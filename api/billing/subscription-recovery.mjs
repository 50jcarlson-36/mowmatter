const fail = (m) => Object.assign(Error(m), { status: 409 });
export function subscriptionRecovery({ db, stripe, now = Date.now }) {
  return async ({
    cid,
    nonce,
    kind,
    subject,
    account = null,
    request = null,
  }) => {
    const attempt = await db("rpc/mow_subscription_prepare", "POST", {
      cid,
      token: nonce,
      kind,
      subject,
      account,
      request,
    });
    if (!attempt?.request)
      throw fail(
        "An earlier checkout needs reconciliation before another can be started",
      );
    const opts = {
      ...(attempt.account_id ? { stripeAccount: attempt.account_id } : {}),
      idempotencyKey: "mow-subscription-" + nonce,
    };
    if (attempt.session_id) {
      const existing = await stripe.checkout.sessions.retrieve(
        attempt.session_id,
        {},
        attempt.account_id ? { stripeAccount: attempt.account_id } : {},
      );
      if (existing.status === "open" && existing.url)
        return { url: existing.url };
      throw fail("Subscription confirmation is pending");
    }
    if (now() - Date.parse(attempt.created_at) >= 23 * 3600000)
      throw fail(
        "This checkout needs reconciliation before another can be started",
      );
    const session = await stripe.checkout.sessions.create(
      attempt.request,
      opts,
    );
    const bound = await db("rpc/mow_subscription_bind", "POST", {
      cid,
      token: nonce,
      sid: session.id,
    });
    if (bound !== true)
      throw fail(
        "Checkout reference is pending. Retry to recover the existing link",
      );
    if (!session.url) throw fail("Subscription confirmation is pending");
    return { url: session.url };
  };
}
