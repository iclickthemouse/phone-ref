#!/usr/bin/env node
// phone-ref: drop an image or video on this computer, see it on your phone.
//
//   phone-ref                          start, open the drop page
//   phone-ref --watch "C:\folder"      also auto-show new files saved in a folder
//   phone-ref --data "E:\phone-ref"    where sessions are saved (default: ~/phone-ref)
//   phone-ref --port 7879              use a different port
//   phone-ref --no-open                don't open the browser
//
// Zero dependencies, Node 18+ (also runs under Bun, which builds the .exe / Mac binaries).
// Includes "QR Code Generator for JavaScript" (c) 2009 Kazuhiko Arase, MIT license.

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { exec } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const QR_LIB = /*__QR_LIB__*/'';
const DROP_HTML = /*__DROP_HTML__*/'';
const VIEW_HTML = /*__VIEW_HTML__*/'';

// ---------- options ----------
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const CONFIG = path.join(os.homedir(), '.phone-ref.json');
function loadConfig() { try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return {}; } }
function saveConfig(patch) { try { fs.writeFileSync(CONFIG, JSON.stringify({ ...loadConfig(), ...patch }, null, 2)); } catch {} }

const PORT = Number(opt('--port') || process.env.PORT || 7878);
const OPEN = !args.includes('--no-open');
const home = (p) => (p && (p === '~' || /^~[\\/]/.test(p)) ? path.join(os.homedir(), p.slice(1)) : p);
if (opt('--data')) saveConfig({ data: path.resolve(home(opt('--data'))) });
const DATA = path.resolve(home(opt('--data') || process.env.PHONE_REF_DATA || loadConfig().data) || path.join(os.homedir(), 'phone-ref'));
const SESSIONS = path.join(DATA, 'sessions');

const TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.heic': 'image/heic', '.heif': 'image/heif',
  '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.tif': 'image/tiff', '.tiff': 'image/tiff',
  '.jxl': 'image/jxl',
  '.mp4': 'video/mp4', '.m4v': 'video/x-m4v', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
};
const EXT_FOR = Object.fromEntries(Object.entries(TYPES).reverse().map(([e, t]) => [t, e]));
const typeOf = (name) => TYPES[path.extname(name).toLowerCase()] || '';
const isMedia = (t) => /^(image|video)\//.test(t);
const IG_MODES = ['off', 'feed', 'reel', 'story', 'grid'];

// ---------- sessions (each one is a folder: session.json + copies of dropped files + thumbs) ----------
let session = null;   // { id, name, created, updated, next, current, items: [ { id, name, type, kind, size, file, own, source, at, thumb } ] }
const sdir = (id = session.id) => path.join(SESSIONS, id);
const itemPath = (it) => (it.own ? path.join(sdir(), it.file) : it.file);
const itemById = (id) => session.items.find((i) => i.id === id);
const currentItem = () => (session.current != null && itemById(session.current)) || null;

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function niceName(d = new Date()) {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function saveSession() {
  session.updated = Date.now();
  fs.mkdirSync(sdir(), { recursive: true });
  const f = path.join(sdir(), 'session.json');
  fs.writeFileSync(f + '.tmp', JSON.stringify(session, null, 1));
  fs.renameSync(f + '.tmp', f);
}
function listSessions() {
  const out = [];
  let ids = [];
  try { ids = fs.readdirSync(SESSIONS); } catch {}
  for (const id of ids) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(SESSIONS, id, 'session.json'), 'utf8'));
      out.push({ id, name: s.name, created: s.created, updated: s.updated || s.created, count: s.items.length });
    } catch {}
  }
  return out.sort((a, b) => b.updated - a.updated);
}
function openSession(id) {
  const s = JSON.parse(fs.readFileSync(path.join(SESSIONS, id, 'session.json'), 'utf8'));
  s.id = id;
  s.items = s.items || [];
  s.next = Math.max(s.next || 1, ...s.items.map((i) => i.id + 1));
  session = s;
  saveSession();
  broadcast();
  log(`session "${session.name}" (${session.items.length} items)`);
}
function newSession() {
  if (session && session.items.length === 0) return;       // already on an empty one
  let id = stamp(), n = 2;
  while (fs.existsSync(path.join(SESSIONS, id))) id = `${stamp()}-${n++}`;
  session = { id, name: niceName(), created: Date.now(), updated: Date.now(), next: 1, current: null, items: [] };
  saveSession();
  broadcast();
  log(`new session "${session.name}"`);
}

