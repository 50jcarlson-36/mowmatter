const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("../api/node_modules/jsdom");
const code = fs.readFileSync(__dirname + "/dist/privacy-controls.js", "utf8"),
  capture = fs.readFileSync(__dirname + "/dist/capture.js", "utf8");
function page({ gpc = false, storage = false } = {}) {
  const d = new JSDOM(
    "<!doctype html><html><head></head><body><a data-cta>CTA</a></body></html>",
    {
      url: "https://mowmatter.com/?utm_source=test",
      runScripts: "outside-only",
    },
  );
  Object.defineProperty(d.window.navigator, "globalPrivacyControl", {
    value: gpc,
  });
  if (storage)
    Object.defineProperty(d.window, "localStorage", {
      get() {
        throw Error("blocked");
      },
    });
  const sent = [];
  d.window.fetch = async (url, opt) => {
    sent.push(JSON.parse(opt.body));
    return { ok: true, json: async () => ({ ok: true }) };
  };
  d.window.AbortSignal.timeout = () => undefined;
  d.window.eval(code);
  d.window.eval(capture);
  return { w: d.window, sent };
}
test("analytics defaults off, enables on affirmative choice, stops immediately on withdrawal", () => {
  const { w, sent } = page();
  w.mmTrack("cta_click");
  assert.equal(sent.length, 0);
  w.document.querySelector("[data-choice=yes]").click();
  w.mmTrack("assessment_started");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].measurement_consent, true);
  w.mmPrivacy.save(false);
  w.mmTrack("signup_started");
  assert.equal(sent.length, 1);
});
test("GPC overrides saved consent and suppresses analytics", () => {
  const { w, sent } = page({ gpc: true });
  w.mmPrivacy.save(true);
  assert.equal(w.mmPrivacy.allowed(), false);
  w.mmTrack("cta_click");
  assert.equal(sent.length, 0);
});
test("blocked storage fails closed", () => {
  const { w, sent } = page({ storage: true });
  assert.equal(w.mmPrivacy.save(true), false);
  w.mmTrack("cta_click");
  assert.equal(sent.length, 0);
});
test("stale consent expires and every marketing page loads controls before collection", () => {
  const { w } = page();
  w.localStorage.setItem(
    "mm-privacy-v1",
    JSON.stringify({
      version: "2026-10-28",
      analytics: true,
      time: Date.now() - 181 * 86400000,
    }),
  );
  assert.equal(w.mmPrivacy.allowed(), false);
  for (const name of fs
    .readdirSync(__dirname + "/dist")
    .filter((x) => x.endsWith(".html"))) {
    const s = fs.readFileSync(__dirname + "/dist/" + name, "utf8");
    assert(s.includes("privacy-controls.js"), name);
    if (s.includes('src="capture.js"'))
      assert(
        s.indexOf("privacy-controls.js") < s.indexOf('src="capture.js"'),
        name,
      );
  }
});
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");
async function runCapture(context) {
  const { notifySavedLead } = await import(
    "../supabase/functions/mowmatter-capture/lead-alert.mjs"
  );
  const source = fs.readFileSync(
    __dirname + "/../supabase/functions/mowmatter-capture/index.ts",
    "utf8",
  );
  // vm runs a script; supply the actual ESM dependency through its isolated context.
  // Match only this known import so new dependencies still fail visibly.
  const dependency =
    /^import \{notifySavedLead\} from '\.\/lead-alert\.mjs';\r?\n/m;
  assert.match(
    source,
    dependency,
    "capture dependency changed; update the test loader",
  );
  vm.runInNewContext(stripTypeScriptTypes(source.replace(dependency, "")), {
    ...context,
    notifySavedLead,
  });
}

