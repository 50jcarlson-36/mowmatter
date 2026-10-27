export function routeNoticeBody(claim) {
  const p = claim.payload || {};
  const url =
    "https://office.mowmatter.com/customer-account.html?" +
    new URLSearchParams({
      business: claim.company_id,
      customer: claim.customer_id,
      visit: claim.job_id,
    }) +
    "#service-today";
  const text =
    claim.kind === "approaching"
      ? `${p.ahead === 2 ? "We're two stops away" : "You're next on our route"}. Please unlock your gate and bring pets inside. We'll confirm when work starts.`
      : claim.kind === "cancelled"
        ? `Your lawn visit on ${p.date} was cancelled. ${p.reason || "Contact your provider to arrange your next visit."} Review service and billing details in your account.`
        : `Your lawn visit is now scheduled for ${p.date} at ${String(p.time).slice(0, 5)} (your property's local time). View the change or request another day in your account. This notice does not authorize an extra charge.`;
  return `${claim.company_name} — powered by Mowmatter: ${text} ${url} Reply STOP to opt out, HELP for help.`;
}
export function createRouteNotices({ backend, transport }) {
  return async () => {
    if (!transport.configured()) return { status: "pending_provider" };
    const claim = await backend.db("rpc/mow_route_notice_claim", "POST", {});
    if (!claim.claimed) return { status: "idle" };
    try {
      const result = await transport.send({
        to: claim.phone,
        companyId: claim.company_id,
        customerId: claim.customer_id,
        kind: claim.kind,
        idempotencyKey: "route:" + claim.id,
        body: routeNoticeBody(claim),
      });
      await backend.db("mow_route_notices?id=eq." + claim.id, "PATCH", {
        status: "accepted",
        provider_id: result.sid,
        updated_at: new Date().toISOString(),
      });
      return { status: "accepted" };
    } catch {
      // Keep the claim in sending: acceptance may have occurred before a timeout.
      // Never automatically retry an uncertain provider request.
      return { status: "needs_review" };
    }
  };
}
export function startRouteNoticeWorker(
  send,
  { intervalMs = 15000, onError = () => {} } = {},
) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      for (let i = 0; i < 20; i++) {
        const result = await send();
        if (result.status !== "accepted") break;
      }
    } catch {
      onError("Route notification processing unavailable");
    } finally {
      busy = false;
    }
  };
  void tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
