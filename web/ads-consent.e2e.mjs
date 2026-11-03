// Browser check for Google Ads consent gating (not part of npm test; needs playwright-core + Chromium):
//   npm i --no-save playwright-core && npx playwright-core install chromium
//   node web/ads-consent.e2e.mjs web/dist [screenshot-dir]
// Serves web/dist as https://mowmatter.com with its real CSP, mocks the capture API,
// and records (then blocks) every Google request.
import { chromium } from "playwright-core";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
const dist = process.argv[2], shots = process.argv[3];
const csp = (await readFile(dist + "/_headers", "utf8")).match(/Content-Security-Policy: (.*)/)[1];
const googleHost = /(^|\.)(google|googletagmanager|google-analytics|googleadservices|doubleclick)\.(com|net)$/;
const types = { html: "text/html", js: "text/javascript", css: "text/css", png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", mjs: "text/javascript", webp: "image/webp", json: "application/json" };
let failures = 0;
const check = (ok, label) => { console.log((ok ? "PASS " : "FAIL ") + label); if (!ok) failures++; };

async function session({ testIds = false, gpc = false, width = 1280 } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height: 812 }, serviceWorkers: "block" });
  if (gpc) await context.addInitScript(() => Object.defineProperty(Navigator.prototype, "globalPrivacyControl", { get: () => true }));
  const google = [], bodies = [], cspErrors = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (googleHost.test(url.hostname)) { google.push(url.href); return route.fulfill({ status: 204, body: "" }); }
    if (url.hostname.endsWith("supabase.co")) {
      const body = JSON.parse(route.request().postData() || "{}"); bodies.push(body);
      const data = body.kind === "directory" ? { ok: true, location: body.zip, listings: [{ id: "x1", company_name: "Test Lawn Co", description: "Test listing", services: ["mowing"], featured: false, distance_miles: 2 }] } : { ok: true };
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(data) });
    }
    if (url.hostname !== "mowmatter.com") return route.fulfill({ status: 204, body: "" });
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    if (!existsSync(dist + path) && existsSync(dist + path + ".html")) path += ".html";
    if (!existsSync(dist + path)) return route.fulfill({ status: 404, body: "" });
    let body = await readFile(dist + path);
    if (testIds && path === "/privacy-controls.js")
      body = body.toString().replace("AW-REPLACE_WITH_CONVERSION_ID", "AW-1234567890").replace("REPLACE_BUSINESS_SIGNUP_LABEL", "TestSignup1").replace("REPLACE_HOMEOWNER_REQUEST_LABEL", "TestHome01").replace("REPLACE_DIRECTORY_SEARCH_LABEL", "TestSearch1");
    const ext = path.split(".").pop();
    return route.fulfill({ status: 200, body, headers: { "content-type": types[ext] || "application/octet-stream", ...(ext === "html" ? { "content-security-policy": csp } : {}) } });
  });
  const page = await context.newPage();
  page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) cspErrors.push(m.text()); });
  return { browser, page, google, bodies, cspErrors };
}
const ads = (list) => list.filter((u) => /googleadservices|doubleclick|\/pagead\/|gtag\/js\?id=AW-/.test(u));
const wait = (p) => p.waitForTimeout(600);

// 1. No Google request of any kind before a choice, on every ad landing page.
for (const gpc of [false, true]) {
  const s = await session({ testIds: true, gpc });
  for (const path of ["/?gclid=TESTCLICK&utm_source=google", "/pricing", "/early-access", "/lawn-care", "/locate-lawn-care"]) {
    await s.page.goto("https://mowmatter.com" + path); await wait(s.page);
  }
  check(s.google.length === 0, `${gpc ? "GPC: " : ""}no Google requests on 5 landing pages before consent (${s.google.length})`);
  // Directory search before consent must not convert.
  await s.page.fill("#directory-zip", "32137"); await s.page.click("#directory-search"); await wait(s.page);
  const dl = await s.page.evaluate(() => JSON.stringify(window.dataLayer || []));
  check(!dl.includes("conversion") && ads(s.google).length === 0, `${gpc ? "GPC: " : ""}directory search before consent sends no conversion`);
  if (gpc) {
    check(!(await s.page.locator("#mm-cookie-choice").count()), "GPC: consent banner not shown");
    await s.page.evaluate(() => window.mmPrivacy.save(true)); await wait(s.page);
    check(await s.page.evaluate(() => window.mmAds.convert("directory_search")) === false && s.google.length === 0, "GPC: allow attempt still sends nothing to Google");
  }
  check(s.cspErrors.length === 0, `${gpc ? "GPC: " : ""}no CSP violations (${s.cspErrors.length})`);
  await s.browser.close();
}

