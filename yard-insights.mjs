const $ = (id) => document.getElementById(id),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const money = (c) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    c / 100,
  );
async function api(action, body = {}) {
  const s = await window.MM.ensureSession();
  const r = await fetch(
    "https://mowmatter-property.onrender.com/api/operations/" + action,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + s.access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    },
  );
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Please try again");
  return d;
}
async function load() {
  await window.MM.ready;
  if (!window.MM.session) {
    $("auth").hidden = false;
    $("offers").hidden = true;
    $("logout").hidden = true;
    return;
  }
  const d = await api("customer-insights");
  $("auth").hidden = true;
  $("offers").hidden = false;
  $("logout").hidden = false;
  $("offers").innerHTML = d.offers.length
    ? d.offers
        .map(
          (o) =>
            `<article class="card"><h2>${esc(o.title)}</h2><p>${esc(o.description)}</p>${o.quote.lines.map((l) => `<p>${esc(l.name)} <strong>${money(l.amountCents)}</strong></p>`).join("")}<p><strong>Total ${money(o.quote.perVisitCents)}</strong> · ${o.quote.visitsPerYear === 1 ? "One-time" : "Per visit; " + o.quote.visitsPerYear + " planned visits/year"}</p><p>${esc(o.state)}</p>${o.state === "offered" ? `<label><input type="checkbox" data-confirm="${esc(o.id)}"> I reviewed this scope and price. Scheduling and payment require separate confirmation.</label><button data-id="${esc(o.id)}" data-choice="accepted">Accept optional quote</button><button data-id="${esc(o.id)}" data-choice="declined">No thanks</button>` : ""}</article>`,
        )
        .join("")
    : '<section class="card"><h2>No reviewed insights yet.</h2><p>Ask your lawn company to connect your confirmed email and share a reviewed suggestion. Your existing service remains unchanged.</p></section>';
}
$("login").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target,
    button = e.submitter;
  button.disabled = true;
  try {
    if (button.value === "signup") {
      if (!$("terms").checked)
        throw Error("Agree to the terms before creating an account.");
      await window.MM.signUp(f.elements.email.value, f.elements.password.value);
      $("status").textContent =
        "Check your email to confirm your account. Return here to sign in, then ask your lawn company to connect it.";
    } else {
      await window.MM.signIn(f.elements.email.value, f.elements.password.value);
      await load();
      $("status").textContent = "Your customer portal is ready.";
    }
  } catch (err) {
    $("status").textContent = err.message;
  } finally {
    button.disabled = false;
  }
};
$("offers").onclick = async (e) => {
  const b = e.target.closest("[data-choice]");
  if (!b) return;
  if (
    b.dataset.choice === "accepted" &&
    !document.querySelector(`[data-confirm="${b.dataset.id}"]`).checked
  ) {
    $("status").textContent =
      "Review the scope and price, then check the confirmation.";
    return;
  }
  b.disabled = true;
  try {
    await api("respond", {
      offer_id: b.dataset.id,
      choice: b.dataset.choice,
      confirm_quote: true,
    });
    await load();
    $("status").textContent =
      b.dataset.choice === "accepted"
        ? "Quote accepted. Your company still needs to confirm scheduling and payment."
        : "Suggestion declined. Your current service is unchanged.";
  } catch (err) {
    $("status").textContent = err.message;
    b.disabled = false;
  }
};
$("logout").onclick = async () => {
  await window.MM.signOut();
  await load();
};
load().catch((e) => {
  $("status").textContent = e.message;
});
