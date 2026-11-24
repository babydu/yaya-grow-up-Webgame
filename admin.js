// Hidden operations panel. No button is rendered anywhere; it opens only when
// the URL hash carries the secret token from config.js, e.g. #ops=mkx7d2.
//
// Saving is GLOBAL for every visitor:
//   - on a server running server.js, "发布到服务器" POSTs /api/site-config and
//     rewrites data/site-config.json live.
//   - on static-only hosting, "导出 data/site-config.json" and replace that file.
// "本机预览" only affects the operator's own browser while they tune content.
(function () {
  if (!window.Site) return;
  const S = window.Site;
  let draft = null;
  let root = null;
  let token = '';

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const note = msg => { try { if (typeof window.toast === 'function') window.toast(msg); } catch (_) { /* ignore */ } };
  const $ops = sel => root && root.querySelector(sel);

  function hashToken() { const m = /(?:^|[#&])ops=([^&]+)/.exec(location.hash || ''); return m ? decodeURIComponent(m[1]) : ''; }
  function shouldOpen() { return !!S.adminToken() && hashToken() === S.adminToken(); }

  const PRESET_TOP = { id: 'ad-top-' + Math.random().toString(36).slice(2, 6), slot: 'top', text: '全站公告：欢迎来到《慢慢长大》，本周有温柔的小活动。', link: '', enabled: true };
  const PRESET_BOTTOM = { id: 'ad-bot-' + Math.random().toString(36).slice(2, 6), slot: 'bottom', text: '赞助伙伴：温柔宠物用品，点此了解更多', link: 'https://example.com', enabled: true };

  function ensureRoot() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'ops-root';
    root.className = 'ops-root';
    root.hidden = true;
    root.innerHTML = `
      <div class="ops-panel" role="dialog" aria-modal="true" aria-label="运营后台">
        <header class="ops-head"><strong>运营后台</strong>
          <span class="ops-conn" id="ops-conn"></span>
          <button type="button" id="ops-close" aria-label="关闭后台">关闭</button>
        </header>
        <div class="ops-body">
          <section class="ops-sec">
            <h3>公告</h3>
            <label class="ops-check"><input type="checkbox" id="ops-an-on"> 启用公告</label>
            <label class="ops-field"><span>标题</span><input type="text" id="ops-an-title" maxlength="120" placeholder="例如：本周小活动"></label>
            <label class="ops-field"><span>内容</span><textarea id="ops-an-body" rows="3" maxlength="1000" placeholder="一句话说明即可"></textarea></label>
            <label class="ops-field"><span>链接（可选，http(s) 或 / 开头）</span><input type="text" id="ops-an-link" placeholder="https://..."></label>
            <div class="ops-inline">
              <label class="ops-check"><input type="checkbox" id="ops-an-ticker"> 顶部滚动条</label>
              <label class="ops-check"><input type="checkbox" id="ops-an-modal"> 进入时弹窗（每次新公告一次）</label>
            </div>
            <p class="ops-hint">发布时会自动更新公告版本号；所有访客在下次打开时看到一次弹窗 / 滚动条，可自行关闭。</p>
          </section>

          <section class="ops-sec">
            <h3>广告位</h3>
            <label class="ops-check"><input type="checkbox" id="ops-topOn"> 顶部条幅（页头下方细条）</label>
            <label class="ops-check"><input type="checkbox" id="ops-bottomOn"> 底部卡片（页脚上方卡片）</label>
            <div class="ops-presets">
              <button type="button" class="ops-chip" id="ops-preset-top">+ 公告式条幅</button>
              <button type="button" class="ops-chip" id="ops-preset-bottom">+ 赞助卡片</button>
              <button type="button" class="ops-chip" id="ops-add">+ 空白广告</button>
            </div>
            <div id="ops-ads" class="ops-ads"></div>
            <p class="ops-hint">广告都在正常文档流中，不遮挡界面；每条带关闭按钮，访客关闭后不再显示。</p>
          </section>

          <section class="ops-sec">
            <h3>站点文案</h3>
            <label class="ops-field"><span>页脚补充说明</span><textarea id="ops-footerNote" rows="2" placeholder="例如：本站由 XXX 支持"></textarea></label>
          </section>

          <section class="ops-sec">
            <h3>发布</h3>
            <div class="ops-actions">
              <button type="button" id="ops-publish" class="ops-primary">发布到服务器（全站生效）</button>
              <button type="button" id="ops-preview">本机预览</button>
              <button type="button" id="ops-clearPreview">取消预览</button>
            </div>
            <div class="ops-actions">
              <button type="button" id="ops-export">导出 data/site-config.json</button>
              <button type="button" id="ops-clearDismissed">恢复被关闭的广告</button>
              <button type="button" id="ops-reset">清空为默认并预览</button>
            </div>
            <p class="ops-hint" id="ops-note">「发布到服务器」会把配置写入服务器上的 data/site-config.json，所有访客生效；若为纯静态部署（无 server.js），请用「导出」替换该文件后重新部署。</p>
            <details class="ops-details"><summary>高级：编辑原始 JSON</summary>
              <textarea id="ops-json" class="ops-json" spellcheck="false"></textarea>
              <button type="button" id="ops-applyjson" class="ops-chip">从 JSON 载入到编辑器</button>
            </details>
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
        <label class="ops-check ops-ad-en"><input type="checkbox" data-f="enabled"${a.enabled !== false ? ' checked' : ''}> 启用</label>
      </div>
      <label class="ops-field"><span>文案</span><input type="text" data-f="text" maxlength="200" value="${esc(a.text)}" placeholder="广告 / 公告文案"></label>
      <label class="ops-field"><span>链接（可选）</span><input type="text" data-f="link" value="${esc(a.link || '')}" placeholder="https://..."></label>
      <div class="ops-ad-foot"><span class="ops-id">${esc(a.id)}</span>
        <span class="ops-ad-btns">
          <button type="button" class="ops-mini" data-up="${i}" title="上移">↑</button>
          <button type="button" class="ops-mini" data-down="${i}" title="下移">↓</button>
          <button type="button" class="ops-del" data-del="${i}">删除</button>
        </span>
      </div>
    </div>`;
  }

  function renderConn() {
    const c = $ops('#ops-conn');
    if (!c) return;
    c.textContent = document.getElementById('ad-top') || document.getElementById('notice-ticker') ? '' : '';
    c.className = 'ops-conn ' + (S.hasRemote() ? 'ok' : 'warn');
    c.textContent = S.hasRemote() ? '已连接全局配置' : '纯静态：用导出方式';
  }

  function renderEditor() {
    const a = draft.announcement || {};
    $ops('#ops-an-on').checked = !!a.enabled;
    $ops('#ops-an-title').value = a.title || '';
    $ops('#ops-an-body').value = a.body || '';
    $ops('#ops-an-link').value = a.link || '';
    $ops('#ops-an-ticker').checked = a.ticker !== false;
    $ops('#ops-an-modal').checked = a.modal !== false;
    $ops('#ops-topOn').checked = !!draft.ads.topEnabled;
    $ops('#ops-bottomOn').checked = !!draft.ads.bottomEnabled;
    $ops('#ops-footerNote').value = draft.site.footerNote || '';
    $ops('#ops-ads').innerHTML = draft.ads.items.length ? draft.ads.items.map(adRow).join('') : '<p class="ops-empty">还没有广告。用上面的快捷按钮添加。</p>';
    $ops('#ops-json').value = JSON.stringify({ site: draft.site, ads: draft.ads, announcement: draft.announcement }, null, 2);
    renderConn();
  }

  function readAnnouncement() {
    const a = {
      enabled: $ops('#ops-an-on').checked,
      version: (draft.announcement && draft.announcement.version) || 0,
      title: $ops('#ops-an-title').value.trim(),
      body: $ops('#ops-an-body').value.trim(),
      link: $ops('#ops-an-link').value.trim(),
      ticker: $ops('#ops-an-ticker').checked,
      modal: $ops('#ops-an-modal').checked
    };
    const prev = draft.announcement || {};
    const changed = a.title !== (prev.title || '') || a.body !== (prev.body || '') || a.link !== (prev.link || '') || a.enabled !== !!prev.enabled;
    if (changed) a.version = Date.now(); // new version -> everyone sees it once more
    return a;
  }
  function syncDraft() {
    draft.announcement = readAnnouncement();
    draft.ads.topEnabled = $ops('#ops-topOn').checked;
    draft.ads.bottomEnabled = $ops('#ops-bottomOn').checked;
    draft.site.footerNote = $ops('#ops-footerNote').value.trim();
    root.querySelectorAll('.ops-ad').forEach(row => {
      const i = Number(row.dataset.i);
      const item = draft.ads.items[i]; if (!item) return;
      item.slot = row.querySelector('[data-f="slot"]').value === 'top' ? 'top' : 'bottom';
      item.enabled = row.querySelector('[data-f="enabled"]').checked;
      item.text = row.querySelector('[data-f="text"]').value.trim();
      item.link = row.querySelector('[data-f="link"]').value.trim();
    });
    draft.ads.items = draft.ads.items.map(S.normalizeAd).filter(Boolean);
  }
  function reorder(i, dir) {
    syncDraft();
    const j = i + dir;
    if (j < 0 || j >= draft.ads.items.length) return;
    const t = draft.ads.items[i]; draft.ads.items[i] = draft.ads.items[j]; draft.ads.items[j] = t;
    renderEditor();
  }

  function open() {
    // Native <dialog> lives in the browser top layer and would sit above this
    // overlay; close any open dialog first so the panel is clickable.
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (_) { /* ignore */ } });
    ensureRoot();
    token = hashToken();
    Promise.resolve(S.refresh()).then(() => {
      draft = JSON.parse(JSON.stringify(S.getConfig()));
      renderEditor();
      root.hidden = false;
    });
  }
  function close() {
    if (root) root.hidden = true;
    if (hashToken()) history.replaceState(null, '', location.pathname + location.search);
  }

  async function publish() {
    syncDraft();
    const payload = { site: draft.site, ads: draft.ads, announcement: draft.announcement };
    if (!token) { note('请用带 #ops=密钥 的地址打开后台。'); return; }
    note('正在发布到服务器…');
    const res = await S.save(payload, token);
    if (res.ok) { draft = JSON.parse(JSON.stringify(S.getConfig())); renderEditor(); note('已发布，全站访客生效。'); }
    else if (res.error === 'unauthorized') { note('密钥不正确，服务器拒绝了写入。'); }
    else { note('无法写入服务器（可能是纯静态部署）。请改用「导出 data/site-config.json」并替换部署。'); }
  }

  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#ops-close')) { close(); return; }
    if (t.closest('#ops-add')) { syncDraft(); draft.ads.items.push({ id: 'ad-' + Math.random().toString(36).slice(2, 8), slot: 'bottom', text: '', link: '', enabled: true }); renderEditor(); return; }
    if (t.closest('#ops-preset-top')) { syncDraft(); draft.ads.items.push({ ...PRESET_TOP, id: 'ad-' + Math.random().toString(36).slice(2, 8) }); renderEditor(); return; }
    if (t.closest('#ops-preset-bottom')) { syncDraft(); draft.ads.items.push({ ...PRESET_BOTTOM, id: 'ad-' + Math.random().toString(36).slice(2, 8) }); renderEditor(); return; }
    const up = t.closest('[data-up]'); if (up) { reorder(Number(up.getAttribute('data-up')), -1); return; }
    const down = t.closest('[data-down]'); if (down) { reorder(Number(down.getAttribute('data-down')), 1); return; }
    const del = t.closest('[data-del]'); if (del) { syncDraft(); draft.ads.items.splice(Number(del.getAttribute('data-del')), 1); renderEditor(); return; }
    if (t.closest('#ops-publish')) { publish(); return; }
    if (t.closest('#ops-preview')) { syncDraft(); S.preview(JSON.parse(JSON.stringify(draft))); note('已在本机预览（未保存）。'); return; }
    if (t.closest('#ops-clearPreview')) { S.clearPreview(); note('已取消本机预览。'); return; }
    if (t.closest('#ops-clearDismissed')) { S.clearDismissed(); note('已恢复被访客关闭的广告显示。'); return; }
    if (t.closest('#ops-reset')) { draft = JSON.parse(JSON.stringify(S.BASE)); S.preview(JSON.parse(JSON.stringify(draft))); renderEditor(); note('已清空为默认（仅预览，未发布）。'); return; }
    if (t.closest('#ops-export')) {
      syncDraft();
      const blob = new Blob([S.exportJson(draft)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'site-config.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      note('已导出 site-config.json，替换服务器 data/site-config.json 后重新部署即可全站生效。');
      return;
    }
    if (t.closest('#ops-applyjson')) {
      try { draft = JSON.parse($ops('#ops-json').value); S.BASE && (draft.site = draft.site || { footerNote: '' }); draft.ads = draft.ads || { topEnabled: true, bottomEnabled: true, items: [] }; draft.announcement = draft.announcement || { enabled: false, version: 0, title: '', body: '', link: '', ticker: true, modal: true }; }
      catch (_) { note('JSON 有误。'); return; }
      renderEditor(); note('已载入到编辑器，点「发布」或「预览」生效。'); return;
    }
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && root && !root.hidden) close(); });
  window.addEventListener('hashchange', () => { if (shouldOpen()) open(); });
  if (shouldOpen()) open();

  window.SiteAdmin = { open, close, isOpen: () => !!root && !root.hidden };
})();