function addItem({ id, file, own, name, type, source }) {
  const size = fs.statSync(file).size;
  const it = { id, name, type, kind: type.startsWith('video/') ? 'video' : 'image', size, file: own ? path.basename(file) : file, own, source, at: Date.now(), thumb: 0 };
  session.items.push(it);
  session.current = it.id;
  saveSession();
  broadcast();
  log(`→ phone  ${name}  (${fmtSize(size)}${source === 'watch' ? ', from watched folder' : ''})`);
  return it;
}
function selectItem(id) {
  if (!itemById(id)) return false;
  if (session.current !== id) { session.current = id; saveSession(); broadcast(); }
  return true;
}
function removeItem(id) {
  const i = session.items.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [it] = session.items.splice(i, 1);
  if (it.own) fs.rm(itemPath(it), { force: true }, () => {});
  fs.rm(path.join(sdir(), 'thumbs', `${it.id}.jpg`), { force: true }, () => {});
  if (session.current === id) session.current = session.items.length ? session.items[Math.min(i, session.items.length - 1)].id : null;
  saveSession();
  broadcast();
}
const reserveId = () => session.next++;
async function sessionFile(id, name, type) {
  await fsp.mkdir(sdir(), { recursive: true });
  const ext = path.extname(name) ? '' : EXT_FOR[type] || '';
  return path.join(sdir(), `${String(id).padStart(3, '0')}-${name}${ext}`);
}

// ---------- live state to every open page ----------
const clients = new Set();   // { res, role: 'phone' | 'embed' | 'desk' }
let ig = { mode: 'off', handle: 'your.handle', zones: false, ...(loadConfig().ig || {}) };

function pubItem(it) {
  if (!it) return null;
  const key = `${session.id}/${it.id}`;
  return {
    key, id: it.id, name: it.name, kind: it.kind, type: it.type, size: it.size,
    url: `/media/${key}/${encodeURIComponent(it.name)}`,
    thumb: it.thumb ? `/thumb/${key}?t=${it.thumb}` : null,
    missing: !it.own && !fs.existsSync(it.file),
  };
}
function state() {
  return {
    item: pubItem(currentItem()),
    phones: [...clients].filter((c) => c.role === 'phone').length,
    watch: watcher ? watcher.dir : null,
    ig,
    session: { id: session.id, name: session.name, items: session.items.map(pubItem) },
  };
}
function broadcast() {
  if (!session) return;
  const msg = `data: ${JSON.stringify(state())}\n\n`;
  for (const c of clients) c.res.write(msg);
}
setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, 15000).unref();

