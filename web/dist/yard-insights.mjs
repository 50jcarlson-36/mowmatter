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
  if (window.MM.recovery) {
    $("auth").hidden = false;
    $("offers").hidden = true;
    $("logout").hidden = true;
    $("auth").innerHTML =
      '<h2>Choose a new password</h2><form id="yard-recovery"><label>New password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><button>Save password</button></form>';
    $("yard-recovery").onsubmit = async (event) => {
      event.preventDefault();
      const button = event.submitter;
      button.disabled = true;
      try {
        await MM.updatePassword(event.target.elements.password.value);
        await load();
      } catch (error) {
        $("status").textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
    return;
  }
  if (!window.MM.session) {
    $("auth").hidden = false;
    MM.mountGoogleLogin($("login"), {
      autoStart: false,
      status: $("status"),
      acceptance: () => {
        if (!$("terms").checked) {
          $("terms").focus();
          throw Error(
            "Agree to the terms and review the privacy policy before continuing with Google.",
          );
        }
        return {
          terms_version: "2026-10-07",
          privacy_notice_version: "2026-10-11",
          account_audience: "customer",
          terms_accepted_at: new Date().toISOString(),
        };
      },
    });
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
            `<article class="card"><h2>${esc(o.title)}</h2><p>${esc(o.description)}</p>${o.quote.lines.map((l) => `<p>${esc(l.name)} <strong>${money(l.amountCents)}</strong></p>`).join("")}<p><strong>Total ${money(o.quote.perVisitCents)}</strong> · ${o.quote.visitsPerYear === 1 ? "One-time" : "Per visit; " + o.quote.visitsPerYear + " planned visits/year"}</p><p>${esc(o.state)}</p>${o.state === "offered" ? `<label><input type="checkbox" data-confirm="${esc(o.id)}"> I reviewed this scope and price. Scheduling and payment require separate confirmation.</label><button data-id="${esc(o.id)}" data-choice="accepted">Add this service</button><button data-id="${esc(o.id)}" data-choice="declined">No thanks</button>` : ""}</article>`,
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
      await window.MM.signUp(
        f.elements.email.value,
        f.elements.password.value,
        undefined,
        {
          terms_version: "2026-10-07",
          privacy_notice_version: "2026-10-11",
          account_audience: "customer",
          terms_accepted_at: new Date().toISOString(),
        },
      );
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

for (const [id, method] of [
  ["yard-forgot", "resetPassword"],
  ["yard-resend", "resend"],
]) {
  $(id).onclick = async (event) => {
    const email = $("login").elements.email;
    if (!email.reportValidity()) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await MM[method](email.value);
      $("status").textContent =
        "If eligible, an email has been requested. Check your inbox and spam folder.";
    } catch (error) {
      $("status").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
