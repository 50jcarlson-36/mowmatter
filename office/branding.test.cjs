const { JSDOM } = require("jsdom"),
  fs = require("fs"),
  assert = require("node:assert/strict");
const wait = () => new Promise((r) => setTimeout(r, 20));
(async () => {
  const d = new JSDOM('<main id="main"></main><p id="business-name"></p>', {
      url: "https://office.mowmatter.com/settings.html",
      runScripts: "outside-only",
    }),
    w = d.window;
  w.AbortSignal.timeout = () => undefined;
  w.MM = { ensureSession: async () => ({ access_token: "test" }) };
  let saved;
  w.fetch = async (url, o) => {
    const b = JSON.parse(o.body);
    if (b.action === "save") saved = b;
    return {
      ok: true,
      json: async () =>
        b.action === "get"
          ? { company: { name: "Real Lawn", branding: {} }, invoices: [] }
          : { ok: true },
    };
  };
  w.eval(fs.readFileSync("dist/business-branding.js", "utf8"));
  await w.showMowBranding({
    company: { id: "co" },
    customers: [{ id: "cu", name: "<b>Customer</b>", email: "c@example.com" }],
  });
  const f = w.document.querySelector("form");
  assert(f);
  assert(
    w.document
      .querySelector("#brand-preview")
      .textContent.includes("Real Lawn"),
  );
  assert(!w.document.querySelector(".job-list b b"));
  f.elements.name.value = "New Lawn";
  f.elements.primary.value = "#ffffff";
  f.dispatchEvent(new w.Event("input", { bubbles: true }));
  assert.equal(
    w.document.querySelector(".brand-button").style.color,
    "rgb(0, 0, 0)",
  );
  f.dispatchEvent(
    new w.SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
      submitter:
        f.querySelector('button[type="submit"]') ||
        f.querySelector("button:not([type])"),
    }),
  );
  await wait();
  assert.equal(saved.name, "New Lawn");
  assert.equal(saved.branding.primary, "#ffffff");
  assert.equal(saved.branding.auto_invoice, false);
  assert.match(
    w.document.querySelector(".job-list input").value,
    /business=co&customer=cu/,
  );
  const dialog = w.document.createElement('dialog');
  dialog.id = 'dialog';
  dialog.innerHTML = '<div id="dialog-content"></div>';
  dialog.showModal = () => { dialog.open = true; };
  w.document.body.append(dialog);
  w.MowBusiness.showInvoice({html:'<article class="invoice-document"><table><thead><tr><th>Service</th><th>Date</th><th>Amount</th></tr></thead><tbody><tr><td>Mowing</td><td>2026-10-13</td><td>$125.00</td></tr></tbody></table></article>'});
  assert(dialog.open);
  assert.deepEqual([...dialog.querySelectorAll('td')].map(td => td.dataset.label), ['Service', 'Date', 'Amount']);
  assert.equal(dialog.querySelector('table').getAttribute('role'), 'table');
  assert.equal(dialog.querySelector('td:last-child').textContent, '$125.00');
  w.close();
  console.log(
    "PASS: branding preview, safe rendering, accessible colors, saved preferences and scoped customer links",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