// ---------- network helpers ----------
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if ((a.family !== 'IPv4' && a.family !== 4) || a.internal || a.address.startsWith('169.254.')) continue;
      const [o1, o2] = a.address.split('.').map(Number);
      const tailscale = /tailscale/i.test(name) || (o1 === 100 && o2 >= 64 && o2 <= 127);
      const virtual = /vEthernet|VirtualBox|VMware|WSL|Hyper-V|docker|^br-|veth|ZeroTier|Npcap|Bluetooth|Loopback|utun|vboxnet|bridge|awdl|llw/i.test(name);
      out.push({ name, address: a.address, kind: tailscale ? 'tailscale' : virtual ? 'virtual' : 'lan' });
    }
  }
  const rank = { lan: 0, tailscale: 1, virtual: 2 };
  const priv = (ip) => (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ? 0 : 1);
  const phys = (n) => (/wi-?fi|wlan|wireless|ethernet|^eth|^en\d/i.test(n) ? 0 : 1);
  return out.sort((x, y) => rank[x.kind] - rank[y.kind] || priv(x.address) - priv(y.address) || phys(x.name) - phys(y.name));
}
function isLocal(req) {
  // behind a local proxy (e.g. Tailscale HTTPS), judge by the original client instead
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const a = (fwd || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  if (a === '127.0.0.1' || a === '::1') return true;
  return Object.values(os.networkInterfaces()).flat().some((i) => i && i.address === a);
}

// ---------- QR ----------
const qrcode = (() => { const m = { exports: {} }; new Function('module', 'exports', 'define', QR_LIB)(m, m.exports, undefined); return m.exports; })();
function qrMatrix(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount();
  return { n, dark: (r, c) => r >= 0 && c >= 0 && r < n && c < n && q.isDark(r, c) };
}
function qrSvg(text) {
  const { n, dark } = qrMatrix(text);
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 ${n + 6} ${n + 6}" shape-rendering="crispEdges"><rect x="-3" y="-3" width="${n + 6}" height="${n + 6}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
function qrTerminal(text) {
  const { n, dark } = qrMatrix(text);
  const lines = [];
  for (let r = -2; r < n + 2; r += 2) {
    let s = '  \x1b[47m\x1b[30m';
    for (let c = -2; c < n + 2; c++) {
      const t = dark(r, c), b = dark(r + 1, c);
      s += t && b ? '█' : t ? '▀' : b ? '▄' : ' ';
    }
    lines.push(s + '\x1b[0m');
  }
  return lines.join('\n');
}

// ---------- folder watch (e.g. ComfyUI output) ----------
let watcher = null; // { dir, w }
const pending = new Map();
const untilde = (p) => (p === '~' || /^~[\\/]/.test(p) ? path.join(os.homedir(), p.slice(1)) : p);
function startWatch(dir, save = true) {
  stopWatch(false);
  dir = path.resolve(untilde(dir));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`Not a folder: ${dir}`);
  const w = fs.watch(dir, { recursive: true }, (_evt, fname) => {
    if (!fname) return;
    const full = path.join(dir, fname.toString());
    if (!isMedia(typeOf(full))) return;
    clearTimeout(pending.get(full));
    pending.set(full, setTimeout(() => settle(full), 400));
  });
  w.on('error', (e) => log(`watch error: ${e.message}`));
  watcher = { dir, w };
  if (save) saveConfig({ watch: dir });
  log(`watching ${dir}`);
  broadcast();
}
function stopWatch(save = true) {
  if (watcher) { watcher.w.close(); log(`stopped watching ${watcher.dir}`); }
  watcher = null;
  if (save) { saveConfig({ watch: null }); broadcast(); }
}
// wait until the file stops growing (renders/encodes write over time), then show it
async function settle(full, lastSize = -1, tries = 0) {
  pending.delete(full);
  let st; try { st = await fsp.stat(full); } catch { return; }
  if (!st.isFile()) return;
  if (st.size === 0 || st.size !== lastSize) {
    if (tries < 150) pending.set(full, setTimeout(() => settle(full, st.size, tries + 1), 400));
    return;
  }
  const type = typeOf(full);
  if (type.startsWith('image/')) {      // video tools often save a same-named preview .png next to the .mp4: prefer the video
    const stem = full.slice(0, -path.extname(full).length);
    if (['.mp4', '.mov', '.webm', '.m4v', '.mkv'].some((e) => fs.existsSync(stem + e))) return;
  }
  const known = session.items.find((i) => !i.own && i.file === full);
  if (known) {
    if (known.size !== st.size) { known.size = st.size; known.thumb = 0; }
    session.current = known.id; saveSession(); broadcast();
    return;
  }
  addItem({ id: reserveId(), file: full, own: false, name: path.basename(full), type, source: 'watch' });
}

// ---------- http ----------
const send = (res, code, body, type = 'text/plain; charset=utf-8', extra = {}) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra }); res.end(body); };
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), 'application/json');
const readBody = async (req, max = 1e5) => { let s = ''; for await (const c of req) { s += c; if (s.length > max) break; } return s; };
const readJson = async (req) => { try { return JSON.parse(await readBody(req)); } catch { return {}; } };
const safeName = (s) => (s || 'pasted').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').slice(-120) || 'pasted';

