import { randomUUID, randomBytes } from "node:crypto";
const fail = (m, s = 400) => Object.assign(Error(m), { status: s });
const uuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const monthlyAmount = (p) => {
  if (
    !Number.isSafeInteger(p.price_cents) ||
    p.price_cents < 1 ||
    ![7, 14, 28].includes(p.interval_days)
  )
    throw fail("Choose a priced recurring service plan");
  return Math.round((p.price_cents * 365.25) / p.interval_days / 12);
};
export function homeownerBilling({
  db,
  stripe,
  ready,
  connected,
  feePlan,
  feeBps,
}) {
  const rows = (cid, cu = "") =>
    db(
      "mow_homeowner_subscriptions?select=*&company_id=eq." +
        cid +
        (cu ? "&customer_id=eq." + cu : ""),
    );
  const portalURL = (cid, cu) =>
    "https://office.mowmatter.com/customer-account.html?" +
    new URLSearchParams({ business: cid, customer: cu });
  async function handle({ pathname, body, cid, user, account, customerRoute }) {
    if (pathname === "/api/billing/prepare-recurring") {
      if (
        !uuid(body.plan_id) ||
        body.confirm_review !== true ||
        typeof body.terms !== "string" ||
        body.terms.trim().length < 3 ||
        body.terms.length > 1500
      )
        throw fail("Review the recurring service terms");
      const plans = await db(
          "mow_service_plans?select=*&company_id=eq." +
            cid +
            "&id=eq." +
            body.plan_id,
        ),
        p = plans[0];
      if (!p?.active) throw fail("Choose an active recurring service plan");
      const existing = (await rows(cid)).find((s) => s.plan_id === p.id);
      if (existing)
        throw fail(
          "A billing proposal already exists for this plan. Do not replace an authorized subscription.",
          409,
        );
      const company = (
        await db("mow_crew_companies?select=name&id=eq." + cid)
      )[0];
      const amount = monthlyAmount(p);
      if (body.expected_monthly_cents !== amount)
        throw fail("Review the calculated monthly total", 409);
      await db(
        "mow_homeowner_subscriptions",
        "POST",
        {
          plan_id: p.id,
          company_id: cid,
          customer_id: p.customer_id,
          monthly_cents: amount,
          terms: body.terms.trim(),
          snapshot: {
            business: company.name,
            per_visit_cents: p.price_cents,
            interval_days: p.interval_days,
            services: p.services,
            first_date: p.first_date,
            prepared_by: user.id,
          },
        },
        "return=minimal",
      );
      return { ok: true, monthly_cents: amount };
    }
    if (pathname === "/api/billing/recurring-status")
      return {
        plans: (await rows(cid, body.customer_id)).map((s) => ({
          plan_id: s.plan_id,
          monthly_cents: s.monthly_cents,
          terms: s.terms,
          snapshot: s.snapshot,
          status: s.status,
          period_end: s.period_end,
          cancel_at_period_end: s.cancel_at_period_end,
          last_invoice_status: s.last_invoice_status,
        })),
        payments_enabled: (await ready()).homeowner_payments_enabled,
      };
    if (
      ![
        "/api/billing/recurring-checkout",
        "/api/billing/recurring-portal",
      ].includes(pathname)
    )
      return null;
    if (!uuid(body.plan_id)) throw fail("Choose a recurring plan");
    let s = (await rows(cid, body.customer_id)).find(
      (s) => s.plan_id === body.plan_id,
    );
    if (!s) throw fail("Plan unavailable", 404);
    if (!(await ready()).homeowner_payments_enabled)
      throw fail("Recurring payments are awaiting payment activation", 503);
    const connection = await connected(account);
    if (!connection?.payments_ready || !connection.payouts_ready)
      throw fail("Your provider must finish payment verification", 409);
    const opts = { stripeAccount: connection.account_id };
    if (pathname === "/api/billing/recurring-portal") {
      if (!s.stripe_customer || !s.subscription_id)
        throw fail("No subscription to manage yet");
      // Connected-account configuration is created on demand, with period-end cancellation and payment updates.
      const configuration = await stripe.billingPortal.configurations.create(
        {
          business_profile: {
            headline: "Manage your lawn care subscription",
            privacy_policy_url: "https://mowmatter.com/privacy.html",
            terms_of_service_url: "https://mowmatter.com/service-terms.html",
          },
          features: {
            customer_update: { enabled: false },
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            subscription_cancel: { enabled: true, mode: "at_period_end" },
          },
        },
        {
          ...opts,
          idempotencyKey:
            "mow-homeowner-portal-" + connection.account_id + "-v1",
        },
      );
      const portal = await stripe.billingPortal.sessions.create(
        {
          customer: s.stripe_customer,
          configuration: configuration.id,
          return_url: portalURL(cid, body.customer_id),
        },
        opts,
      );
      return { url: portal.url };
    }
    if (
      body.confirm_recurring !== true ||
      body.notice_version !== "2026-10-11" ||
      body.expected_monthly_cents !== s.monthly_cents
    )
      throw fail("Review the monthly amount and recurring authorization");
    if (s.subscription_id) throw fail("Manage your existing subscription", 409);
    if (s.checkout_session) {
      const old = await stripe.checkout.sessions.retrieve(
        s.checkout_session,
        {},
        opts,
      );
      if (old.status === "open" && old.url) return { url: old.url };
      if (old.status === "complete")
        throw fail("Subscription confirmation is pending", 409);
    }
    const nonce = randomUUID();
    const claimed = await db("rpc/mow_homeowner_checkout_claim", "POST", {
      pid: s.plan_id,
      cid,
      customer: body.customer_id,
      actor: user.id,
      actor_email: user.email,
      token: nonce,
    });
    if (!claimed) throw fail("Checkout is already being prepared", 409);
    if (!s.stripe_customer) {
      const customer = (
        await db(
          "mow_customers?select=name,email&company_id=eq." +
            cid +
            "&id=eq." +
            body.customer_id,
        )
      )[0];
      const made = await stripe.customers.create(
        {
          name: customer.name,
          email: customer.email,
          metadata: {
            mowmatter_customer: body.customer_id,
            mowmatter_company: cid,
          },
        },
        {
          ...opts,
          idempotencyKey: "mow-homeowner-" + cid + "-" + body.customer_id,
        },
      );
      s.stripe_customer = made.id;
      await db(
        "mow_homeowner_subscriptions?company_id=eq." +
          cid +
          "&plan_id=eq." +
          s.plan_id,
        "PATCH",
        { stripe_customer: made.id },
        "return=minimal",
      );
    }
    const subscriptions = await stripe.subscriptions.list(
      { customer: s.stripe_customer, status: "all", limit: 100 },
      opts,
    );
    if (
      subscriptions.data.some(
        (x) => !["canceled", "incomplete_expired"].includes(x.status),
      )
    )
      throw fail(
        "An existing subscription needs review before another can be started",
        409,
      );
    const suffix = [...randomBytes(8)]
      .map((n) => String.fromCharCode(97 + (n % 26)))
      .join("");
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: s.stripe_customer,
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: s.monthly_cents,
              recurring: { interval: "month" },
              product_data: {
                name: s.snapshot.business + " — recurring lawn care",
                description:
                  "Service every " +
                  s.snapshot.interval_days +
                  " days. Fixed monthly billing.",
              },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          application_fee_percent: feeBps[feePlan(account)] / 100,
          metadata: {
            mowmatter_homeowner_plan: s.plan_id,
            mowmatter_company: cid,
          },
        },
        metadata: { mowmatter_homeowner_plan: s.plan_id },
        custom_text: {
          submit: {
            message:
              "Renews monthly until canceled. Manage cancellation in your customer account; cancellation takes effect at the end of the paid period. Additional work requires separate approval.",
          },
        },
        integration_identifier: "mowmatter_recurring_" + suffix,
        expires_at: Math.floor(Date.now() / 1000) + 1800,
        success_url: portalURL(cid, body.customer_id) + "&payment=returned",
        cancel_url: portalURL(cid, body.customer_id) + "&payment=cancelled",
      },
      { ...opts, idempotencyKey: "mow-recurring-" + nonce },
    );
    await db(
      "mow_homeowner_subscriptions?company_id=eq." +
        cid +
        "&plan_id=eq." +
        s.plan_id +
        "&nonce=eq." +
        nonce,
      "PATCH",
      { checkout_session: session.id },
      "return=minimal",
    );
    return { url: session.url };
  }
  async function sync(event, cid) {
    const o = event.data.object;
    let sid =
      o.object === "subscription"
        ? o.id
        : o.object === "checkout.session"
          ? o.subscription
          : o.parent?.subscription_details?.subscription || o.subscription;
    if (typeof sid === "object") sid = sid?.id;
    if (!sid) return false;
    const sub = await stripe.subscriptions.retrieve(
      sid,
      { expand: ["latest_invoice"] },
      { stripeAccount: event.account },
    );
    const pid = sub.metadata?.mowmatter_homeowner_plan;
    if (!uuid(pid)) return false;
    const s = (await rows(cid)).find((s) => s.plan_id === pid);
    if (
      !s ||
      sub.metadata.mowmatter_company !== cid ||
      s.stripe_customer !== sub.customer ||
      (s.subscription_id && s.subscription_id !== sub.id)
    )
      throw fail("Subscription record mismatch", 409);
    const item = sub.items?.data?.[0];
    if (
      item?.price?.unit_amount !== s.monthly_cents ||
      item?.price?.currency !== "usd" ||
      item?.price?.recurring?.interval !== "month"
    )
      throw fail("Subscription price mismatch", 409);
    await db("rpc/mow_homeowner_sync", "POST", {
      eid: event.id,
      etype: event.type,
      ec: event.created,
      pid,
      cid,
      subid: sub.id,
      scustomer: sub.customer,
      new_state: sub.status,
      pstart: item?.current_period_start ?? sub.current_period_start ?? null,
      pend: item?.current_period_end ?? sub.current_period_end ?? null,
      cancel_end: !!sub.cancel_at_period_end,
      invoice_state: sub.latest_invoice?.status || null,
    });
    return true;
  }
  return { handle, sync };
}
