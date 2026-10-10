import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import {
  normalizeBrand,
  portalURL,
  invoiceHTML,
} from "../crew/supabase/functions/mowmatter-business/model.mjs";
const co = "11111111-1111-4111-8111-111111111111",
  cu = "22222222-2222-4222-8222-222222222222";
function harness({
  email = "customer@example.invalid",
  verified = true,
  owner = false,
} = {}) {
  let handler;
  const writes = [];
  const records = {
    mow_crew_companies: [{ id: co, name: "Business", branding: {} }],
    mow_crew_members: owner
      ? [{ company_id: co, user_id: "user", role: "owner" }]
      : [],
    mow_customers: [
      {
        id: cu,
        company_id: co,
        name: "Customer",
        email: "customer@example.invalid",
        phone: "",
      },
    ],
    mow_crew_jobs: [],
    mow_customer_invoices: [],
  };
  const db = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "user",
            email,
            email_confirmed_at: verified ? "now" : null,
          },
        },
        error: null,
      }),
    },
    from(table) {
      let filters = [],
        mode = "list",
        update;
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          filters.push((r) => r[k] === v);
          return q;
        },
        in(k, v) {
          filters.push((r) => v.includes(r[k]));
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        single() {
          mode = "single";
          return q;
        },
        maybeSingle() {
          mode = "maybe";
          return q;
        },
        update(v) {
          update = v;
          return q;
        },
        then(resolve) {
          const rows = (records[table] || []).filter((r) =>
            filters.every((fn) => fn(r)),
          );
          if (update) {
            writes.push({ table, update, rows: rows.length });
            for (const row of rows) Object.assign(row, update);
          }
          resolve({
            data: mode === "list" ? rows : rows[0] || null,
            error:
              mode === "single" && !rows.length
                ? { message: "Record unavailable" }
                : null,
          });
        },
      };
      return q;
    },
  };
  const source = stripTypeScriptTypes(
    readFileSync(
      new URL(
        "../crew/supabase/functions/mowmatter-business/index.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ).replace(/^import .*;\n/gm, "");
  vm.runInNewContext(source, {
    Deno: { env: { get: () => "" }, serve: (fn) => (handler = fn) },
    createClient: () => db,
    normalizeBrand,
    portalURL,
    invoiceHTML,
    Response,
    Date,
    JSON,
    Set,
    Error,
    FormData,
    File,
    Uint8Array,
    Number,
    crypto,
    fetch: () => {
      throw Error("Unexpected outbound request");
    },
  });
  return {
    writes,
    request: (body, origin = "https://office.mowmatter.com") =>
      handler(
        new Request("https://example.invalid", {
          method: "POST",
          headers: {
            origin,
            authorization: "Bearer test",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        }),
      ),
  };
}
test("portal denies wrong email and unconfirmed identities", async () => {
  for (const options of [
    { email: "other@example.invalid" },
    { verified: false },
  ]) {
    const h = harness(options),
      r = await h.request({
        action: "portal",
        company_id: co,
        customer_id: cu,
      });
    assert([401, 403].includes(r.status));
    assert(!JSON.stringify(await r.json()).includes('"customer":'));
    assert.equal(h.writes.length, 0);
  }
});
test("customer cannot change branding or read another customer", async () => {
  const h = harness();
  assert.equal(
    (
      await h.request({
        action: "save",
        company_id: co,
        name: "Attack",
        branding: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (await h.request({ action: "portal", company_id: co, customer_id: co }))
      .status,
    403,
  );
  assert.equal(
    (
      await h.request(
        { action: "portal", company_id: co, customer_id: cu },
        "https://evil.invalid",
      )
    ).status,
    403,
  );
  assert.equal(h.writes.length, 0);
});
test("verified customer updates only their phone and sees only scoped data", async () => {
  const h = harness();
  const r = await h.request({
    action: "portal",
    company_id: co,
    customer_id: cu,
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).customer.id, cu);
  assert.equal(
    (
      await h.request({
        action: "portal_update",
        company_id: co,
        customer_id: cu,
        phone: "555-0123",
        email: "attacker@example.invalid",
      })
    ).status,
    200,
  );
  assert.deepEqual(h.writes[0].update.phone, "555-0123");
  assert.equal(h.writes[0].update.email, undefined);
  assert.equal(h.writes[0].rows, 1);
});
