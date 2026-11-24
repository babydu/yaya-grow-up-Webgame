// Minimal static server + global site-config API (no external dependencies).
//
//   PORT=8080 OPS_TOKEN=your-token node server.js
//
// - Serves the whole folder as static files.
// - GET  data/site-config.json  -> public config every visitor reads (static).
// - POST /api/site-config       -> writes data/site-config.json (global, live)
//                                  requires header x-admin-token === OPS_TOKEN.
//
// The admin token is read from the OPS_TOKEN env var, falling back to the
// adminToken declared in config.js, so operators can keep a single source.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'site-config.json');

function readToken() {
  if (process.env.OPS_TOKEN) return String(process.env.OPS_TOKEN);
  try {
    const src = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
    const m = /adminToken\s*:\s*['"]([^'"]+)['"]/.exec(src);
    if (m) return m[1];
  } catch (_) { /* ignore */ }
  return 'mkx7d2';
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8'
};

function sanitizeConfig(input) {
  const out = {};
  if (input && typeof input === 'object') {
    if (input.site && typeof input.site === 'object') {
      out.site = { footerNote: String(input.site.footerNote || '').slice(0, 200) };
    }
    if (input.ads && typeof input.ads === 'object') {
      const items = Array.isArray(input.ads.items) ? input.ads.items.slice(0, 30).map(a => {
        if (!a || typeof a !== 'object') return null;
        const text = String(a.text || '').slice(0, 200);
        if (!text) return null;
        let link = String(a.link || '').trim();
        if (link && !/^https?:\/\//i.test(link) && link[0] !== '/') link = '';
        return {
          id: String(a.id || 'ad-' + Math.random().toString(36).slice(2, 8)),
          slot: a.slot === 'top' ? 'top' : 'bottom',
          text, link, enabled: a.enabled !== false
        };
      }).filter(Boolean) : [];
      out.ads = {
        topEnabled: input.ads.topEnabled !== false,
        bottomEnabled: input.ads.bottomEnabled !== false,
        items
      };
    }
    if (input.announcement && typeof input.announcement === 'object') {
      const an = input.announcement;
      let link = String(an.link || '').trim();
      if (link && !/^https?:\/\//i.test(link) && link[0] !== '/') link = '';
      out.announcement = {
        enabled: an.enabled === true,
        version: Number.isSafeInteger(an.version) ? an.version : 0,
        title: String(an.title || '').slice(0, 120),
        body: String(an.body || '').slice(0, 1000),
        link,
        ticker: an.ticker !== false,
        modal: an.modal !== false
      };
    }
  }
  out.updatedAt = Date.now();
  return out;
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  // Block server source, test files, dotfiles and the git dir from being served.
  if (rel === '/server.js' || /\.test\.cjs$/i.test(rel) || rel.startsWith('/.') || rel.startsWith('/.git')) {
    return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  }
  const filePath = path.normalize(path.join(ROOT, rel));
  // Guard against sibling-prefix traversal (e.g. /workspace_evil vs /workspace).
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'text/plain; charset=utf-8', 'Forbidden');
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    if (p === '/api/site-config') {
      if (req.method === 'GET') {
        fs.readFile(CONFIG_FILE, 'utf8', (err, data) => {
          if (err) return send(res, 200, MIME['.json'], '{}');
          send(res, 200, MIME['.json'], data);
        });
        return;
      }
      if (req.method === 'POST') {
        const token = req.headers['x-admin-token'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (token !== readToken()) return send(res, 401, MIME['.json'], JSON.stringify({ ok: false, error: 'unauthorized' }));
        let raw = '';
        req.on('data', c => { raw += c; if (raw.length > 200000) { raw = ''; req.destroy(); } });
        req.on('end', () => {
          let body;
          try { body = JSON.parse(raw || '{}'); } catch (_) { return send(res, 400, MIME['.json'], JSON.stringify({ ok: false, error: 'bad-json' })); }
          const clean = sanitizeConfig(body);
          fs.mkdir(DATA_DIR, { recursive: true }, () => {
            const tmp = CONFIG_FILE + '.tmp';
            fs.writeFile(tmp, JSON.stringify(clean, null, 2), err => {
              if (err) return send(res, 500, MIME['.json'], JSON.stringify({ ok: false, error: 'write-failed' }));
              fs.rename(tmp, CONFIG_FILE, err2 => {
                if (err2) return send(res, 500, MIME['.json'], JSON.stringify({ ok: false, error: 'rename-failed' }));
                send(res, 200, MIME['.json'], JSON.stringify({ ok: true, updatedAt: clean.updatedAt }));
              });
            });
          });
        });
        return;
      }
      return send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed');
    serveStatic(req, res, p);
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8000;
  createServer().listen(port, () => {
    console.log(`site server on http://localhost:${port}  (ops token from ${process.env.OPS_TOKEN ? 'env' : 'config.js'})`);
  });
}

module.exports = { createServer, sanitizeConfig, readToken, CONFIG_FILE };
