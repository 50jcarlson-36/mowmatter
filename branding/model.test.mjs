import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeBrand,
  invoiceHTML,
  invoiceEmailHTML,
  portalURL,
} from "../crew/supabase/functions/mowmatter-business/model.mjs";
const brand = {
  primary: "#174d36",
  accent: "#c4f500",
  phone: "",
  email: "owner@example.com",
  address: "",
  website: "https://example.com",
  tagline: "",
  invoice_note: "Thanks",
  invoice_terms: "Net 15",
  auto_invoice: true,
};
test("brand rejects unsafe colors and website schemes, bounds user content", () => {
  assert.equal(normalizeBrand(brand).auto_invoice, true);
  for (const b of [
    { primary: "red;display:none" },
    { website: "javascript:alert(1)" },
    { invoice_note: "a".repeat(501) },
    { email: "invalid" },
  ])
    assert.throws(() => normalizeBrand({ ...brand, ...b }));
  assert.equal(
    normalizeBrand({ ...brand, auto_invoice: "true" }).auto_invoice,
    false,
  );
});
test("invoice uses issued snapshot, escapes content, includes a customer scoped account link", () => {
  const i = {
    number: 1,
    created_at: "2026-10-10T00:00:00Z",
    amount_cents: 5250,
    snapshot: {
      business: "<script>bad</script>",
      branding: brand,
      customer: "A & B",
      address: "Main",
      service_date: "2026-10-09",
      services: ["Mow"],
    },
  };
  const html = invoiceHTML(i, portalURL("company", "customer"));
  assert.match(html, /\$52.50/);
  assert.match(html, /&lt;script&gt;/);
  assert(!html.includes("<script>"));
  assert.match(html, /customer=customer/);
  assert.match(html, /Powered by/);
  assert.match(html, /not a receipt/);
  assert.match(html, /<dt[^>]*>Service<\/dt>/);
  assert.match(html, /<dt[^>]*>Service date<\/dt>/);
  assert(!html.includes("<table"), "Invoice details must reflow without a desktop-width table");
  const email = invoiceEmailHTML(i, portalURL("company", "customer"), true);
  assert.match(email, /name="viewport" content="width=device-width,initial-scale=1"/);
  assert.match(email, /reminder for your outstanding invoice/);
  assert(email.includes(html));
});
test("emailed and browser invoices share the same responsive template", () => {
  assert.equal(
    readFileSync(new URL("../crew/supabase/functions/mowmatter-business/model.mjs", import.meta.url), "utf8"),
    readFileSync(new URL("../supabase/functions/mowmatter-invoice-delivery/model.mjs", import.meta.url), "utf8"),
  );
});
