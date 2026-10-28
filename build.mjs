// Assembles the single-file dist/phone-ref.mjs from src/ (server + two pages + shared zoom engine + QR lib).
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const panzoom = read('src/panzoom.js');
const page = (f) => {
  const h = read(f);
  if (!h.includes('/*__PANZOOM__*/')) throw new Error(f + ' is missing the PANZOOM slot');
  return h.replace('/*__PANZOOM__*/', () => panzoom);
};
let src = read('src/server.mjs');
for (const [slot, val] of [['QR_LIB', read("vendor/qrcode-generator.min.js")], ['DROP_HTML', page('src/drop.html')], ['VIEW_HTML', page('src/view.html')]]) {
  const mark = `/*__${slot}__*/''`;
  if (!src.includes(mark)) throw new Error('missing slot ' + slot);
  src = src.replace(mark, () => JSON.stringify(val));
}
fs.mkdirSync(new URL('dist/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('dist/phone-ref.mjs', import.meta.url), src);
// syntax-check the inline page scripts too
for (const f of ['src/drop.html', 'src/view.html']) {
  const h = page(f);
  const scripts = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  scripts.forEach((s, i) => { try { new Function(s); } catch (e) { throw new Error(`${f} script ${i}: ${e.message}`); } });
}
console.log('built dist/phone-ref.mjs', fs.statSync(new URL('dist/phone-ref.mjs', import.meta.url)).size, 'bytes');
