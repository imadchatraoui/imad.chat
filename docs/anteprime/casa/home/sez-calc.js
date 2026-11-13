/* imad.chat — i conti delle sezioni (prototipo). Plain script, ES2017 al massimo, nessuna dipendenza oltre a ImadAstro
   (../../shared/astro-lite.js). Funziona nella pagina (window.SEZ_CALC) e in node (module.exports), così i numeri si controllano
   contro le risposte salvate delle rotte e contro lib/astro.
     heat(j)            l'anno di GitHub da /api/github/contributi: giorni attivi, serie più lunga, serie in corso, giorno più pieno,
                        mesi, giorni della settimana. Solo dai giorni della risposta; null se la risposta non c'è.
     city(c, d)         una città adesso: ora (Casablanca a UTC+0 dal 20 settembre 2026), Sole e Luna (altezza, azimut), alba,
                        tramonto, ore di luce, qibla e distanza dalla Kaʿba. */
(function (root) {
  "use strict";
  var A = root.ImadAstro || (typeof require === "function" ? require(process.env.ASTRO_LITE) : null);
  var DAY = 86400000, RAD = Math.PI / 180, DEG = 180 / Math.PI;
  var MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  var MESI3 = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  var GIORNI = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
  var GIORNI3 = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
  var WINDS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];

  function parseDay(s) { var m = typeof s === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null; return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function wdOf(ms) { return (new Date(ms).getUTCDay() + 6) % 7; }              /* lunedì = 0 */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ------------------------------------------------------------------ l'anno di GitHub */
  function heat(j) {
    if (!j || !j.ok || !j.days || !j.days.length) return null;
    var list = [];
    for (var i = 0; i < j.days.length; i++) {
      var x = j.days[i], ms = parseDay(x && x.d);
      if (isNaN(ms)) continue;
      var n = typeof x.n === "number" && isFinite(x.n) && x.n >= 0 ? Math.round(x.n) : null;
      var l = typeof x.l === "number" && isFinite(x.l) ? clamp(Math.round(x.l), 0, 4) : null;
      list.push({ d: x.d, ms: ms, n: n, l: l });
    }
    if (!list.length) return null;
    list.sort(function (a, b) { return a.ms - b.ms; });
    /* un giorno ripetuto nella risposta conta una volta sola (l'ultimo) */
    var uniq = [];
    list.forEach(function (x) { if (uniq.length && uniq[uniq.length - 1].ms === x.ms) uniq[uniq.length - 1] = x; else uniq.push(x); });
    list = uniq;
    var counts = list.some(function (x) { return x.n !== null; });
    var max = 0; list.forEach(function (x) { if (x.n > max) max = x.n; });
    list.forEach(function (x) { if (x.l === null) x.l = x.n ? clamp(Math.ceil(4 * x.n / Math.max(1, max)), 1, 4) : 0; });
    function on(x) { return counts ? x.n > 0 : x.l > 0; }

    var out = { counts: counts, days: list, first: list[0], last: list[list.length - 1], span: list.length, updated: j.updated || null };
    out.total = !counts ? null : (typeof j.total === "number" && isFinite(j.total) && j.total >= 0 ? Math.round(j.total) : null);
    out.sum = counts ? list.reduce(function (s, x) { return s + (x.n || 0); }, 0) : null;
    out.active = list.filter(on).length;

    /* le serie: giorni di fila con almeno un contributo (un buco nel calendario della risposta spezza la serie) */
    var best = { n: 0, from: null, to: null }, run = 0, runFrom = null, prev = null;
    list.forEach(function (x) {
      if (on(x) && prev && x.ms - prev.ms === DAY && run > 0) run++;
      else if (on(x)) { run = 1; runFrom = x; }
      else run = 0;
      if (run > best.n) best = { n: run, from: runFrom, to: x };
      prev = x;
    });
    out.longest = best.n ? best : null;
    /* la serie in corso: finisce oggi, o ieri se oggi non ci sono ancora contributi (la giornata non è finita) */
    var k = list.length - 1, today = list[k], alive = null;
    if (!on(today)) k--;
    if (k >= 0 && on(list[k])) {
      var m = k; while (m > 0 && on(list[m - 1]) && list[m].ms - list[m - 1].ms === DAY) m--;
      alive = { n: k - m + 1, from: list[m], to: list[k], untilYesterday: k === list.length - 2 };
    }
    out.current = alive;
    /* il giorno più pieno (il primo, se sono più di uno) e quanti lo pareggiano */
    if (counts && max > 0) {
      var top = list.filter(function (x) { return x.n === max; });
      out.busiest = { n: max, day: top[0], ties: top.length };
    } else out.busiest = null;

    /* mese per mese, dal primo all'ultimo del calendario: somma, giorni attivi, giorni presenti, e se il mese è intero */
    var months = [], idx = {};
    list.forEach(function (x) {
      var dt = new Date(x.ms), key = dt.getUTCFullYear() * 12 + dt.getUTCMonth();
      if (idx[key] === undefined) { idx[key] = months.length; months.push({ y: dt.getUTCFullYear(), m: dt.getUTCMonth(), sum: 0, active: 0, present: 0, len: new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate(), days: [] }); }
      var mo = months[idx[key]]; mo.present++; mo.days.push(x); if (on(x)) mo.active++; if (counts) mo.sum += x.n || 0;
    });
    months.forEach(function (mo) { mo.partial = mo.present < mo.len; mo.name = MESI[mo.m]; mo.short = MESI3[mo.m]; });
    out.months = months;
    var bm = null; if (counts) months.forEach(function (mo) { if (!bm || mo.sum > bm.sum) bm = mo; });
    out.bestMonth = bm && bm.sum > 0 ? bm : null;

    /* la settimana: per ogni giorno della settimana, quanti ce ne sono nel calendario, la somma, la media, i giorni attivi */
    var wk = [0, 1, 2, 3, 4, 5, 6].map(function (w) { return { wd: w, name: GIORNI[w], short: GIORNI3[w], count: 0, sum: 0, active: 0 }; });
    list.forEach(function (x) { var w = wk[wdOf(x.ms)]; w.count++; if (counts) w.sum += x.n || 0; if (on(x)) w.active++; });
    wk.forEach(function (w) { w.avg = counts && w.count ? w.sum / w.count : null; });
    out.week = wk;
    var bw = null; wk.forEach(function (w) { var v = counts ? w.sum : w.active; if (!bw || v > (counts ? bw.sum : bw.active)) bw = w; });
    out.bestWeekday = bw;
    return out;
  }

  /* «mar 4 nov», con l'anno se serve */
  function dayLabel(x, withYear, long) {
    var dt = new Date(x.ms);
    return (long ? GIORNI[wdOf(x.ms)] : GIORNI3[wdOf(x.ms)]) + " " + dt.getUTCDate() + " " + (long ? MESI[dt.getUTCMonth()] : MESI3[dt.getUTCMonth()]) + (withYear ? " " + dt.getUTCFullYear() : "");
  }
  /* «dal 3 al 9 marzo», «dal 28 febbraio al 3 marzo», «dal 30 dicembre 2025 al 2 gennaio 2026» */
  function rangeLabel(a, b) {
    var da = new Date(a.ms), db = new Date(b.ms);
    if (a.ms === b.ms) return "il " + da.getUTCDate() + " " + MESI[da.getUTCMonth()] + " " + da.getUTCFullYear();
    var ya = da.getUTCFullYear(), yb = db.getUTCFullYear();
    if (ya !== yb) return "dal " + da.getUTCDate() + " " + MESI[da.getUTCMonth()] + " " + ya + " al " + db.getUTCDate() + " " + MESI[db.getUTCMonth()] + " " + yb;
    if (da.getUTCMonth() !== db.getUTCMonth()) return "dal " + da.getUTCDate() + " " + MESI[da.getUTCMonth()] + " al " + db.getUTCDate() + " " + MESI[db.getUTCMonth()] + " " + yb;
    return "dal " + da.getUTCDate() + " al " + db.getUTCDate() + " " + MESI[db.getUTCMonth()] + " " + yb;
  }

  /* ------------------------------------------------------------------ le città */
  /* la Luna vista dal posto e non dal centro della Terra: la parallasse la abbassa fino a quasi un grado (parallasse orizzontale media 0,9507°) */
  var HP = 0.9507 * RAD;
  function moonTopo(d, lat, lon) {
    var g = A.moon(d, lat, lon), alt = g.altitude * RAD;
    var p = Math.asin(Math.sin(HP) * Math.cos(alt));
    return { altitude: (alt - p) * DEG, azimuth: g.azimuth };
  }
  function wind(b) { return WINDS[Math.round(b / 22.5) % 16]; }
  function riseSet(d, c) {
    var t = A.sunTimes(d, c.lat, c.lon, c.tz), out = { rise: t.sunrise, set: t.sunset, light: null };
    if (t.sunrise && t.sunset && t.sunset > t.sunrise) out.light = t.sunset.getTime() - t.sunrise.getTime();
    return out;
  }
  function city(c, d) {
    var s = A.sun(d, c.lat, c.lon), m = moonTopo(d, c.lat, c.lon), mp = A.moonPhase(d), q = A.qibla(c.lat, c.lon), rs = riseSet(d, c);
    var rising = A.sun(new Date(d.getTime() + 600000), c.lat, c.lon).altitude > s.altitude;
    return {
      id: c.id, tz: A.fixTz(c.tz, d), time: A.localTime(d, c.tz), timeS: A.localTime(d, c.tz, true), off: c.id === "torino" ? 0 : A.offsetFromRome(d, c.tz),
      sun: { alt: s.altitude, az: s.azimuth, wind: wind(s.azimuth), rising: rising }, moon: { alt: m.altitude, az: m.azimuth, wind: wind(m.azimuth), fraction: mp.fraction, waxing: mp.waxing, name: mp.name },
      rise: rs.rise, set: rs.set, light: rs.light, riseT: rs.rise ? A.localTime(rs.rise, c.tz) : null, setT: rs.set ? A.localTime(rs.set, c.tz) : null,
      qibla: { bearing: q.bearing, wind: wind(q.bearing), km: q.distanceKm }
    };
  }

  var api = { heat: heat, dayLabel: dayLabel, rangeLabel: rangeLabel, city: city, moonTopo: moonTopo, wind: wind, MESI: MESI, MESI3: MESI3, GIORNI: GIORNI, GIORNI3: GIORNI3, wdOf: wdOf, parseDay: parseDay };
  root.SEZ_CALC = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
