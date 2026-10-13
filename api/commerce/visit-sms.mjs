import { fail, uuid } from "../operations/access.mjs";
export function createVisitSMS({ backend: b, transport } = {}) {
  return async ({ user, eventId }) => {
    if (!uuid(eventId)) throw fail("Choose a visit event");
    if (!transport.configured()) return { status: "pending_provider" };
    const claim = await b.db("rpc/mow_visit_sms_claim", "POST", {
      actor: user.id,
      eid: eventId,
    });
    if (!claim.claimed) return { status: claim.status };
    const url =
      "https://office.mowmatter.com/customer-account.html?" +
      new URLSearchParams({
        business: claim.company_id,
        customer: claim.customer_id,
      });
    const body = `${claim.company_name} via MowMatter: ${claim.kind === "arrival" ? "We arrived for your lawn care visit." : "We finished your lawn care visit. View your visit details and photos:"} ${url} Reply STOP to opt out, HELP for help.`;
    try {
      const r = await transport.send({
        to: claim.phone,
        idempotencyKey: "visit:" + claim.id,
        body,
      });
      await b.db("mow_visit_sms_messages?id=eq." + claim.id, "PATCH", {
        status: "accepted",
        provider_id: r.sid,
        updated_at: new Date().toISOString(),
      });
      return { status: "accepted" };
    } catch {
      // An uncertain send is never automatically retried: the provider may have accepted it.
      throw fail("SMS delivery needs review. Your visit was saved.", 503);
    }
  };
}