async function handlePush(req, res) {
  let name = safeName(decodeURIComponent(req.headers['x-name'] || 'pasted'));
  let type = (req.headers['content-type'] || '').split(';')[0].trim();
  if (!isMedia(type)) type = typeOf(name);
  if (!isMedia(type)) return send(res, 415, `"${name}" isn't an image or video`);
  if (!path.extname(name) && EXT_FOR[type]) name += EXT_FOR[type];
  const id = reserveId();
  const file = await sessionFile(id, name, type);
  await pipeline(req, fs.createWriteStream(file));
  addItem({ id, file, own: true, name, type, source: 'drop' });
  json(res, 200, { ok: true });
}

async function handlePushUrl(req, res) {
  const url = (await readBody(req)).trim();
  if (/^file:/i.test(url)) {                         // a file path: show it in place, nothing copied
    const p = fileURLToPath(url);
    const type = typeOf(p);
    if (!isMedia(type) || !fs.existsSync(p)) return send(res, 415, "That isn't an image or video file");
    addItem({ id: reserveId(), file: p, own: false, name: path.basename(p), type, source: 'drop' });
    return json(res, 200, { ok: true });
  }
  if (!/^https?:/i.test(url)) return send(res, 400, 'Not a link');
  let r;
  try { r = await get(url); } catch (e) { return send(res, 502, `Couldn't fetch that link (${e.message})`); }
  if (r.statusCode !== 200) { r.resume(); return send(res, 502, `That link returned ${r.statusCode}`); }
  const u = new URL(r.finalUrl);
  let name = safeName(u.searchParams.get('filename') || decodeURIComponent(path.basename(u.pathname)) || 'linked');
  let type = (r.headers['content-type'] || '').split(';')[0].trim();
  if (!isMedia(type)) type = typeOf(name);
  if (!isMedia(type)) { r.resume(); return send(res, 415, "That link isn't an image or video"); }
  if (!path.extname(name) && EXT_FOR[type]) name += EXT_FOR[type];
  const id = reserveId();
  const file = await sessionFile(id, name, type);
  await pipeline(r, fs.createWriteStream(file));
  addItem({ id, file, own: true, name, type, source: 'drop' });
  json(res, 200, { ok: true });
}
// plain GET that follows redirects (e.g. ComfyUI's /view?filename=… links)
function get(url, hops = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const rq = lib.get(url, { headers: { 'User-Agent': 'phone-ref' }, timeout: 15000 }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && hops < 4) {
        r.resume();
        return resolve(get(new URL(r.headers.location, url).href, hops + 1));
      }
      r.finalUrl = url;
      resolve(r);
    });
    rq.on('timeout', () => rq.destroy(new Error('timed out')));
    rq.on('error', reject);
  });
}

