#!/usr/bin/env node
// qr-prova.mjs — proves that every code QRCore draws scans.
//
// It serves docs/anteprime/casa/tools/qr on a local port, opens a test page in headless Chromium,
// draws a matrix of cases and decodes each one twice:
//   1. in the page, with QRCore.verify (jsQR on the canvas pixels);
//   2. outside the browser, on the saved PNG, with zxing-cpp (Python; OpenCV's QR detector as fallback).
// A case passes when both decoders return exactly the encoded text. A failure is acceptable only when
// QRCore.scannable already says "errore" for those options (the rule catches it); every other failure
// is a bug. It also checks: the module kinds of all 40 versions, that progress 1 is pixel-identical to
// the plain render, that squares land on whole device pixels, the payload strings, and the SVG output; and the motion
// options of QR Studio (cells, morph, flow, logoIn, eyeScale, frame): each lands exactly on the still picture at its ends,
// fixContrast reaches its target, maxLogoScale is the real limit, measure() matches what render draws.
//
// Usage (from the repo root):
//   node docs/anteprime/casa/tools/qr/strumenti/qr-prova.mjs [--out DIR] [--python PY] [--port 4101] [--only GROUP]
//   PY must import zxingcpp and PIL:  python3 -m venv v && v/bin/pip install zxing-cpp pillow
// Output: a summary table on stdout, every case in DIR/risultati.tsv, the PNGs in DIR/png/.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repo = path.resolve(root, '../../../../..');
const require = createRequire(path.join(repo, 'package.json'));
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), 'qr-prova')));
const PY = arg('--python', 'python3');
const PORT = +arg('--port', 4101);
const ONLY = arg('--only', '');
fs.mkdirSync(path.join(OUT, 'png'), { recursive: true });

// ---------------------------------------------------------------- strings (no Arabic typed by hand)
const cp = (...xs) => String.fromCodePoint(...xs);
function longUrl(len) {
  let s = 'https://www.esempio.it/articoli/2026/11/una-pagina-con-un-indirizzo-lungo?utm_source=instagram&utm_medium=bio&ref=';
  const pad = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let i = 0;
  while (s.length < len) s += pad[i++ % pad.length];
  return s.slice(0, len);
}
const TEXTS = {
  corto: 'https://imad.chat',
  url120: longUrl(120),
  url300: longUrl(300),
  italiano: 'Perché è così? Città, caffè, più là: «virgolette», l’apostrofo e un po’ di è é à ò ù ì.',
  // Arabic (salam), Cyrillic, CJK, Devanagari, then emoji: all from code points
  mondo: [cp(0x633, 0x644, 0x627, 0x645), cp(0x43f, 0x440, 0x438, 0x432, 0x435, 0x442), cp(0x4f60, 0x597d),
    cp(0x928, 0x92e, 0x938, 0x94d, 0x924, 0x947), cp(0x1f431, 0x2b50, 0x1f319, 0x1f600)].join(' '),
};
const WIFI_IN = { ssid: 'Casa; di "Imad", 2,4 GHz', password: 'p;a,s:s\\w"o rd!', security: 'WPA' };
const VCARD_IN = { name: 'Mario Rossi', org: 'Officina; Torino', title: 'Tecnico, turno A', phone: '+39 011 123 4567',
  email: 'mario.rossi@esempio.it', url: 'esempio.it', address: 'Via Roma 1, 10100 Torino', note: 'Riga uno\nRiga due' };

