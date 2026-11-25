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
const sanitizeHtml = require('./sanitize-html.js');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'site-config.json');
const STATS_FILE = process.env.STATS_FILE ? path.resolve(process.env.STATS_FILE) : path.join(DATA_DIR, 'stats.json');

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
        const text = sanitizeHtml(String(a.text || '')).slice(0, 2000);
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
        title: sanitizeHtml.strip(String(an.title || '')).slice(0, 120),
        body: sanitizeHtml(String(an.body || '')).slice(0, 4000),
        link,
        ticker: an.ticker !== false,
        modal: an.modal !== false
      };
    }
  }
  out.prices = {};
  if (input.prices && typeof input.prices === 'object' && !Array.isArray(input.prices)) {
    let n = 0;
    for (const [k, v] of Object.entries(input.prices)) {
      if (n >= 500) break;
      const id = String(k).slice(0, 80);
      const num = Number(v);
      if (Number.isSafeInteger(num) && num >= 1 && num <= 1000000) { out.prices[id] = num; n++; }
    }
  }
  if (input.analytics && typeof input.analytics === 'object') {
    const a = input.analytics;
    const mid = String(a.measurementId || '').trim().slice(0, 40);
    out.analytics = {
      firstParty: a.firstParty !== false,
      provider: a.provider === 'ga4' ? 'ga4' : '',
      measurementId: /^[A-Za-z0-9-]{0,40}$/.test(mid) ? mid : '',
      respectDNT: a.respectDNT !== false,
      requireConsent: a.requireConsent === true
    };
  }
  out.updatedAt = Date.now();
  return out;
}

// Anonymous first-party analytics: whitelisted counters only, clamped, no PII.
const STAT_FIELDS = {
  pageview: 10000, session: 10000, activeSeconds: 3600, careActions: 10000,
  adopts: 1000, checkins: 1000, stageUps: 1000, nannySeconds: 3600,
  pointsEarned: 100000, pointsSpent: 100000, criticals: 1000,
  adopt_cat: 1000, adopt_dog: 1000, adopt_baby: 1000, adopt_plant: 1000,
  care_food: 10000, care_clean: 10000, care_mood: 10000, care_energy: 10000,
  stage_0: 1000, stage_1: 1000, stage_2: 1000, stage_3: 1000
};
function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function sanitizeStat(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(STAT_FIELDS)) {
    const n = Number(input[key]);
    if (Number.isFinite(n) && n > 0) out[key] = Math.min(STAT_FIELDS[key], Math.round(n));
  }
  return out;
}
function readStats() {
  try { const v = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')); if (v && typeof v === 'object') return v; } catch (_) { /* ignore */ }
  return { totals: {}, daily: {}, updatedAt: 0 };
}
function writeJsonAtomic(file, value, cb) {
  fs.mkdir(DATA_DIR, { recursive: true }, () => {
    const tmp = file + '.tmp';
    fs.writeFile(tmp, JSON.stringify(value, null, 2), err => {
      if (err) return cb(err);
      fs.rename(tmp, file, cb);
    });
  });
}
const rateBuckets = new Map();
function rateAllowed(ip) {
  const now = Date.now();
  const arr = (rateBuckets.get(ip) || []).filter(t => now - t < 60000);
  if (arr.length >= 120) { rateBuckets.set(ip, arr); return false; }
  arr.push(now);
  rateBuckets.set(ip, arr);
  if (rateBuckets.size > 5000) rateBuckets.clear();
  return true;
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

    if (p === '/api/stat') {
      if (req.method !== 'POST') return send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed');
      const ip = (req.socket && req.socket.remoteAddress) || 'unknown';
      if (!rateAllowed(ip)) return send(res, 429, MIME['.json'], JSON.stringify({ ok: false, error: 'rate-limited' }));
      let raw = '';
      req.on('data', c => { raw += c; if (raw.length > 20000) { raw = ''; req.destroy(); } });
      req.on('end', () => {
        let body;
        try { body = JSON.parse(raw || '{}'); } catch (_) { return send(res, 400, MIME['.json'], JSON.stringify({ ok: false, error: 'bad-json' })); }
        const add = sanitizeStat(body);
        const hourOk = Number.isInteger(body.hour) && body.hour >= 0 && body.hour < 24;
        if (!Object.keys(add).length && !hourOk) return send(res, 200, MIME['.json'], JSON.stringify({ ok: true, ignored: true }));
        const stats = readStats();
        stats.totals = stats.totals || {}; stats.daily = stats.daily || {}; stats.hourly = stats.hourly || {};
        const day = today();
        const bucket = stats.daily[day] || (stats.daily[day] = {});
        for (const [k, v] of Object.entries(add)) {
          stats.totals[k] = (stats.totals[k] || 0) + v;
          bucket[k] = (bucket[k] || 0) + v;
        }
        if (hourOk) stats.hourly[body.hour] = (stats.hourly[body.hour] || 0) + 1;
        const days = Object.keys(stats.daily).sort();
        while (days.length > 60) delete stats.daily[days.shift()];
        stats.updatedAt = Date.now();
        writeJsonAtomic(STATS_FILE, stats, err => {
          if (err) return send(res, 500, MIME['.json'], JSON.stringify({ ok: false, error: 'write-failed' }));
          send(res, 200, MIME['.json'], JSON.stringify({ ok: true }));
        });
      });
      return;
    }

    if (p === '/api/stats') {
      if (req.method !== 'GET') return send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed');
      const token = req.headers['x-admin-token'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (token !== readToken()) return send(res, 401, MIME['.json'], JSON.stringify({ ok: false, error: 'unauthorized' }));
      return send(res, 200, MIME['.json'], JSON.stringify(readStats()));
    }

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

module.exports = { createServer, sanitizeConfig, readToken, CONFIG_FILE, STATS_FILE, sanitizeStat };
