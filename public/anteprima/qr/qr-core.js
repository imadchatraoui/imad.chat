/*
 * qr-core.js — the QR engine of imad.chat (QR Studio and the mini QR in the home's Tools tile).
 * Plain script, ES2017, no framework, no build step. It defines window.QRCore.
 *
 * Load order (plain <script> tags, no modules):
 *   <script src="vendor/qrcode-generator.js"></script>   global `qrcode` (Kazuhiko Arase, MIT): builds the matrix
 *   <script src="vendor/jsQR.js"></script>               global `jsQR`  (cozmo/jsQR, Apache-2.0): reads it back
 *   <script src="qr-core.js"></script>                   global `QRCore`
 * jsQR (250 KB) is needed only by QRCore.verify; a page that never verifies may leave it out (it may also be
 * loaded later, before the first verify). Licences: vendor/*.LICENSE; sources: docs/fonti.md, "Strumenti: QR".
 *
 * Usage (the mini QR of the home tile):
 *   var text = QRCore.payload.url(input.value) || "https://imad.chat";
 *   var qr;
 *   try { qr = QRCore.encode(text, { ecc: QRCore.suggestEcc(false) }); }
 *   catch (e) { note.textContent = e.message; return; }            // short Italian sentence, show as is
 *   var opts = { size: 132, shape: "uniti", eye: "tondo", fg: "#1d1b16", bg: "#ffffff" };
 *   var check = QRCore.scannable(opts, qr);                         // { ok, level, why, problems, details }
 *   var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
 *   var t0 = performance.now();
 *   (function frame(now) {                                          // the code draws itself in 600 ms
 *     var p = reduce ? 1 : Math.min(1, (now - t0) / 600);
 *     QRCore.render(canvas, qr, Object.assign({}, opts, { progress: p, order: "onda" }));
 *     if (p < 1) { raf = requestAnimationFrame(frame); return; }
 *     var v = QRCore.verify(canvas, text);                          // read the pixels back
 *     saveButton.disabled = !v.ok || check.level === "errore";      // never offer a code that does not scan
 *   })(t0);
 *
 * ---------------------------------------------------------------------------------------------------------
 * QRCore.payload — the strings phones really read. Every function returns a string.
 *   url(s)        trims; adds "https://" when there is no scheme and it looks like a host
 *                 ("imad.chat/x", "www.a.it", "localhost:3000", "192.168.1.1"; "//a.it/x" gets "https:");
 *                 "" for empty input; anything else (a scheme like "mailto:", plain words) is returned trimmed.
 *   text(s)       the text, line breaks normalised to "\n" ("" for null/undefined).
 *   wifi({ ssid, password, security: "WPA"|"WEP"|"nopass", hidden })
 *                 "WIFI:T:WPA;S:<ssid>;P:<password>;H:true;;" with \ ; , : " escaped by a backslash.
 *                 security defaults to "WPA" with a password and "nopass" without (WPA covers WPA2/WPA3);
 *                 P is left out for "nopass", H only when hidden is true.
 *   vcard({ name, org, title, phone, email, url, address, note })
 *                 vCard 3.0, CRLF line ends, \ , ; and line breaks escaped. N is "last;first" from name
 *                 (last word = family name). Empty fields are left out. url goes through url().
 *   email({ to, subject, body })   "mailto:<to>?subject=...&body=..." (encodeURIComponent, CRLF in body).
 *   tel(n)        "tel:+39011..." keeping only digits, a leading +, * and #.
 *   sms({ to, body })              "SMSTO:<to>:<body>" (the number cleaned like tel).
 *
 * QRCore.encode(text, { ecc, minVersion }) -> qr
 *   ecc "L"|"M"|"Q"|"H" (default "M"), minVersion 1..40 (default 1). Picks the smallest version that fits.
 *   Mode: digits only -> Numeric; QR alphanumeric charset (0-9 A-Z space $%*+-./:) -> Alphanumeric;
 *   anything else -> Byte, as UTF-8 bytes whenever the text is not plain ASCII.
 *   qr = { n, version, ecc, text, mode, get(r, c) -> boolean (dark), kind(r, c) -> string,
 *          modules: Uint8Array(n*n) 1 = dark, kinds: Uint8Array(n*n) codes of QRCore.KIND }
 *   kind(r, c): "finder" (the three eyes with their light separators, 8x8 each), "align" (the 5x5
 *   alignment patterns), "timing" (row 6 / column 6), "format" (format bits, the dark module, and the
 *   version bits of versions 7+), "data" (data and error correction). Treat a qr as read-only.
 *   Throws an Error with err.code "VUOTO" (empty text) or "TROPPO_LUNGO" (does not fit in version 40 at
 *   that ecc); err.message is a short Italian sentence to show as is.
 *
 * QRCore.render(canvas, qr, opts) -> info
 *   Draws on a 2D canvas at the device pixel ratio. Sets canvas.width/height to size*dpr and, unless
 *   opts.style === false, canvas.style.width/height to size px (CSS max-width still applies). opts:
 *     size      CSS px of the canvas side (default 256)
 *     dpr       pixel ratio (default window.devicePixelRatio, between 1 and 4)
 *     quiet     quiet zone in modules (default 4, never under 2)
 *     shape     "quadrati" | "punti" | "tondi" | "uniti" (neighbouring modules join into soft shapes)
 *     eye       "quadrato" | "tondo" | "goccia" (the three finders; alignment patterns follow: square
 *               for "quadrato", rounded otherwise). "goccia" keeps one sharp corner towards the centre.
 *     fg        a CSS colour, or { from, to, angle } (degrees: 0 = left to right, 90 = top to bottom;
 *               default 45). Default "#111111".
 *     bg        a CSS colour or "transparent". Default "#ffffff".
 *     logo      { image, scale, pad, round } or null. image: a loaded <img>, <canvas> or ImageBitmap (an image
 *               not loaded yet only clears its margin). scale: 0.12..0.3 of the code's side (default 0.22);
 *               pad: modules of clean margin around it (default 1); round: false, true (0.35) or 0..1, the
 *               corner rounding of the picture. Data modules under the margin are not drawn; use ecc "H".
 *     progress  0..1 (default 1) with order "onda" (a ripple from the centre) | "righe" | "caso": which
 *               modules are already drawn; each eases in (scale with a small overshoot, and alpha) over 30%
 *               of the run, the eyes as whole pieces, the logo over the last 30%. At 1 the picture is exactly
 *               the final one. The caller animates progress (and draws 1 at once with reduced motion).
 *   Modules land on whole device pixels: the module side is an integer number of device px and whatever does
 *   not divide goes to the margin, so the real quiet zone can be a little larger than asked.
 *   Needs `document` (it keeps an offscreen mask and small sprites). Cost measured in headless Chromium,
 *   software raster, 132 px at x3: 1 to 4 ms a frame; 320 px at x3, version 11: 5 to 11 ms.
 *   info = { dpr, width, height, m, ox, oy, side, quiet, cleared } (device px; quiet in modules;
 *   cleared = dark data modules removed under the logo).
 *
 * QRCore.svg(qr, opts) -> string
 *   The same picture as an SVG document (opts as render; progress and dpr are ignored). viewBox in modules,
 *   width/height = size. A logo needs a data: URL: opts.logo.href, or a data: <img>, or a drawable image that
 *   is turned into a PNG (if that fails the logo is left out and its margin stays clear). An SVG is not snapped
 *   to pixels: check it with scannable(Object.assign({}, opts, { svg: true }), qr) for the size it is shown at.
 *
 * QRCore.verify(canvasOrImageData, expected?) -> { ok, text, inverted, scale }
 *   Reads the drawn pixels back with jsQR, flattened on white, dark-on-light first, then inverted; at the
 *   native size and then at 0.5, 0.75 and 0.33 (jsQR binarises in 8 px blocks and misses some perfectly good
 *   codes at one scale only). ok: a code was read and, if expected is given, its text equals expected.
 *   text: what was read (null if nothing). scale: the scale that read it. 20 to 130 ms on a 400 to 1200 px
 *   canvas: run it once, when the drawing has finished, not on every frame.
 *
 * QRCore.suggestEcc(hasLogo) -> "H" with a logo, "M" without.
 * QRCore.contrast(fg, bg) -> WCAG contrast ratio (1..21). fg may be a gradient (the worse end counts);
 *   "transparent" is taken as white; colours with alpha are composited on the background.
 * QRCore.scannable(opts, qr) -> { ok, level: "ok"|"avviso"|"errore", why, problems: [{ code, level, why }], details }
 *   The rules every failure of strumenti/qr-prova.mjs turned into. why = the worst problem's Italian sentence
 *   ("" when ok). "errore": do not offer saving; "avviso": it scans, but some readers may fail. Codes:
 *     CONTRASTO      ratio under 3 = errore, under 4.5 = avviso (or a colour it cannot read)
 *     INVERTITO      a light code on a dark ground: avviso (it reads only in readers that try inverted)
 *     TRASPARENTE    avviso: it depends on what it is put on
 *     MARGINE        quiet zone under 4 modules: avviso
 *     MODULI_PICCOLI module under 1.75 CSS px (squares, joined) or 2 CSS px (dots, tiles), or under 2 device px
 *                    for dots and tiles, or (with opts.svg) under 4 device px off the grid: errore
 *     DENSO          version 31 or more: avviso; 36 or more: errore (too dense for a phone camera)
 *     LOGO_GRANDE    the logo's margin damages too many codewords: errore. Counted exactly: every codeword
 *                    with a module under the margin is taken as wrong, and in the worst Reed-Solomon block
 *                    those must stay under 80% of what the block can correct.
 *     LOGO_ECC       a logo with ecc under H: avviso
 *   details = { contrast, moduleCss, moduleDev, logoShare, logoLoad } (logoLoad 1 = exactly at the limit of
 *   the correction; over 0.8 is LOGO_GRANDE). If a logo is too big, a higher ecc or a smaller scale helps;
 *   a higher minVersion alone rarely does. Always also run verify on the final canvas.
 * QRCore.KIND = { data: 0, finder: 1, align: 2, timing: 3, format: 4 }; QRCore.version.
 * ---------------------------------------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var KIND = { data: 0, finder: 1, align: 2, timing: 3, format: 4 };
  var KIND_NAME = ['data', 'finder', 'align', 'timing', 'format'];
  var SHAPES = ['quadrati', 'punti', 'tondi', 'uniti'];
  var EYES = ['quadrato', 'tondo', 'goccia'];
  var ORDERS = ['onda', 'righe', 'caso'];
  var WINDOW = 0.3;     // each module eases in over this part of the progress

  // Alignment pattern centres, versions 1..40 (ISO/IEC 18004, annex E).
  var ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46],
    [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74],
    [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94],
    [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110],
    [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126],
    [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150],
    [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162],
    [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function pick(v, list, d) { return list.indexOf(v) >= 0 ? v : d; }

  function fail(code, msg) { var e = new Error(msg); e.code = code; return e; }

  // ------------------------------------------------------------------ payloads

  function trim(s) { return (s === null || s === undefined) ? '' : String(s).replace(/^\s+|\s+$/g, ''); }
  function nl(s) { return String(s).replace(/\r\n?/g, '\n'); }

  var HOST = /^(localhost|(\d{1,3}\.){3}\d{1,3}|([a-z0-9\u00a1-\uffff]([a-z0-9\u00a1-\uffff-]*[a-z0-9\u00a1-\uffff])?\.)+[a-z\u00a1-\uffff]{2,})(:\d{1,5})?([\/?#]\S*)?$/i;

  var payload = {
    url: function (s) {
      s = trim(s);
      if (!s) return '';
      if (/^[a-z][a-z0-9+.\-]*:\/\//i.test(s)) return s;
      if (/^\/\/\S/.test(s)) return 'https:' + s;
      if (HOST.test(s)) return 'https://' + s;
      return s;
    },
    text: function (s) {
      return (s === null || s === undefined) ? '' : nl(s);
    },
    wifi: function (o) {
      o = o || {};
      var pw = o.password === null || o.password === undefined ? '' : String(o.password);
      var t = pick(o.security, ['WPA', 'WEP', 'nopass'], pw ? 'WPA' : 'nopass');
      var esc = function (v) { return String(v === null || v === undefined ? '' : v).replace(/([\\;,:"])/g, '\\$1'); };
      var out = 'WIFI:T:' + t + ';S:' + esc(o.ssid) + ';';
      if (t !== 'nopass') out += 'P:' + esc(pw) + ';';
      if (o.hidden === true) out += 'H:true;';
      return out + ';';
    },
    vcard: function (o) {
      o = o || {};
      var esc = function (v) {
        return nl(trim(v)).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
      };
      var name = trim(o.name).replace(/\s+/g, ' ');
      var lines = ['BEGIN:VCARD', 'VERSION:3.0'];
      var parts = name ? name.split(' ') : [];
      var last = '', first = '';
      if (parts.length > 1) { last = parts.pop(); first = parts.join(' '); } else if (parts.length) last = parts[0];
      lines.push('N:' + esc(last) + ';' + esc(first) + ';;;');
      lines.push('FN:' + esc(name || o.org || o.email || o.phone || ''));
      if (trim(o.org)) lines.push('ORG:' + esc(o.org));
      if (trim(o.title)) lines.push('TITLE:' + esc(o.title));
      if (trim(o.phone)) lines.push('TEL;TYPE=CELL:' + trim(o.phone).replace(/[^\d+*#() .\-]/g, ''));
      if (trim(o.email)) lines.push('EMAIL;TYPE=INTERNET:' + trim(o.email).replace(/\s+/g, ''));
      if (trim(o.url)) lines.push('URL:' + payload.url(o.url));
      if (trim(o.address)) lines.push('ADR;TYPE=HOME:;;' + esc(o.address) + ';;;;');
      if (trim(o.note)) lines.push('NOTE:' + esc(o.note));
      lines.push('END:VCARD');
      return lines.join('\r\n');
    },
    email: function (o) {
      o = o || {};
      var q = [];
      if (trim(o.subject)) q.push('subject=' + encodeURIComponent(trim(o.subject)));
      if (o.body && trim(o.body)) q.push('body=' + encodeURIComponent(nl(o.body).replace(/\n/g, '\r\n')));
      return 'mailto:' + trim(o.to).replace(/\s+/g, '') + (q.length ? '?' + q.join('&') : '');
    },
    tel: function (n) {
      var s = trim(n);
      var plus = s.charAt(0) === '+';
      return 'tel:' + (plus ? '+' : '') + s.replace(/[^\d*#]/g, '');
    },
    sms: function (o) {
      o = o || {};
      var to = trim(o.to);
      var plus = to.charAt(0) === '+';
      to = (plus ? '+' : '') + to.replace(/[^\d*#]/g, '');
      return 'SMSTO:' + to + ':' + (o.body ? nl(o.body) : '');
    }
  };

  // ------------------------------------------------------------------ encode

  // UTF-8 bytes as a "binary string" (one char per byte), lone surrogates become U+FFFD.
  function utf8(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var d = s.charCodeAt(i + 1);
        if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
        else c = 0xfffd;
      } else if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
      if (c < 0x80) out += String.fromCharCode(c);
      else if (c < 0x800) out += String.fromCharCode(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out += String.fromCharCode(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out += String.fromCharCode(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function lib() {
    var q = root.qrcode;
    if (typeof q !== 'function') throw fail('LIBRERIA', 'Manca qrcode-generator: carica vendor/qrcode-generator.js prima di qr-core.js.');
    return q;
  }

  function build(version, ecc, data, mode) {
    var q = lib()(version, ecc);
    q.addData(data, mode);
    q.make();
    return q;
  }

  function kindsFor(n, version) {
    var k = new Uint8Array(n * n);
    var r, c, i, j;
    function set(rr, cc, v) { if (rr >= 0 && cc >= 0 && rr < n && cc < n && !k[rr * n + cc]) k[rr * n + cc] = v; }
    // finders with their separators
    for (r = 0; r < 8; r++) for (c = 0; c < 8; c++) {
      set(r, c, KIND.finder); set(r, n - 1 - c, KIND.finder); set(n - 1 - r, c, KIND.finder);
    }
    // alignment
    var pos = ALIGN[version] || [];
    for (i = 0; i < pos.length; i++) for (j = 0; j < pos.length; j++) {
      var ar = pos[i], ac = pos[j];
      if (k[ar * n + ac] === KIND.finder) continue;
      for (r = -2; r <= 2; r++) for (c = -2; c <= 2; c++) set(ar + r, ac + c, KIND.align);
    }
    // timing
    for (i = 8; i < n - 8; i++) { set(6, i, KIND.timing); set(i, 6, KIND.timing); }
    // format bits and the dark module
    for (i = 0; i < 9; i++) { set(8, i, KIND.format); set(i, 8, KIND.format); }
    for (i = 0; i < 8; i++) { set(8, n - 1 - i, KIND.format); set(n - 1 - i, 8, KIND.format); }
    // version bits
    if (version >= 7) for (i = 0; i < 6; i++) for (j = 0; j < 3; j++) {
      set(i, n - 11 + j, KIND.format); set(n - 11 + j, i, KIND.format);
    }
    return k;
  }

  function encode(text, o) {
    o = o || {};
    text = text === null || text === undefined ? '' : String(text);
    if (!text.length) throw fail('VUOTO', 'Scrivi qualcosa da mettere nel codice.');
    var ecc = pick(o.ecc, ['L', 'M', 'Q', 'H'], 'M');
    var minV = clamp(Math.round(num(o.minVersion, 1)), 1, 40);
    var mode, data;
    if (/^[0-9]+$/.test(text)) { mode = 'Numeric'; data = text; }
    else if (/^[0-9A-Z $%*+\-.\/:]+$/.test(text)) { mode = 'Alphanumeric'; data = text; }
    else { mode = 'Byte'; data = /^[\x00-\x7f]*$/.test(text) ? text : utf8(text); }
    var q;
    try {
      q = build(0, ecc, data, mode);
      var v0 = (q.getModuleCount() - 17) / 4;
      if (v0 < minV) q = build(minV, ecc, data, mode);
    } catch (e) {
      if (e && e.code === 'LIBRERIA') throw e;
      throw fail('TROPPO_LUNGO', ecc === 'L' ? 'Troppo lungo per un codice QR: accorcia il testo.'
        : 'Troppo lungo per un codice QR: accorcia il testo o abbassa la correzione.');
    }
    var n = q.getModuleCount();
    var version = (n - 17) / 4;
    var mods = new Uint8Array(n * n);
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) mods[r * n + c] = q.isDark(r, c) ? 1 : 0;
    var kinds = kindsFor(n, version);
    return {
      n: n, version: version, ecc: ecc, text: text, mode: mode, modules: mods, kinds: kinds,
      get: function (r, c) { return r >= 0 && c >= 0 && r < n && c < n && mods[r * n + c] === 1; },
      kind: function (r, c) { return (r >= 0 && c >= 0 && r < n && c < n) ? KIND_NAME[kinds[r * n + c]] : null; }
    };
  }

  // ------------------------------------------------------------------ colours

  var probe = null;
  function parseColor(s) {
    if (s === 'transparent') return [0, 0, 0, 0];
    var str = String(s === null || s === undefined ? '' : s).replace(/\s+/g, '');
    var m = /^#([0-9a-f]{3,8})$/i.exec(str);
    if (!m && root.document) {
      if (!probe) probe = root.document.createElement('canvas').getContext('2d');
      if (probe) {
        probe.fillStyle = '#010203'; probe.fillStyle = String(s);
        var a1 = probe.fillStyle;
        probe.fillStyle = '#040506'; probe.fillStyle = String(s);
        if (a1 !== probe.fillStyle) return null; // invalid colour
        str = String(a1).replace(/\s+/g, '');
        m = /^#([0-9a-f]{6})$/i.exec(str);
      }
    }
    if (m) {
      var h = m[1];
      if (h.length === 3 || h.length === 4) h = h.replace(/./g, function (x) { return x + x; });
      if (h.length !== 6 && h.length !== 8) return null;
      return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16),
        h.length === 8 ? parseInt(h.substr(6, 2), 16) / 255 : 1];
    }
    m = /^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]+))?\)$/i.exec(str);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    return null;
  }

  function lum(rgb) {
    var f = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }
  function over(c, b) { // c over opaque b
    var a = c[3];
    return [c[0] * a + b[0] * (1 - a), c[1] * a + b[1] * (1 - a), c[2] * a + b[2] * (1 - a), 1];
  }
  function stops(fg) {
    if (fg && typeof fg === 'object') return [fg.from, fg.to];
    return [fg === undefined || fg === null ? '#111111' : fg];
  }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  // { ratio, fgLum, bgLum } for the worst stop
  function contrastInfo(fg, bg) {
    var b = (bg === undefined || bg === null) ? [255, 255, 255, 1] : parseColor(bg);
    if (!b) return null;
    var transparent = b[3] < 1;
    if (transparent) b = over(b, [255, 255, 255, 1]);
    var list = stops(fg), worst = null;
    for (var i = 0; i < list.length; i++) {
      var f = parseColor(list[i]);
      if (!f) return null;
      f = over(f, b);
      var r = ratio(f, b);
      if (!worst || r < worst.ratio) worst = { ratio: r, fgLum: lum(f), bgLum: lum(b), transparent: transparent };
    }
    return worst;
  }

  function contrast(fg, bg) {
    var c = contrastInfo(fg, bg);
    return c ? Math.round(c.ratio * 100) / 100 : 1;
  }

  // ------------------------------------------------------------------ geometry (pens)

  function CanvasPen(ctx, ox, oy, m) { this.x = ctx; this.ox = ox; this.oy = oy; this.m = m; }
  CanvasPen.prototype.M = function (a, b) { this.x.moveTo(this.ox + a * this.m, this.oy + b * this.m); };
  CanvasPen.prototype.L = function (a, b) { this.x.lineTo(this.ox + a * this.m, this.oy + b * this.m); };
  CanvasPen.prototype.A = function (cx, cy, r, a0, a1, ccw) {
    this.x.arc(this.ox + cx * this.m, this.oy + cy * this.m, r * this.m, a0, a1, ccw);
  };
  CanvasPen.prototype.Z = function () { this.x.closePath(); };
  // whole circles and rectangles through the native calls: far cheaper to rasterise than beziers
  CanvasPen.prototype.O = function (cx, cy, r) {
    var X = this.ox + cx * this.m, Y = this.oy + cy * this.m, R = r * this.m;
    this.x.moveTo(X + R, Y); this.x.arc(X, Y, R, 0, Math.PI * 2);
  };
  CanvasPen.prototype.R = function (a, b, w, h) { this.x.rect(this.ox + a * this.m, this.oy + b * this.m, w * this.m, h * this.m); };

  function fx(v) { var s = (Math.round(v * 1000) / 1000).toString(); return s === '-0' ? '0' : s; }
  function SvgPen(ox, oy) { this.d = []; this.ox = ox; this.oy = oy; }
  SvgPen.prototype.M = function (a, b) { this.d.push('M' + fx(this.ox + a) + ' ' + fx(this.oy + b)); };
  SvgPen.prototype.L = function (a, b) { this.d.push('L' + fx(this.ox + a) + ' ' + fx(this.oy + b)); };
  // a quarter (or smaller) arc from the current point, which must be the arc's start
  SvgPen.prototype.A = function (cx, cy, r, a0, a1, ccw) {
    var x = this.ox + cx + r * Math.cos(a1), y = this.oy + cy + r * Math.sin(a1);
    this.d.push('A' + fx(r) + ' ' + fx(r) + ' 0 0 ' + (ccw ? 0 : 1) + ' ' + fx(x) + ' ' + fx(y));
  };
  SvgPen.prototype.Z = function () { this.d.push('Z'); };
  SvgPen.prototype.O = function (cx, cy, r) {
    var x = this.ox + cx, y = this.oy + cy;
    this.d.push('M' + fx(x + r) + ' ' + fx(y) + 'A' + fx(r) + ' ' + fx(r) + ' 0 1 1 ' + fx(x - r) + ' ' + fx(y) + 'A' + fx(r) + ' ' + fx(r) + ' 0 1 1 ' + fx(x + r) + ' ' + fx(y) + 'Z');
  };
  SvgPen.prototype.R = function (a, b, w, h) { rectPath(this, a, b, w, h); };

  // rounded rectangle, radii [tl, tr, br, bl]; ccw draws it the other way round (a hole).
  var PI = Math.PI, HP = Math.PI / 2;
  function rrect(p, x, y, w, h, rad, ccw) {
    var tl = rad ? rad[0] : 0, tr = rad ? rad[1] : 0, br = rad ? rad[2] : 0, bl = rad ? rad[3] : 0;
    if (!ccw) {
      p.M(x + tl, y);
      p.L(x + w - tr, y); if (tr) p.A(x + w - tr, y + tr, tr, -HP, 0, false);
      p.L(x + w, y + h - br); if (br) p.A(x + w - br, y + h - br, br, 0, HP, false);
      p.L(x + bl, y + h); if (bl) p.A(x + bl, y + h - bl, bl, HP, PI, false);
      p.L(x, y + tl); if (tl) p.A(x + tl, y + tl, tl, PI, PI + HP, false);
    } else {
      p.M(x + tl, y);
      if (tl) p.A(x + tl, y + tl, tl, -HP, -PI, true);
      p.L(x, y + h - bl); if (bl) p.A(x + bl, y + h - bl, bl, PI, HP, true);
      p.L(x + w - br, y + h); if (br) p.A(x + w - br, y + h - br, br, HP, 0, true);
      p.L(x + w, y + tr); if (tr) p.A(x + w - tr, y + tr, tr, 0, -HP, true);
    }
    p.Z();
  }
  function rectPath(p, x, y, w, h) { p.M(x, y); p.L(x + w, y); p.L(x + w, y + h); p.L(x, y + h); p.Z(); }
  function rect(p, x, y, w, h) { p.R(x, y, w, h); }
  function all4(r) { return [r, r, r, r]; }

  // concave fillet in the corner (cx, cy) of a light cell; dx, dy point into the cell.
  function fillet(p, cx, cy, dx, dy, r) {
    p.M(cx, cy);
    p.L(cx + dx * r, cy);
    p.A(cx + dx * r, cy + dy * r, r, dy > 0 ? -HP : HP, dx > 0 ? PI : 0, dx * dy > 0);
    p.Z();
  }

  // ------------------------------------------------------------------ layout and logo

  function layoutFor(n, o) {
    var dpr = clamp(num(o.dpr, root.devicePixelRatio || 1), 1, 4);
    var size = Math.max(16, num(o.size, 256));
    var quiet = Math.max(2, Math.round(num(o.quiet, 4)));
    var W = Math.round(size * dpr);
    var fr = o.frame ? frameOpts(o.frame) : null;
    var edge = fr ? quiet + FR.sw + FR.om : quiet;          // modules from the code to the side of the picture
    var m = Math.max(1, Math.floor(W / (n + 2 * edge)));
    var side = m * n;
    var ox = Math.floor((W - side) / 2);
    var H = W, band = 0;
    if (fr) {
      band = fr.text ? FR.cap : 0;
      var slack = ox - edge * m;                             // what whole modules leave over, on each side
      H = Math.round(ox + side + (quiet + band + FR.pb + FR.sw + FR.om) * m + slack);
    }
    return { dpr: dpr, size: size, W: W, H: H, m: m, side: side, ox: ox, oy: ox, quiet: quiet, realQuiet: fr ? quiet : ox / m, frame: fr, band: band };
  }

  function logoOpts(logo) {
    if (!logo) return null;
    var round = logo.round === true ? 0.35 : clamp(num(logo.round, 0), 0, 1);
    return {
      image: logo.image || null, href: logo.href || null,
      scale: clamp(num(logo.scale, 0.22), 0.12, 0.3),
      pad: clamp(num(logo.pad, 1), 0, 4), round: round
    };
  }

  // the square of modules cleared for the logo: { start, c, box } in modules (box = picture side)
  function logoArea(qr, lo) {
    if (!lo) return null;
    var n = qr.n;
    var box = lo.scale * n;
    var c = Math.ceil(box + 2 * lo.pad);
    if (c % 2 !== n % 2) c++;
    c = Math.min(c, n - 16);
    return { start: (n - c) / 2, c: c, box: box };
  }

  // per module: 0 light, 1 drawn as a module, 2 part of an eye/alignment (drawn as a unit), 3 cleared
  function plan(qr, area) {
    var n = qr.n, k = qr.kinds, mods = qr.modules;
    var st = new Uint8Array(n * n);
    var alignKeep = {};
    var i, r, c;
    if (area) {
      // an alignment pattern is cleared only when it lies wholly inside the logo square
      var pos = ALIGN[qr.version] || [];
      for (i = 0; i < pos.length; i++) for (var j = 0; j < pos.length; j++) {
        var ar = pos[i], ac = pos[j];
        if (k[ar * n + ac] !== KIND.align) continue;
        var inside = ar - 2 >= area.start && ar + 2 < area.start + area.c && ac - 2 >= area.start && ac + 2 < area.start + area.c;
        alignKeep[ar + ',' + ac] = !inside;
      }
    }
    var cleared = 0;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
      i = r * n + c;
      var kd = k[i];
      var inLogo = area && r >= area.start && r < area.start + area.c && c >= area.start && c < area.start + area.c;
      if (kd === KIND.finder) { st[i] = mods[i] ? 2 : 0; continue; }
      if (kd === KIND.align) {
        if (inLogo && !alignOwnerKept(qr, r, c, alignKeep)) { st[i] = 3; continue; }
        st[i] = mods[i] ? 2 : 0; continue;
      }
      if (inLogo && kd === KIND.data) { st[i] = 3; if (mods[i]) cleared++; continue; }
      st[i] = mods[i] ? 1 : 0;
    }
    return { st: st, cleared: cleared, alignKeep: alignKeep };
  }
  function alignOwnerKept(qr, r, c, keep) {
    var pos = ALIGN[qr.version] || [];
    for (var i = 0; i < pos.length; i++) for (var j = 0; j < pos.length; j++) {
      if (Math.abs(pos[i] - r) <= 2 && Math.abs(pos[j] - c) <= 2) {
        var key = pos[i] + ',' + pos[j];
        if (key in keep) return keep[key];
      }
    }
    return true;
  }

  // ------------------------------------------------------------------ shapes

  var DOT = 0.9, TILE = 0.9, TILE_R = 0.3, JOIN_R = 0.5, FILLET_R = 0.3;
  var MORPH_W = 0.5;    // in a shape change each piece morphs over this part of the wave
  var DIP = 0.18;       // ...and dips this much at the middle of its morph (the wave that passes)

  // [side, tl, tr, br, bl] of a data module of a shape at scale 1, in modules (nb = neighbour bits, for "uniti")
  function modGeom(shape, nb) {
    if (shape === 'punti') return [DOT, DOT / 2, DOT / 2, DOT / 2, DOT / 2];
    if (shape === 'tondi') return [TILE, TILE_R, TILE_R, TILE_R, TILE_R];
    if (shape === 'uniti') {
      var up = nb & 1, rt = nb & 2, dn = nb & 4, lf = nb & 8;
      return [1, (!up && !lf) ? JOIN_R : 0, (!up && !rt) ? JOIN_R : 0, (!dn && !rt) ? JOIN_R : 0, (!dn && !lf) ? JOIN_R : 0];
    }
    return [1, 0, 0, 0, 0];
  }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  // a module part way from shape a to shape b (u 0..1): side and corners in between, a small dip in the middle
  function morphModule(p, a, b, u, nb, r, c, s) {
    if (u <= 0) { moduleShape(p, a, nb, r, c, s); return; }
    if (u >= 1) { moduleShape(p, b, nb, r, c, s); return; }
    var ga = modGeom(a, nb), gb = modGeom(b, nb), e = easeInOut(u);
    var k = s * (1 - DIP * Math.sin(Math.PI * u));
    var side = (ga[0] + (gb[0] - ga[0]) * e) * k, h = side / 2, cx = c + 0.5, cy = r + 0.5, rad = [];
    for (var i = 1; i < 5; i++) rad.push(Math.min(h, (ga[i] + (gb[i] - ga[i]) * e) * k));
    rrect(p, cx - h, cy - h, side, side, rad);
  }

  // neighbour bits of a module drawn as a module: 1 up, 2 right, 4 down, 8 left
  function bits(st, n, r, c) {
    return (on(st, n, r - 1, c) ? 1 : 0) | (on(st, n, r, c + 1) ? 2 : 0) | (on(st, n, r + 1, c) ? 4 : 0) | (on(st, n, r, c - 1) ? 8 : 0);
  }
  function moduleShape(p, shape, nb, r, c, s) {
    var cx = c + 0.5, cy = r + 0.5, h;
    if (shape === 'punti') { p.O(cx, cy, DOT * s / 2); return; }
    if (shape === 'tondi') { h = TILE * s / 2; rrect(p, cx - h, cy - h, 2 * h, 2 * h, all4(TILE_R * s)); return; }
    if (shape === 'uniti') {
      h = s / 2;
      var R = JOIN_R * s, up = nb & 1, rt = nb & 2, dn = nb & 4, lf = nb & 8;
      rrect(p, cx - h, cy - h, 2 * h, 2 * h, [(!up && !lf) ? R : 0, (!up && !rt) ? R : 0, (!dn && !rt) ? R : 0, (!dn && !lf) ? R : 0]);
      return;
    }
    if (s >= 1) { rect(p, c, r, 1, 1); return; }
    h = s / 2; rect(p, cx - h, cy - h, 2 * h, 2 * h);
  }
  function on(st, n, r, c) { return r >= 0 && c >= 0 && r < n && c < n && st[r * n + c] === 1; }

  // eye radii [outer, hole, centre] as corner arrays; which = 0 TL, 1 TR, 2 BL
  function eyeRadii(eye, which) {
    if (eye === 'tondo') return [all4(2.4), all4(1.4), all4(1.5)];
    if (eye === 'goccia') {
      var sharp = which === 0 ? 2 : (which === 1 ? 3 : 1);
      var mk = function (v) { var a = all4(v); a[sharp] = 0; return a; };
      return [mk(3), mk(2), mk(1.5)];
    }
    return [all4(0), all4(0), all4(0)];
  }
  function scaleR(a, s) { return [a[0] * s, a[1] * s, a[2] * s, a[3] * s]; }
  function lerpR(a, b, e) { return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e, a[3] + (b[3] - a[3]) * e]; }

  // rr: optional radii [outer, hole, centre] (a morph between two eyes); round: optional roundness 0..1 of an alignment
  function eyeShape(p, eye, which, x, y, s, rr) {
    rr = rr || eyeRadii(eye, which);
    var cx = x + 3.5, cy = y + 3.5;
    var S = function (v, c0) { return c0 + (v - c0) * s; };
    rrect(p, S(x, cx), S(y, cy), 7 * s, 7 * s, scaleR(rr[0], s));
    rrect(p, S(x + 1, cx), S(y + 1, cy), 5 * s, 5 * s, scaleR(rr[1], s), true);
    rrect(p, S(x + 2, cx), S(y + 2, cy), 3 * s, 3 * s, scaleR(rr[2], s));
  }
  function alignShape(p, eye, x, y, s, round) { // x, y = top-left of the 5x5
    var k = typeof round === 'number' ? round : (eye !== 'quadrato' ? 1 : 0);
    var cx = x + 2.5, cy = y + 2.5;
    var S = function (v, c0) { return c0 + (v - c0) * s; };
    rrect(p, S(x, cx), S(y, cy), 5 * s, 5 * s, all4(1.6 * k * s));
    rrect(p, S(x + 1, cx), S(y + 1, cy), 3 * s, 3 * s, all4(0.6 * k * s), true);
    rrect(p, S(x + 2, cx), S(y + 2, cy), s, s, all4(0.5 * k * s));
  }

  // every drawable piece of the picture: { d: delay 0..1, r, c, k: 0 module | 1 eye | 2 alignment | 3 fillet, ... }
  // fil: also the fillets of the joined shape when the shape is another one (a morph from or to "uniti")
  function pieces(qr, o, pl, fil) {
    var n = qr.n, st = pl.st, shape = o.shape, eye = o.eye, order = o.order;
    var out = [];
    var mid = (n - 1) / 2, maxD = Math.sqrt(2) * mid;
    var delay = function (r, c) {
      if (order === 'righe') return (r + 0.6 * c / n) / (n - 1 + 0.6);
      if (order === 'caso') {
        var h = Math.imul(r + 1, 374761393) ^ Math.imul(c + 1, 668265263) ^ Math.imul(n, 2246822519);
        h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
      }
      var dr = r - mid, dc = c - mid;
      return Math.sqrt(dr * dr + dc * dc) / maxD;
    };
    var r, c;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
      if (st[r * n + c] !== 1) continue;
      out.push({ d: delay(r, c), r: r, c: c, k: 0, nb: bits(st, n, r, c) });
    }
    // eyes
    var eyes = [[0, 0, 0], [0, n - 7, 1], [n - 7, 0, 2]];
    for (var e = 0; e < 3; e++) out.push({ d: delay(eyes[e][0] + 3, eyes[e][1] + 3), r: eyes[e][0], c: eyes[e][1], k: 1, w: eyes[e][2] });
    // alignment patterns that are kept
    var pos = ALIGN[qr.version] || [];
    for (var i = 0; i < pos.length; i++) for (var j = 0; j < pos.length; j++) {
      var ar = pos[i], ac = pos[j];
      if (qr.kinds[ar * n + ac] !== KIND.align) continue;
      var key = ar + ',' + ac;
      if (key in pl.alignKeep && !pl.alignKeep[key]) continue;
      out.push({ d: delay(ar, ac), r: ar - 2, c: ac - 2, k: 2 });
    }
    // fillets of the joined shape
    if (shape === 'uniti' || fil) {
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
        var v = st[r * n + c];
        if (v !== 0) continue;
        // corners: [dr, dc] of the diagonal neighbour
        var cs = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
        for (var q = 0; q < 4; q++) {
          var a = cs[q][0], b = cs[q][1];
          if (on(st, n, r + a, c) && on(st, n, r, c + b) && on(st, n, r + a, c + b)) {
            out.push({ d: Math.max(delay(r + a, c), delay(r, c + b)), r: r, c: c, k: 3, a: a, b: b, q: q });
          }
        }
      }
    }
    return out;
  }

  function drawPiece(p, pc, o, n, st, s) {
    if (pc.k === 0) moduleShape(p, o.shape, pc.nb, pc.r, pc.c, s);
    else if (pc.k === 1) eyeShape(p, o.eye, pc.w, pc.c, pc.r, s);
    else if (pc.k === 2) alignShape(p, o.eye, pc.c, pc.r, s);
    else {
      var cx = pc.b < 0 ? pc.c : pc.c + 1, cy = pc.a < 0 ? pc.r : pc.r + 1;
      fillet(p, cx, cy, -pc.b, -pc.a, FILLET_R * s);
    }
  }

  function easeOutCubic(t) { t = 1 - t; return 1 - t * t * t; }
  function easeOutBack(t) { var c1 = 1.25, c3 = c1 + 1; var u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; }

  function normOpts(o) {
    o = o || {};
    return {
      size: o.size, dpr: o.dpr, quiet: o.quiet, style: o.style,
      shape: pick(o.shape, SHAPES, 'quadrati'), eye: pick(o.eye, EYES, 'quadrato'),
      fg: o.fg === undefined || o.fg === null ? '#111111' : o.fg,
      bg: o.bg === undefined || o.bg === null ? '#ffffff' : o.bg,
      logo: logoOpts(o.logo),
      progress: clamp(num(o.progress, 1), 0, 1), order: pick(o.order, ORDERS, 'onda'),
      frame: frameOpts(o.frame),
      cells: o.cells || null,
      morph: o.morph && (SHAPES.indexOf(o.morph.shape) >= 0 || EYES.indexOf(o.morph.eye) >= 0) && num(o.morph.t, 1) < 1
        ? { shape: pick(o.morph.shape, SHAPES, null), eye: pick(o.morph.eye, EYES, null), t: clamp(num(o.morph.t, 1), 0, 1) } : null,
      flow: o.flow && num(o.flow.t, 1) < 1
        ? { fg: o.flow.fg === undefined || o.flow.fg === null ? null : o.flow.fg, bg: o.flow.bg === undefined || o.flow.bg === null ? null : o.flow.bg,
          t: clamp(num(o.flow.t, 1), 0, 1), angle: num(o.flow.angle, 45) } : null,
      logoIn: typeof o.logoIn === 'number' && isFinite(o.logoIn) ? clamp(o.logoIn, 0, 1) : null,
      eyeScale: typeof o.eyeScale === 'number' && isFinite(o.eyeScale) && o.eyeScale < 1 ? Math.max(0, o.eyeScale) : null
    };
  }

  // ------------------------------------------------------------------ the frame: a ring around the code and a caption under it
  // In modules: om outer margin, sw the ring, then the quiet zone, the code, the quiet zone, the caption band (cap, empty text: 0),
  // pb the space under it, the ring, om. The ring is at the edge of the quiet zone, the caption at least `quiet` modules under the code.
  var FR = { om: 1.1, sw: 0.9, cap: 3.6, pb: 1.4, rad: 3.4, font: 2.45 };
  var FONT = 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  function frameOpts(f) {
    if (!f) return null;
    var text = String(f.text === undefined || f.text === null ? '' : f.text).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    return { text: text, t: clamp(num(f.t, 1), 0, 1), font: f.font || FONT, weight: num(f.weight, 700), fontData: f.fontData || null };
  }

  function gradientLine(x, y, side, angle) {
    var a = num(angle, 45) * Math.PI / 180;
    var dx = Math.cos(a), dy = Math.sin(a);
    var L = (Math.abs(dx) + Math.abs(dy)) * side / 2;
    var cx = x + side / 2, cy = y + side / 2;
    return [cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L];
  }

  function imageReady(img) {
    if (!img) return false;
    if (typeof img.naturalWidth === 'number') return img.complete && img.naturalWidth > 0;
    return (img.width || 0) > 0;
  }
  function imageSize(img) {
    return [img.naturalWidth || img.videoWidth || img.width || 1, img.naturalHeight || img.videoHeight || img.height || 1];
  }

  // plan and pieces depend only on the code, the shape, the eyes, the order and the logo square:
  // they are kept on the qr object (a qr never changes) for the frames of an animation.
  function prepared(qr, o, area, fil) {
    var key = o.shape + '|' + o.eye + '|' + o.order + '|' + (area ? area.start + ',' + area.c : '-') + (fil ? '|f' : '');
    var memo = qr._memo || (qr._memo = { keys: [], val: {} });
    if (memo.val[key]) return memo.val[key];
    var pl = plan(qr, area);
    var v = { pl: pl, list: pieces(qr, o, pl, fil) };
    memo.keys.push(key); memo.val[key] = v;
    if (memo.keys.length > 6) delete memo.val[memo.keys.shift()];
    return v;
  }

  // horizontal runs of fully drawn modules; for "uniti" a run gets the corners its end modules would have
  function runs(p, shape, st, full, n) {
    for (var r = 0; r < n; r++) {
      var c = 0;
      while (c < n) {
        if (!full[r * n + c]) { c++; continue; }
        var c0 = c;
        while (c < n && full[r * n + c]) c++;
        var c1 = c - 1;
        if (shape === 'uniti') {
          var R = JOIN_R;
          var lf = on(st, n, r, c0 - 1), rt = on(st, n, r, c1 + 1);
          rrect(p, c0, r, c - c0, 1, [
            (!on(st, n, r - 1, c0) && !lf) ? R : 0, (!on(st, n, r - 1, c1) && !rt) ? R : 0,
            (!on(st, n, r + 1, c1) && !rt) ? R : 0, (!on(st, n, r + 1, c0) && !lf) ? R : 0]);
        } else rect(p, c0, r, c - c0, 1);
      }
    }
  }

  var masks = [];
  function maskFor(W, H) {
    H = H || W;
    for (var i = 0; i < masks.length; i++) if (masks[i].width === W && masks[i].height === H) return masks[i];
    var c = root.document.createElement('canvas');
    c.width = W; c.height = H;
    masks.unshift(c);
    if (masks.length > 6) masks.pop();
    return c;
  }

  // sprites are kept for the last few module sizes (a page that draws its code at two densities, or small previews
  // beside a big code, would otherwise throw them away at every switch)
  var spriteSets = [];
  function spriteSet(m) {
    for (var i = 0; i < spriteSets.length; i++) if (spriteSets[i].m === m) {
      var hitSet = spriteSets[i];
      if (hitSet.count > 3000) { hitSet.map = {}; hitSet.count = 0; }
      if (i) { spriteSets.splice(i, 1); spriteSets.unshift(hitSet); }
      return hitSet;
    }
    var set = { m: m, map: {}, count: 0 };
    spriteSets.unshift(set);
    if (spriteSets.length > 4) spriteSets.pop();
    return set;
  }
  // a module, a fillet or a morphing module, drawn once per module size and stamped (mo: { a, b, u } for a morph)
  function sprite(m, shape, pc, s, mo) {
    s = Math.abs(s - 1) < 1e-4 ? 1 : Math.round(s * 32) / 32;
    var sprites = spriteSet(m);
    var key = (mo ? 'M' + mo.a + '>' + mo.b + '@' + mo.u : shape) + (pc.k === 3 ? 'f' + pc.q : 'm' + pc.nb) + '|' + s;
    var hit = sprites.map[key];
    if (hit) return hit;
    var pad = Math.ceil(m * 0.15) + 1, S = m + 2 * pad;
    var cv = root.document.createElement('canvas');
    cv.width = cv.height = S;
    var x = cv.getContext('2d');
    x.fillStyle = '#000';
    x.beginPath();
    var pen = new CanvasPen(x, pad, pad, m);
    if (pc.k === 3) {
      var cs = [[-1, -1], [-1, 1], [1, 1], [1, -1]][pc.q];
      fillet(pen, cs[1] < 0 ? 0 : 1, cs[0] < 0 ? 0 : 1, -cs[1], -cs[0], FILLET_R * s);
    } else if (mo) morphModule(pen, mo.a, mo.b, mo.u, pc.nb, 0, 0, s);
    else moduleShape(pen, shape, pc.nb, 0, 0, s);
    x.fill();
    hit = { cv: cv, pad: pad };
    sprites.map[key] = hit; sprites.count++;
    return hit;
  }

  // two scratch canvases for the colour flow
  var scratch = [];
  function scratchCanvas(i, W, H) {
    var c = scratch[i] || (scratch[i] = root.document.createElement('canvas'));
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    return c;
  }
  // a fill style for a colour or a gradient over the code square
  function paint(x, fg, L) {
    if (fg && typeof fg === 'object') {
      var g = gradientLine(L.ox, L.oy, L.side, fg.angle);
      var gr = x.createLinearGradient(g[0], g[1], g[2], g[3]);
      gr.addColorStop(0, fg.from || '#111111');
      gr.addColorStop(1, fg.to || fg.from || '#111111');
      return gr;
    }
    return fg;
  }
  // the front of a colour flow: alpha 1 behind it (the new colour), 0 ahead, a soft edge between; along angle, over W x H
  var FLOW_SOFT = 0.3;
  function frontGradient(x, W, H, angle, t) {
    var a = angle * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
    var Lh = (Math.abs(dx) * W + Math.abs(dy) * H) / 2;
    var g = x.createLinearGradient(W / 2 - dx * Lh, H / 2 - dy * Lh, W / 2 + dx * Lh, H / 2 + dy * Lh);
    var f = easeInOut(t) * (1 + FLOW_SOFT), g0 = f - FLOW_SOFT, g1 = f;
    var al = function (pos) { return clamp((g1 - pos) / (g1 - g0), 0, 1); };
    var st = [0, 1];
    if (g0 > 0 && g0 < 1) st.push(g0);
    if (g1 > 0 && g1 < 1) st.push(g1);
    st.sort(function (p, q) { return p - q; });
    for (var i = 0; i < st.length; i++) g.addColorStop(st[i], 'rgba(0,0,0,' + (Math.round(al(st[i]) * 1000) / 1000) + ')');
    return g;
  }
  // old colour where the front has not passed, new colour where it has: exactly linear (the two parts are added)
  function flowLayer(W, H, from, to, L, fl) {
    var A = scratchCanvas(0, W, H), B = scratchCanvas(1, W, H);
    var ax = A.getContext('2d'), bx = B.getContext('2d');
    var grad = frontGradient(ax, W, H, fl.angle, fl.t);
    ax.setTransform(1, 0, 0, 1, 0, 0); ax.globalAlpha = 1; ax.globalCompositeOperation = 'source-over'; ax.clearRect(0, 0, W, H);
    if (from !== 'transparent') { ax.fillStyle = paint(ax, from, L); ax.fillRect(0, 0, W, H); }
    ax.globalCompositeOperation = 'destination-out'; ax.fillStyle = grad; ax.fillRect(0, 0, W, H);
    bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalAlpha = 1; bx.globalCompositeOperation = 'source-over'; bx.clearRect(0, 0, W, H);
    if (to !== 'transparent') { bx.fillStyle = paint(bx, to, L); bx.fillRect(0, 0, W, H); }
    bx.globalCompositeOperation = 'destination-in'; bx.fillStyle = frontGradient(bx, W, H, fl.angle, fl.t); bx.fillRect(0, 0, W, H);
    bx.globalCompositeOperation = 'source-over';
    ax.globalCompositeOperation = 'lighter'; ax.drawImage(B, 0, 0);
    ax.globalCompositeOperation = 'source-over';
    return A;
  }

  // the picture's drop: scale from 1.14 with a damped settle, a short fall, alpha in the first quarter
  function dropAt(t) {
    if (t >= 1) return { s: 1, y: 0, a: 1, sh: 0 };
    return { s: 1 + 0.14 * (1 - t) * (1 - t) * Math.cos(2.2 * Math.PI * t), y: -0.1 * (1 - easeOutCubic(t)), a: clamp(t / 0.25, 0, 1), sh: 1 - t };
  }

  // the frame's ring (a stroke along its middle line, drawn up to t of its length) and the caption
  function frameRect(L) {
    var m = L.m, q = L.quiet, e = (q + FR.sw / 2) * m;
    return { x: L.ox - e, y: L.oy - e, w: L.side + 2 * e, h: L.side + 2 * e + (L.band + FR.pb) * m, r: (FR.rad - FR.sw / 2) * m };
  }
  function captionPx(x, L, fr) {
    var m = L.m, px = FR.font * m, max = L.side + 2 * (L.quiet - 1) * m;
    x.font = fr.weight + ' ' + px + 'px ' + fr.font;
    var w = x.measureText(fr.text).width;
    if (w > max) { px = Math.max(m * 1.2, px * max / w); x.font = fr.weight + ' ' + px + 'px ' + fr.font; }
    return px;
  }
  function drawFrame(x, L, fr) {
    var R = frameRect(L), m = L.m, t = fr.t;
    x.save();
    x.globalAlpha = 1;
    x.lineWidth = FR.sw * m;
    x.strokeStyle = '#000';
    x.beginPath();
    rrect(new CanvasPen(x, 0, 0, 1), R.x, R.y, R.w, R.h, all4(R.r));
    if (t < 1) {
      var per = 2 * (R.w + R.h) - (8 - 2 * Math.PI) * R.r;
      if (x.setLineDash) { x.setLineDash([per * easeInOut(t), per + 1]); x.lineDashOffset = 0; }
    }
    if (t > 0) x.stroke();
    if (x.setLineDash) x.setLineDash([]);
    if (fr.text && t > 0) {
      var ta = clamp((t - 0.35) / 0.65, 0, 1);
      if (ta > 0) {
        captionPx(x, L, fr);
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#000';
        x.globalAlpha = ta >= 1 ? 1 : easeOutCubic(ta);
        x.fillText(fr.text, L.ox + L.side / 2, L.oy + L.side + (L.quiet + L.band / 2) * m + (1 - easeOutCubic(ta)) * 0.8 * m);
      }
    }
    x.restore();
  }

  // the cells a still picture of qr draws as modules (1), for the caller's cells field: everything else is 0
  function targets(qr, opts) {
    var o = normOpts(opts);
    var pl = plan(qr, logoArea(qr, o.logo));
    var t = new Uint8Array(qr.n * qr.n);
    for (var i = 0; i < t.length; i++) t[i] = pl.st[i] === 1 ? 1 : 0;
    return t;
  }

  // ------------------------------------------------------------------ render

  function render(canvas, qr, opts) {
    var o = normOpts(opts);
    var L = layoutFor(qr.n, o);
    var W = L.W, H = L.H;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    if (o.style !== false && canvas.style) {
      canvas.style.width = L.size + 'px';
      canvas.style.height = (H === W ? L.size : Math.round(H / L.dpr * 100) / 100) + 'px';
    }
    var ctx = canvas.getContext('2d');
    var area = logoArea(qr, o.logo);
    var n = qr.n, p = o.progress;
    var mo = o.morph;
    var fromShape = mo && mo.shape ? mo.shape : o.shape, fromEye = mo && mo.eye ? mo.eye : o.eye;
    if (mo && fromShape === o.shape && fromEye === o.eye) mo = null;
    var prep = prepared(qr, o, area, !!mo && fromShape === 'uniti' && o.shape !== 'uniti');
    var pl = prep.pl, list = prep.list;
    var cells = o.cells && o.cells.length === n * n ? o.cells : null;
    if (cells && !mo) {                                     // a field at rest is the still picture: draw it the usual way
      var rest = true;
      for (var i0 = 0; i0 < cells.length && rest; i0++) if (cells[i0] !== (pl.st[i0] === 1 ? 1 : 0)) rest = false;
      if (rest) cells = null;
    }

    // The modules are drawn in black on a mask, then the colour (or gradient) goes in through the mask
    // and the mask onto the background. Rounded tiles, joined modules and fillets are stamped from
    // small sprites drawn once per module size: the same pixels as drawing each in place (modules sit
    // on whole device pixels) at a fraction of the cost.
    var mk = maskFor(W, H);
    var mx = mk.getContext('2d');
    mx.setTransform(1, 0, 0, 1, 0, 0);
    mx.globalCompositeOperation = 'source-over';
    mx.globalAlpha = 1;
    mx.clearRect(0, 0, W, H);
    mx.fillStyle = '#000';
    var pen = new CanvasPen(mx, L.ox, L.oy, L.m);
    if (!cells && !mo && o.eyeScale === null) {
      var stamp = o.shape === 'tondi' || o.shape === 'uniti';
      var merge = o.shape === 'quadrati';
      var full = merge ? new Uint8Array(n * n) : null;
      var LEVELS = 12, buckets = [];
      for (var b = 0; b <= LEVELS; b++) buckets.push([]);
      for (var j = 0; j < list.length; j++) {
        var pc = list[j];
        var t = p >= 1 ? 1 : (p - pc.d * (1 - WINDOW)) / WINDOW;
        if (t <= 0) continue;
        if (t >= 1) {
          if (merge && pc.k === 0) { full[pc.r * n + pc.c] = 1; continue; }
          buckets[LEVELS].push(pc, 1);
          continue;
        }
        var al = easeOutCubic(Math.min(1, t * 1.5));
        buckets[Math.round(al * LEVELS)].push(pc, t);
      }
      for (var lv = 1; lv <= LEVELS; lv++) {
        var bk = buckets[lv];
        if (!bk.length && !(lv === LEVELS && merge)) continue;
        mx.globalAlpha = lv / LEVELS;
        mx.beginPath();
        for (var q = 0; q < bk.length; q += 2) {
          var it = bk[q], tt = bk[q + 1];
          var sc = tt >= 1 ? 1 : 0.25 + 0.75 * easeOutBack(tt);
          if (stamp && (it.k === 0 || it.k === 3)) {
            var sp = sprite(L.m, o.shape, it, Math.min(1, sc));
            mx.drawImage(sp.cv, L.ox + it.c * L.m - sp.pad, L.oy + it.r * L.m - sp.pad);
          } else drawPiece(pen, it, o, n, pl.st, sc);
        }
        if (lv === LEVELS && merge) runs(pen, o.shape, pl.st, full, n);
        mx.fill();
      }
      mx.globalAlpha = 1;
    } else drawMoving(mx, pen, L, qr, o, pl, list, cells, mo, fromShape, fromEye, p);
    if (L.frame) drawFrame(mx, L, L.frame);

    // colour: the code's fill through the mask, then the background, then the mask on it (a flow blends old and new)
    mx.globalAlpha = 1;
    var fl = o.flow, fgNow = o.fg, bgNow = o.bg;
    if (fl && fl.t <= 0) { if (fl.fg !== null) fgNow = fl.fg; if (fl.bg !== null) bgNow = fl.bg; fl = null; }
    mx.globalCompositeOperation = 'source-in';
    if (fl && fl.fg !== null) mx.drawImage(flowLayer(W, H, fl.fg, o.fg, L, fl), 0, 0);
    else { mx.fillStyle = paint(mx, fgNow, L); mx.fillRect(0, 0, W, H); }
    mx.globalCompositeOperation = 'source-over';

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    if (fl && fl.bg !== null) ctx.drawImage(flowLayer(W, H, fl.bg, o.bg, L, fl), 0, 0);
    else if (bgNow !== 'transparent') { ctx.fillStyle = bgNow; ctx.fillRect(0, 0, W, H); }
    ctx.drawImage(mk, 0, 0);

    if (area && o.logo.image && imageReady(o.logo.image)) {
      var drop = null, la;
      if (o.logoIn !== null) { la = o.logoIn; drop = dropAt(la); }
      else la = p >= 1 ? 1 : clamp((p - 0.7) / 0.3, 0, 1);
      if (la > 0) {
        var e = drop ? 1 : easeOutCubic(la);
        var box0 = area.box * L.m;
        var box = Math.round(drop ? box0 * drop.s : box0 * (0.85 + 0.15 * e));
        var bx = Math.round(L.ox + (L.side - box) / 2), by = Math.round(L.oy + (L.side - box) / 2 + (drop ? drop.y * box0 : 0));
        var sz = imageSize(o.logo.image);
        var k = Math.min(box / sz[0], box / sz[1]);
        var w = sz[0] * k, h = sz[1] * k;
        var rr = o.logo.round > 0 ? o.logo.round * Math.min(w, h) / 2 : 0;
        if (drop && drop.sh > 0.01) {
          // the shadow stays where the picture lands and sharpens as it gets there (drawn far away, offset back)
          var k0 = Math.min(box0 / sz[0], box0 / sz[1]), w0 = sz[0] * k0, h0 = sz[1] * k0, FAR = 4 * W + 1000;
          ctx.save();
          ctx.globalAlpha = Math.min(1, drop.a * 1.2);
          ctx.shadowColor = 'rgba(0, 0, 0, ' + (0.32 * drop.sh) + ')';
          ctx.shadowBlur = Math.max(1, box0 * 0.16 * drop.sh);
          ctx.shadowOffsetX = FAR; ctx.shadowOffsetY = box0 * 0.05 * drop.sh;
          ctx.fillStyle = '#000';
          ctx.beginPath();
          rrect(new CanvasPen(ctx, L.ox + (L.side - w0) / 2 - FAR, L.oy + (L.side - h0) / 2, 1), 0, 0, w0, h0, all4(o.logo.round > 0 ? o.logo.round * Math.min(w0, h0) / 2 : 0));
          ctx.fill();
          ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha = drop ? drop.a : e;
        if (rr > 0) {
          ctx.beginPath();
          var cp = new CanvasPen(ctx, bx + (box - w) / 2, by + (box - h) / 2, 1);
          rrect(cp, 0, 0, w, h, all4(rr));
          ctx.clip();
        }
        ctx.drawImage(o.logo.image, bx + (box - w) / 2, by + (box - h) / 2, w, h);
        ctx.restore();
      }
    }
    return { dpr: L.dpr, width: W, height: H, m: L.m, ox: L.ox, oy: L.oy, side: L.side, quiet: L.realQuiet, cleared: pl.cleared };
  }

  // a frame in motion: a field of module scales (cells) and/or a morph between two shapes and eyes, drawn piece by piece
  function drawMoving(mx, pen, L, qr, o, pl, list, cells, mo, fromShape, fromEye, p) {
    var n = qr.n, st = pl.st, m = L.m, toShape = o.shape, toEye = o.eye;
    var MT = mo ? mo.t : 1, span = Math.max(1, 2 * (n - 1));
    var uAt = function (r, c) { return mo ? clamp((MT - ((r + c) / span) * (1 - MORPH_W)) / MORPH_W, 0, 1) : 1; };
    var i, r, c, j, pc, sp;
    var nbSrc = st, full = null, fullQ = new Uint8Array(n * n);
    if (cells) {
      full = new Uint8Array(n * n);
      for (i = 0; i < n * n; i++) if (st[i] !== 2 && cells[i] >= 0.999) full[i] = 1;
      nbSrc = full;
    }
    var stampOf = function (sh) { return sh === 'tondi' || sh === 'uniti'; };
    var at = function (cv, pad, rr, cc) { mx.drawImage(cv, L.ox + cc * m - pad, L.oy + rr * m - pad); };
    mx.globalAlpha = 1;
    mx.beginPath();
    var mod = function (rr, cc, s, nb) {
      if (s <= 0.002) return;
      var u = uAt(rr, cc), uq = u <= 0 ? 0 : (u >= 1 ? 1 : Math.round(u * 24) / 24);
      if (uq > 0 && uq < 1) { sp = sprite(m, null, { k: 0, nb: nb }, s, { a: fromShape, b: toShape, u: uq }); at(sp.cv, sp.pad, rr, cc); return; }
      var sh = uq <= 0 ? fromShape : toShape;
      if (stampOf(sh)) { sp = sprite(m, sh, { k: 0, nb: nb }, s); at(sp.cv, sp.pad, rr, cc); return; }
      if (sh === 'quadrati' && Math.abs(s - 1) < 1e-4) { fullQ[rr * n + cc] = 1; return; }   // merged into runs, as in a still picture
      if (sh === 'quadrati' && s > 1) { var hh = s / 2; rect(pen, cc + 0.5 - hh, rr + 0.5 - hh, s, s); return; }
      moduleShape(pen, sh, nb, rr, cc, s);
    };
    var grow = function (d) {                              // the draw-in of the progress, for pieces without a field
      var t = p >= 1 ? 1 : (p - d * (1 - WINDOW)) / WINDOW;
      return t <= 0 ? 0 : (t >= 1 ? 1 : 0.25 + 0.75 * easeOutBack(t));
    };
    // eyes and alignment patterns: whole pieces; with a new eye their corners travel from the old radii to the new
    var eyeMorph = !!mo && fromEye !== toEye;
    for (j = 0; j < list.length; j++) {
      pc = list[j];
      if (pc.k !== 1 && pc.k !== 2) continue;
      var sc = o.eyeScale !== null ? o.eyeScale : grow(pc.d);
      if (sc <= 0.002) continue;
      var u = eyeMorph ? uAt(pc.r + (pc.k === 1 ? 3 : 2), pc.c + (pc.k === 1 ? 3 : 2)) : 1;
      var e = easeInOut(u), dip = eyeMorph && u > 0 && u < 1 ? 1 - DIP * 0.6 * Math.sin(Math.PI * u) : 1;
      if (pc.k === 1) {
        if (u < 1) {
          var A = eyeRadii(fromEye, pc.w), B = eyeRadii(toEye, pc.w);
          eyeShape(pen, toEye, pc.w, pc.c, pc.r, sc * dip, [lerpR(A[0], B[0], e), lerpR(A[1], B[1], e), lerpR(A[2], B[2], e)]);
        } else eyeShape(pen, toEye, pc.w, pc.c, pc.r, sc);
      } else {
        var k0 = fromEye !== 'quadrato' ? 1 : 0, k1 = toEye !== 'quadrato' ? 1 : 0;
        alignShape(pen, toEye, pc.c, pc.r, sc * dip, u < 1 ? k0 + (k1 - k0) * e : k1);
      }
    }
    if (cells) {
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
        i = r * n + c;
        if (cells[i] <= 0.002 || st[i] === 2) continue;
        var kd = qr.kinds[i];
        if (kd === KIND.finder || kd === KIND.align) continue;
        mod(r, c, cells[i], bits(nbSrc, n, r, c));
      }
    } else {
      for (j = 0; j < list.length; j++) { pc = list[j]; if (pc.k === 0) mod(pc.r, pc.c, grow(pc.d), pc.nb); }
    }
    // fillets of the joined shape, growing or fading with the morph
    if (toShape === 'uniti' || (mo && fromShape === 'uniti')) {
      var wAt = function (rr, cc) {
        if (!mo) return toShape === 'uniti' ? 1 : 0;
        var ee = easeInOut(uAt(rr, cc));
        return (toShape === 'uniti' ? ee : 0) + (fromShape === 'uniti' ? 1 - ee : 0);
      };
      var fil = function (rr, cc, qd, w) {
        if (w <= 0.002) return;
        sp = sprite(m, 'uniti', { k: 3, q: qd }, w); at(sp.cv, sp.pad, rr, cc);
      };
      if (cells) {
        var CS = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
        for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
          i = r * n + c;
          if (cells[i] > 0.002 || st[i] === 2 || st[i] === 3) continue;
          for (var qd = 0; qd < 4; qd++) {
            var a = CS[qd][0], bb = CS[qd][1];
            if (on(full, n, r + a, c) && on(full, n, r, c + bb) && on(full, n, r + a, c + bb)) fil(r, c, qd, wAt(r, c));
          }
        }
      } else {
        for (j = 0; j < list.length; j++) { pc = list[j]; if (pc.k === 3 && p >= 1) fil(pc.r, pc.c, pc.q, wAt(pc.r, pc.c)); }
      }
    }
    runs(pen, 'quadrati', st, fullQ, n);
    mx.fill();
  }

  // ------------------------------------------------------------------ svg

  var svgId = 0;
  function attr(v) { return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  function logoHref(lo) {
    if (lo.href) return lo.href;
    var img = lo.image;
    if (!img) return null;
    if (typeof img.src === 'string' && /^data:image\//.test(img.src)) return img.src;
    if (!imageReady(img) || !root.document) return null;
    try {
      var sz = imageSize(img);
      var k = Math.min(1, 512 / Math.max(sz[0], sz[1]));
      var cv = root.document.createElement('canvas');
      cv.width = Math.max(1, Math.round(sz[0] * k)); cv.height = Math.max(1, Math.round(sz[1] * k));
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      return cv.toDataURL('image/png');
    } catch (e) { return null; }
  }

  function txt(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function svg(qr, opts) {
    var o = normOpts(opts);
    o.progress = 1;
    var n = qr.n, quiet = Math.max(2, Math.round(num(o.quiet, 4)));
    var fr = o.frame, band = fr && fr.text ? FR.cap : 0;
    var edge = fr ? quiet + FR.sw + FR.om : quiet;
    var T = n + 2 * edge, TH = fr ? edge + n + quiet + band + FR.pb + FR.sw + FR.om : T;
    var size = Math.max(16, num(o.size, 256));
    var area = logoArea(qr, o.logo);
    var prep = prepared(qr, o, area);
    var pl = prep.pl, list = prep.list;
    var pen = new SvgPen(edge, edge);
    if (o.shape === 'quadrati' || o.shape === 'uniti') {
      // horizontal runs make a smaller file; the eyes, alignment and fillets stay pieces
      var full = new Uint8Array(n * n);
      for (var i = 0; i < list.length; i++) {
        if (list[i].k === 0) full[list[i].r * n + list[i].c] = 1;
        else drawPiece(pen, list[i], o, n, pl.st, 1);
      }
      runs(pen, o.shape, pl.st, full, n);
    } else {
      for (var j = 0; j < list.length; j++) drawPiece(pen, list[j], o, n, pl.st, 1);
    }
    var id = 'qr' + (++svgId) + Math.floor(Math.random() * 1e6).toString(36);
    var defs = '', fill;
    if (o.fg && typeof o.fg === 'object') {
      var g = gradientLine(edge, edge, n, o.fg.angle);
      defs += '<linearGradient id="' + id + 'g" gradientUnits="userSpaceOnUse" x1="' + fx(g[0]) + '" y1="' + fx(g[1]) + '" x2="' + fx(g[2]) + '" y2="' + fx(g[3]) + '">' +
        '<stop offset="0" stop-color="' + attr(o.fg.from || '#111111') + '"/><stop offset="1" stop-color="' + attr(o.fg.to || o.fg.from || '#111111') + '"/></linearGradient>';
      fill = 'url(#' + id + 'g)';
    } else fill = attr(o.fg);
    var body = '';
    if (o.bg !== 'transparent') body += '<rect width="' + fx(T) + '" height="' + fx(TH) + '" fill="' + attr(o.bg) + '"/>';
    body += '<path d="' + pen.d.join('') + '" fill="' + fill + '"' + (o.shape === 'quadrati' && o.eye === 'quadrato' ? ' shape-rendering="crispEdges"' : '') + '/>';
    if (fr) {
      var e = quiet + FR.sw / 2, rp = new SvgPen(0, 0);
      rrect(rp, edge - e, edge - e, n + 2 * e, n + 2 * e + band + FR.pb, all4(FR.rad - FR.sw / 2));
      body += '<path d="' + rp.d.join('') + '" fill="none" stroke="' + fill + '" stroke-width="' + fx(FR.sw) + '"/>';
      if (fr.text) {
        // the caption's size: as on the canvas (measured there in pixels, here in modules)
        var fs = FR.font;
        if (root.document) {
          try {
            var mc = root.document.createElement('canvas').getContext('2d');
            var Lm = { m: 100, side: n * 100, quiet: quiet };
            fs = captionPx(mc, Lm, fr) / 100;
          } catch (er) { fs = FR.font; }
        }
        var fam = fr.font;
        if (fr.fontData) {
          defs += '<style>@font-face{font-family:"QRCaption";src:url(' + fr.fontData + ') format("woff2");font-weight:200 800;font-style:normal;}</style>';
          fam = '"QRCaption", ' + fam;
        }
        body += '<text x="' + fx(edge + n / 2) + '" y="' + fx(edge + n + quiet + band / 2) + '" text-anchor="middle" dominant-baseline="central" font-family="' + attr(fam) +
          '" font-weight="' + fr.weight + '" font-size="' + fx(fs) + '" fill="' + fill + '">' + txt(fr.text) + '</text>';
      }
    }
    if (area) {
      var href = logoHref(o.logo);
      if (href) {
        var box = area.box, bx = edge + (n - box) / 2;
        var w = box, h = box;
        if (o.logo.image && imageReady(o.logo.image)) {
          var sz = imageSize(o.logo.image), k = Math.min(box / sz[0], box / sz[1]);
          w = sz[0] * k; h = sz[1] * k;
        }
        var x = bx + (box - w) / 2, y = bx + (box - h) / 2;
        var clip = '';
        if (o.logo.round > 0) {
          var cpen = new SvgPen(x, y);
          rrect(cpen, 0, 0, w, h, all4(o.logo.round * Math.min(w, h) / 2));
          defs += '<clipPath id="' + id + 'c"><path d="' + cpen.d.join('') + '"/></clipPath>';
          clip = ' clip-path="url(#' + id + 'c)"';
        }
        body += '<image x="' + fx(x) + '" y="' + fx(y) + '" width="' + fx(w) + '" height="' + fx(h) + '" preserveAspectRatio="xMidYMid meet" href="' + attr(href) + '" xlink:href="' + attr(href) + '"' + clip + '/>';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + fx(size) + '" height="' + fx(size * TH / T) + '" viewBox="0 0 ' + fx(T) + ' ' + fx(TH) + '">' +
      (defs ? '<defs>' + defs + '</defs>' : '') + body + '</svg>';
  }

  // ------------------------------------------------------------------ verify

  // jsQR binarises in blocks of 8 px, so a perfectly good code can be missed at one scale and read at
  // another (a camera sees it at every scale): after the native size, smaller copies are tried.
  var SCALES = [1, 0.5, 0.75, 0.33];

  function pixels(src) {
    var w, h, data;
    if (src && src.data && typeof src.width === 'number' && !src.getContext) {
      w = src.width; h = src.height;
      var c0 = root.document.createElement('canvas');
      c0.width = w; c0.height = h;
      c0.getContext('2d').putImageData(src, 0, 0);
      return c0;
    }
    return src;
  }

  function verify(src, expected, vo) {
    var dec = root.jsQR;
    if (typeof dec !== 'function') throw fail('LIBRERIA', 'Manca jsQR: carica vendor/jsQR.js prima di qr-core.js.');
    var img = pixels(src);
    var w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    var want = expected === undefined || expected === null ? null : String(expected);
    var first = null;
    var scales = vo && vo.scales && vo.scales.length ? vo.scales : SCALES;
    for (var i = 0; i < scales.length; i++) {
      var k = scales[i];
      var w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
      if (k < 1 && Math.min(w, h) < 48) continue;
      var cv = root.document.createElement('canvas');
      cv.width = w; cv.height = h;
      var cx = cv.getContext('2d');
      cx.imageSmoothingEnabled = true;
      cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h); // flatten on white
      cx.drawImage(img, 0, 0, w, h);
      var data = cx.getImageData(0, 0, w, h).data;
      var res = null, inverted = false;
      try { res = dec(data, w, h, { inversionAttempts: 'dontInvert' }); } catch (e) { res = null; }
      if (!res) {
        try { res = dec(data, w, h, { inversionAttempts: 'attemptBoth' }); } catch (e2) { res = null; } // 'onlyInvert' is broken in jsQR 1.4
        inverted = !!res;
      }
      if (res) {
        if (!first) first = { text: res.data, inverted: inverted, scale: k };
        if (want === null || res.data === want) return { ok: true, text: res.data, inverted: inverted, scale: k };
      }
    }
    return first ? { ok: false, text: first.text, inverted: first.inverted, scale: first.scale } : { ok: false, text: null, inverted: false, scale: 0 };
  }

  // ------------------------------------------------------------------ error-correction budget

  // Reed-Solomon blocks per version (rows) and level (L|M|Q|H): count,total,data[,count,total,data].
  // Taken from qrcode-generator's RS_BLOCK_TABLE (Kazuhiko Arase, MIT), i.e. ISO/IEC 18004 table 9.
  var RS = [
    '1,26,19|1,26,16|1,26,13|1,26,9', '1,44,34|1,44,28|1,44,22|1,44,16', '1,70,55|1,70,44|2,35,17|2,35,13', '1,100,80|2,50,32|2,50,24|4,25,9',
    '1,134,108|2,67,43|2,33,15,2,34,16|2,33,11,2,34,12', '2,86,68|4,43,27|4,43,19|4,43,15', '2,98,78|4,49,31|2,32,14,4,33,15|4,39,13,1,40,14', '2,121,97|2,60,38,2,61,39|4,40,18,2,41,19|4,40,14,2,41,15',
    '2,146,116|3,58,36,2,59,37|4,36,16,4,37,17|4,36,12,4,37,13', '2,86,68,2,87,69|4,69,43,1,70,44|6,43,19,2,44,20|6,43,15,2,44,16', '4,101,81|1,80,50,4,81,51|4,50,22,4,51,23|3,36,12,8,37,13', '2,116,92,2,117,93|6,58,36,2,59,37|4,46,20,6,47,21|7,42,14,4,43,15',
    '4,133,107|8,59,37,1,60,38|8,44,20,4,45,21|12,33,11,4,34,12', '3,145,115,1,146,116|4,64,40,5,65,41|11,36,16,5,37,17|11,36,12,5,37,13', '5,109,87,1,110,88|5,65,41,5,66,42|5,54,24,7,55,25|11,36,12,7,37,13', '5,122,98,1,123,99|7,73,45,3,74,46|15,43,19,2,44,20|3,45,15,13,46,16',
    '1,135,107,5,136,108|10,74,46,1,75,47|1,50,22,15,51,23|2,42,14,17,43,15', '5,150,120,1,151,121|9,69,43,4,70,44|17,50,22,1,51,23|2,42,14,19,43,15', '3,141,113,4,142,114|3,70,44,11,71,45|17,47,21,4,48,22|9,39,13,16,40,14', '3,135,107,5,136,108|3,67,41,13,68,42|15,54,24,5,55,25|15,43,15,10,44,16',
    '4,144,116,4,145,117|17,68,42|17,50,22,6,51,23|19,46,16,6,47,17', '2,139,111,7,140,112|17,74,46|7,54,24,16,55,25|34,37,13', '4,151,121,5,152,122|4,75,47,14,76,48|11,54,24,14,55,25|16,45,15,14,46,16', '6,147,117,4,148,118|6,73,45,14,74,46|11,54,24,16,55,25|30,46,16,2,47,17',
    '8,132,106,4,133,107|8,75,47,13,76,48|7,54,24,22,55,25|22,45,15,13,46,16', '10,142,114,2,143,115|19,74,46,4,75,47|28,50,22,6,51,23|33,46,16,4,47,17', '8,152,122,4,153,123|22,73,45,3,74,46|8,53,23,26,54,24|12,45,15,28,46,16', '3,147,117,10,148,118|3,73,45,23,74,46|4,54,24,31,55,25|11,45,15,31,46,16',
    '7,146,116,7,147,117|21,73,45,7,74,46|1,53,23,37,54,24|19,45,15,26,46,16', '5,145,115,10,146,116|19,75,47,10,76,48|15,54,24,25,55,25|23,45,15,25,46,16', '13,145,115,3,146,116|2,74,46,29,75,47|42,54,24,1,55,25|23,45,15,28,46,16', '17,145,115|10,74,46,23,75,47|10,54,24,35,55,25|19,45,15,35,46,16',
    '17,145,115,1,146,116|14,74,46,21,75,47|29,54,24,19,55,25|11,45,15,46,46,16', '13,145,115,6,146,116|14,74,46,23,75,47|44,54,24,7,55,25|59,46,16,1,47,17', '12,151,121,7,152,122|12,75,47,26,76,48|39,54,24,14,55,25|22,45,15,41,46,16', '6,151,121,14,152,122|6,75,47,34,76,48|46,54,24,10,55,25|2,45,15,64,46,16',
    '17,152,122,4,153,123|29,74,46,14,75,47|49,54,24,10,55,25|24,45,15,46,46,16', '4,152,122,18,153,123|13,74,46,32,75,47|48,54,24,14,55,25|42,45,15,32,46,16', '20,147,117,4,148,118|40,75,47,7,76,48|43,54,24,22,55,25|10,45,15,67,46,16', '19,148,118,6,149,119|18,75,47,31,76,48|34,54,24,34,55,25|20,45,15,61,46,16'];
  // misdecode protection codewords of the smallest versions (not usable for correction)
  var PROTECT = { '1L': 3, '1M': 2, '1Q': 1, '1H': 1, '2L': 2, '3L': 1 };

  function rsBlocks(version, ecc) {
    var f = RS[version - 1].split('|')['LMQH'.indexOf(ecc)].split(',');
    var out = [];
    for (var i = 0; i < f.length; i += 3) for (var k = 0; k < +f[i]; k++) out.push({ total: +f[i + 1], data: +f[i + 2] });
    return out;
  }

  // For each module of the data region: which RS block its codeword belongs to, and that codeword's
  // number in the whole sequence (-1 for remainder bits and function modules).
  function codewordMap(qr) {
    var n = qr.n, kinds = qr.kinds;
    var blocks = rsBlocks(qr.version, qr.ecc);
    var seq = [], i, b;
    var maxData = 0;
    for (b = 0; b < blocks.length; b++) maxData = Math.max(maxData, blocks[b].data);
    for (i = 0; i < maxData; i++) for (b = 0; b < blocks.length; b++) if (i < blocks[b].data) seq.push(b);
    var ecLen = blocks[0].total - blocks[0].data;
    for (i = 0; i < ecLen; i++) for (b = 0; b < blocks.length; b++) seq.push(b);
    var cw = new Int32Array(n * n);
    for (i = 0; i < cw.length; i++) cw[i] = -1;
    var bit = 0;
    for (var right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      var upward = ((right + 1) & 2) === 0;
      for (var v = 0; v < n; v++) {
        var y = upward ? n - 1 - v : v;
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          if (kinds[y * n + x] !== KIND.data) continue;
          var w = bit >> 3;
          if (w < seq.length) cw[y * n + x] = w;
          bit++;
        }
      }
    }
    return { cw: cw, seq: seq, blocks: blocks, ecLen: ecLen };
  }

  // How much of the correction the cleared modules use: the worst block's damaged codewords divided
  // by the codewords that block can correct (1 = exactly at the limit, with nothing left for a blur).
  function logoLoad(qr, st) {
    var map = codewordMap(qr);
    var hit = {};
    for (var i = 0; i < st.length; i++) if (st[i] === 3 && map.cw[i] >= 0) hit[map.cw[i]] = 1;
    var per = [];
    for (var b = 0; b < map.blocks.length; b++) per.push(0);
    for (var w in hit) if (Object.prototype.hasOwnProperty.call(hit, w)) per[map.seq[+w]]++;
    var p = PROTECT[qr.version + qr.ecc] || 0;
    var t = Math.floor((map.ecLen - p) / 2);
    var worst = 0;
    for (var k = 0; k < per.length; k++) worst = Math.max(worst, per[k] / t);
    return worst;
  }

  // ------------------------------------------------------------------ advice

  function suggestEcc(hasLogo) { return hasLogo ? 'H' : 'M'; }

  // OKLab (Björn Ottosson's matrices): to darken or lighten a colour keeping its hue
  function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function gam(v) { v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.round(clamp(v, 0, 1) * 255); }
  function toLab(c) {
    var r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
      s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function fromLab(L) {
    var l = L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], m = L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], s = L[0] - 0.0894841775 * L[1] - 1.291485548 * L[2];
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
  }
  function hex2(c) { var s = '#'; for (var i = 0; i < 3; i++) { var h = Math.round(c[i]).toString(16); s += h.length < 2 ? '0' + h : h; } return s; }

  // The nearest colour of the same hue with at least `target` contrast on bg (default 4.5): darker on a light ground,
  // lighter on a dark one; the chroma follows the lightness so the colour stays in gamut. A gradient: each end on its own.
  // Returns fg itself when it already passes, null when a colour cannot be read.
  function fixContrast(fg, bg, target) {
    target = num(target, 4.5);
    if (fg && typeof fg === 'object') {
      var a = fixContrast(fg.from, bg, target), b = fixContrast(fg.to, bg, target);
      return a && b ? { from: a, to: b, angle: fg.angle } : null;
    }
    var f = parseColor(fg), g = (bg === undefined || bg === null) ? [255, 255, 255, 1] : parseColor(bg);
    if (!f || !g) return null;
    if (g[3] < 1) g = over(g, [255, 255, 255, 1]);
    f = over(f, g);
    if (ratio(f, g) >= target) return fg;
    var L = toLab(f), C = Math.sqrt(L[1] * L[1] + L[2] * L[2]), h = Math.atan2(L[2], L[1]);
    var dark = lum(g) > 0.18;
    var at = function (l) { var k = dark ? (L[0] > 0 ? l / L[0] : 0) : (L[0] < 1 ? (1 - l) / (1 - L[0]) : 0); return fromLab([l, C * k * Math.cos(h), C * k * Math.sin(h)]); };
    var lo = dark ? 0 : L[0], hi = dark ? L[0] : 1, best = dark ? [0, 0, 0] : [255, 255, 255];
    for (var i = 0; i < 40; i++) {
      var mid = (lo + hi) / 2, c = at(mid);
      if (ratio(c, g) >= target) { best = c; if (dark) lo = mid; else hi = mid; } else if (dark) hi = mid; else lo = mid;
    }
    return hex2(best);
  }

  // The largest picture (scale, 0.12..0.3, in steps of 0.005) that leaves the code readable: its margin must use no more
  // than LOGO_LOAD of the worst block's correction. 0 when even the smallest is too big (use ecc "H", or no picture).
  function maxLogoScale(qr, logo) {
    var lo = logoOpts(logo || {});
    var ok = function (sc) { lo.scale = sc; return logoLoad(qr, plan(qr, logoArea(qr, lo)).st) <= LOGO_LOAD; };
    if (!ok(0.12)) return 0;
    if (ok(0.3)) return 0.3;
    var a = 0.12, b = 0.3;
    for (var i = 0; i < 12; i++) { var mid = (a + b) / 2; if (ok(mid)) a = mid; else b = mid; }
    return Math.floor(a * 200 + 1e-6) / 200;
  }

  // the size of what render draws, in CSS px (taller than wide with a frame)
  function measure(qr, opts) {
    var L = layoutFor(qr.n, normOpts(opts));
    return { width: L.size, height: L.H / L.dpr, deviceWidth: L.W, deviceHeight: L.H };
  }

  // Smallest module side for a phone camera reading the code off a screen, in CSS px (1 CSS px is about
  // 0.16 mm on a phone: 2 px = 0.33 mm, the usual minimum for print), and in device px for the shape to
  // exist at all (a dot of 0.86 px is a grey smudge). Both decoders of strumenti/qr-prova.mjs read even
  // 1 px modules on clean pixels: these limits are for real cameras, not for the bench.
  var MIN_CSS = { quadrati: 1.75, uniti: 1.75, tondi: 2, punti: 2 };
  var MIN_DEV = { quadrati: 1, uniti: 1, tondi: 2, punti: 2 };
  // an SVG drawn off the pixel grid with 3.6 px per module failed zxing-cpp in every shape; 4.9 px passed
  var MIN_DEV_SVG = 4;
  // Part of the error correction a logo may use, counted exactly: every codeword with a module under the
  // logo's margin is taken as wrong, and in the worst Reed-Solomon block those must stay under this share
  // of what the block can correct (the rest is left for blur, glare and print).
  // Calibrated by strumenti/qr-prova.mjs (worst case: a dark, busy picture).
  var LOGO_LOAD = 0.8;

  function scannable(opts, qr) {
    var o = normOpts(opts);
    var problems = [];
    var details = {};
    var add = function (code, level, why) { problems.push({ code: code, level: level, why: why }); };
    var ci = contrastInfo(o.fg, o.bg);
    if (!ci) add('CONTRASTO', 'errore', 'Non riconosco uno dei colori.');
    else {
      details.contrast = Math.round(ci.ratio * 100) / 100;
      if (ci.ratio < 3) add('CONTRASTO', 'errore', 'Contrasto troppo basso tra codice e fondo: scurisci il codice o schiarisci il fondo.');
      else if (ci.ratio < 4.5) add('CONTRASTO', 'avviso', 'Contrasto un po\u2019 basso: in poca luce alcuni lettori faticano.');
      if (ci.fgLum > ci.bgLum) add('INVERTITO', 'avviso', 'Codice chiaro su fondo scuro: molte fotocamere non lo leggono.');
      if (ci.transparent) add('TRASPARENTE', 'avviso', 'Fondo trasparente: mettilo su una superficie chiara e uniforme.');
    }
    var q = Math.round(num(opts && opts.quiet, 4));
    if (q < 4) add('MARGINE', 'avviso', 'Margine sotto i 4 moduli: alcuni lettori faticano a trovare il codice.');
    if (qr) {
      var L = layoutFor(qr.n, o);
      var dev = L.m, css = L.m / L.dpr, minDev = MIN_DEV[o.shape];
      if (opts && opts.svg === true) {
        // an SVG is not snapped to the pixel grid: off the grid both decoders need more pixels
        dev = L.W / (qr.n + 2 * L.quiet); css = dev / L.dpr; minDev = Math.max(minDev, MIN_DEV_SVG);
      }
      details.moduleCss = Math.round(css * 100) / 100;
      details.moduleDev = Math.round(dev * 100) / 100;
      if (dev < minDev - 1e-9 || css < MIN_CSS[o.shape] - 1e-9) {
        add('MODULI_PICCOLI', 'errore', o.shape === 'quadrati' || o.shape === 'uniti'
          ? 'Codice troppo fitto per questa misura: ingrandiscilo o accorcia il testo.'
          : 'Codice troppo fitto per questa forma: ingrandiscilo, accorcia il testo o usa i quadrati.');
      }
      if (qr.version >= 36) add('DENSO', 'errore', 'Troppo fitto per un telefono: accorcia il testo.');
      else if (qr.version >= 31) add('DENSO', 'avviso', 'Codice molto fitto: alcuni telefoni faticano a leggerlo.');
      if (o.logo) {
        var pl = plan(qr, logoArea(qr, o.logo));
        var dataMods = 0, areaMods = 0;
        for (var i = 0; i < qr.kinds.length; i++) {
          if (qr.kinds[i] === KIND.data) dataMods++;
          if (pl.st[i] === 3) areaMods++;
        }
        var share = areaMods / dataMods, load = logoLoad(qr, pl.st);
        details.logoShare = Math.round(share * 1000) / 1000;
        details.logoLoad = Math.round(load * 1000) / 1000;
        if (load > LOGO_LOAD) {
          add('LOGO_GRANDE', 'errore', qr.ecc === 'H' ? 'Immagine troppo grande per restare leggibile: rimpiccioliscila.'
            : 'Immagine troppo grande per questa correzione: usa la correzione alta (H) o rimpiccioliscila.');
        } else if (qr.ecc !== 'H') {
          add('LOGO_ECC', 'avviso', 'Con un\u2019immagine al centro conviene la correzione alta (H).');
        }
      }
    }
    var rank = { errore: 0, avviso: 1 };
    problems.sort(function (a, b) { return rank[a.level] - rank[b.level]; });
    var level = problems.length ? problems[0].level : 'ok';
    return { ok: problems.length === 0, level: level, why: problems.length ? problems[0].why : '', problems: problems, details: details };
  }

  root.QRCore = {
    version: '1.1.0',
    KIND: KIND,
    payload: payload,
    encode: encode,
    render: render,
    svg: svg,
    verify: verify,
    suggestEcc: suggestEcc,
    contrast: contrast,
    scannable: scannable,
    targets: targets,
    measure: measure,
    fixContrast: fixContrast,
    maxLogoScale: maxLogoScale,
    // for the test bench and QR Studio; not needed by most callers
    _layout: function (qr, opts) { var L = layoutFor(qr.n, normOpts(opts)); return { dpr: L.dpr, width: L.W, m: L.m, side: L.side, ox: L.ox, quiet: L.realQuiet }; },
    _parseColor: parseColor
  };
})(typeof self !== 'undefined' ? self : this);
