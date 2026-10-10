import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const root = resolve(import.meta.dirname, "../..");
// Canonical sources are copied only because each service deploys independently.
const copies = [
  ["api/pricing/quote-engine.mjs", "office/dist/pricing-engine.mjs"],
  ["office/dist/mm-client.js", "web/dist/yard-auth.js"],
  ["office/dist/services-preview.css", "web/dist/yard-insights.css"],
  ...[
    "yard-auth.js",
    "yard-insights.html",
    "yard-insights.mjs",
    "yard-insights.css",
  ].map((name) => ["web/dist/" + name, name]),
];
const sync = process.argv.includes("--sync");
for (const [source, target] of copies) {
  const canonical = await readFile(resolve(root, source));
  if (sync) {
    await mkdir(dirname(resolve(root, target)), { recursive: true });
    await writeFile(resolve(root, target), canonical);
  } else if (!canonical.equals(await readFile(resolve(root, target)))) {
    throw Error(
      `Generated asset drift: ${target}; run npm run sync:assets in api`,
    );
  }
}
console.log(
  sync
    ? "Deployment assets synchronized"
    : "Deployment assets match canonical sources",
);
