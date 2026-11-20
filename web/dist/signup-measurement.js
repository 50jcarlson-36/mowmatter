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

  function openOfficeAfterMeasurement(library) {
    // The Pixel loads its dataset configuration after the library loads.
    // Keep this page open until the event request finishes or the wait expires.
    let observer;
    let metaPending = Boolean(library);
    let analyticsPending = /^[0-9a-f-]{36}$/.test(cookie('mm-ga-registration') || '') &&
      navigator.globalPrivacyControl !== true && navigator.doNotTrack !== '1' &&
      window.mmPrivacy?.allowed() === true;
    if (!metaPending && !analyticsPending) {
      location.replace(office);
      return;
    }
    const timeout = setTimeout(continueToOffice, 5000);
    function continueToOffice() {
      clearTimeout(timeout);
      observer?.disconnect();
      window.removeEventListener('mm-analytics-ready', sendAnalytics);
      location.replace(office);
    }
    function finishMeta() {
      metaPending = false;
      if (!analyticsPending) continueToOffice();
    }
    function finishAnalytics() {
      analyticsPending = false;
      if (!metaPending) continueToOffice();
    }
    function sendAnalytics() {
      document.cookie = 'mm-ga-registration=; Domain=mowmatter.com; Path=/; Secure; SameSite=Lax; Max-Age=0';
      if (!window.siteAnalytics?.trackSignup?.('sign_up', 'unknown', finishAnalytics)) finishAnalytics();
    }
    if (analyticsPending) {
      if (window.siteAnalytics) sendAnalytics();
      else window.addEventListener('mm-analytics-ready', sendAnalytics, { once: true });
    }
    if (!library) return;
    library.addEventListener('error', finishMeta, { once: true });
    if (!window.PerformanceObserver?.supportedEntryTypes?.includes('resource')) return;
    observer = new PerformanceObserver(list => {
      const sent = list.getEntries().some(entry => {
        const url = new URL(entry.name);
        return url.origin === 'https://www.facebook.com' &&
          /^\/tr\/?$/.test(url.pathname) &&
          url.searchParams.get('id') === pixelId &&
          url.searchParams.get('ev') === 'CompleteRegistration';
      });
      if (sent) finishMeta();
    });
    observer.observe({ type: 'resource', buffered: true });
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
    if (completion) openOfficeAfterMeasurement(library);
    document.head.append(library);
  }

  start();
  if (completion) {
    if (!started) openOfficeAfterMeasurement();
  } else {
    window.addEventListener('mmprivacychange', () => {
      if (!allowed()) window.fbq?.('consent', 'revoke');
      else if (started) window.fbq?.('consent', 'grant');
      else start();
    });
  }
})();
