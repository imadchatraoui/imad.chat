/*
 * qr-core.js — the QR engine of imad.chat (QR Studio and the mini QR in the home's Tools tile).
 * Plain script, ES2017, no framework. It defines window.QRCore.
 *
 * Load order (plain <script> tags, no modules):
 *   <script src="vendor/qrcode-generator.js"></script>   global `qrcode` (Kazuhiko Arase, MIT): builds the matrix
 *   <script src="vendor/jsQR.js"></script>               global `jsQR`  (cozmo/jsQR, Apache-2.0): reads it back
 *   <script src="qr-core.js"></script>                   global `QRCore`
 * jsQR (250 KB) is needed only by QRCore.verify; a page that never verifies may leave it out.
 *
 * Usage:
 *   var text = QRCore.payload.url("imad.chat");                       // "https://imad.chat"
 *   var qr   = QRCore.encode(text, { ecc: QRCore.suggestEcc(false) }); // matrix
 *   var opts = { size: 132, shape: "uniti", eye: "tondo", fg: "#1d1b16", bg: "#fff" };
 *   var chk  = QRCore.scannable(opts, qr);                            // { ok, level, why, problems }
 *   var t0 = performance.now();
 *   (function frame(now) {                                            // the code draws itself in 700 ms
 *     var p = Math.min(1, (now - t0) / 700);
 *     QRCore.render(canvas, qr, Object.assign({}, opts, { progress: p, order: "onda" }));
 *     if (p < 1) requestAnimationFrame(frame);
 *     else if (!QRCore.verify(canvas, text).ok) { ... say it does not scan, do not offer "Salva" ... }
 *   })(t0);
 *
 * ---------------------------------------------------------------------------------------------
 * QRCore.payload — the strings phones really read. Every function returns a string.
 *   url(s)        trims; adds "https://" when there is no scheme and it looks like a host
 *                 ("imad.chat/x", "www.a.it", "localhost:3000", "192.168.1.1"); "" for empty input;
 *                 anything else (a scheme like "mailto:", or plain words) is returned trimmed, as is.
 *   text(s)       the text unchanged ("" for null/undefined); line breaks normalised to "\n".
 *   wifi({ ssid, password, security: "WPA"|"WEP"|"nopass", hidden })
 *                 "WIFI:T:WPA;S:<ssid>;P:<password>;H:true;;"  with \ ; , : " escaped by a backslash.
 *                 security defaults to "WPA" with a password and "nopass" without; WPA covers WPA2/WPA3.
 *                 P is left out for "nopass", H only when hidden is true.
 *   vcard({ name, org, title, phone, email, url, address, note })
 *                 vCard 3.0, CRLF line ends, \ , ; and line breaks escaped. N is "last;first" taken from
 *                 name (last word = family name). Empty fields are left out. url goes through url().
 *   email({ to, subject, body })   "mailto:<to>?subject=...&body=..." (encodeURIComponent, CRLF in body).
 *   tel(n)        "tel:+39011..." keeping only digits, a leading +, * and #.
 *   sms({ to, body })              "SMSTO:<to>:<body>".
 *
 * QRCore.encode(text, { ecc, minVersion }) -> qr
 *   ecc "L"|"M"|"Q"|"H" (default "M"), minVersion 1..40 (default 1). Picks the smallest version that fits.
 *   Mode: digits only -> Numeric; QR alphanumeric charset (0-9 A-Z space $%*+-./:) -> Alphanumeric;
 *   anything else -> Byte, as UTF-8 bytes (plain ASCII stays one byte per character).
 *   qr = { n, version, ecc, text, mode, get(r, c) -> boolean (dark), kind(r, c) -> string,
 *          modules: Uint8Array(n*n) 1 = dark, kinds: Uint8Array(n*n) codes of KIND }
 *   kind(r, c): "finder" (the three eyes with their light separators, 8x8 each), "align" (5x5 alignment
 *   patterns), "timing" (row 6 / column 6), "format" (format bits, the dark module, and the version bits
 *   of versions 7+), "data" (everything else: data and error correction).
 *   Throws Error (err.code "VUOTO") for empty text; Error (err.code "TROPPO_LUNGO") when it cannot fit:
 *   err.message is a short Italian sentence to show as is.
 *
 * QRCore.render(canvas, qr, opts) -> info
 *   Draws on a 2D canvas at the device pixel ratio. Sets canvas.width/height to size*dpr and, unless
 *   opts.style === false, canvas.style.width/height to size px. opts:
 *     size      CSS px of the canvas side (default 256)
 *     dpr       pixel ratio (default window.devicePixelRatio, capped to 4)
 *     quiet     quiet zone in modules (default 4, never under 2)
 *     shape     "quadrati" | "punti" | "tondi" | "uniti" (neighbouring modules join into soft shapes)
 *     eye       "quadrato" | "tondo" | "goccia" (the three finders; alignment patterns follow the eye)
 *     fg        a CSS colour, or { from, to, angle } (angle in degrees: 0 = left to right,
 *               90 = top to bottom; default 45)                                     default "#111111"
 *     bg        a CSS colour or "transparent"                                       default "#ffffff"
 *     logo      { image, scale, pad, round } or null. image: a loaded <img>, <canvas> or ImageBitmap
 *               (not loaded yet = only the margin is cleared). scale 0.12..0.3 of the code's side
 *               (default 0.22); pad: modules of clean margin around it (default 1); round: false,
 *               true or 0..1 (corner rounding of the picture; true = 0.35). Use ecc "H" with a logo.
 *     progress  0..1 (default 1) and order "onda" (a ripple from the centre) | "righe" | "caso":
 *               which modules are already drawn; each eases in (scale and alpha) over 30% of the run.
 *               At 1 the picture is exactly the final one. Respect reduced motion in the caller
 *               (draw progress 1 at once).
 *   Modules land on whole device pixels: the module side m is an integer number of device pixels and
 *   whatever does not divide goes to the margin, so the real quiet zone can be a little larger.
 *   info = { dpr, width, height, m, ox, oy, side, quiet, cleared }  (device px; cleared = data modules
 *   removed under the logo).
 *
 * QRCore.svg(qr, opts) -> string
 *   The same picture as an SVG document (opts as render, without progress/dpr). viewBox in modules;
 *   width/height = size. A logo needs a data: URL: opts.logo.href, or a data: <img>, or a drawable
 *   image that is turned into one (if that fails the logo is left out and its margin stays clear).
 *
 * QRCore.verify(canvasOrImageData, expected?) -> { ok, text, inverted }
 *   Reads the drawn pixels back with jsQR (flattened on white, then also inverted). ok is true when a
 *   code is found and, if expected is given, its text equals expected. text is null when nothing is read.
 *
 * QRCore.suggestEcc(hasLogo) -> "H" with a logo, "M" without.
 * QRCore.contrast(fg, bg) -> WCAG contrast ratio (1..21). fg may be a gradient (the worse end counts);
 *   bg "transparent" is taken as white. Colours with alpha are composited on bg.
 * QRCore.scannable(opts, qr) -> { ok, level: "ok"|"avviso"|"errore", why, problems: [{ code, why, level }] }
 *   why is the first (worst) problem's Italian sentence, "" when ok. "errore" = do not offer saving;
 *   "avviso" = it scanned here but some readers may fail. Codes: CONTRASTO, INVERTITO, MARGINE,
 *   MODULI_PICCOLI, LOGO_GRANDE, LOGO_ECC, TRASPARENTE. Always also run verify on the final canvas.
 * QRCore.KIND = { data: 0, finder: 1, align: 2, timing: 3, format: 4 }, QRCore.version.
 * ---------------------------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var KIND = { data: 0, finder: 1, align: 2, timing: 3, format: 4 };
  var KIND_NAME = ['data', 'finder', 'align', 'timing', 'format'];
  var SHAPES = ['quadrati', 'punti', 'tondi', 'uniti'];
  var EYES = ['quadrato', 'tondo', 'goccia'];
  var ORDERS = ['onda', 'righe', 'caso'];
  var K = 0.5522847498; // cubic bezier constant for a quarter circle
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
  CanvasPen.prototype.C = function (a, b, c, d, e, f) {
    var m = this.m, ox = this.ox, oy = this.oy;
    this.x.bezierCurveTo(ox + a * m, oy + b * m, ox + c * m, oy + d * m, ox + e * m, oy + f * m);
  };
  CanvasPen.prototype.Z = function () { this.x.closePath(); };

  function fx(v) { var s = (Math.round(v * 1000) / 1000).toString(); return s === '-0' ? '0' : s; }
  function SvgPen(ox, oy) { this.d = []; this.ox = ox; this.oy = oy; }
  SvgPen.prototype.M = function (a, b) { this.d.push('M' + fx(this.ox + a) + ' ' + fx(this.oy + b)); };
  SvgPen.prototype.L = function (a, b) { this.d.push('L' + fx(this.ox + a) + ' ' + fx(this.oy + b)); };
  SvgPen.prototype.C = function (a, b, c, d, e, f) {
    var ox = this.ox, oy = this.oy;
    this.d.push('C' + fx(ox + a) + ' ' + fx(oy + b) + ' ' + fx(ox + c) + ' ' + fx(oy + d) + ' ' + fx(ox + e) + ' ' + fx(oy + f));
  };
  SvgPen.prototype.Z = function () { this.d.push('Z'); };

  // rounded rectangle, radii [tl, tr, br, bl]; ccw draws it the other way round (a hole).
  function rrect(p, x, y, w, h, rad, ccw) {
    var tl = rad ? rad[0] : 0, tr = rad ? rad[1] : 0, br = rad ? rad[2] : 0, bl = rad ? rad[3] : 0;
    if (!ccw) {
      p.M(x + tl, y);
      p.L(x + w - tr, y); if (tr) p.C(x + w - tr + K * tr, y, x + w, y + tr - K * tr, x + w, y + tr);
      p.L(x + w, y + h - br); if (br) p.C(x + w, y + h - br + K * br, x + w - br + K * br, y + h, x + w - br, y + h);
      p.L(x + bl, y + h); if (bl) p.C(x + bl - K * bl, y + h, x, y + h - bl + K * bl, x, y + h - bl);
      p.L(x, y + tl); if (tl) p.C(x, y + tl - K * tl, x + tl - K * tl, y, x + tl, y);
    } else {
      p.M(x + tl, y);
      if (tl) p.C(x + tl - K * tl, y, x, y + tl - K * tl, x, y + tl);
      p.L(x, y + h - bl); if (bl) p.C(x, y + h - bl + K * bl, x + bl - K * bl, y + h, x + bl, y + h);
      p.L(x + w - br, y + h); if (br) p.C(x + w - br + K * br, y + h, x + w, y + h - br + K * br, x + w, y + h - br);
      p.L(x + w, y + tr); if (tr) p.C(x + w, y + tr - K * tr, x + w - tr + K * tr, y, x + w - tr, y);
    }
    p.Z();
  }
  function rect(p, x, y, w, h) { p.M(x, y); p.L(x + w, y); p.L(x + w, y + h); p.L(x, y + h); p.Z(); }
  function all4(r) { return [r, r, r, r]; }

  // concave fillet in the corner (cx, cy) of a light cell; dx, dy point into the cell.
  function fillet(p, cx, cy, dx, dy, r) {
    p.M(cx, cy);
    p.L(cx + dx * r, cy);
    p.C(cx + dx * (r - K * r), cy, cx, cy + dy * (r - K * r), cx, cy + dy * r);
    p.Z();
  }

  // ------------------------------------------------------------------ layout and logo

  function layoutFor(n, o) {
    var dpr = clamp(num(o.dpr, root.devicePixelRatio || 1), 1, 4);
    var size = Math.max(16, num(o.size, 256));
    var quiet = Math.max(2, Math.round(num(o.quiet, 4)));
    var W = Math.round(size * dpr);
    var m = Math.max(1, Math.floor(W / (n + 2 * quiet)));
    var side = m * n;
    var ox = Math.floor((W - side) / 2);
    return { dpr: dpr, size: size, W: W, m: m, side: side, ox: ox, oy: ox, quiet: quiet, realQuiet: ox / m };
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

  var DOT = 0.86, TILE = 0.9, TILE_R = 0.3, JOIN_R = 0.5, FILLET_R = 0.3;

  function moduleShape(p, shape, st, n, r, c, s) {
    var cx = c + 0.5, cy = r + 0.5, h;
    if (shape === 'punti') { h = DOT * s / 2; rrect(p, cx - h, cy - h, 2 * h, 2 * h, all4(h)); return; }
    if (shape === 'tondi') { h = TILE * s / 2; rrect(p, cx - h, cy - h, 2 * h, 2 * h, all4(TILE_R * s)); return; }
    if (shape === 'uniti') {
      h = s / 2;
      var R = JOIN_R * s;
      var up = on(st, n, r - 1, c), dn = on(st, n, r + 1, c), lf = on(st, n, r, c - 1), rt = on(st, n, r, c + 1);
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

  function eyeShape(p, eye, which, x, y, s) {
    var rr = eyeRadii(eye, which);
    var cx = x + 3.5, cy = y + 3.5;
    var S = function (v, c0) { return c0 + (v - c0) * s; };
    rrect(p, S(x, cx), S(y, cy), 7 * s, 7 * s, scaleR(rr[0], s));
    rrect(p, S(x + 1, cx), S(y + 1, cy), 5 * s, 5 * s, scaleR(rr[1], s), true);
    rrect(p, S(x + 2, cx), S(y + 2, cy), 3 * s, 3 * s, scaleR(rr[2], s));
  }
  function alignShape(p, eye, x, y, s) { // x, y = top-left of the 5x5
    var round = eye !== 'quadrato';
    var cx = x + 2.5, cy = y + 2.5;
    var S = function (v, c0) { return c0 + (v - c0) * s; };
    rrect(p, S(x, cx), S(y, cy), 5 * s, 5 * s, all4(round ? 1.6 * s : 0));
    rrect(p, S(x + 1, cx), S(y + 1, cy), 3 * s, 3 * s, all4(round ? 0.6 * s : 0), true);
    rrect(p, S(x + 2, cx), S(y + 2, cy), s, s, all4(round ? 0.5 * s : 0));
  }

  // every drawable piece of the picture: { t: delay 0..1, draw(pen, s) }
  function pieces(qr, o, pl) {
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
      out.push({ d: delay(r, c), r: r, c: c, k: 0 });
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
    if (shape === 'uniti') {
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
        var v = st[r * n + c];
        if (v !== 0) continue;
        // corners: [dr, dc] of the diagonal neighbour
        var cs = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
        for (var q = 0; q < 4; q++) {
          var a = cs[q][0], b = cs[q][1];
          if (on(st, n, r + a, c) && on(st, n, r, c + b) && on(st, n, r + a, c + b)) {
            out.push({ d: Math.max(delay(r + a, c), delay(r, c + b)), r: r, c: c, k: 3, a: a, b: b });
          }
        }
      }
    }
    return out;
  }

  function drawPiece(p, pc, o, n, st, s) {
    if (pc.k === 0) moduleShape(p, o.shape, st, n, pc.r, pc.c, s);
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
      progress: clamp(num(o.progress, 1), 0, 1), order: pick(o.order, ORDERS, 'onda')
    };
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

  // ------------------------------------------------------------------ render

  function render(canvas, qr, opts) {
    var o = normOpts(opts);
    var L = layoutFor(qr.n, o);
    if (canvas.width !== L.W) canvas.width = L.W;
    if (canvas.height !== L.W) canvas.height = L.W;
    if (o.style !== false && canvas.style) {
      canvas.style.width = L.size + 'px';
      canvas.style.height = L.size + 'px';
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, L.W, L.W);
    if (o.bg !== 'transparent') { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, L.W, L.W); }

    var area = logoArea(qr, o.logo);
    var pl = plan(qr, area);
    var list = pieces(qr, o, pl);
    var n = qr.n, p = o.progress;
    var pen = new CanvasPen(ctx, L.ox, L.oy, L.m);

    var fill;
    if (o.fg && typeof o.fg === 'object') {
      var g = gradientLine(L.ox, L.oy, L.side, o.fg.angle);
      fill = ctx.createLinearGradient(g[0], g[1], g[2], g[3]);
      fill.addColorStop(0, o.fg.from || '#111111');
      fill.addColorStop(1, o.fg.to || o.fg.from || '#111111');
    } else fill = o.fg;
    ctx.fillStyle = fill;

    if (p >= 1) {
      ctx.beginPath();
      for (var i = 0; i < list.length; i++) drawPiece(pen, list[i], o, n, pl.st, 1);
      ctx.fill();
    } else {
      var LEVELS = 12, buckets = [];
      for (var b = 0; b <= LEVELS; b++) buckets.push([]);
      for (var j = 0; j < list.length; j++) {
        var t = (p - list[j].d * (1 - WINDOW)) / WINDOW;
        if (t <= 0) continue;
        if (t > 1) t = 1;
        var al = easeOutCubic(Math.min(1, t * 1.5));
        buckets[Math.round(al * LEVELS)].push([list[j], t]);
      }
      for (var lv = 1; lv <= LEVELS; lv++) {
        if (!buckets[lv].length) continue;
        ctx.globalAlpha = lv / LEVELS;
        ctx.beginPath();
        for (var q = 0; q < buckets[lv].length; q++) {
          var it = buckets[lv][q];
          var s = it[1] >= 1 ? 1 : 0.25 + 0.75 * easeOutBack(it[1]);
          drawPiece(pen, it[0], o, n, pl.st, s);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (area && o.logo.image && imageReady(o.logo.image)) {
      var la = p >= 1 ? 1 : clamp((p - 0.7) / 0.3, 0, 1);
      if (la > 0) {
        var e = easeOutCubic(la);
        var box = Math.round(area.box * L.m * (0.85 + 0.15 * e));
        var bx = Math.round(L.ox + (L.side - box) / 2), by = Math.round(L.oy + (L.side - box) / 2);
        var sz = imageSize(o.logo.image);
        var k = Math.min(box / sz[0], box / sz[1]);
        var w = sz[0] * k, h = sz[1] * k;
        ctx.save();
        ctx.globalAlpha = e;
        if (o.logo.round > 0) {
          ctx.beginPath();
          var cp = new CanvasPen(ctx, bx + (box - w) / 2, by + (box - h) / 2, 1);
          rrect(cp, 0, 0, w, h, all4(o.logo.round * Math.min(w, h) / 2));
          ctx.clip();
        }
        ctx.drawImage(o.logo.image, bx + (box - w) / 2, by + (box - h) / 2, w, h);
        ctx.restore();
      }
    }
    return { dpr: L.dpr, width: L.W, height: L.W, m: L.m, ox: L.ox, oy: L.oy, side: L.side, quiet: L.realQuiet, cleared: pl.cleared };
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

  function svg(qr, opts) {
    var o = normOpts(opts);
    o.progress = 1;
    var n = qr.n, quiet = Math.max(2, Math.round(num(o.quiet, 4)));
    var T = n + 2 * quiet;
    var size = Math.max(16, num(o.size, 256));
    var area = logoArea(qr, o.logo);
    var pl = plan(qr, area);
    var list = pieces(qr, o, pl);
    var pen = new SvgPen(quiet, quiet);
    if (o.shape === 'quadrati') {
      // horizontal runs make a smaller file; the eyes and alignment stay pieces
      for (var r = 0; r < n; r++) {
        var c = 0;
        while (c < n) {
          if (pl.st[r * n + c] !== 1) { c++; continue; }
          var c0 = c;
          while (c < n && pl.st[r * n + c] === 1) c++;
          rect(pen, c0, r, c - c0, 1);
        }
      }
      for (var i = 0; i < list.length; i++) if (list[i].k !== 0) drawPiece(pen, list[i], o, n, pl.st, 1);
    } else {
      for (var j = 0; j < list.length; j++) drawPiece(pen, list[j], o, n, pl.st, 1);
    }
    var id = 'qr' + (++svgId) + Math.floor(Math.random() * 1e6).toString(36);
    var defs = '', fill;
    if (o.fg && typeof o.fg === 'object') {
      var g = gradientLine(quiet, quiet, n, o.fg.angle);
      defs += '<linearGradient id="' + id + 'g" gradientUnits="userSpaceOnUse" x1="' + fx(g[0]) + '" y1="' + fx(g[1]) + '" x2="' + fx(g[2]) + '" y2="' + fx(g[3]) + '">' +
        '<stop offset="0" stop-color="' + attr(o.fg.from || '#111111') + '"/><stop offset="1" stop-color="' + attr(o.fg.to || o.fg.from || '#111111') + '"/></linearGradient>';
      fill = 'url(#' + id + 'g)';
    } else fill = attr(o.fg);
    var body = '';
    if (o.bg !== 'transparent') body += '<rect width="' + T + '" height="' + T + '" fill="' + attr(o.bg) + '"/>';
    body += '<path d="' + pen.d.join('') + '" fill="' + fill + '"' + (o.shape === 'quadrati' && o.eye === 'quadrato' ? ' shape-rendering="crispEdges"' : '') + '/>';
    if (area) {
      var href = logoHref(o.logo);
      if (href) {
        var box = area.box, bx = quiet + (n - box) / 2;
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
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + fx(size) + '" height="' + fx(size) + '" viewBox="0 0 ' + T + ' ' + T + '">' +
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

  function verify(src, expected) {
    var dec = root.jsQR;
    if (typeof dec !== 'function') throw fail('LIBRERIA', 'Manca jsQR: carica vendor/jsQR.js prima di qr-core.js.');
    var img = pixels(src);
    var w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    var want = expected === undefined || expected === null ? null : String(expected);
    var first = null;
    for (var i = 0; i < SCALES.length; i++) {
      var k = SCALES[i];
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
        try { res = dec(data, w, h, { inversionAttempts: 'onlyInvert' }); } catch (e2) { res = null; }
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

  // Smallest module side for a phone camera reading the code off a screen, in CSS px (1 CSS px is about
  // 0.16 mm on a phone: 2 px = 0.33 mm, the usual minimum for print), and in device px for the shape to
  // exist at all (a dot of 0.86 px is a grey smudge). Both decoders of strumenti/qr-prova.mjs read even
  // 1 px modules on clean pixels: these limits are for real cameras, not for the bench.
  var MIN_CSS = { quadrati: 1.75, uniti: 1.75, tondi: 2, punti: 2 };
  var MIN_DEV = { quadrati: 1, uniti: 1, tondi: 2, punti: 2 };
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
      var css = L.m / L.dpr;
      details.moduleCss = Math.round(css * 100) / 100;
      details.moduleDev = L.m;
      if (L.m < MIN_DEV[o.shape] || css < MIN_CSS[o.shape] - 1e-9) {
        add('MODULI_PICCOLI', 'errore', o.shape === 'quadrati' || o.shape === 'uniti'
          ? 'Codice troppo fitto per questa misura: ingrandiscilo o accorcia il testo.'
          : 'Codice troppo fitto per questa forma: ingrandiscilo, accorcia il testo o usa i quadrati.');
      }
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
    version: '1.0.0',
    KIND: KIND,
    payload: payload,
    encode: encode,
    render: render,
    svg: svg,
    verify: verify,
    suggestEcc: suggestEcc,
    contrast: contrast,
    scannable: scannable,
    // for the test bench and QR Studio; not needed by most callers
    _layout: function (qr, opts) { var L = layoutFor(qr.n, normOpts(opts)); return { dpr: L.dpr, width: L.W, m: L.m, side: L.side, ox: L.ox, quiet: L.realQuiet }; },
    _parseColor: parseColor
  };
})(typeof self !== 'undefined' ? self : this);
