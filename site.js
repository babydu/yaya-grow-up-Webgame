// Site config layering + inline, dismissible ad slots.
//
// Effective config = BASE defaults <- window.SITE_CONFIG (config.js, global for
// every visitor) <- localStorage override "slow-growing-site" (this browser only,
// used by the hidden ops panel for live preview and by the owner locally).
//
// Ads live in normal document flow (#ad-top under the header, #ad-bottom before
// the footer) so they never cover the game UI, and each one is individually
// dismissible with the choice remembered per visitor.
(function () {
  const STORE = 'slow-growing-site';
  const DISMISS = 'slow-growing-ad-dismissed';
  const BASE = {
    adminToken: 'mkx7d2',
    site: { footerNote: '' },
    ads: { topEnabled: true, bottomEnabled: true, items: [] }
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  function merge(base, extra) {
    if (!extra || typeof extra !== 'object') return base;
    const out = clone(base);
    if (extra.adminToken) out.adminToken = String(extra.adminToken);
    if (extra.site && typeof extra.site === 'object') out.site = { ...out.site, ...extra.site };
    if (extra.ads && typeof extra.ads === 'object') {
      if (typeof extra.ads.topEnabled === 'boolean') out.ads.topEnabled = extra.ads.topEnabled;
      if (typeof extra.ads.bottomEnabled === 'boolean') out.ads.bottomEnabled = extra.ads.bottomEnabled;
      if (Array.isArray(extra.ads.items)) out.ads.items = clone(extra.ads.items).map(normalizeAd).filter(Boolean);
    }
    return out;
  }
  function normalizeAd(a) {
    if (!a || typeof a !== 'object') return null;
    const text = typeof a.text === 'string' ? a.text.slice(0, 200) : '';
    if (!text) return null;
    const slot = a.slot === 'top' ? 'top' : 'bottom';
    let link = typeof a.link === 'string' ? a.link.trim() : '';
    if (link && !/^https?:\/\//i.test(link) && link[0] !== '/') link = '';
    return {
      id: a.id ? String(a.id) : 'ad-' + Math.random().toString(36).slice(2, 8),
      slot, text, link, enabled: a.enabled !== false
    };
  }
  function readStore(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (_) { return fallback; }
  }

  function getConfig() {
    const global = typeof window.SITE_CONFIG === 'object' && window.SITE_CONFIG ? window.SITE_CONFIG : {};
    const local = readStore(STORE, null);
    return merge(merge(BASE, global), local);
  }
  function save(cfg) {
    try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (_) { /* ignore */ }
    renderAds();
  }
  function reset() {
    try { localStorage.removeItem(STORE); } catch (_) { /* ignore */ }
    renderAds();
  }
  function dismissed() { return readStore(DISMISS, []); }
  function dismiss(id) {
    const list = dismissed();
    if (!list.includes(id)) { list.push(id); try { localStorage.setItem(DISMISS, JSON.stringify(list)); } catch (_) { /* ignore */ } }
    renderAds();
  }
  function clearDismissed() { try { localStorage.removeItem(DISMISS); } catch (_) { /* ignore */ } renderAds(); }

  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function adBody(ad) {
    const text = esc(ad.text);
    if (ad.link) return `<a class="ad-link" href="${esc(ad.link)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    return `<span class="ad-text">${text}</span>`;
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
      `<div class="ad-row" data-ad-id="${esc(a.id)}"><span class="ad-tag">广告</span>${adBody(a)}<button class="ad-close" type="button" data-ad-close="${esc(a.id)}" aria-label="关闭广告">×</button></div>`
    ).join('');
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

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ad-close]');
    if (b) dismiss(b.getAttribute('data-ad-close'));
  });

  window.Site = { BASE, getConfig, save, reset, renderAds, dismissed, clearDismissed, normalizeAd };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderAds);
  else renderAds();
})();
