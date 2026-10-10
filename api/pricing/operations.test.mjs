import test from "node:test";
import assert from "node:assert/strict";
import { createNWS, classifyHour, coordinates } from "../weather/nws.mjs";
import {
  validateAssessment,
  normalizedImage,
  createPhotoAnalyzer,
} from "../operations/photo-insights.mjs";
import { createOperations } from "../operations/handler.mjs";
import { backend } from "../operations/access.mjs";
import { Readable } from "node:stream";
const now = () => Date.parse("2026-10-10T14:00:00Z");
const hour = {
  startTime: "2026-10-10T14:00:00Z",
  endTime: "2026-10-10T15:00:00Z",
  temperature: 84,
  temperatureUnit: "F",
  probabilityOfPrecipitation: { value: 10 },
  windSpeed: "5 to 10 mph",
  shortForecast: "Sunny",
};
const cid = "11111111-1111-4111-8111-111111111111",
  uid = "22222222-2222-4222-8222-222222222222",
  pid = "33333333-3333-4333-8333-333333333333";
const output = {
  summary: "Visible lawn observations",
  findings: [
    {
      id: "one",
      photoId: pid,
      observation: "Grass extends over an edge",
      uncertainty: "Scope needs review",
      confidence: "supported",
      possibleIdentification: "",
      serviceId: "edging",
      inventedPrice: 50000,
    },
  ],
};
test("weather coordinates reject strings and nonfinite values", () => {
  for (const pair of [
    ["29", -81],
    [NaN, -81],
    [100, -81],
    [29, Infinity],
  ])
    assert.throws(() => coordinates(...pair));
  assert.deepEqual(coordinates(29.50001, -81.20001), [29.5, -81.2]);
});
test("thunderstorms and severe active alerts block planning; unknown fields require review", () => {
  assert.equal(
    classifyHour({ ...hour, shortForecast: "Thunderstorms" }, [], now()).status,
    "blocked",
  );
  assert.equal(
    classifyHour(
      hour,
      [
        {
          severity: "Severe",
          effective: "2026-10-10T13:00:00Z",
          expires: "2026-10-10T16:00:00Z",
        },
      ],
      now(),
    ).status,
    "blocked",
  );
  assert.equal(
    classifyHour({ ...hour, temperature: null }, [], now()).status,
    "review",
  );
  assert.equal(classifyHour(hour, [], now()).status, "clear");
});
test("weather caches successful responses and coalesces concurrent calls", async () => {
  let calls = 0;
  const forecast = createNWS({
    now,
    fetcher: async (url) => {
      calls++;
      return {
        ok: true,
        json: async () =>
          String(url).includes("/points/")
            ? {
                properties: {
                  timeZone: "America/New_York",
                  forecastHourly:
                    "https://api.weather.gov/gridpoints/JAX/1,1/forecast/hourly",
                },
              }
            : String(url).includes("/alerts/")
              ? { features: [] }
              : {
                  properties: {
                    updated: "2026-10-10T13:00:00Z",
                    periods: [hour],
                  },
                },
      };
    },
  });
  const [a, b] = await Promise.all([
    forecast(29.5, -81.2),
    forecast(29.5, -81.2),
  ]);
  assert.equal(calls, 3);
  assert.equal(a, b);
  await forecast(29.5, -81.2);
  assert.equal(calls, 3);
});
test("provider forecast URL cannot redirect requests to private hosts", async () => {
  const forecast = createNWS({
    now,
    fetcher: async () => ({
      ok: true,
      json: async () => ({
        properties: {
          timeZone: "America/New_York",
          forecastHourly: "http://127.0.0.1/secrets",
        },
      }),
    }),
  });
  await assert.rejects(forecast(29.5, -81.2), /Invalid weather/);
});
test("stale weather never becomes a clear forecast", async () => {
  const forecast = createNWS({
    now,
    fetcher: async (url) => ({
      ok: true,
      json: async () =>
        String(url).includes("/points/")
          ? {
              properties: {
                timeZone: "America/New_York",
                forecastHourly:
                  "https://api.weather.gov/gridpoints/JAX/1,1/forecast/hourly",
              },
            }
          : String(url).includes("/alerts/")
            ? { features: [] }
            : {
                properties: {
                  updated: "2026-10-09T13:00:00Z",
                  periods: [hour],
                },
              },
    }),
  });
  await assert.rejects(forecast(29.5, -81.2), /stale/);
});
test("photo findings cannot invent photos, services or public prices", () => {
  const result = validateAssessment(output, [pid], ["edging"]);
  assert.equal(result.findings[0].inventedPrice, undefined);
  assert.equal(result.requiresOwnerReview, true);
  assert.throws(() => validateAssessment(output, [], ["edging"]));
  assert.throws(() => validateAssessment(output, [pid], []));
});
test("image decoding strips metadata and rejects unsupported payloads", async () => {
  const { default: sharp } = await import("sharp");
  const image = await sharp({
    create: { width: 2400, height: 100, channels: 3, background: "green" },
  })
    .withMetadata()
    .png()
    .toBuffer();
  const normalized = await normalizedImage(image);
  const m = await sharp(normalized).metadata();
  assert.equal(m.format, "jpeg");
  assert.equal(m.width, 1600);
  assert.equal(m.exif, undefined);
  await assert.rejects(normalizedImage(Buffer.from("not an image")));
});
test("disabled photo analysis does not reserve credits or invoke a model", async () => {
  let calls = 0;
  const analyze = createPhotoAnalyzer({
    env: {},
    backend: { db: () => calls++ },
    generate: () => calls++,
  });
  await assert.rejects(
    analyze({ cid, user: { id: uid }, body: {}, catalog: { services: [] } }),
    /activation/,
  );
  assert.equal(calls, 0);
});
test("duplicate completed photo request returns stored result without provider call", async () => {
  let calls = 0;
  const analyze = createPhotoAnalyzer({
    env: {
      PHOTO_INSIGHTS_ENABLED: "true",
      AI_GATEWAY_API_KEY: "fake",
      PHOTO_INSIGHTS_MODEL: "configured",
      PHOTO_INSIGHTS_DAILY_LIMIT: "10",
    },
    backend: {
      db: async () => ({
        claimed: false,
        state: "owner_review",
        result: output,
      }),
    },
    generate: () => calls++,
  });
  assert.deepEqual(
    await analyze({
      cid,
      user: { id: uid },
      body: {
        job_id: pid,
        request_id: uid,
        photo_ids: [pid],
        confirm_analysis: true,
      },
      catalog: { services: [{ id: "edging" }] },
    }),
    output,
  );
  assert.equal(calls, 0);
});
async function call(handler, action, input) {
  const req = Readable.from([Buffer.from(JSON.stringify(input))]);
  req.url = "/api/operations/" + action;
  req.method = "POST";
  req.headers = {
    "content-type": "application/json",
    authorization: "Bearer fake",
  };
  let result;
  await handler(req, {}, (status, body) => {
    result = { status, body };
  });
  return result;
}
test("owner denial prevents reading settings or weather provider calls", async () => {
  let calls = 0;
  const handler = createOperations({
    backend: {
      owner: async () => {
        throw Object.assign(Error("Denied"), { status: 403 });
      },
      db: () => calls++,
    },
    weather: () => calls++,
  });
  assert.equal(
    (await call(handler, "weather", { company_id: cid, job_id: pid })).status,
    403,
  );
  assert.equal(calls, 0);
});
test("homeowner reads only explicitly linked customer offers", async () => {
  const paths = [];
  const handler = createOperations({
    backend: {
      user: async () => ({ id: uid }),
      db: async (path) => {
        paths.push(path);
        return path.startsWith("mow_customer_access")
          ? [{ company_id: cid, customer_id: pid }]
          : [];
      },
    },
  });
  assert.equal((await call(handler, "customer-insights", {})).status, 200);
  assert(paths[1].includes("company_id=eq." + cid));
  assert(paths[1].includes("customer_id=eq." + pid));
  assert(!paths[1].includes("result"));
});
test("homeowner acceptance requires explicit quote confirmation", async () => {
  let calls = 0;
  const handler = createOperations({
    backend: { user: async () => ({ id: uid }), db: () => calls++ },
  });
  assert.equal(
    (await call(handler, "respond", { offer_id: pid, choice: "accepted" }))
      .status,
    400,
  );
  assert.equal(calls, 0);
});
test("owner settings must be approved and revisioned", async () => {
  const handler = createOperations({
    backend: { owner: async () => ({ id: uid }), db: async () => [] },
  });
  assert.equal(
    (await call(handler, "save-settings", { company_id: cid, catalog: {} }))
      .status,
    400,
  );
});
test("secret database keys are not sent as JWT bearer tokens", () => {
  const b = backend({ env: { SUPABASE_SECRET_KEY: "sb_secret_test" } });
  assert.equal(b.headers().Authorization, undefined);
  assert.equal(b.headers().apikey, "sb_secret_test");
});

