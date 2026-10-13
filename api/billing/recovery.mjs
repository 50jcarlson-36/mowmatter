import { randomUUID } from "node:crypto";
const fail = (message, status = 503) =>
  Object.assign(Error(message), { status });
const checkoutTypes = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
]);
export function paymentRecovery({ db, stripe, now = Date.now }) {
  async function receive(event) {
    // Keep only routing information; Stripe remains the source of payment/customer data.
    await db(
      "mow_webhook_inbox?on_conflict=event_id",
      "POST",
      {
        event_id: event.id,
        event_type: event.type,
        account_id: event.account || null,
        object_id: event.data.object.id,
        event_created: event.created,
        livemode: event.livemode,
      },
      "resolution=ignore-duplicates,return=minimal",
    );
  }
  async function finish(event) {
    await db(
      "mow_webhook_inbox?event_id=eq." + encodeURIComponent(event.id),
      "PATCH",
      { processed_at: new Date(now()).toISOString() },
      "return=minimal",
    );
  }
  async function apply(event, session, cid) {
    if (!checkoutTypes.has(event.type))
      throw fail("Unexpected payment event", 409);
    const applied = await db("rpc/mow_payment_reconcile", "POST", {
      eid: event.id,
      etype: event.type,
      ec: event.created,
      cid,
      sid: session.id,
      jid: session.metadata?.mowmatter_job || null,
      token: session.metadata?.mowmatter_attempt || null,
      amount: session.amount_total,
      currency: session.currency,
      account: event.account,
      state:
        session.payment_status === "paid"
          ? "paid"
          : event.type === "checkout.session.async_payment_failed"
            ? "failed"
            : "pending",
    });
    if (applied !== true)
      throw fail("Payment mapping is pending; retry this event");
  }
  async function checkout({
    job,
    cid,
    account,
    plan,
    bps,
    fee,
    success_url,
    cancel_url,
  }) {
    let row = (
      await db(
        "mow_payment_checkouts?select=*&company_id=eq." +
          cid +
          "&job_id=eq." +
          job.id,
      )
    )[0];
    if (row?.status === "paid")
      throw fail("This visit has already been paid", 409);
    if (row && row.amount_cents !== job.price_cents)
      throw fail("Payment amount changed. Contact your provider.", 409);
    if (row?.session_id) {
      const old = await stripe.checkout.sessions.retrieve(
        row.session_id,
        {},
        { stripeAccount: account },
      );
      if (old.status === "open" && old.url) return { url: old.url };
      if (old.status !== "expired")
        throw fail("Payment confirmation is pending", 409);
      // Only a Stripe-confirmed expiration permits another attempt. Time alone never does.
      await db("rpc/mow_payment_expire", "POST", {
        jid: job.id,
        cid,
        sid: old.id,
      });
      row = null;
    }
    if (!row) {
      const nonce = randomUUID();
      await db("rpc/mow_payment_claim", "POST", {
        jid: job.id,
        cid,
        token: nonce,
        amount: job.price_cents,
        bps,
        fee,
      });
      row = (
        await db(
          "mow_payment_checkouts?select=*&company_id=eq." +
            cid +
            "&job_id=eq." +
            job.id,
        )
      )[0];
    }
    if (!row || row.status === "paid")
      throw fail("Payment record is unavailable or already paid", 409);
    const request = {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: row.amount_cents,
            product_data: { name: "Completed lawn care visit" },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: row.fee_cents,
        metadata: {
          mowmatter_job: job.id,
          fee_bps: String(row.fee_bps),
          fee_plan: plan,
        },
      },
      metadata: { mowmatter_job: job.id, mowmatter_attempt: row.nonce },
      success_url,
      cancel_url,
    };
    // The DB chooses the first immutable payload, including return URLs and fee snapshot.
    const attempt = await db("rpc/mow_payment_prepare", "POST", {
      jid: job.id,
      cid,
      token: row.nonce,
      account,
      request,
    });
    if (!attempt?.request)
      throw fail(
        "This earlier attempt needs payment recovery before another link can be created",
        409,
      );
    if (attempt.session_id) {
      const existing = await stripe.checkout.sessions.retrieve(
        attempt.session_id,
        {},
        { stripeAccount: attempt.account_id },
      );
      if (existing.status === "open" && existing.url)
        return { url: existing.url };
      throw fail("Payment confirmation is pending", 409);
    }
    // Stripe may prune keys after 24h. Never recreate an unknown result beyond that window.
    if (now() - Date.parse(attempt.created_at) >= 23 * 3600000)
      throw fail(
        "This payment attempt needs reconciliation before another can be started",
        409,
      );
    const session = await stripe.checkout.sessions.create(attempt.request, {
      stripeAccount: attempt.account_id,
      idempotencyKey: "mowmatter-job-" + row.nonce,
    });
    const bound = await db("rpc/mow_payment_bind", "POST", {
      jid: job.id,
      cid,
      token: row.nonce,
      sid: session.id,
    });
    if (bound !== true)
      throw fail(
        "Payment reference is pending. Retry to recover the existing link",
      );
    if (!session.url) throw fail("Payment confirmation is pending", 409);
    return { url: session.url };
  }
  return { receive, finish, apply, checkout };
}
