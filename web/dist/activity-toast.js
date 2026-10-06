/* Mow Matter marketing prompts. Activity claims require verified, consented events. */
(() => {
  'use strict';
  const activities = [
    ['valuation', 'Build a business worth growing', 'Know your numbers. Plan your next chapter.', '', 'Explore your business growth potential.', 'growth.html', 'Explore the Growth Lab'],
    ['signup', 'Your next chapter starts here', 'Still running your business from text messages?', '', 'Take the first step toward a more organized operation.', 'early-access.html', 'Join early access'],
    ['routing', 'Give your crew a clearer day', 'The next stop. The job details. One workspace.', '', 'See how Mow Matter connects the office and the field.', 'crew-app.html', 'Explore the Crew app'],
    ['growth', 'Get organized before you grow', 'A second truck needs more than a longer to-do list.', '', 'Explore a system built around owners and small crews.', 'platform.html', 'Explore the platform'],
    ['lead', 'Make your next customer a nearby one', 'Explore the power of tighter neighborhoods.', '', 'Plan growth around the routes you already serve.', 'growth.html', 'Plan your growth'],
    ['routing', 'Leave the late-night text threads behind', 'Tomorrow’s jobs deserve a clear plan.', '', 'See the crew experience before your next busy day.', 'crew-app.html', 'See the Crew app'],
    ['valuation', 'Build more than a packed schedule', 'What could your lawn care business become?', '', 'Explore recurring work, route density and business planning.', 'growth.html', 'Explore your potential'],
    ['signup', 'Ready for a more organized business?', 'Customers, recurring work and crew progress.', '', 'Discover the management hub built for lawn care.', 'platform.html', 'See the management hub'],
    ['routing', 'Put the plan in your crew’s hands', 'Less back-and-forth. A clearer next stop.', '', 'Explore the mobile experience for people doing the work.', 'crew-app.html', 'Meet Mow Matter Crew'],
    ['growth', 'Make room for what’s next', 'Growth starts with a business you can manage.', '', 'See how your office and field can stay connected.', 'platform.html', 'Explore the platform'],
    ['lead', 'Turn visibility into opportunity', 'Your truck can start the next conversation.', '', 'Explore website and QR-code lead generation.', 'platform.html', 'See what’s possible'],
    ['signup', 'Stop putting your next chapter off', 'You have the truck. You have the drive.', '', 'Explore the tools to organize the business behind the work.', 'early-access.html', 'Join early access']
  ];
  const key = 'mowmatter.marketing.v2';
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
  let live = [], loading = false, refreshAt = 0;
  async function refreshActivity() {
    if (loading || document.hidden || stopped) return;
    loading = true; refreshAt = Date.now() + 60000;
    try {
      const res = await fetch('https://pzymmsfjgspvzbivzvkx.supabase.co/functions/v1/mowmatter-activity', {headers:{apikey:'sb_publishable_KQGD-vWlAlJi_Bv7fSaEvA_YLJpIgyu'},signal:AbortSignal.timeout(8000)});
      if (!res.ok) throw Error('Unavailable');
      const data = await res.json();
      if (Math.abs(Date.now() - Date.parse(data.generatedAt)) > 600000 || !Number.isFinite(Date.parse(data.generatedAt))) throw Error('Stale');
      live = (Array.isArray(data.events) ? data.events : []).filter(e => ['signup','lead'].includes(e.type) && typeof e.title === 'string' && typeof e.place === 'string' && typeof e.detail === 'string' && e.href === 'early-access.html').slice(0,30).map(e => [e.type,e.title.slice(0,100),e.place.slice(0,100),'',e.detail.slice(0,250),e.href,e.cta || 'Explore Mow Matter']);
    } catch { live = []; }
    finally { loading = false; }
  }
  let nextAt = Date.now() + 10000;
  const host = document.createElement('aside');
  host.id = 'mm-activity-toast';
  host.className = 'mm-fixed mm-z-50 mm-rounded-2xl mm-bg-slate-900/95 mm-backdrop-blur-md mm-text-white mm-shadow-2xl mm-border mm-border-white/20';
  host.hidden = true;
  host.setAttribute('aria-label', 'Mow Matter business growth prompts');
  host.innerHTML = `<div class="mm-flex mm-gap-3 mm-p-4"><span class="mm-flex mm-shrink-0 mm-items-center mm-justify-center mm-rounded-xl mm-bg-emerald-950 mm-text-white mm-w-10 mm-h-10" aria-hidden="true" data-icon></span><div class="mm-min-w-0 mm-flex-1"><p class="mm-m-0 mm-text-xs mm-font-bold mm-uppercase mm-tracking-wide mm-text-green-400">GROW WITH MOW MATTER</p><div role="status" aria-live="polite" aria-atomic="true" data-content></div></div><button type="button" class="mm-toast-close" aria-label="Dismiss and pause activity notifications for this visit"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div>`;
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
    const pool = live.length ? live : activities;
    const [type, title, place, value, detail, href, cta] = pool[cursor % pool.length];
    host.querySelector('[data-icon]').innerHTML = `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconPaths[type]}</svg>`;
    const content = host.querySelector('[data-content]');
    content.replaceChildren();
    for (const [tag, text, classes] of [['p', title, 'mm-m-0 mm-mt-1 mm-font-bold mm-text-sm'], ['p', place, 'mm-m-0 mm-mt-1 mm-text-sm'], ...(value ? [['span', value, 'mm-inline-block mm-mt-2 mm-rounded-md mm-bg-amber-100 mm-px-2 mm-py-1 mm-font-bold mm-text-amber-900 mm-text-sm']] : []), ['p', detail, 'mm-m-0 mm-mt-2 mm-text-xs mm-leading-relaxed mm-text-slate-300']]) {
      const node = document.createElement(tag); node.className = classes; node.textContent = text; content.append(node);
    }
    const link = document.createElement('a'); link.href = href; link.textContent = cta + ' →'; link.className = 'mm-inline-block mm-mt-2 mm-text-sm mm-font-bold mm-text-green-400'; content.append(link);
    host.hidden = false;
    // A layout read ensures the entry transition starts from its hidden position.
    void host.offsetWidth;
    host.classList.add('mm-toast-visible');
    cursor = (cursor + 1) % pool.length;
    write(local, key, String(cursor));
    hideTimer = setTimeout(hide, 6000);
    nextAt = Date.now() + 10000 + Math.floor(Math.random() * 8001);
  }
  function start() {
    if (!stopped && !interval) interval = setInterval(() => { if (Date.now() >= refreshAt) void refreshActivity(); if (Date.now() >= nextAt) show(); }, 1000);
  }
  function cleanup() { clearInterval(interval); interval = null; clearTimeout(hideTimer); clearTimeout(removeTimer); host.hidden = true; host.classList.remove('mm-toast-visible'); }
  host.querySelector('button').addEventListener('click', () => { stopped = true; write(session, pausedKey, '1'); cleanup(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); else nextAt = Date.now() + 10000; });
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('pageshow', start);
  start();
})();
