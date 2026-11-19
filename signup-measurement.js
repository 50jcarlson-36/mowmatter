(() => {
  'use strict';
  const pixelId = '2191095804857507';
  const office = 'https://office.mowmatter.com/';
  const completion = /^\/signup-complete(?:\.html|\/)?$/.test(location.pathname);
  const homeownerReceipt = /^\/request-received(?:\.html|\/)?$/.test(location.pathname);
  const homeownerForm = /^\/lawn-care(?:\.html|\/)?$/.test(location.pathname);
  const marker = homeownerReceipt ? 'mm-meta-homeowner' : 'mm-meta-registration';
  let started = false;

  function cookie(name) {
    return document.cookie.split('; ').find(value => value.startsWith(name + '='))?.slice(name.length + 1);
  }

  function allowed() {
    return navigator.globalPrivacyControl !== true && navigator.doNotTrack !== '1' && cookie('mm-meta-consent') === 'allow';
  }

  function start() {
    if (started || !allowed() || location.hostname !== 'mowmatter.com') return;
    if (homeownerForm) {
      const clickId = new URLSearchParams(location.search).get('fbclid');
      if (/^[\w-]{8,500}$/.test(clickId || '') && !cookie('_fbc')?.endsWith('.' + clickId)) {
        document.cookie = '_fbc=fb.1.' + Date.now() + '.' + clickId +
          '; Domain=mowmatter.com; Path=/; Secure; SameSite=Lax; Max-Age=7776000';
      }
      return;
    }
    const eventId = completion || homeownerReceipt ? cookie(marker) : null;
    if ((completion || homeownerReceipt) && !/^[0-9a-f-]{36}$/.test(eventId || '')) return;
    started = true;
    if (completion || homeownerReceipt) {
      document.cookie = marker + '=; Domain=mowmatter.com; Path=/; Secure; SameSite=Lax; Max-Age=0';
    }
    const meta = (...args) => {
      if (meta.callMethod) meta.callMethod(...args);
      else meta.queue.push(args);
    };
    meta.queue = [];
    meta.push = meta;
    meta.loaded = true;
    meta.version = '2.0';
    window.fbq = window._fbq = meta;
    meta('set', 'autoConfig', false, pixelId);
    meta('init', pixelId);
    if (completion) meta('trackSingle', pixelId, 'CompleteRegistration', {}, { eventID: eventId });
    else if (homeownerReceipt) meta('trackSingle', pixelId, 'Lead', {}, { eventID: eventId });
    else meta('trackSingle', pixelId, 'PageView');

    const library = document.createElement('script');
    library.async = true;
    library.src = 'https://connect.facebook.net/en_US/fbevents.js';
    library.referrerPolicy = 'strict-origin';
    if (completion) library.addEventListener('load', () => setTimeout(() => location.replace(office), 350), { once: true });
    document.head.append(library);
  }

  start();
  if (completion) {
    if (!started) location.replace(office);
    else setTimeout(() => location.replace(office), 1800);
  } else {
    window.addEventListener('mmprivacychange', () => {
      if (!allowed()) window.fbq?.('consent', 'revoke');
      else if (started) window.fbq?.('consent', 'grant');
      else start();
    });
  }
})();
