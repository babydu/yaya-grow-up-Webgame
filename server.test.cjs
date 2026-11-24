'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createServer, readToken, CONFIG_FILE } = require('./server.js');

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
        announcement: { enabled: true, version: 1234, title: '公告标题', body: '公告正文', link: '', ticker: true, modal: true }
      })
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ok, true);

    // A fresh read reflects the global write.
    r = await fetch(base + '/api/site-config');
    const cfg = await r.json();
    assert.equal(cfg.site.footerNote, '全站生效的页脚');
    assert.equal(cfg.ads.topEnabled, false);
    assert.equal(cfg.ads.items.length, 1);
    assert.equal(cfg.ads.items[0].text, '赞助卡片文案');
    assert.equal(cfg.ads.items[0].junk, undefined); // sanitised
    assert.equal(cfg.announcement.title, '公告标题');
    assert.equal(cfg.announcement.version, 1234);

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
