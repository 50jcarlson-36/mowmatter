import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../../", import.meta.url),
  check = process.argv.includes("--check");
const services = [];
async function output(url, text) {
  if (check) {
    if ((await readFile(url, "utf8")) !== text)
      throw Error("Security header drift: " + url.pathname);
  } else await writeFile(url, text);
}
for (const host of ["web", "office", "crew"]) {
  const folder = new URL(host + "/dist/", root),
    hashes = new Set();
  for (const file of await readdir(folder))
    if (file.endsWith(".html")) {
      const html = await readFile(new URL(file, folder), "utf8");
      for (const [, attrs, script] of html.matchAll(
        /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
      )) {
        if (
          /\bsrc\s*=/.test(attrs) ||
          /type=["']application\/ld\+json/.test(attrs) ||
          !script.trim()
        )
          continue;
        hashes.add(
          "'sha256-" +
            createHash("sha256").update(script).digest("base64") +
            "'",
        );
      }
    }
  const ancestors =
    host === "office"
      ? "https://mowmatter.com https://www.mowmatter.com"
      : "'none'";
  const googleScript =
    host === "web" ? "https://www.googletagmanager.com " : "";
  const googleImages =
    host === "web"
      ? "https://www.google-analytics.com https://region1.google-analytics.com "
      : "";
  const googleConnect =
    host === "web"
      ? "https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com "
      : "";
  const csp = `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors ${ancestors}; script-src 'self' ${googleScript}${[...hashes].sort().join(" ")}; style-src 'self' 'unsafe-inline'; img-src 'self' ${googleImages}data: blob: https://pzymmsfjgspvzbivzvkx.supabase.co; font-src 'self' data:; connect-src 'self' ${googleConnect}https://pzymmsfjgspvzbivzvkx.supabase.co wss://pzymmsfjgspvzbivzvkx.supabase.co https://mowmatter-property.onrender.com; frame-src ${host === "web" ? "https://office.mowmatter.com" : "'none'"}; form-action 'self'; worker-src 'self' blob:; upgrade-insecure-requests`;
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000",
    "Permissions-Policy": "camera=(self), geolocation=(self), microphone=()",
    "Content-Security-Policy": csp,
    ...(host === "office" ? {} : { "X-Frame-Options": "DENY" }),
  };
  await output(
    new URL("_headers", folder),
    "/*\n" +
      Object.entries(headers)
        .map(([k, v]) => `  ${k}: ${v}\n`)
        .join(""),
  );
  if (host !== "web") services.push({ host, headers });
}
let yaml =
  "# Import only after review; existing Render services need these response headers applied.\nservices:\n";
for (const { host, headers } of services) {
  yaml += `  - type: web\n    name: mowmatter-${host}\n    runtime: static\n    repo: https://github.com/50jcarlson-36/mowmatter\n    rootDir: ${host}\n    buildCommand: test -s dist/index.html\n    staticPublishPath: dist\n    autoDeployTrigger: off\n    headers:\n`;
  for (const [name, value] of Object.entries(headers))
    yaml += `      - path: /*\n        name: ${name}\n        value: ${JSON.stringify(value)}\n`;
}
await output(new URL("render.yaml", root), yaml);
console.log(
  check
    ? "Security headers match current assets."
    : "Generated security headers.",
);
