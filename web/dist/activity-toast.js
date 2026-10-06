/* Mow Matter example activity engine. Replace examples only with verified,
   consented, anonymized events before changing the disclosure. */
(() => {
  'use strict';
  const activities = [
    ['valuation', 'Portfolio assessment', 'James · Palm Coast, FL', '$145K', 'Illustrative business value estimate. Not an appraisal.'],
    ['valuation', 'Portfolio assessment', 'Maria · Jacksonville, FL', '$220K', 'Illustrative business value estimate. Not an appraisal.'],
    ['valuation', 'Portfolio assessment', 'Chris · Orlando, FL', '$285K', 'Illustrative business value estimate. Not an appraisal.'],
    ['signup', 'A simpler schedule', 'A two-crew business in Tampa, FL', '', 'Example: organizing recurring visits in one workspace.'],
    ['routing', 'Less time between lawns', 'Alex R. · Florida', '', 'Example: exploring AI routing through early access.'],
    ['lead', 'Turn a truck into a lead source', 'Homeowner · St. Augustine, FL', '', 'Example: scanning a truck QR code to request weekly mowing.'],
    ['lead', 'Grow around your existing route', 'Residential lead · Daytona Beach, FL', '', 'Example: matching a service request to a nearby operator.'],
    ['growth', 'See what a tighter route could do', 'Operator · Georgia', '22%', 'Illustrative travel-time reduction scenario. Results vary.'],
    ['valuation', 'Portfolio assessment', 'Daniel · Savannah, GA', '$120K', 'Illustrative business value estimate. Not an appraisal.'],
    ['valuation', 'Portfolio assessment', 'Taylor · Charleston, SC', '$310K', 'Illustrative business value estimate. Not an appraisal.'],
    ['signup', 'Make room for the next crew', 'A two-crew business in Gainesville, FL', '', 'Example: planning assignments and recurring service days.'],
    ['routing', 'Plan tomorrow before tonight', 'Jordan M. · North Carolina', '', 'Example: reviewing a daily route in the crew app.'],
    ['valuation', 'Portfolio assessment', 'Luis · Fort Myers, FL', '$195K', 'Illustrative business value estimate. Not an appraisal.']
  ];
  const key = 'mowmatter.activity.v1';
  const pausedKey = 'mowmatter.activity.paused';
  const read = (storage, name) => { try { return storage.getItem(name); } catch { return null; } };
  const write = (storage, name, value) => { try { storage.setItem(name, value); } catch { /* Private browsing remains functional. */ } };
  let local, session;
  try { local = window.localStorage; } catch {}
  try { session = window.sessionStorage; } catch {}
  if (read(session, pausedKey) === '1') return;
  const saved = Number(read(local, key));
  let cursor = Number.isInteger(saved) && saved >= 0 ? saved % activities.length : 0;
  let interval, hideTimer, removeTimer, stopped = false;
  let nextAt = Date.now() + 10000;
  const host = document.createElement('aside');
  host.id = 'mm-activity-toast';
  host.className = 'mm-fixed mm-z-50 mm-rounded-2xl mm-bg-white mm-text-slate-800 mm-shadow-2xl mm-border mm-border-emerald-100';
  host.hidden = true;
  host.setAttribute('aria-label', 'Illustrative Mow Matter activity');
  host.innerHTML = `<div class="mm-flex mm-gap-3 mm-p-4"><span class="mm-flex mm-shrink-0 mm-items-center mm-justify-center mm-rounded-xl mm-bg-emerald-950 mm-text-white mm-w-10 mm-h-10" aria-hidden="true" data-icon></span><div class="mm-min-w-0 mm-flex-1"><p class="mm-m-0 mm-text-xs mm-font-bold mm-uppercase mm-tracking-wide mm-text-emerald-800">Example activity · Mow Matter</p><div role="status" aria-live="polite" aria-atomic="true" data-content></div><p class="mm-m-0 mm-mt-2 mm-text-xs mm-text-slate-500">Illustrative scenario · Not a live customer event</p></div><button type="button" class="mm-toast-close" aria-label="Dismiss and pause activity notifications for this visit"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div>`;
  document.body.append(host);
  const iconPaths = { valuation: '<path d="M12 3v18m4-14H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7"/>', signup: '<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>', routing: '<path d="M5 5h9a5 5 0 0 1 0 10H7m3-3-3 3 3 3"/><circle cx="5" cy="5" r="2"/>', lead: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>', growth: '<path d="m3 17 6-6 4 4 8-10m-6 0h6v6"/>' };
  function hide() {
    clearTimeout(hideTimer);
    host.classList.remove('mm-toast-visible');
    removeTimer = setTimeout(() => { host.hidden = true; }, 250);
  }
  function busy() {
    const focused = document.activeElement;
    return document.hidden || !!document.querySelector('dialog[open]') || (focused && (focused.matches('input, textarea, select') || focused.isContentEditable));
  }
  function show() {
    if (stopped || busy() || host.contains(document.activeElement)) return;
    clearTimeout(removeTimer);
    const [type, title, place, value, detail] = activities[cursor];
    host.querySelector('[data-icon]').innerHTML = `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconPaths[type]}</svg>`;
    const content = host.querySelector('[data-content]');
    content.replaceChildren();
    for (const [tag, text, classes] of [['p', title, 'mm-m-0 mm-mt-1 mm-font-bold mm-text-sm'], ['p', place, 'mm-m-0 mm-mt-1 mm-text-sm'], ...(value ? [['span', value, 'mm-inline-block mm-mt-2 mm-rounded-md mm-bg-amber-100 mm-px-2 mm-py-1 mm-font-bold mm-text-amber-900 mm-text-sm']] : []), ['p', detail, 'mm-m-0 mm-mt-2 mm-text-xs mm-leading-relaxed mm-text-slate-600']]) {
      const node = document.createElement(tag); node.className = classes; node.textContent = text; content.append(node);
    }
    host.hidden = false;
    // A layout read ensures the entry transition starts from its hidden position.
    void host.offsetWidth;
    host.classList.add('mm-toast-visible');
    cursor = (cursor + 1) % activities.length;
    write(local, key, String(cursor));
    hideTimer = setTimeout(hide, 6000);
    nextAt = Date.now() + 14000 + Math.floor(Math.random() * 8001);
  }
  function start() {
    if (!stopped && !interval) interval = setInterval(() => { if (Date.now() >= nextAt) show(); }, 1000);
  }
  function cleanup() { clearInterval(interval); interval = null; clearTimeout(hideTimer); clearTimeout(removeTimer); host.hidden = true; host.classList.remove('mm-toast-visible'); }
  host.querySelector('button').addEventListener('click', () => { stopped = true; write(session, pausedKey, '1'); cleanup(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); else nextAt = Date.now() + 14000; });
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('pageshow', start);
  start();
})();
