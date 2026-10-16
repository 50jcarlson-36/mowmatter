// A preference save is the only trigger. Disabled SMS never creates a deferred send.
export function createSMSPreferences({
  backend: b,
  transport,
  routeEnabled = false,
}) {
  return async (preferences) => {
    const claim = await b.db("rpc/mow_sms_preferences_confirm", "POST", {
      ...preferences,
      route_enabled: routeEnabled,
      send_confirmation: transport.configured(),
    });
    if (!claim.claimed) return { ok: true, confirmation: claim.status };
    try {
      const result = await transport.send({
        to: claim.phone,
        idempotencyKey: "opt-in:" + claim.id,
        body: "MowMatter: You requested texts for your selected preferences. Service updates: up to 2 per visit; optional offers: up to 3 per day, only if selected. Message and data rates may apply. Reply HELP for help or STOP to opt out. Support: support@mowmatter.com.",
      });
      await b.db("mow_sms_confirmations?id=eq." + claim.id, "PATCH", {
        status: "accepted",
        provider_id: result.sid,
        updated_at: new Date().toISOString(),
      });
      return { ok: true, confirmation: "accepted" };
    } catch {
      // Never retry an uncertain provider request; the preference was already saved.
      return { ok: true, confirmation: "needs_review" };
    }
  };
}
