'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const pathm = require('node:path');
process.env.STATS_FILE = pathm.join(os.tmpdir(), 'opencode-stats-' + process.pid + '.json');
try { fs.unlinkSync(process.env.STATS_FILE); } catch (_) { /* ignore */ }
const { createServer, readToken, tokenStatus, randomToken, CONFIG_FILE, STATS_FILE } = require('./server.js');

function listen() {
  return new Promise(resolve => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

test('site-config API: public read, token-guarded global write that persists', async () => {
  const backup = fs.existsSync(CONFIG_FILE) ? fs.readFileSync(CONFIG_FILE, 'utf8') : null;
  const server = await listen();
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = readToken();
  try {
    // Public read works.
    let r = await fetch(base + '/api/site-config');
    assert.equal(r.status, 200);

    // Write without the token is rejected.
    r = await fetch(base + '/api/site-config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ads: { items: [] } })
    });
    assert.equal(r.status, 401);

    // Write with the token is accepted and normalised.
    r = await fetch(base + '/api/site-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({
        site: { footerNote: '全站生效的页脚' },
        ads: { topEnabled: false, bottomEnabled: true, items: [
          { id: 'a1', slot: 'bottom', text: '赞助卡片文案', link: 'https://example.com', enabled: true, junk: 'drop' }
        ] },
        announcement: { enabled: true, version: 1234, title: '公告标题', body: '公告正文', link: '', ticker: true, modal: true },
        prices: { 'cat-milk': 25, 'bad': 0, 'neg': -5, 'big': 9999999 },
        gameplay: { vigilSeconds: 90, junk: 'drop' }
      })
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ok, true);

    // A fresh read reflects the global write.
    r = await fetch(base + '/api/site-config');
    const cfg = await r.json();
    assert.equal(cfg.gameplay.vigilSeconds, 90);
    assert.equal(cfg.site.footerNote, '全站生效的页脚');
    assert.equal(cfg.ads.topEnabled, false);
    assert.equal(cfg.ads.items.length, 1);
    assert.equal(cfg.ads.items[0].text, '赞助卡片文案');
    assert.equal(cfg.ads.items[0].junk, undefined); // sanitised
    assert.equal(cfg.announcement.title, '公告标题');
    assert.equal(cfg.announcement.version, 1234);
    assert.equal(cfg.prices['cat-milk'], 25);
    assert.equal(cfg.prices.bad, undefined);   // 0 dropped
    assert.equal(cfg.prices.neg, undefined);   // negative dropped
    assert.equal(cfg.prices.big, undefined);   // out of range dropped

    // Wrong token rejected.
    r = await fetch(base + '/api/site-config', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': 'nope' }, body: '{}'
    });
    assert.equal(r.status, 401);

    // Static serving works; server source and test files are not exposed.
    r = await fetch(base + '/'); assert.equal(r.status, 200);
    r = await fetch(base + '/server.js'); assert.equal(r.status, 404);
    r = await fetch(base + '/server.test.cjs'); assert.equal(r.status, 404);
    // Path traversal attempts are refused (never 200).
    for (const bad of ['/%2e%2e/%2e%2e/etc/passwd', '/..%2f..%2fetc%2fpasswd', '/../etc/passwd']) {
      r = await fetch(base + bad);
      assert.ok(r.status === 403 || r.status === 404, 'traversal blocked: ' + bad + ' -> ' + r.status);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (backup !== null) fs.writeFileSync(CONFIG_FILE, backup);
  }
});

test('stats API aggregates anonymous counters, clamps and is token-guarded', async () => {
  try { fs.unlinkSync(STATS_FILE); } catch (_) { /* ignore */ }
  const server = await listen();
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = readToken();
  try {
    // Public, anonymous ingest with junk + out-of-range values.
    let r = await fetch(base + '/api/stat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageview: 1, activeSeconds: 30, careActions: 2, care_food: 2, adopt_cat: 1, hour: 9, hack: 99, bad: -1 })
    });
    assert.equal(r.status, 200);
    r = await fetch(base + '/api/stat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageview: 1, activeSeconds: 45 })
    });
    assert.equal(r.status, 200);
    // Reading requires the operator token.
    r = await fetch(base + '/api/stats');
    assert.equal(r.status, 401);
    r = await fetch(base + '/api/stats', { headers: { 'x-admin-token': token } });
    const d = await r.json();
    assert.equal(d.totals.pageview, 2);
    assert.equal(d.totals.activeSeconds, 75);
    assert.equal(d.totals.careActions, 2);
    assert.equal(d.totals.care_food, 2);
    assert.equal(d.totals.adopt_cat, 1);
    assert.equal(d.hourly['9'], 1);
    assert.equal(d.totals.hack, undefined);
    assert.equal(d.totals.bad, undefined);
    assert.ok(Object.keys(d.daily).length >= 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
    try { fs.unlinkSync(STATS_FILE); } catch (_) { /* ignore */ }
  }
});