// ---------------------------------------------------------------- the test page
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>prova</title></head><body style="margin:0;background:#888">
<script src="/vendor/qrcode-generator.js"></script><script src="/vendor/jsQR.js"></script><script src="/qr-core.js"></script>
<script>
window.makeLogo = function (kind) {
  var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d');
  if (kind === 'chiaro') {
    x.fillStyle = '#f3e7c9'; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#c9a23f'; x.beginPath(); x.arc(128, 128, 80, 0, Math.PI * 2); x.fill();
  } else {
    // worst case: a dark, busy picture right in the middle of the code
    var g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#1d1b16'); g.addColorStop(1, '#3a2f1e');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#e8c15a'; x.beginPath(); x.arc(128, 128, 70, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#000'; x.lineWidth = 10; for (var i = 0; i < 6; i++) { x.beginPath(); x.moveTo(0, i * 50); x.lineTo(256, i * 50 + 40); x.stroke(); }
  }
  return c;
};
window.runCase = function (cs) {
  var t0 = performance.now();
  var qr = QRCore.encode(cs.text, cs.enc || {});
  var opts = Object.assign({}, cs.opts);
  if (opts.logo) opts.logo = Object.assign({}, opts.logo, { image: makeLogo(opts.logo.kind) });
  var cv = document.createElement('canvas');
  var info = QRCore.render(cv, qr, opts);
  var v = QRCore.verify(cv, cs.text);
  var sc = QRCore.scannable(opts, qr);
  if (opts.frame && !(cv.height > cv.width)) v = { ok: false, text: 'cornice senza altezza', inverted: false, scale: 0 };
  return { version: qr.version, n: qr.n, mode: qr.mode, m: info.m, quiet: info.quiet, cleared: info.cleared,
    js: v.text, jsOk: v.ok, inv: v.inverted, level: sc.level, why: sc.why, codes: sc.problems.map(function (p) { return p.code + ':' + p.level; }).join(','),
    det: sc.details, scale: v.scale, png: cv.toDataURL('image/png'), ms: Math.round(performance.now() - t0) };
};
window.runSvg = function (cs) {
  return new Promise(function (resolve) {
    var qr = QRCore.encode(cs.text, cs.enc || {});
    var opts = Object.assign({}, cs.opts);
    if (opts.logo) opts.logo = Object.assign({}, opts.logo, { image: makeLogo(opts.logo.kind) });
    var s = QRCore.svg(qr, opts);
    var img = new Image();
    img.onload = function () {
      var px = Math.round(opts.size * (cs.scale || 2));
      var cv = document.createElement('canvas'); cv.width = px; cv.height = Math.round(px * (img.naturalHeight || img.height) / (img.naturalWidth || img.width));
      var x = cv.getContext('2d'); x.drawImage(img, 0, 0, cv.width, cv.height);
      var v = QRCore.verify(cv, cs.text);
      var sc = QRCore.scannable(Object.assign({}, opts, { dpr: cs.scale || 2, svg: true }), qr);
      resolve({ version: qr.version, n: qr.n, mode: qr.mode, m: px / (qr.n + 8), quiet: 4, cleared: 0, js: v.text, jsOk: v.ok, inv: v.inverted,
        level: sc.level, why: sc.why, codes: sc.problems.map(function (p) { return p.code + ':' + p.level; }).join(','), det: sc.details, scale: v.scale, png: cv.toDataURL('image/png'), bytes: s.length, ms: 0 });
    };
    img.onerror = function () { resolve({ error: 'svg non caricato' }); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  });
};
</script></body></html>`;

const MIME = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/__prova.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(PAGE); }
  const f = path.join(root, path.normalize(u).replace(/^([/\\])+/, ''));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

// ---------------------------------------------------------------- the matrix
const SHAPES = ['quadrati', 'punti', 'tondi', 'uniti'];
const EYES = ['quadrato', 'tondo', 'goccia'];
const cases = [];
let seq = 0;
const add = (group, label, text, enc, opts, extra) => cases.push(Object.assign({ id: String(++seq).padStart(4, '0'), group, label, text, enc, opts }, extra || {}));

function buildCases(page) {
  return page.evaluate(([w, v]) => ({ wifi: QRCore.payload.wifi(w), vcard: QRCore.payload.vcard(v) }), [WIFI_IN, VCARD_IN]);
}

function matrix(P) {
  const contents = { corto: TEXTS.corto, url300: TEXTS.url300, italiano: TEXTS.italiano, mondo: TEXTS.mondo, wifi: P.wifi, vcard: P.vcard };
  // A. contents x ecc
  for (const [k, t] of Object.entries(contents)) for (const ecc of ['L', 'M', 'Q', 'H'])
    add('contenuti', `${k} ecc ${ecc}`, t, { ecc }, { size: 320, dpr: 2 });
  // B. shapes x sizes x pixel ratios
  for (const k of ['corto', 'url120', 'url300']) for (const shape of SHAPES) for (const size of [96, 132, 320]) for (const dpr of [1, 2, 3])
    add('misure', `${k} ${shape} ${size}px x${dpr}`, TEXTS[k], { ecc: 'M' }, { size, dpr, shape });
  // C. eyes x shapes
  for (const eye of EYES) for (const shape of SHAPES) {
    add('occhi', `url120 ${shape}/${eye} 132px x2`, TEXTS.url120, { ecc: 'M' }, { size: 132, dpr: 2, shape, eye });
    add('occhi', `vcard ${shape}/${eye} 320px x1`, P.vcard, { ecc: 'M' }, { size: 320, dpr: 1, shape, eye });
  }
  // D. colours
  const grad = { from: '#8a5a12', to: '#1d1b16', angle: 45 };
  const grad2 = { from: '#2b6cb0', to: '#6b21a8', angle: 90 };
  for (const shape of SHAPES) {
    add('colori', `gradiente oro ${shape} 320px x2`, TEXTS.url120, { ecc: 'M' }, { size: 320, dpr: 2, shape, eye: 'tondo', fg: grad });
    add('colori', `gradiente blu ${shape} 132px x2`, TEXTS.url120, { ecc: 'M' }, { size: 132, dpr: 2, shape, eye: 'goccia', fg: grad2 });
    add('colori', `trasparente ${shape} 132px x2`, TEXTS.url120, { ecc: 'M' }, { size: 132, dpr: 2, shape, bg: 'transparent', fg: '#1d1b16' });
    add('colori', `trasparente ${shape} 320px x1`, TEXTS.corto, { ecc: 'M' }, { size: 320, dpr: 1, shape, bg: 'transparent', fg: grad });
    add('colori', `inchiostro su carta ${shape} 132px x3`, TEXTS.url120, { ecc: 'M' }, { size: 132, dpr: 3, shape, fg: '#2a2418', bg: '#f4ecd8' });
  }
  // colours a rule must catch (or that must still pass)
  add('colori', 'chiaro su scuro', TEXTS.corto, { ecc: 'M' }, { size: 320, dpr: 2, fg: '#ffffff', bg: '#111111' });
  add('colori', 'chiaro su scuro uniti', TEXTS.url120, { ecc: 'M' }, { size: 132, dpr: 2, shape: 'uniti', fg: '#f4ecd8', bg: '#1d1b16' });
  add('colori', 'contrasto basso (grigi)', TEXTS.corto, { ecc: 'M' }, { size: 320, dpr: 2, fg: '#9a9a9a', bg: '#d0d0d0' });
  add('colori', 'contrasto basso (giallo)', TEXTS.corto, { ecc: 'M' }, { size: 320, dpr: 2, fg: '#ffd84d', bg: '#ffffff' });
  add('colori', 'contrasto medio (oro)', TEXTS.corto, { ecc: 'M' }, { size: 320, dpr: 2, fg: '#b08a2e', bg: '#ffffff' });
  add('colori', 'margine 2', TEXTS.url120, { ecc: 'M' }, { size: 132, dpr: 2, quiet: 2 });
  // E. logo
  for (const scale of [0.18, 0.24, 0.3]) for (const ecc of ['M', 'Q', 'H']) for (const shape of SHAPES) {
    add('logo', `logo ${scale} ecc ${ecc} ${shape} 320px x2`, TEXTS.url120, { ecc }, { size: 320, dpr: 2, shape, eye: 'tondo', logo: { scale, kind: 'scuro', round: true } });
    add('logo', `logo ${scale} ecc ${ecc} ${shape} 132px x3`, TEXTS.corto, { ecc }, { size: 132, dpr: 3, shape, logo: { scale, kind: 'chiaro' } });
  }
  // E2. where the logo limit really is: a dark, busy picture, growing until the code stops reading
  for (const [k, t] of [['corto', TEXTS.corto], ['url60', longUrl(60)], ['url120', TEXTS.url120], ['url300', TEXTS.url300]])
    for (const ecc of ['M', 'Q', 'H']) for (const scale of [0.12, 0.15, 0.18, 0.21, 0.24, 0.27, 0.3]) for (const pad of [0, 1, 2]) for (const shape of ['quadrati', 'uniti'])
      add('logo-limite', `${k} ecc ${ecc} logo ${scale} pad ${pad} ${shape}`, t, { ecc }, { size: 320, dpr: 2, shape, logo: { scale, pad, kind: 'scuro' } });
  // E3. every size of code: lengths that reach versions 1 to 40, big enough to read (about 6 device px a module)
  for (const len of [10, 40, 80, 150, 250, 400, 600, 850, 1100, 1400, 1700, 2000, 2300, 2600, 2900]) for (const shape of ['quadrati', 'uniti']) {
    const t = longUrl(Math.max(len, 30)).slice(0, len).replace(/^https:\/\/www\.esempio\.it/, len < 30 ? 'imad.chat' : 'https://www.esempio.it');
    add('versioni', `${len} caratteri ${shape}`, t, { ecc: 'L' }, { size: 400, dpr: 3, shape, eye: 'tondo' });
  }
  // F. the home tile: URLs up to 120 characters, 120 to 132 CSS px, every shape and eye, x1 to x3
  for (const len of [24, 60, 90, 120]) for (const shape of SHAPES) for (const eye of EYES) for (const size of [120, 132]) for (const dpr of [1, 2, 3]) {
    const t = len === 24 ? 'https://imad.chat/tools' + '/'.repeat(1) : longUrl(len);
    add('casa', `url${len} ${shape}/${eye} ${size}px x${dpr}`, t.slice(0, len), { ecc: 'M' }, { size, dpr, shape, eye, quiet: 4, fg: '#1d1b16', bg: '#ffffff' });
  }
  // F2. pixel ratios of real Android phones and SVGs rasterised off the module grid
  for (const shape of SHAPES) for (const dpr of [1.5, 2.625, 3.5]) add('frazionari', `url120 ${shape} 132px x${dpr}`, TEXTS.url120, { ecc: 'M' }, { size: 132, dpr, shape, eye: 'goccia' });
  for (const shape of SHAPES) for (const [k, t, ecc] of [['vcard', P.vcard, 'M'], ['url300', TEXTS.url300, 'Q']]) for (const scale of [1, 1.37])
    add('frazionari', `svg ${k} ${shape} x${scale}`, t, { ecc }, { size: 320, shape, eye: 'tondo', fg: { from: '#8a5a12', to: '#1d1b16' } }, { svg: true, scale });
  // H. QR Studio: the frame with its caption (canvas and SVG), with gradients, a transparent ground and a picture
  for (const shape of SHAPES) for (const eye of EYES) {
    add('cornice', `cornice ${shape}/${eye} 1024px`, TEXTS.url120, { ecc: 'M' }, { size: 1024, dpr: 1, shape, eye, fg: '#221d14', bg: '#fbf6ea', frame: { text: 'Scansiona' } });
  }
  for (const shape of SHAPES) {
    add('cornice', `cornice sfumata trasparente ${shape} 512px x2`, TEXTS.corto, { ecc: 'M' }, { size: 512, dpr: 2, shape, eye: 'tondo', bg: 'transparent', fg: { from: '#c6504a', to: '#9d6d28', angle: 45 }, frame: { text: 'Scansiona' } });
    add('cornice', `cornice lunga logo ${shape} 1024px`, TEXTS.url120, { ecc: 'H' }, { size: 1024, dpr: 1, shape, eye: 'goccia', frame: { text: 'Inquadra e apri il menu della settimana' }, logo: { scale: 0.2, kind: 'scuro', round: true } });
    add('cornice', `cornice senza scritta ${shape} 1024px`, TEXTS.corto, { ecc: 'M' }, { size: 1024, dpr: 1, shape, frame: { text: '' } });
    add('cornice', `svg cornice ${shape}`, TEXTS.url120, { ecc: 'Q' }, { size: 512, shape, eye: 'tondo', fg: { from: '#172554', to: '#7a1f5c', angle: 90 }, frame: { text: 'Scansiona' } }, { svg: true, scale: 2 });
  }
  // G. SVG
  for (const shape of SHAPES) {
    add('svg', `svg ${shape} url120`, TEXTS.url120, { ecc: 'M' }, { size: 132, shape, eye: 'goccia' }, { svg: true, scale: 2 });
    add('svg', `svg ${shape} gradiente`, P.vcard, { ecc: 'Q' }, { size: 320, shape, eye: 'tondo', fg: grad }, { svg: true, scale: 1 });
    add('svg', `svg ${shape} logo 0.24`, TEXTS.url120, { ecc: 'H' }, { size: 320, shape, logo: { scale: 0.24, kind: 'scuro', round: true } }, { svg: true, scale: 1 });
  }
}

// ---------------------------------------------------------------- independent decoder
const PYCODE = String.raw`
import json, sys
files = json.load(open(sys.argv[1]))
out = {}
try:
    import zxingcpp
    from PIL import Image
    from importlib.metadata import version
    eng = 'zxing-cpp ' + version('zxing-cpp')
    def flat(f):
        im = Image.open(f).convert('RGBA')
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        return Image.alpha_composite(bg, im).convert('L')
    for f in files:
        im = flat(f)
        r = zxingcpp.read_barcodes(im, formats=zxingcpp.BarcodeFormat.QRCode, try_invert=False, text_mode=zxingcpp.TextMode.Plain)
        inv = False
        if not r:
            r = zxingcpp.read_barcodes(im, formats=zxingcpp.BarcodeFormat.QRCode, try_invert=True, text_mode=zxingcpp.TextMode.Plain)
            inv = bool(r)
        out[f] = {'text': r[0].text if r else None, 'inv': inv}
except ImportError:
    import cv2, numpy as np
    eng = 'opencv ' + cv2.__version__
    det = cv2.QRCodeDetector()
    for f in files:
        im = cv2.imread(f, cv2.IMREAD_UNCHANGED)
        if im.shape[2] == 4:
            a = im[:, :, 3:4] / 255.0
            im = (im[:, :, :3] * a + 255 * (1 - a)).astype('uint8')
        t, pts, _ = det.detectAndDecode(im)
        inv = False
        if not t:
            t, pts, _ = det.detectAndDecode(255 - im)
            inv = bool(t)
        out[f] = {'text': t or None, 'inv': inv}
json.dump({'engine': eng, 'res': out}, open(sys.argv[2], 'w'), ensure_ascii=False)
`;

// ---------------------------------------------------------------- self checks (in the page)
async function selfChecks(page) {
  return page.evaluate(([w, v, wifiIn, vcardIn]) => {
    const fails = [];
    const ok = (cond, what) => { if (!cond) fails.push(what); };
    // module kinds of every version
    for (let ver = 1; ver <= 40; ver++) {
      const qr = QRCore.encode('A', { ecc: 'L', minVersion: ver });
      if (qr.version !== ver) { fails.push('minVersion ' + ver + ' -> ' + qr.version); continue; }
      const n = qr.n;
      const finder = (r, c) => { const R = Math.max(Math.abs(r - 3), Math.abs(c - 3)); return R === 2 ? false : R <= 3; };
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const k = qr.kind(r, c), d = qr.get(r, c);
        let rr = r, cc = c;
        if (k === 'finder') {
          if (c >= n - 8) cc = n - 1 - c; if (r >= n - 8) rr = n - 1 - r;
          if (rr === 7 || cc === 7) ok(!d, `v${ver} separatore ${r},${c}`);
          else ok(d === finder(rr, cc), `v${ver} occhio ${r},${c}`);
        } else if (k === 'timing') ok(d === ((r === 6 ? c : r) % 2 === 0), `v${ver} timing ${r},${c}`);
      }
      // alignment: 5x5 ring pattern around each centre
      const counts = { align: 0 };
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.kind(r, c) === 'align') counts.align++;
      ok(counts.align % 25 === 0, `v${ver} allineamento ${counts.align}`);
      ok(qr.get(n - 8, 8) && qr.kind(n - 8, 8) === 'format', `v${ver} modulo scuro`);
    }
    // payloads
    const P = QRCore.payload;
    ok(P.url('  imad.chat ') === 'https://imad.chat', 'url host');
    ok(P.url('www.esempio.it/a?b=1') === 'https://www.esempio.it/a?b=1', 'url www');
    ok(P.url('localhost:3000/x') === 'https://localhost:3000/x', 'url localhost');
    ok(P.url('http://a.it') === 'http://a.it', 'url http');
    ok(P.url('mailto:a@b.it') === 'mailto:a@b.it', 'url mailto');
    ok(P.url('ciao come stai') === 'ciao come stai', 'url testo');
    ok(P.url('//cdn.esempio.it/x') === 'https://cdn.esempio.it/x', 'url //');
    ok(P.wifi({ ssid: 'a;b', password: 'x"y\\z', security: 'WPA', hidden: true }) === 'WIFI:T:WPA;S:a\\;b;P:x\\"y\\\\z;H:true;;', 'wifi escape ' + P.wifi({ ssid: 'a;b', password: 'x"y\\z', security: 'WPA', hidden: true }));
    ok(P.wifi({ ssid: 'Ospiti' }) === 'WIFI:T:nopass;S:Ospiti;;', 'wifi nopass');
    ok(P.email({ to: 'a@b.it', subject: 'Ciao è', body: 'riga\nriga' }) === 'mailto:a@b.it?subject=Ciao%20%C3%A8&body=riga%0D%0Ariga', 'email');
    ok(P.tel('+39 011 12.34-56') === 'tel:+39011123456', 'tel');
    ok(P.sms({ to: '333 123', body: 'ci vediamo: alle 5' }) === 'SMSTO:333123:ci vediamo: alle 5', 'sms');
    ok(v.indexOf('BEGIN:VCARD\r\nVERSION:3.0\r\nN:Rossi;Mario;;;\r\nFN:Mario Rossi\r\nORG:Officina\\; Torino\r\n') === 0, 'vcard head');
    ok(v.indexOf('NOTE:Riga uno\\nRiga due\r\nEND:VCARD') > 0, 'vcard note');
    // the wifi string parses back to the original fields (the way ZXing does)
    const parse = (s, key) => { const i = s.indexOf(key + ':'); let out = '', j = i + key.length + 1; while (j < s.length && s[j] !== ';') { if (s[j] === '\\') j++; out += s[j]; j++; } return out; };
    ok(parse(w.slice(5), 'P') === wifiIn.password && parse(w.slice(5), 'S') === wifiIn.ssid, 'wifi parse back');
    // errors
    try { QRCore.encode(''); fails.push('vuoto senza errore'); } catch (e) { ok(e.code === 'VUOTO', 'codice VUOTO'); }
    try { QRCore.encode('x'.repeat(3000), { ecc: 'H' }); fails.push('troppo lungo senza errore'); } catch (e) { ok(e.code === 'TROPPO_LUNGO' && /QR/.test(e.message), 'codice TROPPO_LUNGO'); }
    // progress 1 is the final picture; squares on whole pixels
    const qr = QRCore.encode('https://imad.chat/tools/qr');
    for (const shape of ['quadrati', 'punti', 'tondi', 'uniti']) for (const order of ['onda', 'righe', 'caso']) {
      const a = document.createElement('canvas'), b = document.createElement('canvas');
      const o = { size: 133, dpr: 3, shape, eye: 'goccia', fg: { from: '#a00', to: '#004' } };
      QRCore.render(a, qr, o);
      QRCore.render(b, qr, Object.assign({}, o, { progress: 0.4, order }));
      QRCore.render(b, qr, Object.assign({}, o, { progress: 1, order }));
      const da = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, db = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
      let diff = 0; for (let i = 0; i < da.length; i++) if (da[i] !== db[i]) diff++;
      ok(diff === 0, `progress 1 ${shape}/${order}: ${diff} byte diversi`);
      // a half-drawn frame must differ and must not throw
      const c = document.createElement('canvas');
      QRCore.render(c, qr, Object.assign({}, o, { progress: 0.5, order }));
      const dc = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let d2 = 0; for (let i = 0; i < da.length; i += 4) if (da[i] !== dc[i]) d2++;
      ok(d2 > 0, `progress 0.5 ${shape}/${order} uguale al finale`);
    }
    for (const dpr of [1, 1.5, 2, 2.625, 3]) {
      const a = document.createElement('canvas');
      QRCore.render(a, qr, { size: 131, dpr, shape: 'quadrati', fg: '#123456', bg: '#fedcba' });
      const d = a.getContext('2d').getImageData(0, 0, a.width, a.height).data;
      const seen = {}; for (let i = 0; i < d.length; i += 4) seen[d[i] + ',' + d[i + 1] + ',' + d[i + 2]] = 1;
      ok(Object.keys(seen).length === 2, `pixel interi x${dpr}: ${Object.keys(seen).length} colori`);
    }
    // contrast
    ok(Math.abs(QRCore.contrast('#000', '#fff') - 21) < 0.01, 'contrasto 21');
    ok(QRCore.contrast({ from: '#000', to: '#777' }, '#fff') < 5, 'contrasto gradiente');
    ok(QRCore.suggestEcc(true) === 'H' && QRCore.suggestEcc(false) === 'M', 'suggestEcc');
    // verify takes ImageData too, and says no to a wrong expected text
    const cv = document.createElement('canvas');
    QRCore.render(cv, qr, { size: 200, dpr: 2, bg: 'transparent' });
    const id = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
    ok(QRCore.verify(id, 'https://imad.chat/tools/qr').ok, 'verify ImageData');
    ok(!QRCore.verify(cv, 'https://imad.chat/altro').ok, 'verify testo diverso');
    ok(QRCore.svg(qr, { size: 100 }).indexOf('<svg') === 0, 'svg');

    // QR Studio: the motion options land exactly on the still picture at their ends
    const px = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const same = (a, b) => { if (a.length !== b.length) return -1; let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
    const draw = (q, o) => { const c = document.createElement('canvas'); QRCore.render(c, q, o); return c; };
    const logo = document.createElement('canvas'); logo.width = logo.height = 64; const lx = logo.getContext('2d'); lx.fillStyle = '#c33'; lx.fillRect(0, 0, 64, 64);
    for (const shape of ['quadrati', 'punti', 'tondi', 'uniti']) for (const eye of ['quadrato', 'tondo', 'goccia']) {
      const base = { size: 188, dpr: 3, shape, eye, fg: '#222', bg: '#fbf6ea' };
      const R = px(draw(qr, base));
      const tg = QRCore.targets(qr, base), cells = new Float32Array(tg.length); for (let i = 0; i < tg.length; i++) cells[i] = tg[i];
      ok(same(R, px(draw(qr, Object.assign({}, base, { cells })))) === 0, `cells a riposo ${shape}/${eye}`);
      ok(same(R, px(draw(qr, Object.assign({}, base, { morph: { shape: 'punti', eye: 'goccia', t: 1 } })))) === 0, `morph t=1 ${shape}/${eye}`);
      ok(same(R, px(draw(qr, Object.assign({}, base, { flow: { fg: '#f00', bg: '#000', t: 1 } })))) === 0, `flow t=1 ${shape}/${eye}`);
      ok(same(R, px(draw(qr, Object.assign({}, base, { eyeScale: 1 })))) === 0, `eyeScale 1 ${shape}/${eye}`);
      ok(same(R, px(draw(qr, Object.assign({}, base, { fg: '#f00', bg: '#000', flow: { fg: '#222', bg: '#fbf6ea', t: 0 } })))) === 0, `flow t=0 ${shape}/${eye}`);
      for (const fs of ['quadrati', 'uniti']) for (const fe of ['quadrato', 'goccia']) {
        if (fs === shape && fe === eye) continue;
        const a = px(draw(qr, Object.assign({}, base, { shape: fs, eye: fe }))), b = px(draw(qr, Object.assign({}, base, { morph: { shape: fs, eye: fe, t: 0 } })));
        ok(same(a, b) === 0, `morph t=0 da ${fs}/${fe} a ${shape}/${eye}`);
      }
      const L = Object.assign({}, base, { logo: { image: logo, scale: 0.2, round: true } });
      const RL = px(draw(qr, L));
      ok(same(RL, px(draw(qr, Object.assign({}, L, { logoIn: 1 })))) === 0, `logoIn 1 ${shape}/${eye}`);
      ok(same(RL, px(draw(qr, Object.assign({}, L, { logoIn: 0.4 })))) > 0, `logoIn 0.4 diverso ${shape}/${eye}`);
      // a frame in motion, a field half way, a morph and a flow together: no throw, a different picture
      const half = new Float32Array(tg.length); for (let i = 0; i < tg.length; i++) half[i] = (i % 3) / 2;
      ok(same(R, px(draw(qr, Object.assign({}, base, { cells: half, morph: { shape: 'punti', t: 0.4 }, flow: { fg: '#f00', t: 0.5 }, eyeScale: 0.5 })))) > 0, `tutto insieme ${shape}/${eye}`);
    }
    // the frame: taller than wide, measure() agrees, the caption is in the SVG and escaped
    const fo = { size: 300, dpr: 2, frame: { text: 'Scansiona <&>' } };
    const fc = draw(qr, fo), m = QRCore.measure(qr, fo);
    ok(fc.height > fc.width && m.deviceWidth === fc.width && m.deviceHeight === fc.height, `cornice misura ${fc.width}x${fc.height} vs ${m.deviceWidth}x${m.deviceHeight}`);
    ok(QRCore.verify(fc, 'https://imad.chat/tools/qr').ok, 'cornice si legge');
    ok(/<text[^>]*>Scansiona &lt;&amp;&gt;<\/text>/.test(QRCore.svg(qr, fo)), 'cornice svg testo');
    ok(QRCore.svg(qr, { size: 300, frame: { text: '' } }).indexOf('<text') < 0, 'cornice senza scritta');
    ok(px(draw(qr, Object.assign({}, fo, { frame: { text: 'x', t: 0.3 } }))).length > 0, 'cornice a metà');
    // targets: exactly the modules a still picture draws as modules
    const t0 = QRCore.targets(qr, {}); let k1 = 0; for (let i = 0; i < t0.length; i++) if (t0[i]) { k1++; if (qr.kinds[i] === QRCore.KIND.finder || !qr.modules[i]) { fails.push('targets ' + i); break; } }
    ok(k1 > 0, 'targets vuoto');
    // fixContrast: reaches the target, keeps the hue, leaves what passes alone; gradients end by end
    for (const [f, bg] of [['#ff6961', '#ffffff'], ['#ffb347', '#ffffff'], ['#9a9a9a', '#fbf6ea'], ['#333333', '#111111'], ['#7cc68a', '#ffffff']]) {
      const x = QRCore.fixContrast(f, bg, 4.5);
      ok(QRCore.contrast(x, bg) >= 4.5, `fixContrast ${f} su ${bg} -> ${x} ${QRCore.contrast(x, bg)}`);
    }
    ok(QRCore.fixContrast('#000000', '#ffffff') === '#000000', 'fixContrast lascia stare');
    const fg2 = QRCore.fixContrast({ from: '#ff6961', to: '#ffb347', angle: 45 }, '#ffffff', 4.5);
    ok(fg2 && QRCore.contrast(fg2, '#ffffff') >= 4.5 && fg2.angle === 45, 'fixContrast sfumatura');
    // maxLogoScale: the limit really is the limit
    for (const t of ['https://imad.chat', 'https://www.esempio.it/articoli/2026/11/una-pagina-lunga?x=1']) for (const pad of [0, 1, 2]) {
      const q2 = QRCore.encode(t, { ecc: 'H' }), mx = QRCore.maxLogoScale(q2, { pad });
      const at = (sc) => QRCore.scannable({ size: 1024, dpr: 1, logo: { image: logo, scale: sc, pad } }, q2).problems.some(p => p.code === 'LOGO_GRANDE');
      ok(mx > 0 && !at(mx), `maxLogoScale ${t.length} pad ${pad}: ${mx} non passa`);
      if (mx > 0 && mx < 0.3) ok(at(Math.min(0.3, mx + 0.01)), `maxLogoScale ${t.length} pad ${pad}: ${mx} + 0.01 passa ancora`);
    }
    // verify takes its scales
    ok(QRCore.verify(cv, 'https://imad.chat/tools/qr', { scales: [0.5] }).scale === 0.5, 'verify scales');
    return fails;
  }, [(await buildCases(page)).wifi, (await buildCases(page)).vcard, WIFI_IN, VCARD_IN]);
}

// ---------------------------------------------------------------- run
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/__prova.html`);