test("API quote engine and Office engine remain identical", async () => {
  const { readFile } = await import("node:fs/promises");
  assert.equal(
    await readFile(new URL("./quote-engine.mjs", import.meta.url), "utf8"),
    await readFile(
      new URL("../../office/dist/pricing-engine.mjs", import.meta.url),
      "utf8",
    ),
  );
});
test("unauthorized homeowner cannot respond without authenticated identity", async () => {
  let writes = 0;
  const handler = createOperations({
    backend: {
      user: async () => {
        throw Object.assign(Error("Sign in"), { status: 401 });
      },
      db: () => writes++,
    },
  });
  assert.equal(
    (
      await call(handler, "respond", {
        offer_id: pid,
        choice: "accepted",
        confirm_quote: true,
      })
    ).status,
    401,
  );
  assert.equal(writes, 0);
});

import { dailyRisk, weekWeather } from "../weather/week.mjs";
test("weekly review accounts for missing coordinates and provider failure without dropping visits", async () => {
  const jobs = [
    { id: "one", service_date: "2026-10-10", latitude: null, longitude: null },
    { id: "two", service_date: "2026-10-10", latitude: 29.5, longitude: -81.2 },
  ];
  const result = await weekWeather(jobs, async () => {
    throw Error("provider offline");
  });
  assert.equal(result.length, 2);
  assert(result.every((v) => v.status === "review" && v.unchanged));
});
test("daily review uses company-local daytime and requires forecast coverage", () => {
  const hours = Array.from({ length: 11 }, (_, i) => ({
    ...classifyHour(hour, []),
    start: `2026-10-10T${String(11 + i).padStart(2, "0")}:00:00Z`,
    status: i === 3 ? "blocked" : "clear",
  }));
  assert.equal(
    dailyRisk({ timeZone: "America/New_York", hours }, "2026-10-10").status,
    "blocked",
  );
  assert.equal(
    dailyRisk({ timeZone: "America/New_York", hours: [] }, "2026-10-10").status,
    "review",
  );
});

