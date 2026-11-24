// Hidden operations panel. No button is rendered anywhere; it opens only when
// the URL hash carries the secret token from config.js, e.g. #ops=mkx7d2.
// Everything it saves goes to this browser's localStorage override; use
// "导出 config.js" to publish globally (replace config.js on the server).
(function () {
  if (!window.Site) return;
  const S = window.Site;
  let draft = null;
  let root = null;

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const note = msg => { try { if (typeof window.toast === 'function') window.toast(msg); } catch (_) { /* ignore */ } };

  function token() { return (S.getConfig().adminToken || '').trim(); }
  function hashToken() {
    const m = /(?:^|[#&])ops=([^&]+)/.exec(location.hash || '');
    return m ? decodeURIComponent(m[1]) : '';
  }
  function shouldOpen() {
    const t = token();
    return !!t && hashToken() === t;
  }

  function ensureRoot() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'ops-root';
    root.className = 'ops-root';
    root.hidden = true;
    root.innerHTML = `
      <div class="ops-panel" role="dialog" aria-modal="true" aria-label="运营后台">
        <header class="ops-head"><strong>运营后台</strong><button type="button" id="ops-close" aria-label="关闭后台">关闭</button></header>
        <div class="ops-body">
          <section class="ops-sec">
            <h3>广告位开关</h3>
            <label class="ops-check"><input type="checkbox" id="ops-topOn"> 顶部条幅（页头下方的细条）</label>
            <label class="ops-check"><input type="checkbox" id="ops-bottomOn"> 底部卡片（页脚上方的卡片）</label>
            <p class="ops-hint">广告位都在正常文档流中，不遮挡界面；每条广告都带关闭按钮，访客关闭后不再显示。</p>
          </section>
          <section class="ops-sec">
            <h3>广告内容</h3>
            <div id="ops-ads" class="ops-ads"></div>
            <button type="button" id="ops-add" class="ops-add">+ 新增广告</button>
          </section>
          <section class="ops-sec">
            <h3>站点文案</h3>
            <label class="ops-field"><span>页脚补充说明</span><textarea id="ops-footerNote" rows="2" placeholder="例如：本站由 XXX 支持"></textarea></label>
          </section>
          <section class="ops-sec">
            <h3>配置数据</h3>
            <textarea id="ops-json" class="ops-json" spellcheck="false"></textarea>
            <div class="ops-actions">
              <button type="button" id="ops-save" class="ops-primary">保存到本浏览器</button>
              <button type="button" id="ops-apply">从 JSON 应用</button>
              <button type="button" id="ops-export">导出 config.js</button>
              <button type="button" id="ops-clearDismissed">恢复被关闭的广告</button>
              <button type="button" id="ops-reset">重置本浏览器覆盖</button>
            </div>
            <p class="ops-hint">「保存到本浏览器」只影响当前浏览器（用于预览）。要影响所有访客，请点「导出 config.js」替换站点目录下的 config.js 后重新部署。</p>
          </section>
        </div>
      </div>`;
    document.body.appendChild(root);
    return root;
  }

  function adRow(a, i) {
    return `<div class="ops-ad" data-i="${i}">
      <div class="ops-ad-grid">
        <label class="ops-field"><span>位置</span>
          <select data-f="slot"><option value="top"${a.slot === 'top' ? ' selected' : ''}>顶部条幅</option><option value="bottom"${a.slot !== 'top' ? ' selected' : ''}>底部卡片</option></select>
        </label>
        <label class="ops-field"><span>启用</span><input type="checkbox" data-f="enabled"${a.enabled !== false ? ' checked' : ''}></label>
      </div>
      <label class="ops-field"><span>文案</span><input type="text" data-f="text" maxlength="200" value="${esc(a.text)}" placeholder="广告 / 公告文案"></label>
      <label class="ops-field"><span>链接（可选，http(s) 或 / 开头）</span><input type="text" data-f="link" value="${esc(a.link || '')}" placeholder="https://..."></label>
      <div class="ops-ad-foot"><span class="ops-id">${esc(a.id)}</span><button type="button" class="ops-del" data-del="${i}">删除</button></div>
    </div>`;
  }

  function renderEditor() {
    root.querySelector('#ops-topOn').checked = !!draft.ads.topEnabled;
    root.querySelector('#ops-bottomOn').checked = !!draft.ads.bottomEnabled;
    root.querySelector('#ops-footerNote').value = draft.site.footerNote || '';
    root.querySelector('#ops-ads').innerHTML = draft.ads.items.length
      ? draft.ads.items.map(adRow).join('')
      : '<p class="ops-empty">还没有广告。点「新增广告」添加一条。</p>';
    root.querySelector('#ops-json').value = JSON.stringify(draft, null, 2);
  }

  function open() {
    // Native <dialog> lives in the browser top layer and would sit above this
    // plain overlay, blocking clicks. Close any open dialog first.
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (_) { /* ignore */ } });
    ensureRoot();
    draft = JSON.parse(JSON.stringify(S.getConfig()));
    renderEditor();
    root.hidden = false;
  }
  function close() {
    if (root) root.hidden = true;
    if (hashToken()) history.replaceState(null, '', location.pathname + location.search);
  }

  function syncDraftFromDom() {
    draft.ads.topEnabled = root.querySelector('#ops-topOn').checked;
    draft.ads.bottomEnabled = root.querySelector('#ops-bottomOn').checked;
    draft.site.footerNote = root.querySelector('#ops-footerNote').value;
    root.querySelectorAll('.ops-ad').forEach(row => {
      const i = Number(row.dataset.i);
      const item = draft.ads.items[i]; if (!item) return;
      item.slot = row.querySelector('[data-f="slot"]').value === 'top' ? 'top' : 'bottom';
      item.enabled = row.querySelector('[data-f="enabled"]').checked;
      item.text = row.querySelector('[data-f="text"]').value;
      item.link = row.querySelector('[data-f="link"]').value;
    });
  }

  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#ops-close')) { close(); return; }
    if (t.closest('#ops-add')) {
      syncDraftFromDom();
      draft.ads.items.push({ id: 'ad-' + Math.random().toString(36).slice(2, 8), slot: 'bottom', text: '', link: '', enabled: true });
      renderEditor();
      return;
    }
    const del = t.closest('[data-del]');
    if (del) {
      syncDraftFromDom();
      draft.ads.items.splice(Number(del.getAttribute('data-del')), 1);
      renderEditor();
      return;
    }
    if (t.closest('#ops-save')) {
      syncDraftFromDom();
      // Drop blank rows and normalise before saving.
      draft.ads.items = draft.ads.items.map(S.normalizeAd).filter(Boolean);
      S.save(draft);
      renderEditor();
      note('已保存到本浏览器（仅本机预览）。');
      return;
    }
    if (t.closest('#ops-apply')) {
      try { draft = JSON.parse(root.querySelector('#ops-json').value); }
      catch (_) { note('JSON 格式有误，请检查。'); return; }
      renderEditor();
      note('已载入 JSON 到编辑器，点「保存到本浏览器」生效。');
      return;
    }
    if (t.closest('#ops-reset')) {
      S.reset();
      draft = JSON.parse(JSON.stringify(S.getConfig()));
      renderEditor();
      note('已重置本浏览器覆盖，回到 config.js 的配置。');
      return;
    }
    if (t.closest('#ops-clearDismissed')) {
      S.clearDismissed();
      note('已恢复被访客关闭的广告显示。');
      return;
    }
    if (t.closest('#ops-export')) {
      syncDraftFromDom();
      const clean = JSON.parse(JSON.stringify(draft));
      clean.ads.items = clean.ads.items.map(S.normalizeAd).filter(Boolean);
      const text = 'window.SITE_CONFIG = ' + JSON.stringify(clean, null, 2) + ';\n';
      const blob = new Blob([text], { type: 'text/javascript' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'config.js';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      note('已导出 config.js，替换服务器上的同名文件即可全站生效。');
      return;
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && root && !root.hidden) close();
  });
  window.addEventListener('hashchange', () => { if (shouldOpen()) open(); });
  if (shouldOpen()) open();

  window.SiteAdmin = { open, close, isOpen: () => !!root && !root.hidden };
})();
