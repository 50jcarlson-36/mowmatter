import { fail, uuid } from "../operations/access.mjs";
import { createBirdSMS } from "./bird.mjs";
import { createRouteNotices } from "./route-notices.mjs";
import { createSMSPreferences } from "./sms-preferences.mjs";
import { createVisitSMS } from "./visit-sms.mjs";
export function createSMS(options = {}) {
  const b = options.backend;
  const env = options.env || process.env;
  const bird = createBirdSMS(options);
  const configured = bird.configured;
  async function sendQuote({ cid, user, quoteId }) {
    if (!configured())
      throw fail(
        "SMS is awaiting provider configuration and registration approval",
        503,
      );
    if (!uuid(quoteId)) throw fail("Choose a quote");
    const quote = (
      await b.db(
        "mow_customer_quotes?select=id,title,amount_cents&company_id=eq." +
          cid +
          "&id=eq." +
          quoteId,
      )
    )[0];
    if (!quote) throw fail("Quote unavailable", 404);
    const company = (
      await b.db("mow_crew_companies?select=name&id=eq." + cid)
    )[0];
    const claim = await b.db("rpc/mow_quote_sms_claim", "POST", {
      qid: quoteId,
      cid,
      actor: user.id,
    });
    if (!claim.claimed)
      throw fail(
        "This quote message was already sent or needs delivery review",
        409,
      );
    const url =
      "https://office.mowmatter.com/customer-account.html?" +
      new URLSearchParams({ business: cid, customer: claim.customer_id });
    const message = `${company.name} via MowMatter: Optional additional service, $${(quote.amount_cents / 100).toFixed(2)}. Review scope and approve or decline: ${url} No charge from this text. Reply STOP to opt out, HELP for help.`;
    // Do not retry uncertain sends: provider may have accepted the message before a timeout.
    try {
      const r = await bird.send({
        to: claim.phone,
        body: message,
        category: "marketing",
        idempotencyKey: "quote:" + cid + ":" + quoteId,
      });
      await b.db(
        "mow_quote_messages?quote_id=eq." + quoteId + "&company_id=eq." + cid,
        "PATCH",
        {
          status: "accepted",
          provider_id: r.sid,
          updated_at: new Date().toISOString(),
        },
      );
      return { ok: true, status: "accepted" };
    } catch (e) {
      throw fail(
        "Message delivery needs review before retrying. The quote remains available in the customer account.",
        503,
      );
    }
  }
  return {
    sendQuote,
    savePreferences: createSMSPreferences({
      backend: b,
      transport: bird,
      routeEnabled: env.MOW_ROUTE_NOTICES_ENABLED === "true",
    }),
    sendRouteNotice: createRouteNotices({
      backend: b,
      transport:
        env.MOW_ROUTE_NOTICES_ENABLED === "true"
          ? bird
          : { configured: () => false },
    }),
    sendVisit: createVisitSMS({ backend: b, transport: bird }),
    webhook: bird.webhook,
    configured,
    status: () => ({
      provider: "bird",
      ready: configured(),
      route_notices_enabled:
        env.MOW_ROUTE_NOTICES_ENABLED === "true" && configured(),
      missing: bird.missing(),
    }),
  };
}