// 2. Reject optional: nothing to Google, no attribution in the request.
{
  const s = await session({ testIds: true });
  await s.page.goto("https://mowmatter.com/locate-lawn-care?gclid=TESTCLICK"); await wait(s.page);
  await s.page.click("#mm-cookie-choice [data-choice=no]");
  await s.page.fill("#directory-zip", "32137"); await s.page.click("#directory-search"); await wait(s.page);
  check(s.google.length === 0, "Reject optional: no Google requests after a search");
  await s.browser.close();
}

// 3. Allow analytics with test IDs: Ads tag loads, conversions fire, gclid reaches the lead source.
{
  const s = await session({ testIds: true });
  await s.page.goto("https://mowmatter.com/?gclid=TESTCLICK&utm_source=google&utm_campaign=homeowners"); await wait(s.page);
  check(s.google.length === 0, "Allow path: nothing before the click");
  await s.page.click("#mm-cookie-choice [data-choice=yes]"); await wait(s.page);
  check(s.google.some((u) => u.includes("gtag/js")), "Allow path: Google tag requested only after Allow analytics");
  await s.page.goto("https://mowmatter.com/locate-lawn-care"); await wait(s.page);
  await s.page.fill("#directory-zip", "32137"); await s.page.click("#directory-search"); await wait(s.page);
  let conv = await s.page.evaluate(() => (window.dataLayer || []).filter((x) => x[0] === "event" && x[1] === "conversion").map((x) => x[2].send_to));
  check(conv.includes("AW-1234567890/TestSearch1"), "directory search conversion queued after consent");
  await s.page.goto("https://mowmatter.com/lawn-care?zip=32137"); await wait(s.page);
  await s.page.fill("[name=address]", "104 Oak Drive"); await s.page.check("[name=services][value=mowing]");
  await s.page.click("#next-step");
  await s.page.fill("[name=email]", "test@example.invalid"); await s.page.check("[name=request_consent]");
  await s.page.click("#home-submit"); await wait(s.page);
  conv = await s.page.evaluate(() => (window.dataLayer || []).filter((x) => x[0] === "event" && x[1] === "conversion").map((x) => x[2]));
  const home = s.bodies.find((b) => b.kind === "homeowner");
  check(conv.some((c) => c.send_to === "AW-1234567890/TestHome01" && /^[0-9a-f-]{36}$/.test(c.transaction_id)), "homeowner request conversion queued with random transaction id");
  check(home?.source?.gclid === "TESTCLICK" && home?.source?.utm_campaign === "homeowners", "gclid + UTM from landing page carried into homeowner request source");
  check(!JSON.stringify(await s.page.evaluate(() => window.dataLayer)).includes("example.invalid"), "no form contents in dataLayer");
  // Early-access iframe signup message.
  await s.page.goto("https://mowmatter.com/early-access"); await wait(s.page);
  const signup = await s.page.evaluate(() => window.mmAds.convert("business_signup"));
  check(signup === true, "business signup conversion available on early-access");
  // Withdraw.
  await s.page.evaluate(() => window.mmPrivacy.save(false));
  const before = s.google.length;
  const after = await s.page.evaluate(() => window.mmAds.convert("business_signup"));
  check(after === false && s.google.length === before, "withdrawal stops conversions");
  check(s.cspErrors.length === 0, "no CSP violations with tags loaded (" + s.cspErrors.length + ")");
  await s.browser.close();
}

// 4. Shipped placeholders: Allow loads GA only, never Google Ads.
{
  const s = await session();
  await s.page.goto("https://mowmatter.com/locate-lawn-care?gclid=TESTCLICK"); await wait(s.page);
  await s.page.click("#mm-cookie-choice [data-choice=yes]");
  await s.page.fill("#directory-zip", "32137"); await s.page.click("#directory-search"); await wait(s.page);
  check(ads(s.google).length === 0 && !s.google.some((u) => u.includes("id=AW-")), "placeholder IDs: no Google Ads request even after consent");
  await s.browser.close();
}

// 5. 375px layout on changed pages with the banner showing.
if (shots) {
  const s = await session({ width: 375 });
  for (const path of ["/", "/pricing", "/early-access", "/lawn-care", "/locate-lawn-care", "/privacy", "/cookies"]) {
    await s.page.goto("https://mowmatter.com" + path); await wait(s.page);
    const { sw, banner } = await s.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, banner: document.querySelector("#mm-cookie-choice")?.getBoundingClientRect().height || 0 }));
    check(sw <= 375, `375px ${path}: no horizontal scroll (scrollWidth ${sw}), banner ${Math.round(banner)}px tall`);
    await s.page.screenshot({ path: `${shots}/375${path === "/" ? "-home" : path.replace("/", "-")}.png` });
  }
  await s.browser.close();
}
console.log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exit(failures ? 1 : 0);