const self = await selfChecks(page);
const P = await buildCases(page);
matrix(P);
const list = ONLY ? cases.filter((c) => c.group === ONLY) : cases;
const t0 = Date.now();
for (const cs of list) {
  let r;
  try { r = cs.svg ? await page.evaluate((c) => window.runSvg(c), cs) : await page.evaluate((c) => window.runCase(c), cs); }
  catch (e) { r = { error: String(e).slice(0, 200) }; }
  cs.res = r;
  if (r && r.png) {
    cs.file = path.join(OUT, 'png', `${cs.id}.png`);
    fs.writeFileSync(cs.file, Buffer.from(r.png.split(',')[1], 'base64'));
    delete r.png;
  }
}
await browser.close();
server.close();

const listFile = path.join(OUT, 'files.json'), resFile = path.join(OUT, 'zxing.json'), pyFile = path.join(OUT, 'decodifica.py');
fs.writeFileSync(pyFile, PYCODE);
fs.writeFileSync(listFile, JSON.stringify(list.filter((c) => c.file).map((c) => c.file)));
const py = spawnSync(PY, ['-I', pyFile, listFile, resFile], { encoding: 'utf8' });
if (py.status !== 0) { console.error('Decoder esterno non riuscito:', py.stderr || py.error); process.exit(2); }
const ext = JSON.parse(fs.readFileSync(resFile, 'utf8'));

