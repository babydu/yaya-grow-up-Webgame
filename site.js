// Global site config + inline ads + announcement (ticker + modal).
//
// Effective config = BASE defaults <- config.js (window.SITE_CONFIG, code-level
// defaults and adminToken) <- data/site-config.json (GLOBAL, fetched so every
// visitor sees the same ads/announcement published by the operator).
//
// Publishing globally:
//   - with server.js: the hidden panel POSTs to /api/site-config and the file is
//     rewritten live for everyone.
//   - static-only hosting: the panel exports the JSON and the owner replaces
//     data/site-config.json before deploying.
(function () {
  const SEEN = 'slow-growing-notice-seen';
  const TICKER_OFF = 'slow-growing-notice-ticker';
  const DISMISS = 'slow-growing-ad-dismissed';
  const BASE = {
    site: { footerNote: '' },
    ads: { topEnabled: true, bottomEnabled: true, items: [] },
    announcement: { enabled: false, version: 0, title: '', body: '', link: '', ticker: true, modal: true },
    prices: {},
    gameplay: { vigilSeconds: 150 },
    analytics: { firstParty: true, provider: '', measurementId: '', respectDNT: true, requireConsent: false }
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  function normalizeAd(a) {
    if (!a || typeof a !== 'object') return null;
    const text = typeof a.text === 'string' ? a.text.slice(0, 2000) : '';
    if (!text) return null;
    return {
      id: a.id ? String(a.id) : 'ad-' + Math.random().toString(36).slice(2, 8),
      slot: a.slot === 'top' ? 'top' : 'bottom', text, link: safeLink(a.link), enabled: a.enabled !== false
    };
  }
  function merge(base, extra) {
    if (!extra || typeof extra !== 'object') return clone(base);
    const out = clone(base);
    if (extra.site && typeof extra.site === 'object') out.site = { ...out.site, ...extra.site };
    if (extra.ads && typeof extra.ads === 'object') {
      if (typeof extra.ads.topEnabled === 'boolean') out.ads.topEnabled = extra.ads.topEnabled;
      if (typeof extra.ads.bottomEnabled === 'boolean') out.ads.bottomEnabled = extra.ads.bottomEnabled;
      if (Array.isArray(extra.ads.items)) out.ads.items = extra.ads.items.map(normalizeAd).filter(Boolean);
    }
    if (extra.announcement && typeof extra.announcement === 'object') out.announcement = { ...out.announcement, ...extra.announcement };
    if (extra.prices && typeof extra.prices === 'object' && !Array.isArray(extra.prices)) out.prices = { ...out.prices, ...extra.prices };
    if (extra.gameplay && typeof extra.gameplay === 'object') {
      const v = extra.gameplay.vigilSeconds;
      if (Number.isSafeInteger(v) && v >= 60 && v <= 600) out.gameplay.vigilSeconds = v;
    }
    if (extra.analytics && typeof extra.analytics === 'object') out.analytics = { ...out.analytics, ...extra.analytics };
    return out;
  }
  function codeDefaults() {
    return (typeof window.SITE_CONFIG === 'object' && window.SITE_CONFIG) ? window.SITE_CONFIG : {};
  }

  let remote = null;      // parsed data/site-config.json
  let readyPromise = null;
  let previewCfg = null;  // transient local preview set by the ops panel
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeLink = u => { const s = String(u == null ? '' : u).trim(); return (/^https?:\/\//i.test(s) || s[0] === '/') ? s : ''; };
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* ignore */ } };

  function getConfig() {
    return merge(merge(BASE, codeDefaults()), previewCfg || remote || {});
  }
  function adminToken() { return String((codeDefaults().adminToken) || '').trim(); }

  // Push the effective price table and gameplay tuning into the engine so
  // shops/buy and the vigil timer all agree across every visitor.
  function syncPrices() {
    const g = window.GameEngine;
    if (g && typeof g.applyPriceOverrides === 'function') {
      g.applyPriceOverrides(getConfig().prices || {});
    }
    if (g && typeof g.configureVigil === 'function') {
      try { g.configureVigil(getConfig().gameplay.vigilSeconds); } catch (_) { /* keep default */ }
    }
    try { window.dispatchEvent(new Event('site-config-applied')); } catch (_) { /* ignore */ }
  }
  function load() {
    if (readyPromise) return readyPromise;
    readyPromise = fetch('data/site-config.json?t=' + Date.now(), { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { remote = (j && typeof j === 'object') ? j : null; })
      .catch(() => { remote = null; })
      .then(() => { syncPrices(); renderAll(); return getConfig(); });
    return readyPromise;
  }
  function refresh() { readyPromise = null; return load(); }

  // ---- ads ----
  function dismissed() { return lsGet(DISMISS, []); }
  function dismissAd(id) { const l = dismissed(); if (!l.includes(id)) { l.push(id); lsSet(DISMISS, l); } renderAds(); }
  function clearDismissed() { try { localStorage.removeItem(DISMISS); } catch (_) { /* ignore */ } renderAds(); }
  function renderHtml(str) {
    return (window.SanitizeHtml ? window.SanitizeHtml(str) : esc(str));
  }
  function adBody(a) {
    const href = safeLink(a.link);
    if (href) {
      const plain = window.SanitizeHtml ? window.SanitizeHtml.strip(a.text) : a.text;
      return `<a class="ad-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer nofollow">${esc(plain)}</a>`;
    }
    return `<span class="ad-text">${renderHtml(a.text)}</span>`;
  }
  function renderSlot(nodeId, slot, enabled) {
    const node = document.getElementById(nodeId);
    if (!node) return;
    if (!enabled) { node.hidden = true; node.innerHTML = ''; return; }
    const gone = dismissed();
    const items = getConfig().ads.items.filter(a => a.slot === slot && a.enabled && !gone.includes(a.id));
    if (!items.length) { node.hidden = true; node.innerHTML = ''; return; }
    node.hidden = false;
    node.innerHTML = items.map(a =>
      `<div class="ad-row" data-ad-id="${esc(a.id)}"><span class="ad-tag">广告</span>${adBody(a)}<button class="ad-close" type="button" data-ad-close="${esc(a.id)}" aria-label="关闭广告">×</button></div>`).join('');
  }
  function renderAds() {
    const cfg = getConfig();
    renderSlot('ad-top', 'top', cfg.ads.topEnabled);
    renderSlot('ad-bottom', 'bottom', cfg.ads.bottomEnabled);
    const note = document.getElementById('footer-note');
    if (note) {
      if (cfg.site.footerNote) { note.textContent = cfg.site.footerNote; note.hidden = false; }
      else { note.textContent = ''; note.hidden = true; }
    }
  }

  // ---- announcement ----
  function announce() {
    const a = getConfig().announcement || {};
    const hasText = (a.title && a.title.trim()) || (a.body && a.body.trim());
    return (a.enabled && hasText) ? { ...a, link: safeLink(a.link) } : null;
  }
  function renderTicker() {
    const node = document.getElementById('notice-ticker');
    if (!node) return;
    const a = announce();
    if (!a || a.ticker === false) { node.hidden = true; node.innerHTML = ''; return; }
    if (lsGet(TICKER_OFF, null) === a.version) { node.hidden = true; node.innerHTML = ''; return; }
    const bodyText = window.SanitizeHtml ? window.SanitizeHtml.strip(a.body || '') : String(a.body || '');
    const line = (a.title ? window.SanitizeHtml ? window.SanitizeHtml.strip(a.title) : a.title : '') + (bodyText ? (a.title ? ' · ' : '') + bodyText : '');
    const href = safeLink(a.link);
    const inner = href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(line)}</a>` : `<span>${esc(line)}</span>`;
    node.hidden = false;
    node.innerHTML = `<span class="notice-tag">公告</span><div class="notice-scroll"><div class="notice-scroll-text">${inner}</div></div><button class="notice-close" type="button" id="notice-ticker-close" aria-label="关闭公告">×</button>`;
  }
  function openModal() {
    const dlg = document.getElementById('notice-dialog');
    const a = announce();
    if (!dlg || !a || a.modal === false) return;
    if (lsGet(SEEN, null) === a.version) return;
    const body = a.body ? `<div class="notice-body">${renderHtml(a.body)}</div>` : '';
    const alink = safeLink(a.link);
    const link = alink ? `<a class="btn-link" href="${esc(alink)}" target="_blank" rel="noopener noreferrer">了解更多</a>` : '';
    document.getElementById('notice-content').innerHTML =
      `<div class="dialog-icon">${window.GameVisuals ? window.GameVisuals.icon('bell') : ''}</div>` +
      `<div class="eyebrow">A NOTE FOR YOU</div><h2 id="notice-title">${esc(a.title || '公告')}</h2>${body}${link}` +
      `<button class="primary close-button-inline" type="button" id="notice-ok">我知道了</button>`;
    if (typeof dlg.showModal === 'function') { try { dlg.showModal(); } catch (_) { /* ignore */ } } else dlg.setAttribute('open', '');
  }
  function closeModal() {
    const dlg = document.getElementById('notice-dialog');
    const a = announce();
    if (a) lsSet(SEEN, a.version);
    if (dlg && dlg.open) dlg.close(); else if (dlg) dlg.removeAttribute('open');
  }

  function renderAll() { renderAds(); renderTicker(); }
  function boot() {
    const dlg = document.getElementById('notice-dialog');
    if (dlg) dlg.addEventListener('close', () => { const a = announce(); if (a) lsSet(SEEN, a.version); });
    load().then(() => { renderAll(); openModal(); });
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ad-close]');
    if (b) { dismissAd(b.getAttribute('data-ad-close')); return; }
    if (e.target.closest('#notice-ticker-close')) {
      const a = announce(); if (a) lsSet(TICKER_OFF, a.version);
      const n = document.getElementById('notice-ticker'); if (n) { n.hidden = true; n.innerHTML = ''; }
      return;
    }
    if (e.target.closest('#notice-ok')) { closeModal(); return; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const d = document.getElementById('notice-dialog'); if (d && d.open) closeModal(); } });

  // ---- publish (admin) ----
  function save(cfg, token) {
    const payload = { site: cfg.site, ads: cfg.ads, announcement: cfg.announcement, prices: cfg.prices, gameplay: cfg.gameplay, analytics: cfg.analytics };
    return fetch('api/site-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' },
      body: JSON.stringify(payload)
    }).then(async r => {
      if (r.status === 401) return { ok: false, error: 'unauthorized' };
      if (!r.ok) return { ok: false, error: 'http-' + r.status };
      // Static hosts often answer any POST with a 200 index.html, which would
      // otherwise look like a successful publish. Require the server's ack.
      try { const body = await r.json(); if (!body || body.ok !== true) return { ok: false, error: 'bad-response' }; }
      catch (_) { return { ok: false, error: 'bad-response' }; }
      remote = merge(BASE, payload);
      previewCfg = null;
      // Re-read what the server actually stored (it sanitises/clamps input).
      readyPromise = null;
      await load();
      return { ok: true };
    }).catch(() => ({ ok: false, error: 'network' }));
  }
  function exportJson(cfg) {
    const clean = { site: cfg.site, ads: cfg.ads, announcement: cfg.announcement, prices: cfg.prices || {}, gameplay: cfg.gameplay || { vigilSeconds: 150 }, analytics: cfg.analytics || {}, updatedAt: Date.now() };
    return JSON.stringify(clean, null, 2);
  }

  window.Site = {
    BASE, getConfig, adminToken, refresh, load,
    save, exportJson, renderAll, hasRemote: () => !!remote,
    normalizeAd, dismissed, clearDismissed,
    preview(cfg) { previewCfg = cfg; syncPrices(); renderAll(); },
    clearPreview() { previewCfg = null; syncPrices(); renderAll(); },
    isPreviewing: () => !!previewCfg
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
