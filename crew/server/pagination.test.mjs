import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
const source = await readFile(
  new URL("../dist/mm-client.js", import.meta.url),
  "utf8",
);
function browser({ failSecond = false } = {}) {
  const dom = new JSDOM("<!doctype html>", {
      url: "https://crew.mowmatter.com/",
      runScripts: "outside-only",
    }),
    w = dom.window,
    calls = [];
  w.AbortSignal = AbortSignal;
  w.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push(body);
    if (body.cursor && failSecond)
      return new Response('{"error":"Unavailable"}', { status: 503 });
    return new Response(
      JSON.stringify({
        company: { id: "company" },
        jobs: body.cursor ? [{ id: "today-b" }] : [{ id: "today-a" }],
        photos: [],
        events: [],
        notifications: [],
        visit_sms: [],
        job_window: { from_date: "2026-10-11", to_date: "2026-10-11" },
        next_cursor: body.cursor
          ? null
          : { date: "2026-10-11", time: "09:00:00", id: "first" },
      }),
    );
  };
  w.localStorage.setItem(
    "mm-auth-v1",
    JSON.stringify({
      access_token: "fake",
      expires_at: Date.now() + 3600000,
      user: { id: "user" },
    }),
  );
  w.eval(source);
  return { dom, w, calls };
}
test("client consumes every current job page and preserves window and company", async () => {
  const { dom, w, calls } = browser();
  try {
    const r = await w.MM.api({ action: "list" });
    assert.deepEqual(
      Array.from(r.jobs, (j) => j.id),
      ["today-a", "today-b"],
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[1].company_id, "company");
    assert.equal(calls[1].from_date, "2026-10-11");
    assert.equal(r.next_cursor, null);
  } finally {
    dom.window.close();
  }
});
test("page failure is surfaced instead of presenting an incomplete route", async () => {
  const { dom, w } = browser({ failSecond: true });
  try {
    await assert.rejects(() => w.MM.api({ action: "list" }), /Unavailable/);
  } finally {
    dom.window.close();
  }
});
