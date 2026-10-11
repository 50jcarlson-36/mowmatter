import { createTwilioSMS } from "./twilio.mjs";
import { createVisitSMS } from "./visit-sms.mjs";
import { createVonage } from "./vonage.mjs";
export function createSMS(options = {}) {
  const env = options.env || process.env;
  const provider =
    env.MOW_SMS_PROVIDER ||
    (env.VONAGE_API_KEY || env.VONAGE_APPLICATION_ID ? "vonage" : "twilio");
  const vonage = createVonage(options);
  const supported = ["vonage", "twilio"].includes(provider);
  const base = createTwilioSMS({
    ...options,
    transport:
      provider === "vonage"
        ? vonage
        : !supported
          ? { configured: () => false }
          : undefined,
  });
  return {
    ...base,
    sendVisit: createVisitSMS({
      backend: options.backend,
      transport: provider === "vonage" ? vonage : { configured: () => false },
    }),
    webhook: async (req, res) =>
      (await vonage.webhook(req, res)) || (await base.webhook(req, res)),
    status: () => ({
      provider,
      ready: supported && base.configured(),
      ...(provider === "vonage" ? { missing: vonage.missing() } : {}),
    }),
  };
}
