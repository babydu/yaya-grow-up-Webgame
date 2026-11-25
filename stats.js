// Anonymous, cookie-less first-party analytics + optional third-party (GA4).
//
// Design: no persistent device id, no PII, no cross-site tracking. Only a
// whitelisted set of aggregate counters is batched and POSTed (every ~20s and
// on hide via sendBeacon) to /api/stat. Active seconds are counted only while
// the page is visible. Third-party analytics (GA4) loads only when configured
// by the operator, honouring Do-Not-Track and an optional consent bar.
(function () {
  const W = window;
  if (!W.Site) return;

  const CONSENT_KEY = 'slow-growing-consent';
  const state = { enabled: false, visible: !document.hidden, lastFlush: Date.now(), pending: {}, started: false };
  // Ephemeral presence id: lives only in this page's memory (a fresh id each
  // load, never persisted to localStorage/cookie). Used purely to tell the
  // server "a tab is still open right now" so it can show live user counts.
  const presenceId = (function () {
    try {
      const c = W.crypto || W.msCrypto;
      if (c && typeof c.getRandomValues === 'function') {
        const a = new Uint32Array(3); c.getRandomValues(a);
        return 'p' + a[0].toString(36) + a[1].toString(36) + a[2].toString(36);
      }
    } catch (_) { /* ignore */ }
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  })();

  const cfg = () => (W.Site.getConfig().analytics) || {};

  function bump(key, n) {
    if (!state.enabled) return;
    const v = Number(n) || 0;
    if (v <= 0) return;
    state.pending[key] = (state.pending[key] || 0) + v;
  }
  function event(key) { bump(key, 1); }

  function post(body, useBeacon) {
    const json = JSON.stringify(body);
    if (useBeacon && typeof navigator.sendBeacon === 'function') {
      try { navigator.sendBeacon('api/stat', new Blob([json], { type: 'application/json' })); return; } catch (_) { /* fall through */ }
    }
    try { fetch('api/stat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true }).catch(() => {}); } catch (_) { /* ignore */ }
  }
  function flush(useBeacon) {
    const now = Date.now();
    if (state.visible) {
      const dt = Math.floor((now - state.lastFlush) / 1000);
      if (dt > 0) bump('activeSeconds', dt);
    }
    state.lastFlush = now;
    const body = state.pending;
    state.pending = {};
    if (!state.hourSent) { body.hour = state.hour; state.hourSent = true; }
    body.presenceId = presenceId;
    body.visible = !document.hidden;
    post(body, useBeacon);
  }

  // ---- third-party (GA4) ----
  let gaLoaded = false;
  function loadGA(id) {
    if (gaLoaded || !id) return;
    gaLoaded = true;
    W.dataLayer = W.dataLayer || [];
    W.gtag = function () { W.dataLayer.push(arguments); };
    W.gtag('js', new Date());
    W.gtag('config', id, { anonymize_ip: true });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    s.onerror = function () { /* ignore network failures silently */ };
    document.head.appendChild(s);
  }
  function dntOn() { return navigator.doNotTrack === '1' || W.doNotTrack === '1'; }
  function showConsent(id) {
    if (document.getElementById('consent-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'consent-bar';
    bar.className = 'consent-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', '统计与隐私');
    bar.innerHTML = '<span class="consent-text">我们使用匿名统计来改善游戏体验（不使用第三方广告追踪）。是否允许加载访问统计？</span>' +
      '<span class="consent-actions"><button type="button" data-consent="grant">同意</button><button type="button" data-consent="deny">拒绝</button><a class="consent-more" href="#about-title">说明</a></span>';
    document.body.appendChild(bar);
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-consent]');
      if (!b) return;
      try { localStorage.setItem(CONSENT_KEY, b.getAttribute('data-consent') === 'grant' ? 'granted' : 'denied'); } catch (_) { /* ignore */ }
      if (b.getAttribute('data-consent') === 'grant') loadGA(id);
      bar.remove();
    });
  }
  function maybeThirdParty(a) {
    if (a.provider !== 'ga4' || !a.measurementId) return;
    if (a.respectDNT !== false && dntOn()) return;
    if (a.requireConsent) {
      let decision = '';
      try { decision = localStorage.getItem(CONSENT_KEY) || ''; } catch (_) { /* ignore */ }
      if (decision === 'granted') loadGA(a.measurementId);
      else if (decision !== 'denied') showConsent(a.measurementId);
      return;
    }
    loadGA(a.measurementId);
  }

  function init() {
    const a = cfg();
    // Anonymous aggregate only; on unless the operator disables it.
    state.enabled = a.firstParty !== false;
    maybeThirdParty(a);
    if (!state.enabled) return;
    state.started = true;
    state.lastFlush = Date.now();
    state.hour = new Date().getHours();
    state.hourSent = false;
    event('pageview');
    event('session');
    // Announce presence right away so live counts include this tab at once.
    post({ presenceId: presenceId, visible: !document.hidden, hour: state.hour }, false);
    state.hourSent = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { flush(false); state.visible = false; }
      else { state.lastFlush = Date.now(); state.visible = true; }
    });
    W.addEventListener('pagehide', () => flush(true));
    setInterval(() => { if (!document.hidden) flush(false); }, 20000);
  }

  W.Stats = { bump, event, flush, isEnabled: () => state.enabled };
  Promise.resolve(W.Site.load()).then(init).catch(() => {});
})();
