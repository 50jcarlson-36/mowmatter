import { fail, uuid } from "../operations/access.mjs";
import { createBirdSMS } from "./bird.mjs";
import {
  nextSendTime,
  quietHoursConfig,
  recipientTimeZone,
} from "./quiet-hours.mjs";
import { createRouteNotices } from "./route-notices.mjs";
import { createSMSPreferences } from "./sms-preferences.mjs";
import { createVisitSMS } from "./visit-sms.mjs";
export function createSMS(options = {}) {
  const b = options.backend;
  const env = options.env || process.env;
  const bird = createBirdSMS(options);
  const configured = bird.configured;
  const hours = quietHoursConfig(env);
  const now = options.now || (() => new Date());
  // Offer texts honor recipient-local quiet hours (see quiet-hours.mjs, pending legal review).
  // Arrival/completion texts in visit-sms.mjs are intentionally not gated yet.
  const deferral = (claim) =>
    nextSendTime(
      now(),
      recipientTimeZone(
        { customer: claim.time_zone, business: claim.business_time_zone },
        hours.fallbackTimeZone,
      ),
      hours,
    );
  async function deliverQuote({
    cid,
    quoteId,
    phone,
    customerId,
    companyName,
    amountCents,
  }) {
    const url =
      "https://office.mowmatter.com/customer-account.html?" +
      new URLSearchParams({ business: cid, customer: customerId });
    const message = `${companyName} via MowMatter: Optional additional service, $${(amountCents / 100).toFixed(2)}. Review scope and approve or decline: ${url} No charge from this text. Reply STOP to opt out, HELP for help.`;
    const r = await bird.send({
      to: phone,
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
  }
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
      await b.db(
        "mow_crew_companies?select=name,communication_timezone&id=eq." + cid,
      )
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
    const sendAfter = deferral({
      ...claim,
      business_time_zone: company.communication_timezone,
    });
    if (sendAfter) {
      await b.db(
        "mow_quote_messages?quote_id=eq." + quoteId + "&company_id=eq." + cid,
        "PATCH",
        {
          status: "deferred",
          send_after: sendAfter.toISOString(),
          updated_at: new Date().toISOString(),
        },
      );
      return {
        ok: true,
        status: "deferred",
        send_after: sendAfter.toISOString(),
      };
    }
    // Do not retry uncertain sends: provider may have accepted the message before a timeout.
    try {
      await deliverQuote({
        cid,
        quoteId,
        phone: claim.phone,
        customerId: claim.customer_id,
        companyName: company.name,
        amountCents: quote.amount_cents,
      });
      return { ok: true, status: "accepted" };
    } catch (e) {
      throw fail(
        "Message delivery needs review before retrying. The quote remains available in the customer account.",
        503,
      );
    }
  }
  // Worker step: sends one deferred offer whose window has opened. The claim RPC rechecks
  // consent, STOP and quote validity at send time.
  async function sendDeferredQuote() {
    if (!configured()) return { status: "pending_provider" };
    const claim = await b.db("rpc/mow_quote_sms_claim_due", "POST", {});
    if (!claim.claimed) return { status: claim.status || "idle" };
    const sendAfter = deferral(claim);
    if (sendAfter) {
      await b.db("mow_quote_messages?quote_id=eq." + claim.quote_id, "PATCH", {
        status: "deferred",
        send_after: sendAfter.toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { status: "deferred" };
    }
    try {
      await deliverQuote({
        cid: claim.company_id,
        quoteId: claim.quote_id,
        phone: claim.phone,
        customerId: claim.customer_id,
        companyName: claim.company_name,
        amountCents: claim.amount_cents,
      });
      return { status: "accepted" };
    } catch {
      // Left in sending for review: never automatically retry an uncertain provider request.
      return { status: "needs_review" };
    }
  }
  return {
    sendQuote,
    sendDeferredQuote,
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
