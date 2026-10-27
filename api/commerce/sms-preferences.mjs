// A preference save is the only trigger. Disabled SMS never creates a deferred send.
export function createSMSPreferences({
  backend: b,
  transport,
  routeEnabled = false,
}) {
  return async (preferences) => {
    if (transport.syncPreferences) {
      // Verify ownership and persist the exact category choices before any provider write.
      await b.db("rpc/mow_sms_preferences_confirm", "POST", {
        ...preferences,
        route_enabled: routeEnabled,
        send_confirmation: false,
      });
      const anyConsent =
        preferences.consent ||
        preferences.service_consent ||
        (routeEnabled && preferences.route_consent);
      if (!anyConsent) return { ok: true, confirmation: "no_consent" };
      let sync;
      try {
        sync = await transport.syncPreferences({
          phone: preferences.p_phone,
          companyId: preferences.cid,
          customerId: preferences.customer,
          marketing: preferences.consent,
          service:
            preferences.service_consent ||
            (routeEnabled && preferences.route_consent),
        });
      } catch {
        return { ok: true, confirmation: "provider_sync_failed" };
      }
      if (sync.status === "provider_opt_out") {
        await b.db("rpc/mow_sms_stop", "POST", {
          p_phone: preferences.p_phone,
        });
        return { ok: true, confirmation: "provider_opt_out" };
      }
      if (sync.status !== "ready")
        return { ok: true, confirmation: sync.status };
    }
    const claim = await b.db("rpc/mow_sms_preferences_confirm", "POST", {
      ...preferences,
      route_enabled: routeEnabled,
      send_confirmation: transport.configured(),
    });
    if (!claim.claimed) return { ok: true, confirmation: claim.status };
    try {
      const result = await transport.send({
        to: claim.phone,
        companyId: preferences.cid,
        customerId: preferences.customer,
        kind: "opt_in_confirmation",
        category: preferences.consent ? "marketing" : "service",
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