// byte-range file serving: iPhone Safari won't play video without it
function serveFile(req, res, file, type, cache = 'no-store') {
  let size; try { size = fs.statSync(file).size; } catch { return send(res, 404, 'That file is gone'); }
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': cache };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  let start = 0, end = size - 1, code = 200;
  if (m) {
    if (m[1] === '' && m[2] !== '') { start = Math.max(0, size - Number(m[2])); }
    else { start = Number(m[1] || 0); if (m[2] !== '') end = Math.min(Number(m[2]), size - 1); }
    if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    code = 206; base['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  res.writeHead(code, { ...base, 'Content-Length': end - start + 1 });
  if (req.method === 'HEAD' || size === 0) return res.end();
  const s = fs.createReadStream(file, { start, end });
  s.on('error', () => res.destroy());
  res.on('close', () => s.destroy());
  s.pipe(res);
}
// /media/<session>/<id>/<name>  and  /thumb/<session>/<id>
function lookup(p) {
  const [, , sid, id] = p.split('/');
  if (sid !== session.id) return null;
  return itemById(Number(id)) || null;
}

function events(req, res, role) {
  req.socket.setNoDelay(true);
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 1500\n\n');
  const c = { res, role };
  clients.add(c);
  if (role === 'phone') broadcast(); else res.write(`data: ${JSON.stringify(state())}\n\n`);
  req.on('close', () => { clients.delete(c); if (role === 'phone') broadcast(); });
}

function openFolder(dir) {
  const cmd = process.platform === 'win32' ? `explorer "${dir}"` : process.platform === 'darwin' ? `open "${dir}"` : `xdg-open "${dir}"`;
  exec(cmd, () => {});
}

const html = (res, body) => send(res, 200, body, 'text/html; charset=utf-8');

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    const local = isLocal(req);

    // ---- open to the phone ----
    if (p === '/') return html(res, local ? DROP_HTML : VIEW_HTML);
    if (p === '/view') return html(res, VIEW_HTML);
    if (p === '/events') { const r = url.searchParams.get('role'); return events(req, res, r === 'phone' || r === 'embed' ? r : 'desk'); }
    if (p.startsWith('/media/')) { const it = lookup(p); return it ? serveFile(req, res, itemPath(it), it.type) : send(res, 404, 'Not found'); }
    if (p.startsWith('/thumb/') && req.method === 'GET') {
      const it = lookup(p);
      return it && it.thumb ? serveFile(req, res, path.join(sdir(), 'thumbs', `${it.id}.jpg`), 'image/jpeg', 'max-age=31536000') : send(res, 404, 'No thumb');
    }
    if (p === '/select' && req.method === 'POST') { const o = await readJson(req); return selectItem(Number(o.id)) ? json(res, 200, { ok: true }) : send(res, 404, 'No such item'); }
    if (p === '/ig' && req.method === 'POST') {
      const o = await readJson(req);
      if (IG_MODES.includes(o.mode)) ig.mode = o.mode;
      if (typeof o.zones === 'boolean') ig.zones = o.zones;
      if (local && typeof o.handle === 'string') ig.handle = o.handle.replace(/[^\w.]/g, '').slice(0, 30) || 'your.handle';
      saveConfig({ ig });
      broadcast();
      return json(res, 200, ig);
    }
    if (p === '/favicon.ico') return send(res, 204, '');

    // ---- only from this computer: nobody else on the Wi-Fi can push to your phone ----
    if (!local) return send(res, 403, 'Only from the computer running phone-ref');
    if (p === '/drop') return html(res, DROP_HTML);
    if (p === '/info') return json(res, 200, { port: PORT, addresses: lanAddresses(), data: DATA, platform: process.platform });
    if (p === '/qr.svg') return send(res, 200, qrSvg(url.searchParams.get('u') || ''), 'image/svg+xml');
    if (p === '/push' && req.method === 'PUT') return await handlePush(req, res);
    if (p === '/push-url' && req.method === 'POST') return await handlePushUrl(req, res);
    if (p.startsWith('/thumb/') && req.method === 'PUT') {
      const it = lookup(p);
      if (!it) return send(res, 404, 'No such item');
      await fsp.mkdir(path.join(sdir(), 'thumbs'), { recursive: true });
      await pipeline(req, fs.createWriteStream(path.join(sdir(), 'thumbs', `${it.id}.jpg`)));
      it.thumb = (it.thumb || 0) + 1;
      saveSession();
      broadcast();
      return json(res, 200, { ok: true });
    }
    if (p === '/remove' && req.method === 'POST') { const o = await readJson(req); removeItem(Number(o.id)); return json(res, 200, { ok: true }); }
    if (p === '/clear' && req.method === 'POST') { session.current = null; saveSession(); broadcast(); return json(res, 200, { ok: true }); }
    if (p === '/sessions') return json(res, 200, { current: session.id, sessions: listSessions() });
    if (p === '/session/new' && req.method === 'POST') { newSession(); return json(res, 200, { ok: true }); }
    if (p === '/session/open' && req.method === 'POST') {
      const o = await readJson(req);
      if (!/^[\w-]+$/.test(o.id || '') || !fs.existsSync(path.join(SESSIONS, o.id, 'session.json'))) return send(res, 404, 'No such session');
      openSession(o.id);
      return json(res, 200, { ok: true });
    }
    if (p === '/session/rename' && req.method === 'POST') {
      const o = await readJson(req);
      session.name = String(o.name || '').trim().slice(0, 80) || session.name;
      saveSession(); broadcast();
      return json(res, 200, { ok: true });
    }
    if (p === '/open-folder' && req.method === 'POST') { fs.mkdirSync(sdir(), { recursive: true }); openFolder(sdir()); return json(res, 200, { ok: true }); }
    if (p === '/view-state' && req.method === 'POST') {   // "Phone follows": relay desktop zoom/position
      const o = await readJson(req);
      const msg = `event: view\ndata: ${JSON.stringify({ v: String(o.v), z: +o.z, cx: +o.cx, cy: +o.cy })}\n\n`;
      for (const c of clients) if (c.role === 'phone') c.res.write(msg);
      return send(res, 204, '');
    }
    if (p === '/watch' && req.method === 'POST') {
      const dir = (await readBody(req)).trim().replace(/^"(.*)"$/, '$1');
      try { dir ? startWatch(dir) : stopWatch(); return json(res, 200, { ok: true }); }
      catch (e) { return send(res, 400, e.message); }
    }
    send(res, 404, 'Not found');
  } catch (e) {
    log(`error: ${e.message}`);
    if (!res.headersSent) send(res, 500, e.message); else res.destroy();
  }
});

