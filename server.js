/* Local development server (no dependencies). On Vercel, /public and /api are served directly. */
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env if present
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  });
} catch (e) { /* no .env file */ }

const routes = { '/api/agent': require('./api/agent'), '/api/library': require('./api/library') };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const PUBLIC = path.join(__dirname, 'public');

function wrap(res) {
  res.status = code => { res.statusCode = code; return res; };
  res.json = obj => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
  return res;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = routes[url.pathname];
  if (route) {
    const chunks = [];
    let size = 0;
    req.on('data', c => { size += c.length; if (size > 6 * 1024 * 1024) req.destroy(); else chunks.push(c); });
    req.on('end', () => {
      try { req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined; } catch (e) { req.body = undefined; }
      Promise.resolve(route(req, wrap(res))).catch(() => { res.statusCode = 500; res.end('{"ok":false,"error":"Server error"}'); });
    });
    return;
  }
  let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(PUBLIC)) { res.statusCode = 403; return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});

const port = Number(process.env.PORT) || 3000;
if (require.main === module) {
  server.listen(port, () => console.log('AinBondhu running at http://localhost:' + port + (process.env.GEMINI_API_KEY ? ' (live AI)' : ' (demo mode: no GEMINI_API_KEY)')));
}
module.exports = server;