test("collector ignores missing consent, body opt-out and GPC without writing analytics", async () => {
  let handler;
  const writes = [];
  await runCapture({
    Deno: {
      env: {
        get: (k) =>
          ({
            SUPABASE_PUBLISHABLE_KEYS: '{"default":"test"}',
            SUPABASE_URL: "https://example.invalid",
            SUPABASE_SECRET_KEYS: '{"default":"secret"}',
          })[k],
      },
      serve: (f) => (handler = f),
    },
    fetch: async (url, opt) => {
      if (url.includes("mowmatter_funnel_events"))
        writes.push(JSON.parse(opt.body));
      return new Response("true", { status: 200 });
    },
    crypto,
    TextEncoder,
    Uint8Array,
    Response,
    Date,
    JSON,
    Set,
    Number,
    URLSearchParams,
  });
  for (const [body, gpc] of [
    [{}, false],
    [{ measurement_consent: true, privacy_signal: true }, false],
    [{ measurement_consent: true }, true],
    [{ measurement_consent: true, measurement_opt_out: true }, false],
  ]) {
    const r = await handler(
      new Request("https://example.invalid", {
        method: "POST",
        headers: {
          origin: "https://mowmatter.com",
          apikey: "test",
          ...(gpc ? { "sec-gpc": "1" } : {}),
        },
        body: JSON.stringify({ kind: "event", event: "cta_click", ...body }),
      }),
    );
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ignored, true);
  }
  assert.equal(writes.length, 0);
  const r = await handler(
    new Request("https://example.invalid", {
      method: "POST",
      headers: { origin: "https://mowmatter.com", apikey: "test" },
      body: JSON.stringify({
        kind: "event",
        event: "cta_click",
        measurement_consent: true,
      }),
    }),
  );
  assert.equal(r.status, 200);
  assert.equal(writes.length, 1);
});
test("sale opt-out needs only a valid email and notice, fails closed on storage errors", async () => {
  let handler,
    fail = false;
  const writes = [];
  await runCapture({
    Deno: {
      env: {
        get: (k) =>
          ({
            SUPABASE_PUBLISHABLE_KEYS: '{"default":"test"}',
            SUPABASE_URL: "https://example.invalid",
            SUPABASE_SECRET_KEYS: '{"default":"secret"}',
          })[k],
      },
      serve: (f) => (handler = f),
    },
    fetch: async (url, opt) => {
      if (url.endsWith("/rpc/mowmatter_opt_out_sale")) {
        writes.push({ url, body: JSON.parse(opt.body) });
        return new Response("true", { status: fail ? 500 : 200 });
      }
      return new Response("true", { status: 200 });
    },
    crypto,
    TextEncoder,
    Uint8Array,
    Response,
    Date,
    JSON,
    Set,
    Number,
    URLSearchParams,
  });
  const send = (body) =>
    handler(
      new Request("https://example.invalid", {
        method: "POST",
        headers: { origin: "https://mowmatter.com", apikey: "test" },
        body: JSON.stringify(body),
      }),
    );
  const body = {
    kind: "sale_optout",
    email: "Privacy@example.invalid",
    submission_id: crypto.randomUUID(),
    notice_version: "2026-10-11",
  };
  assert.equal((await send({ ...body, email: "" })).status, 400);
  assert.equal(writes.length, 0);
  assert.equal((await send(body)).status, 200);
  assert.equal(writes[0].body.p_email, "privacy@example.invalid");
  assert(writes[0].url.endsWith("/rpc/mowmatter_opt_out_sale"));
  fail = true;
  assert.equal((await send(body)).status, 503);
});
test("referral opt-out form requires neither account nor a contact permission checkbox", () => {
  const d = new JSDOM(
    fs.readFileSync(__dirname + "/dist/contact.html", "utf8"),
    {
      url: "https://mowmatter.com/contact.html?request_type=sale_optout",
      runScripts: "outside-only",
    },
  );
  d.window.eval(fs.readFileSync(__dirname + "/dist/legal.js", "utf8"));
  const f = d.window.document.getElementById("legal-request");
  assert.equal(f.elements.request_type.value, "sale_optout");
  assert.equal(f.elements.message.required, false);
  assert.equal(f.elements.contact_consent.required, false);
  assert.equal(f.querySelector("button").textContent, "Stop referral sharing");
});