// ---------- start ----------
function log(s) { console.log(`  ${new Date().toLocaleTimeString()}  ${s}`); }
function fmtSize(b) { return b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB'; }
function openBrowser(u) {
  const cmd = process.platform === 'win32' ? `start "" "${u}"` : process.platform === 'darwin' ? `open "${u}"` : `xdg-open "${u}"`;
  exec(cmd, () => {});
}

try { fs.rmSync(path.join(os.tmpdir(), 'phone-ref'), { recursive: true, force: true }); } catch {}   // v1/v2 temp folder
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
process.on('uncaughtException', (e) => log(`error (kept running): ${e.message}`));
process.on('unhandledRejection', (e) => log(`error (kept running): ${e && e.message}`));

// pick up where you left off: reopen the most recent session
fs.mkdirSync(SESSIONS, { recursive: true });
const last = listSessions()[0];
try { if (last) openSession(last.id); } catch (e) { log(`couldn't reopen last session: ${e.message}`); }
if (!session) newSession();

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.log(`\n  Port ${PORT} is busy. phone-ref may already be running: open http://localhost:${PORT}\n  Or start it on another port: --port ${PORT + 1}\n`);
  else console.log(`\n  Couldn't start: ${e.message}\n`);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  const addrs = lanAddresses();
  const phoneUrl = addrs[0] ? `http://${addrs[0].address}:${PORT}` : null;
  console.log('\n  phone-ref is running\n');
  console.log(`  On this computer:  http://localhost:${PORT}`);
  if (phoneUrl) {
    console.log(`  On your phone:     ${phoneUrl}   (same Wi-Fi)`);
    for (const a of addrs.slice(1)) console.log(`                     http://${a.address}:${PORT}   (${a.kind === 'tailscale' ? 'Tailscale' : a.name})`);
    console.log('\n' + qrTerminal(phoneUrl) + '\n');
  } else {
    console.log('  No network found. Connect to Wi-Fi so your phone can reach this computer.');
  }
  console.log(`  Sessions saved in: ${SESSIONS}`);
  const watchDir = opt('--watch') || loadConfig().watch;
  if (watchDir) { try { startWatch(watchDir, !!opt('--watch')); } catch (e) { log(e.message); } }
  console.log('  Keep this window open. Ctrl+C to stop.\n');
  if (OPEN) openBrowser(`http://localhost:${PORT}/`);
});