test("direct OpenAI sends private normalized images and strict nonstored output", async () => {
  const { directOpenAI } = await import("../operations/photo-insights.mjs");
  const result = await directOpenAI({
    env: {
      OPENAI_API_KEY: "test-secret",
      PHOTO_INSIGHTS_MODEL: "openai/configured",
    },
    images: [{ id: pid, bytes: Buffer.from("jpeg") }],
    pids: [pid],
    serviceIds: [],
    catalog: { services: [] },
    fetcher: async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(options.headers.Authorization, "Bearer test-secret");
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.model, "configured");
      assert.equal(body.text.format.strict, true);
      assert.match(
        body.input[0].content[2].image_url,
        /^data:image\/jpeg;base64,/,
      );
      return Response.json({
        status: "completed",
        output: [
          { content: [{ type: "output_text", text: JSON.stringify(output) }] },
        ],
      });
    },
  });
  assert.deepEqual(result, output);
});
test("direct OpenAI refuses partial or refused responses", async () => {
  const { directOpenAI } = await import("../operations/photo-insights.mjs");
  await assert.rejects(
    directOpenAI({
      env: { OPENAI_API_KEY: "fake", PHOTO_INSIGHTS_MODEL: "configured" },
      images: [],
      pids: [],
      serviceIds: [],
      catalog: { services: [] },
      fetcher: async () => Response.json({ status: "incomplete", output: [] }),
    }),
    /no complete assessment/,
  );
});

test("photo provider accepts the existing Render key name and prefers standard name", async () => {
  const { photoAPIKey } = await import("../operations/photo-insights.mjs");
  assert.equal(photoAPIKey({ OpenAI_api_key: "legacy" }), "legacy");
  assert.equal(
    photoAPIKey({ OpenAI_api_key: "legacy", OPENAI_API_KEY: "standard" }),
    "standard",
  );
});
