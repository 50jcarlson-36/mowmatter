import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".git"].includes(entry.name)) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (/\.(mjs|cjs|js)$/.test(entry.name)) execFileSync(process.execPath, ["--check", path], { stdio: "inherit" });
  }
}
await check(resolve("."));
await check(resolve("../office/dist"));
console.log("API and Office JavaScript syntax checks passed.");
