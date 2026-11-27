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
  let presenceTimer = null;

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
          <section class="ops-sec" id="ops-security-sec">
            <h3>部署安全</h3>
            <div id="ops-security"></div>
          </section>

          <section class="ops-sec">
            <h3>公告</h3>
            <label class="ops-check"><input type="checkbox" id="ops-an-on"> 启用公告</label>
            <label class="ops-field"><span>标题</span><input type="text" id="ops-an-title" maxlength="120" placeholder="例如：本周小活动"></label>
            <label class="ops-field"><span>内容（支持简单 HTML：b/i/a/br/p/ul/li 等）</span><textarea id="ops-an-body" rows="4" maxlength="4000" placeholder="可写纯文本，或用简单 HTML 排版"></textarea></label>
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
            <h3>物品价格</h3>
            <p class="ops-hint">单位：积分 / 整包（一次购买的数量）。留空或等于默认值即使用默认价格。改完点「发布」或「预览」。</p>
            <div id="ops-prices" class="ops-prices"></div>
            <button type="button" class="ops-chip" id="ops-prices-reset">恢复默认价格</button>
          </section>
          <section class="ops-sec">
            <h3>玩法参数</h3>
            <label class="ops-field"><span>守夜时长（秒，60-600）</span><input type="number" id="ops-vigil" min="60" max="600" step="30" placeholder="150"></label>
            <p class="ops-hint">病危保底「为它守夜」需要玩家全程留在页面，离开即作废。积分固定补齐到药价（60 分），缩短时长只是减轻守候负担、不会少给。默认 150 秒（约 2.5 分钟），对所有访客生效。</p>
          </section>
          <section class="ops-sec">
            <h3>统计与分析</h3>
            <label class="ops-check"><input type="checkbox" id="ops-an-firstParty"> 启用匿名统计（页面时长/照护次数等，无个人身份）</label>
            <label class="ops-field"><span>第三方统计</span>
              <select id="ops-an-provider"><option value="">不启用</option><option value="ga4">Google Analytics 4</option></select>
            </label>
            <label class="ops-field"><span>GA4 测量 ID（如 G-XXXXXXX）</span><input type="text" id="ops-an-mid" placeholder="G-XXXXXXX" autocomplete="off"></label>
            <label class="ops-check"><input type="checkbox" id="ops-an-dnt"> 尊重浏览器「请勿跟踪」(DNT)</label>
            <label class="ops-check"><input type="checkbox" id="ops-an-consent"> 需要访客同意后再加载第三方统计</label>
            <p class="ops-hint">匿名统计只上报聚合计数，不使用 Cookie、不存设备标识、不采集个人信息。第三方统计（GA）需合规（同意/DNT）。</p>
            <div class="ops-actions"><button type="button" id="ops-stats-refresh" class="ops-primary">查看统计（需后端）</button><button type="button" id="ops-presence-refresh" class="ops-chip">刷新在线人数</button></div>
            <div id="ops-presence" class="ops-presence"></div>
            <div id="ops-stats" class="ops-stats"><p class="ops-empty">点上方按钮加载统计（需 server.js 后端）。</p></div>
          </section>
          <section class="ops-sec">
            <h3>站点文案</h3>
            <label class="ops-field"><span>页脚补充说明</span><textarea id="ops-footerNote" rows="2" placeholder="例如：本站由 XXX 支持"></textarea></label>
          </section>

          <section class="ops-sec">
            <h3>发布</h3>
            <label class="ops-field"><span>运维写入密钥（服务器 OPS_TOKEN；留空则用入口 token）</span><input type="password" id="ops-secret" autocomplete="off" placeholder="本机已记住则留空；填入新值会覆盖记忆"></label>
            <label class="ops-check"><input type="checkbox" id="ops-forget-secret"> 清除本机记住的密钥</label>
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
<p class="ops-hint" id="ops-note">「发布到服务器」会把配置写入服务器上的 data/site-config.json，所有访客生效。生产环境建议在服务器设置 OPS_TOKEN 并在此填入同一密钥（入口 token 仅用于隐藏面板）。密钥验证成功后会记住在本机浏览器里，之后发布、查看统计都无需再填；换电脑或清浏览器数据需要重新填一次，下方可随时清除记忆。纯静态部署（无 server.js）请用「导出」替换该文件后重新部署。</p>
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
      <label class="ops-field"><span>文案（支持简单 HTML：b/i/a/br/p/ul/li 等）</span><textarea data-f="text" rows="2" maxlength="2000" placeholder="广告 / 公告文案，可用简单 HTML">${esc(a.text)}</textarea></label>
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

  const PRICE_CATS = [
    ['food', '食物 / 花肥'], ['clean', '清洁护理'], ['nutrition', '营养组合'],
    ['comfort', '陪伴玩具'], ['medical', '医疗'], ['accessory', '随身饰物']
  ];
  function priceGroupLabel(cat) {
    const hit = PRICE_CATS.find(x => x[0] === cat);
    return hit ? hit[1] : cat;
  }
  function renderPrices() {
    const box = $ops('#ops-prices');
    if (!box || !window.GameEngine) return;
    const catalog = window.GameEngine.catalog || [];
    const base = window.GameEngine.basePrices ? window.GameEngine.basePrices() : {};
    const over = draft.prices || {};
    const groups = PRICE_CATS.map(([cat]) => [cat, catalog.filter(p => p.category === cat)]).filter(([, items]) => items.length);
    if (!groups.length) { box.innerHTML = '<p class="ops-empty">当前角色没有可调价的物品。</p>'; return; }
    box.innerHTML = groups.map(([cat, items]) => {
      const rows = items.map(p => {
        const def = base[p.id] != null ? base[p.id] : p.price;
        const cur = over[p.id] != null ? over[p.id] : def;
        const unit = p.pack ? (cur / p.pack).toFixed(1) : cur;
        return `<div class="ops-price-row" data-def="${def}">
          <span class="ops-price-name">${p.name}</span>
          <input type="number" min="1" max="1000000" step="1" data-price-id="${p.id}" value="${cur}">
          <span class="ops-price-meta">默认 ${def} · 单份 ≈ ${unit}</span>
        </div>`;
      }).join('');
      return `<div class="ops-price-group"><h4>${priceGroupLabel(cat)}</h4>${rows}</div>`;
    }).join('');
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
    $ops('#ops-vigil').value = (draft.gameplay && draft.gameplay.vigilSeconds) || '';
    $ops('#ops-ads').innerHTML = draft.ads.items.length ? draft.ads.items.map(adRow).join('') : '<p class="ops-empty">还没有广告。用上面的快捷按钮添加。</p>';
    $ops('#ops-json').value = JSON.stringify({ site: draft.site, ads: draft.ads, announcement: draft.announcement, gameplay: draft.gameplay }, null, 2);
    try { $ops('#ops-secret').value = rememberedSecret(); } catch (_) { /* ignore */ }
    const an = draft.analytics || {};
    $ops('#ops-an-firstParty').checked = an.firstParty !== false;
    $ops('#ops-an-provider').value = an.provider === 'ga4' ? 'ga4' : '';
    $ops('#ops-an-mid').value = an.measurementId || '';
    $ops('#ops-an-dnt').checked = an.respectDNT !== false;
    $ops('#ops-an-consent').checked = an.requireConsent === true;
    renderPrices();
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
    const vigilRaw = Number($ops('#ops-vigil').value);
    const vigilOk = Number.isSafeInteger(vigilRaw) && vigilRaw >= 60 && vigilRaw <= 600;
    draft.gameplay = { vigilSeconds: vigilOk ? vigilRaw : 150 };
    if (!vigilOk && $ops('#ops-vigil').value.trim() !== '') note('守夜时长须为 60-600 秒之间的整数，已按默认 150 处理。');
    root.querySelectorAll('.ops-ad').forEach(row => {
      const i = Number(row.dataset.i);
      const item = draft.ads.items[i]; if (!item) return;
      item.slot = row.querySelector('[data-f="slot"]').value === 'top' ? 'top' : 'bottom';
      item.enabled = row.querySelector('[data-f="enabled"]').checked;
      item.text = row.querySelector('[data-f="text"]').value.trim();
      item.link = row.querySelector('[data-f="link"]').value.trim();
    });
    draft.ads.items = draft.ads.items.map(S.normalizeAd).filter(Boolean);
    const prices = {};
    root.querySelectorAll('[data-price-id]').forEach(inp => {
      const id = inp.getAttribute('data-price-id');
      const def = Number(inp.closest('.ops-price-row').getAttribute('data-def'));
      const v = Number(inp.value);
      if (Number.isSafeInteger(v) && v >= 1 && v !== def) prices[id] = v;
    });
    draft.prices = prices;
    draft.analytics = {
      firstParty: $ops('#ops-an-firstParty').checked,
      provider: $ops('#ops-an-provider').value === 'ga4' ? 'ga4' : '',
      measurementId: $ops('#ops-an-mid').value.trim(),
      respectDNT: $ops('#ops-an-dnt').checked,
      requireConsent: $ops('#ops-an-consent').checked
    };
  }
  function reorder(i, dir) {
    syncDraft();
    const j = i + dir;
    if (j < 0 || j >= draft.ads.items.length) return;
    const t = draft.ads.items[i]; draft.ads.items[i] = draft.ads.items[j]; draft.ads.items[j] = t;
    renderEditor();
  }

  // ---- guided security setup ----
  // The panel entry token (config.js adminToken) is served to every visitor,
  // so it can never be a real secret. The write key (server OPS_TOKEN) is what
  // actually protects publishing/stats. Walk the operator through setting it.
  // A secret that passes a server check is remembered on this machine
  // (localStorage) so the operator does not retype the long string for every
  // publish/stats action. 401 answers drop the remembered value.
  function rememberedSecret() {
    try { return localStorage.getItem('ops-write-token') || sessionStorage.getItem('ops-write-token') || ''; } catch (_) { return ''; }
  }
  function rememberSecret(v) {
    const s = String(v || '').trim();
    if (!s) return;
    try { localStorage.setItem('ops-write-token', s); sessionStorage.setItem('ops-write-token', s); } catch (_) { /* ignore */ }
  }
  function forgetSecret() {
    try { localStorage.removeItem('ops-write-token'); sessionStorage.removeItem('ops-write-token'); } catch (_) { /* ignore */ }
    const el = $ops('#ops-secret');
    if (el) el.value = '';
  }
  function writeSecret() {
    const el = $ops('#ops-secret');
    return (el && el.value.trim()) || rememberedSecret() || token;
  }
  async function loadOpsStatus() {
    const box = $ops('#ops-security');
    if (!box) return;
    try {
      const r = await fetch('api/ops-status', { headers: { 'x-admin-token': writeSecret() } });
      if (r.status === 401) {
        forgetSecret();
        box.innerHTML = '<div class="ops-warn"><b>写入密钥不正确。</b>请核对「运维写入密钥」或服务器 OPS_TOKEN 后重试，已记住的密钥已被清除。</div>';
        return;
      }
      if (!r.ok) { box.innerHTML = '<p class="ops-empty">无法读取服务器安全状态（需 server.js）。</p>'; return; }
      rememberSecret(writeSecret());
      const d = await r.json();
      if (d.writeProtected) {
        box.innerHTML = '<div class="ops-ok"><b>已受 OPS_TOKEN 保护。</b>发布与统计由服务器环境变量中的独立密钥校验，入口 token 泄露也无法写入门面。</div>';
        return;
      }
      box.innerHTML = `<div class="ops-warn">
          <b>发布尚未受保护。</b>当前写入密钥回退到 config.js 的公开 adminToken，任何访客拿到它就能改全站配置/公告。
          <ol class="ops-steps">
            <li>生成随机密钥：<code>node server.js --print-token</code></li>
            <li>用它启动：<code>OPS_TOKEN=&lt;密钥&gt; PORT=8080 node server.js</code></li>
            <li>在下方「运维写入密钥」填入同一串，点「发布到服务器」验证一次；统计也会随之切换到该密钥。</li>
          </ol>
          <p class="ops-hint">入口 token（#ops=…，在 config.js，对访客可见）只负责隐藏此面板；真正保护发布的是 OPS_TOKEN。</p>
        </div>
        <div class="ops-actions"><button type="button" id="ops-recheck" class="ops-chip">设置好了，重新检测</button></div>`;
    } catch (_) {
      box.innerHTML = `<div class="ops-warn"><b>纯静态部署。</b>没有后端可写：「发布」不可用，请用「导出 data/site-config.json」替换文件后重新部署；统计与在线人数也不可用。</div>`;
    }
  }

  function open() {
    // Native <dialog> lives in the browser top layer and would sit above this
    // overlay; close any open dialog first so the panel is clickable.
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (_) { /* ignore */ } });
    ensureRoot();
    token = hashToken();
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    Promise.resolve(S.refresh()).then(() => {
      draft = JSON.parse(JSON.stringify(S.getConfig()));
      renderEditor();
      root.hidden = false;
      loadOpsStatus();
      loadPresence();
      if (presenceTimer) clearInterval(presenceTimer);
      presenceTimer = setInterval(() => { if (root && !root.hidden) loadPresence(); }, 30000);
    });
  }
  function close() {
    if (root) root.hidden = true;
    if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    if (hashToken()) history.replaceState(null, '', location.pathname + location.search);
  }

  async function publish() {
    syncDraft();
    const payload = { site: draft.site, ads: draft.ads, announcement: draft.announcement, prices: draft.prices || {}, gameplay: draft.gameplay, analytics: draft.analytics };
    const secretEl = $ops('#ops-secret');
    const secret = writeSecret();
    if (!secret) { note('请用带 #ops=密钥 的地址打开后台，或填写运维写入密钥。'); return; }
    note('正在发布到服务器…');
    const res = await S.save(payload, secret);
    if (res.ok) {
      rememberSecret(secret);
      draft = JSON.parse(JSON.stringify(S.getConfig())); renderEditor(); note('已发布，全站访客生效。密钥已在本机记住，下次无需再填。');
    }
    else if (res.error === 'unauthorized') { forgetSecret(); note('密钥不正确，服务器拒绝了写入，已记住的密钥已被清除。'); }
    else { note('无法写入服务器（可能是纯静态部署）。请改用「导出 data/site-config.json」并替换部署。'); }
  }

  async function loadStats() {
    const box = $ops('#ops-stats');
    if (!box) return;
    const t = writeSecret();
    if (!t) { box.innerHTML = '<p class="ops-empty">请用带 #ops=密钥 的地址打开后台。</p>'; return; }
    box.innerHTML = '<p class="ops-empty">加载中…</p>';
    try {
      const r = await fetch('api/stats', { headers: { 'x-admin-token': t } });
      if (r.status === 401) { forgetSecret(); box.innerHTML = '<p class="ops-empty">密钥不正确或未部署后端，已记住的密钥已被清除。</p>'; return; }
      if (!r.ok) { box.innerHTML = '<p class="ops-empty">统计接口不可用（需 server.js）。</p>'; return; }
      rememberSecret(t);
      const d = await r.json();
      renderStats(d);
    } catch (_) {
      box.innerHTML = '<p class="ops-empty">无法连接统计接口（纯静态部署不提供）。</p>';
    }
  }
  const STAT_LABELS = { pageview: '页面浏览', session: '会话数', activeSeconds: '活跃时长(秒)', careActions: '照护次数', adopts: '领养次数', checkins: '签到次数', stageUps: '晋级次数', nannySeconds: '托管时长(秒)', pointsEarned: '获得积分', pointsSpent: '消耗积分', criticals: '进入病危' };
  const CARE_LABELS = { care_food: '喂养/浇水', care_clean: '清洁', care_mood: '陪伴/晒太阳', care_energy: '休息/施肥' };
  const ADOPT_LABELS = { adopt_cat: '小猫·橘汐', adopt_dog: '小狗·麦芽', adopt_baby: '宝宝·阿团', adopt_plant: '植物·团子' };
  const STAGE_LABELS = { stage_0: '第1阶段', stage_1: '第2阶段', stage_2: '第3阶段', stage_3: '第4阶段' };
  const fmtN = n => Number(n || 0).toLocaleString('zh-CN');
  const mmdd = day => String(day).slice(5);

  async function loadPresence() {
    const box = $ops('#ops-presence');
    if (!box) return;
    const t = writeSecret();
    if (!t) { box.innerHTML = '<p class="ops-empty">请用带 #ops=密钥 的地址打开后台。</p>'; return; }
    try {
      const r = await fetch('api/presence', { headers: { 'x-admin-token': t } });
      if (r.status === 401) { forgetSecret(); box.innerHTML = '<p class="ops-empty">密钥不正确或未部署后端，已记住的密钥已被清除。</p>'; return; }
      if (!r.ok) { box.innerHTML = '<p class="ops-empty">在线统计接口不可用（需 server.js）。</p>'; return; }
      rememberSecret(t);
      const d = await r.json();
      box.innerHTML =
        `<div class="ops-cards ops-presence-cards">` +
        `<div class="ops-card ops-live"><small>当前活跃（前台可见）</small><strong>${fmtN(d.activeNow)}</strong></div>` +
        `<div class="ops-card"><small>当前在线（含后台标签）</small><strong>${fmtN(d.onlineNow)}</strong></div>` +
        `<div class="ops-card"><small>今日到访（近似）</small><strong>${fmtN(d.activeToday)}</strong></div>` +
        `</div>` +
        `<p class="ops-hint">实时数据来自最近 60 秒内的心跳，仅内存维护、不落盘、不含个人身份；服务重启或过零点会重置。</p>`;
    } catch (_) {
      box.innerHTML = '<p class="ops-empty">无法连接在线统计接口（纯静态部署不提供）。</p>';
    }
  }

  function statHbars(items, color) {
    const max = Math.max(1, ...items.map(i => i.value));
    if (!items.some(i => i.value > 0)) return '<p class="ops-empty">暂无数据</p>';
    return items.map(it => `<div class="ops-hbar"><span class="ops-hbar-label">${esc(it.label)}</span><span class="ops-hbar-track"><span class="ops-hbar-fill" style="width:${Math.round((it.value / max) * 100)}%;background:${color}"></span></span><b>${fmtN(it.value)}</b></div>`).join('');
  }
  function statVBars(items, color) {
    const w = 560, h = 120, pad = 14, n = Math.max(1, items.length);
    const max = Math.max(1, ...items.map(i => i.value));
    const bw = (w - 2 * pad) / n;
    const step = Math.ceil(n / 6);
    let bars = '';
    items.forEach((it, i) => {
      const bh = Math.round((it.value / max) * (h - 2 * pad));
      const x = pad + i * bw, y = h - pad - bh;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${bh}" rx="1" fill="${color}"><title>${esc(it.label)}: ${it.value}</title></rect>`;
      if (i % step === 0) bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${h - 3}" font-size="9" fill="#a3ab95" text-anchor="middle">${esc(it.label)}</text>`;
    });
    return `<svg class="ops-chart" viewBox="0 0 ${w} ${h}" role="img">${bars}</svg>`;
  }
  function statLine(items) {
    const w = 560, h = 150, pad = 20, n = items.length;
    const max = Math.max(1, ...items.map(i => i.value));
    const x = i => n <= 1 ? pad : pad + (i * (w - 2 * pad)) / (n - 1);
    const y = v => h - pad - (v / max) * (h - 2 * pad);
    const pts = items.map((it, i) => `${x(i).toFixed(1)},${y(it.value).toFixed(1)}`).join(' ');
    const area = `${pad},${h - pad} ${pts} ${(w - pad)},${h - pad}`;
    const dots = items.map((it, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(it.value).toFixed(1)}" r="2.4" fill="#718365"><title>${esc(it.label)}: ${it.value}</title></circle>`).join('');
    const step = Math.ceil(n / 6);
    const labels = items.map((it, i) => (i % step === 0 || i === n - 1) ? `<text x="${x(i).toFixed(1)}" y="${h - 4}" font-size="9" fill="#a3ab95" text-anchor="middle">${esc(it.label)}</text>` : '').join('');
    return `<svg class="ops-chart" viewBox="0 0 ${w} ${h}" role="img"><polygon points="${area}" fill="#7183651f"/><polyline points="${pts}" fill="none" stroke="#718365" stroke-width="2"/>${dots}${labels}</svg>`;
  }

  function renderStats(d) {
    const box = $ops('#ops-stats');
    if (!box) return;
    const tot = d.totals || {};
    const session = tot.session || 0;
    const derived = [
      { k: '平均活跃时长', v: session ? Math.round((tot.activeSeconds || 0) / session) + ' 秒/会话' : '—' },
      { k: '平均照护次数', v: session ? ((tot.careActions || 0) / session).toFixed(1) + ' 次/会话' : '—' },
      { k: '积分净变化', v: fmtN((tot.pointsEarned || 0) - (tot.pointsSpent || 0)) },
      { k: '托管时长占比', v: (tot.activeSeconds || 0) ? (((tot.nannySeconds || 0) / tot.activeSeconds) * 100).toFixed(1) + '%' : '—' }
    ];
    const totRows = Object.keys(STAT_LABELS).filter(k => tot[k] > 0).map(k => `<span>${esc(STAT_LABELS[k])}</span><b>${fmtN(tot[k])}</b>`).join('');
    const derivedCards = derived.map(x => `<div class="ops-card"><small>${esc(x.k)}</small><strong>${esc(String(x.v))}</strong></div>`).join('');
    const days = Object.keys(d.daily || {}).sort().slice(-14);
    const activeSeries = days.map(day => ({ label: mmdd(day), value: (d.daily[day].activeSeconds || 0) }));
    const lines = days.length ? `<section class="ops-stat-sec"><h4>最近 ${days.length} 天 · 活跃时长(秒)</h4>${statLine(activeSeries)}</section>` : '';
    const careItems = Object.keys(CARE_LABELS).map(k => ({ label: CARE_LABELS[k], value: tot[k] || 0 }));
    const adoptItems = Object.keys(ADOPT_LABELS).map(k => ({ label: ADOPT_LABELS[k], value: tot[k] || 0 }));
    const stageItems = Object.keys(STAGE_LABELS).map(k => ({ label: STAGE_LABELS[k], value: tot[k] || 0 }));
    const hourly = d.hourly || {};
    const hourItems = Array.from({ length: 24 }, (_, hh) => ({ label: hh + '时', value: hourly[hh] || 0 }));
    const dist = `<section class="ops-stat-sec"><h4>照护类型分布</h4>${statHbars(careItems, '#8fa897')}</section>` +
      `<section class="ops-stat-sec"><h4>领养类型分布</h4>${statHbars(adoptItems, '#c7a16d')}</section>` +
      `<section class="ops-stat-sec"><h4>阶段晋级分布</h4>${statHbars(stageItems, '#aca1c0')}</section>` +
      `<section class="ops-stat-sec"><h4>24 小时活跃分布</h4>${statVBars(hourItems, '#718365')}</section>`;
    const dailyRows = days.slice().reverse().map(day => {
      const b = d.daily[day];
      const line = ['pageview', 'session', 'careActions', 'activeSeconds'].map(k => STAT_LABELS[k].replace(/\(.*\)/, '') + ' ' + fmtN(b[k] || 0)).join(' · ');
      return `<div class="ops-stat-day"><span>${esc(day)}</span><small>${esc(line)}</small></div>`;
    }).join('');
    box.innerHTML =
      `<div class="ops-stat-totals">${totRows || '<p class="ops-empty">暂无累计数据。</p>'}</div>` +
      `<div class="ops-cards">${derivedCards}</div>` +
      lines + dist +
      (dailyRows ? `<section class="ops-stat-sec"><h4>每日明细</h4>${dailyRows}</section>` : '') +
      `<p class="ops-hint">更新于 ${d.updatedAt ? new Date(d.updatedAt).toLocaleString('zh-CN') : '—'} · 数据为匿名聚合，仅供参考。</p>`;
  }
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#ops-close')) { close(); return; }
    if (t.closest('#ops-prices-reset')) { syncDraft(); draft.prices = {}; renderPrices(); note('已恢复默认价格（点“预览”或“发布”生效）。'); return; }
    if (t.closest('#ops-add')) { syncDraft(); draft.ads.items.push({ id: 'ad-' + Math.random().toString(36).slice(2, 8), slot: 'bottom', text: '', link: '', enabled: true }); renderEditor(); return; }
    if (t.closest('#ops-preset-top')) { syncDraft(); draft.ads.items.push({ ...PRESET_TOP, id: 'ad-' + Math.random().toString(36).slice(2, 8) }); renderEditor(); return; }
    if (t.closest('#ops-preset-bottom')) { syncDraft(); draft.ads.items.push({ ...PRESET_BOTTOM, id: 'ad-' + Math.random().toString(36).slice(2, 8) }); renderEditor(); return; }
    const up = t.closest('[data-up]'); if (up) { reorder(Number(up.getAttribute('data-up')), -1); return; }
    const down = t.closest('[data-down]'); if (down) { reorder(Number(down.getAttribute('data-down')), 1); return; }
    const del = t.closest('[data-del]'); if (del) { syncDraft(); draft.ads.items.splice(Number(del.getAttribute('data-del')), 1); renderEditor(); return; }
    if (t.closest('#ops-stats-refresh')) { syncDraft(); loadStats(); return; }
    if (t.closest('#ops-presence-refresh')) { loadPresence(); return; }
    if (t.closest('#ops-recheck')) { loadOpsStatus(); return; }
    if (t.closest('#ops-publish')) { publish(); return; }
    if (t.closest('#ops-preview')) { syncDraft(); S.preview(JSON.parse(JSON.stringify(draft))); note('已在本机预览（未保存）。'); return; }
    if (t.closest('#ops-clearPreview')) { S.clearPreview(); note('已取消本机预览。'); return; }
    if (t.closest('#ops-clearDismissed')) { S.clearDismissed(); note('已恢复被访客关闭的广告显示。'); return; }
    const forget = t.closest('#ops-forget-secret');
    if (forget) { forget.checked = true; forgetSecret(); note('已清除本机记住的密钥。下次发布或查看统计需要重新填写。'); return; }
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
      try { draft = JSON.parse($ops('#ops-json').value); S.BASE && (draft.site = draft.site || { footerNote: '' }); draft.ads = draft.ads || { topEnabled: true, bottomEnabled: true, items: [] }; draft.announcement = draft.announcement || { enabled: false, version: 0, title: '', body: '', link: '', ticker: true, modal: true }; draft.prices = draft.prices || {}; draft.gameplay = draft.gameplay || { vigilSeconds: 150 }; draft.analytics = draft.analytics || { firstParty: true, provider: '', measurementId: '', respectDNT: true, requireConsent: false }; }
      catch (_) { note('JSON 有误。'); return; }
      renderEditor(); note('已载入到编辑器，点「发布」或「预览」生效。'); return;
    }
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && root && !root.hidden) close(); });
  window.addEventListener('hashchange', () => { if (shouldOpen()) open(); });
  if (shouldOpen()) open();

  window.SiteAdmin = { open, close, isOpen: () => !!root && !root.hidden };
})();
