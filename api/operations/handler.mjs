import { weekWeather } from "../weather/week.mjs";
import { backend as makeBackend, jsonBody, fail, uuid } from "./access.mjs";
import { createNWS } from "../weather/nws.mjs";
import { privatePhoto, createPhotoAnalyzer } from "./photo-insights.mjs";
import {
  validateCatalog,
  calculateQuote,
  homeownerQuote,
} from "../pricing/quote-engine.mjs";
export function createOperations(options = {}) {
  const b = options.backend || makeBackend(options),
    weather = options.weather || createNWS(options),
    analyze = createPhotoAnalyzer({ ...options, backend: b });
  return async (req, res, send) => {
    const path = req.url.split("?")[0];
    if (!path.startsWith("/api/operations/")) return false;
    try {
      if (req.method !== "POST") throw fail("POST required", 405);
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw fail("Send JSON", 415);
      const input = await jsonBody(req);
      if (
        path === "/api/operations/customer-insights" ||
        path === "/api/operations/respond"
      ) {
        const user = await b.user(req);
        if (path.endsWith("/respond")) {
          if (
            !uuid(input.offer_id) ||
            !["accepted", "declined"].includes(input.choice) ||
            (input.confirm_quote !== true && input.choice === "accepted")
          )
            throw fail("Review and confirm the quote first");
          const result = await b.db("rpc/mow_yard_respond", "POST", {
            actor: user.id,
            offer: input.offer_id,
            choice: input.choice,
          });
          send(200, result);
          return true;
        }
        const access = await b.db(
          "mow_customer_access?select=company_id,customer_id&user_id=eq." +
            user.id,
        );
        const offers = [];
        for (const a of access.slice(0, 20)) {
          offers.push(
            ...(await b.db(
              "mow_yard_offers?select=id,title,description,quote,state,created_at&company_id=eq." +
                a.company_id +
                "&customer_id=eq." +
                a.customer_id +
                "&order=created_at.desc&limit=30",
            )),
          );
        }
        send(200, { offers });
        return true;
      }
      const cid = input.company_id,
        user = await b.owner(req, cid);
      if (path === "/api/operations/week") {
        if (
          typeof input.start_date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(input.start_date) ||
          !Number.isFinite(Date.parse(input.start_date + "T12:00:00Z"))
        )
          throw fail("Choose a valid week start");
        const start = new Date(input.start_date + "T12:00:00Z");
        if (start.toISOString().slice(0, 10) !== input.start_date)
          throw fail("Choose a valid date");
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 6);
        const jobs = await b.db(
          "mow_crew_jobs?select=id,address,service_date,scheduled_time,latitude,longitude&company_id=eq." +
            cid +
            "&service_date=gte." +
            input.start_date +
            "&service_date=lte." +
            end.toISOString().slice(0, 10) +
            "&cancelled_at=is.null&status=in.(scheduled,blocked)&order=service_date.asc&limit=151",
        );
        const visits = await weekWeather(jobs, weather);
        send(200, {
          visits,
          coverage: {
            total: visits.length,
            needsReview: visits.filter((v) => v.status !== "clear").length,
          },
          notice:
            "Forecast guidance only. Original service dates are unchanged. Review field conditions and customer commitments before editing a visit.",
        });
        return true;
      }
      if (path === "/api/operations/weather") {
        if (!uuid(input.job_id)) throw fail("Choose a job");
        const rows = await b.db(
          "mow_crew_jobs?select=id,latitude,longitude&company_id=eq." +
            cid +
            "&id=eq." +
            input.job_id,
        );
        if (!rows[0]) throw fail("Job unavailable", 404);
        send(200, await weather(rows[0].latitude, rows[0].longitude));
        return true;
      }
      if (path === "/api/operations/photo") {
        if (!uuid(input.photo_id)) throw fail("Choose a photo");
        const photos = await b.db(
          "mow_crew_photos?select=storage_path&company_id=eq." +
            cid +
            "&id=eq." +
            input.photo_id,
        );
        if (!photos[0]) throw fail("Photo unavailable", 404);
        const bytes = await privatePhoto(b, photos[0].storage_path);
        send(200, {
          image: "data:image/jpeg;base64," + bytes.toString("base64"),
        });
        return true;
      }
      if (path === "/api/operations/photos") {
        if (!uuid(input.job_id)) throw fail("Choose a visit");
        send(200, {
          photos: await b.db(
            "mow_crew_photos?select=id,created_at&company_id=eq." +
              cid +
              "&job_id=eq." +
              input.job_id +
              "&order=created_at.desc&limit=20",
          ),
        });
        return true;
      }
      const settings = await b.db(
        "mow_owner_settings?select=revision,catalog,labor&company_id=eq." + cid,
      );
      if (path === "/api/operations/settings") {
        send(200, { settings: settings[0] || null });
        return true;
      }
      if (path === "/api/operations/save-settings") {
        if (
          input.confirm_owner_review !== true ||
          !Number.isInteger(input.expected_revision) ||
          input.expected_revision < 0
        )
          throw fail("Review settings before publishing");
        let catalog;
        try {
          catalog = validateCatalog(input.catalog);
        } catch (e) {
          throw fail(e.message);
        }
        if (
          !input.labor ||
          typeof input.labor !== "object" ||
          Array.isArray(input.labor)
        )
          throw fail("Invalid labor settings");
        send(
          200,
          await b.db("rpc/mow_settings_save", "POST", {
            actor: user.id,
            cid,
            expected_revision: input.expected_revision,
            new_catalog: catalog,
            new_labor: input.labor,
          }),
        );
        return true;
      }
      if (path === "/api/operations/link-customer") {
        if (!uuid(input.customer_id) || input.confirm_customer_access !== true)
          throw fail("Confirm customer portal access");
        send(200, {
          ok: await b.db("rpc/mow_customer_link", "POST", {
            actor: user.id,
            cid,
            customer: input.customer_id,
          }),
        });
        return true;
      }
      if (path === "/api/operations/offers") {
        send(200, {
          offers: await b.db(
            "mow_yard_offers?select=id,title,state,quote,customer_id,created_at&company_id=eq." +
              cid +
              "&order=created_at.desc&limit=50",
          ),
        });
        return true;
      }
      if (path === "/api/operations/revoke-customer") {
        if (!uuid(input.customer_id) || input.confirm_customer_access !== true)
          throw fail("Confirm customer access removal");
        await b.db(
          "mow_customer_access?company_id=eq." +
            cid +
            "&customer_id=eq." +
            input.customer_id,
          "DELETE",
        );
        send(200, { ok: true });
        return true;
      }
      if (path === "/api/operations/preview-offer") {
        if (!settings[0]) throw fail("Publish company pricing first", 409);
        let quote;
        try {
          quote = homeownerQuote(
            calculateQuote(settings[0].catalog, input.request),
          );
        } catch (e) {
          throw fail(e.message);
        }
        send(200, { quote });
        return true;
      }
      if (path === "/api/operations/insights") {
        const assessments = await b.db(
            "mow_yard_assessments?select=*&company_id=eq." +
              cid +
              "&order=created_at.desc&limit=30",
          ),
          allowance = await b.db(
            "mow_insight_allowances?select=remaining,enabled&company_id=eq." +
              cid,
          );
        send(200, {
          assessments,
          allowance: allowance[0] || { enabled: false, remaining: 0 },
        });
        return true;
      }
      if (!settings[0]) throw fail("Publish your company pricing first", 409);
      if (path === "/api/operations/analyze") {
        send(200, {
          assessment: await analyze({
            cid,
            user,
            body: input,
            catalog: settings[0].catalog,
          }),
        });
        return true;
      }
      if (path === "/api/operations/publish-offer") {
        if (
          input.confirm_owner_review !== true ||
          !uuid(input.assessment_id) ||
          !uuid(input.offer_id) ||
          typeof input.title !== "string" ||
          !input.title.trim() ||
          input.title.length > 100 ||
          typeof input.description !== "string" ||
          !input.description.trim() ||
          input.description.length > 1000
        )
          throw fail("Review the observation and service scope");
        const a = await b.db(
          "mow_yard_assessments?select=job_id,state&company_id=eq." +
            cid +
            "&id=eq." +
            input.assessment_id,
        );
        if (a[0]?.state !== "owner_review")
          throw fail("Assessment unavailable", 404);
        const jobs = await b.db(
          "mow_crew_jobs?select=customer_id,services&company_id=eq." +
            cid +
            "&id=eq." +
            a[0].job_id,
        );
        if (!jobs[0]?.customer_id)
          throw fail("Connect this job to a customer first", 409);
        const selected = [
          ...(input.request?.serviceIds || []),
          ...(settings[0].catalog.packages.find(
            (p) => p.id === input.request?.packageId,
          )?.serviceIds || []),
        ];
        const included = new Set(
          jobs[0].services.map((s) => s.toLowerCase().trim()),
        );
        if (
          selected.some((id) => {
            const service = settings[0].catalog.services.find(
              (s) => s.id === id,
            );
            return (
              included.has(id.toLowerCase()) ||
              included.has(service?.name.toLowerCase())
            );
          })
        )
          throw fail("This service is already included in the visit");
        let quote;
        try {
          quote = homeownerQuote(
            calculateQuote(settings[0].catalog, input.request),
          );
        } catch (e) {
          throw fail(e.message);
        }
        if (input.expected_total_cents !== quote.perVisitCents)
          throw fail("Quote changed. Review the price again", 409);
        send(
          200,
          await b.db("rpc/mow_yard_publish", "POST", {
            actor: user.id,
            cid,
            aid: input.assessment_id,
            oid: input.offer_id,
            revision: settings[0].revision,
            t: input.title,
            d: input.description,
            q: quote,
          }),
        );
        return true;
      }
      throw fail("Unknown operation", 404);
    } catch (e) {
      send(e.status || 503, {
        error: e.status
          ? e.message
          : "This action could not finish. Refresh and try again.",
      });
    }
    return true;
  };
}
