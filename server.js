'use strict';
// Static file server + tiny WebSocket relay that groups up to 4 phones by a 4-digit room code.
// The host (slot 0) runs the game; guests take slots 1-3.
//   guest → host: JSON only; the relay stamps it with `from: <slot>`.
//   host → guests: JSON with `to: <slot>` (omit or 0 = every guest), or binary whose first byte is the target slot.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { WebSocketServer } = require('ws');

const PORT = +process.env.PORT || 80;
const ROOT = process.env.STATIC_DIR || path.join(__dirname, 'public');
const MAX_GUESTS = 3;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};
const GZIP = new Set(['.html', '.js', '.webmanifest']);

// small site: keep every file (and a gzipped copy) in memory
const files = new Map();
(function load(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const f = path.join(dir, name);
    if (fs.statSync(f).isDirectory()) { load(f); continue; }
    const ext = path.extname(name), body = fs.readFileSync(f);
    files.set('/' + path.relative(ROOT, f).split(path.sep).join('/'), {
      body, gz: GZIP.has(ext) ? zlib.gzipSync(body) : null,
      type: MIME[ext] || 'application/octet-stream',
      cache: ext === '.png' || ext === '.woff2' ? 'public, max-age=2592000' : 'no-cache',
    });
  }
})(ROOT);

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  try { url = decodeURIComponent(url); } catch (e) { url = '/'; }
  if (url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  const f = files.get(url) || files.get(url.replace(/\/?$/, '/index.html')) || (path.extname(url) ? null : files.get('/index.html'));
  if (!f) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found'); return; }
  const useGz = f.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const body = useGz ? f.gz : f.body;
  const h = { 'Content-Type': f.type, 'Cache-Control': f.cache, 'Content-Length': body.length, 'X-Content-Type-Options': 'nosniff' };
  if (f.gz) h.Vary = 'Accept-Encoding';
  if (useGz) h['Content-Encoding'] = 'gzip';
  res.writeHead(200, h);
  res.end(req.method === 'HEAD' ? undefined : body);
});

// ---------------- rooms ----------------
const rooms = new Map();
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });
const sys = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
function newCode() {
  for (let i = 0; i < 1000; i++) {
    const c = String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(c)) return c;
  }
  return null;
}
function fromHost(r, data, isBinary) {
  if (isBinary) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data)]);
    const g = r.guests[buf[0]];
    if (g && g.readyState === 1) g.send(buf.subarray(1), { binary: true });
    return;
  }
  let to = 0;
  try { to = JSON.parse(data).to | 0; } catch (e) { return; }
  const text = data.toString();
  for (let s = 1; s <= MAX_GUESTS; s++) {
    const g = r.guests[s];
    if (g && g.readyState === 1 && (!to || to === s)) g.send(text);
  }
}
function fromGuest(r, ws, data, isBinary) {
  if (isBinary || !r.host || r.host.readyState !== 1) return;
  let m;
  try { m = JSON.parse(data); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  m.from = ws.slot;
  r.host.send(JSON.stringify(m));
}
wss.on('connection', ws => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (data, isBinary) => {
    const r = ws.room;
    if (r) { if (r.host === ws) fromHost(r, data, isBinary); else fromGuest(r, ws, data, isBinary); return; }
    if (isBinary) return;
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    if (m.t === 'create') {
      const code = newCode();
      if (!code) { sys(ws, { t: 'err', msg: '방을 만들 수 없어요. 잠시 후 다시 시도하세요' }); return; }
      const room = { code, host: ws, guests: [null, null, null, null] };
      rooms.set(code, room); ws.room = room; ws.slot = 0;
      sys(ws, { t: 'created', code });
    } else if (m.t === 'join') {
      const room = rooms.get(String(m.code));
      if (!room) { sys(ws, { t: 'err', msg: '그 코드의 방이 없어요' }); return; }
      let slot = 0;
      for (let s = 1; s <= MAX_GUESTS; s++) if (!room.guests[s]) { slot = s; break; }
      if (!slot) { sys(ws, { t: 'err', msg: '방이 가득 찼어요 (최대 4명)' }); return; }
      room.guests[slot] = ws; ws.room = room; ws.slot = slot;
      sys(ws, { t: 'joined', code: room.code, slot });
      sys(room.host, { t: 'peer-joined', slot });
    }
  });
  ws.on('close', () => {
    const r = ws.room;
    if (!r) return;
    ws.room = null;
    if (r.host === ws) {
      rooms.delete(r.code);
      for (const g of r.guests) if (g) { g.room = null; sys(g, { t: 'peer-left', slot: 0 }); }
    } else if (r.guests[ws.slot] === ws) {
      r.guests[ws.slot] = null;
      sys(r.host, { t: 'peer-left', slot: ws.slot });
    }
  });
});
// drop dead connections (phones that lost signal) so their rooms free up
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    try { ws.ping(); } catch (e) { /* ignore */ }
  }
}, 20000);

server.listen(PORT, () => console.log('starfall server on :' + PORT));