// ---------------------------------------------------------------- table
const rows = [];
const groups = {};
for (const cs of list) {
  const r = cs.res || {};
  const z = cs.file ? ext.res[cs.file] : null;
  const jsOk = !!r.jsOk, zOk = !!(z && z.text === cs.text);
  const pass = jsOk && zOk;
  const rule = r.level === 'errore';
  let esito;
  if (r.error) esito = 'ERRORE';
  else if (pass && !rule) esito = 'ok';
  else if (pass && rule) esito = 'ok, ma la regola blocca';
  else if (!pass && rule) esito = 'regola';
  else esito = 'FALLITO';
  const g = groups[cs.group] || (groups[cs.group] = { casi: 0, ok: 0, blocca: 0, regola: 0, fallito: 0, js: 0, zx: 0 });
  g.casi++; if (jsOk) g.js++; if (zOk) g.zx++;
  if (esito === 'ok') g.ok++; else if (esito === 'regola') g.regola++; else if (esito.startsWith('ok,')) g.blocca++; else g.fallito++;
  rows.push([cs.id, cs.group, cs.label, r.version, r.m, jsOk ? 'si' : 'no', zOk ? 'si' : 'no', (r.inv || (z && z.inv)) ? 'inv' : '', r.level || '', r.codes || '', (r.det && r.det.logoLoad !== undefined) ? r.det.logoLoad : '', r.scale || '', esito, r.error || (!pass ? `js=${JSON.stringify((r.js || '').slice(0, 40))} zx=${JSON.stringify(((z && z.text) || '').slice(0, 40))}` : '')]);
}
fs.writeFileSync(path.join(OUT, 'risultati.tsv'), ['id\tgruppo\tcaso\tversione\tmodulo_px\tjsQR\tzxing\tinvertito\tlivello\tregole\tlogo_carico\tscala_jsQR\tesito\tnote', ...rows.map((r) => r.join('\t'))].join('\n'));