test('presence API reports live counts from heartbeats, token-guarded', async () => {
  try { fs.unlinkSync(STATS_FILE); } catch (_) { /* ignore */ }
  const server = await listen();
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = readToken();
  try {
    // Two visible tabs + one hidden tab heartbeat via the stats endpoint.
    await fetch(base + '/api/stat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presenceId: 'pabc123', visible: true })
    });
    await fetch(base + '/api/stat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presenceId: 'pdef456', visible: true })
    });
    await fetch(base + '/api/stat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presenceId: 'pghi789', visible: false })
    });
    // Malformed presence ids are ignored (no throw, not counted).
    await fetch(base + '/api/stat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presenceId: '<script>', visible: true })
    });

    // Re-heartbeating the same id does not double-count.
    await fetch(base + '/api/stat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presenceId: 'pabc123', visible: true })
    });

    // Reading live presence requires the operator token.
    let r = await fetch(base + '/api/presence');
    assert.equal(r.status, 401);
    r = await fetch(base + '/api/presence', { headers: { 'x-admin-token': token } });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.equal(d.onlineNow, 3);
    assert.equal(d.activeNow, 2);
    assert.equal(d.activeToday, 3);
  } finally {
    await new Promise(resolve => server.close(resolve));
    try { fs.unlinkSync(STATS_FILE); } catch (_) { /* ignore */ }
  }
});

test('security: raw stats.json is not served, ops-status reports protection, price keys are hardened', async () => {
  const backup = fs.existsSync(CONFIG_FILE) ? fs.readFileSync(CONFIG_FILE, 'utf8') : null;
  try { fs.unlinkSync(STATS_FILE); } catch (_) { /* ignore */ }
  const server = await listen();
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = readToken();
  try {
    // Anonymous analytics must NOT be downloadable as a static file (bypassing /api/stats).
    let r = await fetch(base + '/data/stats.json');
    assert.equal(r.status, 404, 'raw stats.json blocked');
    // Mid-write scratch files must not leak either.
    fs.writeFileSync(STATS_FILE + '.tmp', '{"partial":1}');
    r = await fetch(base + '/data/stats.json.tmp');
    assert.equal(r.status, 404, 'stats tmp blocked');
    // The public config stays readable (site.js needs it).
    r = await fetch(base + '/data/site-config.json');
    assert.equal(r.status, 200, 'site-config stays public');

    // ops-status: token-gated, reports whether the write key is really protected.
    r = await fetch(base + '/api/ops-status');
    assert.equal(r.status, 401);
    r = await fetch(base + '/api/ops-status', { headers: { 'x-admin-token': token } });
    assert.equal(r.status, 200);
    const st = await r.json();
    assert.equal(typeof st.writeProtected, 'boolean');
    assert.equal(st.writeProtected, !!process.env.OPS_TOKEN);

    // Prototype-polluting price keys are dropped, not stored.
    r = await fetch(base + '/api/site-config', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ prices: { '__proto__': 5, constructor: 5, 'cat-milk': 20 } })
    });
    assert.equal(r.status, 200);
    const cfg = await (await fetch(base + '/api/site-config')).json();
    assert.equal(cfg.prices['cat-milk'], 20);
    assert.equal(Object.prototype.hasOwnProperty.call(cfg.prices, '__proto__'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(cfg.prices, 'constructor'), false);
    assert.equal(Object.getPrototypeOf(cfg.prices), Object.prototype);

    // Token generator produces usable, distinct secrets.
    const a = randomToken(), b = randomToken();
    assert.ok(a.length >= 16 && a !== b, 'random tokens differ and are long enough');
  } finally {
    try { fs.unlinkSync(STATS_FILE + '.tmp'); } catch (_) { /* ignore */ }
    await new Promise(resolve => server.close(resolve));
    if (backup !== null) fs.writeFileSync(CONFIG_FILE, backup);
    try { fs.unlinkSync(STATS_FILE); } catch (_) { /* ignore */ }
  }
});

test('sanitize-html neutralises script injection, event handlers and unsafe urls', async () => {
  const s = require('./sanitize-html.js');
  // Script blocks and unknown tags are dropped; text is kept.
  assert.equal(s('<script>alert(1)</script><b>hi</b>'), '<b>hi</b>');
  assert.equal(s('<img src=x onerror=alert(1)>'), '');
  // Event-handler attributes never survive on allowed tags.
  assert.equal(s('<b onclick="alert(1)">x</b>'), '<b>x</b>');
  // javascript: hrefs are dropped together with the anchor (text kept).
  assert.ok(!/javascript/i.test(s('<a href="javascript:alert(1)">c</a>')));
  assert.ok(/c/.test(s('<a href="javascript:alert(1)">c</a>')));
  // Entity-encoded scheme is also rejected (we test the raw string).
  assert.ok(!/javascript/i.test(s('<a href="jav&#x61;script:alert(1)">c</a>')));
  // Safe http(s) and root-relative links are kept and sandboxed.
  assert.equal(s('<a href="https://ok.example/x">l</a>'), '<a href="https://ok.example/x" target="_blank" rel="noopener noreferrer nofollow">l</a>');
  assert.equal(s('<a href="/local">l</a>'), '<a href="/local" target="_blank" rel="noopener noreferrer nofollow">l</a>');
  // Style/script tags without a closing tag are still dropped (their text is
  // inert, the tag itself never survives).
  assert.equal(s('<style>body{}'), 'body{}');
  assert.equal(s('<script>alert(1)'), 'alert(1)');
  // strip() collapses raw text for ticker use.
  assert.equal(s.strip('<p>a</p> <b>b</b>'), 'a b');
});