console.log(`\nQRCore, prova di lettura (${list.length} casi in ${((Date.now() - t0) / 1000).toFixed(1)} s; decoder esterno: ${ext.engine})\n`);
console.log('gruppo      casi  jsQR  zxing   ok  regola  blocca-ma-legge  FALLITI');
const tot = { casi: 0, js: 0, zx: 0, ok: 0, regola: 0, blocca: 0, fallito: 0 };
for (const [k, g] of Object.entries(groups)) {
  for (const f of Object.keys(tot)) tot[f] += g[f];
  console.log(`${k.padEnd(10)} ${String(g.casi).padStart(5)} ${String(g.js).padStart(5)} ${String(g.zx).padStart(6)} ${String(g.ok).padStart(4)} ${String(g.regola).padStart(7)} ${String(g.blocca).padStart(16)} ${String(g.fallito).padStart(8)}`);
}
console.log(`${'TOTALE'.padEnd(10)} ${String(tot.casi).padStart(5)} ${String(tot.js).padStart(5)} ${String(tot.zx).padStart(6)} ${String(tot.ok).padStart(4)} ${String(tot.regola).padStart(7)} ${String(tot.blocca).padStart(16)} ${String(tot.fallito).padStart(8)}`);
const bad = rows.filter((r) => r[12] !== 'ok');
if (bad.length) {
  console.log('\nCasi non "ok":');
  for (const r of bad) console.log(`  ${r[0]} ${r[1]} | ${r[2]} | v${r[3]} m=${r[4]} | jsQR ${r[5]} zxing ${r[6]} ${r[7]} | ${r[8]} ${r[9]} ${r[10] !== '' ? 'carico ' + r[10] : ''} | ${r[12]} ${r[13]}`);
}
console.log(`\nControlli interni: ${self.length ? self.length + ' falliti' : 'tutti superati'}`);
for (const f of self) console.log('  - ' + f);
if (errors.length) { console.log('\nErrori nella pagina:'); for (const e of errors.slice(0, 20)) console.log('  ' + e); }
console.log(`\nTabella completa: ${path.join(OUT, 'risultati.tsv')}`);
process.exit(tot.fallito || self.length || errors.length ? 1 : 0);
