/* imad.chat — astronomia leggera per le anteprime (browser, nessuna dipendenza).
   Formule a bassa precisione (Sole ~0,05°, Luna ~0,5°), verificate contro astronomy-engine con check-astro-lite.mjs.
   Nel sito vero i calcoli sono quelli di lib/astro (astronomy-engine). */
(function (root) {
  "use strict";
  var RAD = Math.PI / 180, DEG = 180 / Math.PI;
  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  function jd(date) { return date.getTime() / 86400000 + 2440587.5; }
  function d2000(date) { return jd(date) - 2451545.0; }

  /** Tempo siderale medio di Greenwich, in gradi. */
  function gmstDeg(date) {
    var d = d2000(date), T = d / 36525;
    return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T);
  }
  /** Tempo siderale locale, in ore (0..24). */
  function lstHours(date, lon) { return norm360(gmstDeg(date) + lon) / 15; }

  /** Coordinate equatoriali del Sole: { ra (ore), dec (gradi), lambda (longitudine eclittica, gradi) }. */
  function sunEquatorial(date) {
    var d = d2000(date);
    var g = norm360(357.529 + 0.98560028 * d) * RAD;
    var q = norm360(280.459 + 0.98564736 * d);
    var L = norm360(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
    var e = (23.439 - 0.00000036 * d) * RAD;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L * RAD), Math.cos(L * RAD)) * DEG;
    var dec = Math.asin(Math.sin(e) * Math.sin(L * RAD)) * DEG;
    return { ra: norm360(ra) / 15, dec: dec, lambda: L };
  }

  /** Coordinate equatoriali geocentriche della Luna: { ra (ore), dec (gradi), lambda, beta }. */
  function moonEquatorial(date) {
    var d = d2000(date);
    var L = norm360(218.316 + 13.176396 * d), M = norm360(134.963 + 13.064993 * d) * RAD, F = norm360(93.272 + 13.229350 * d) * RAD;
    var D = norm360(297.850 + 12.190749 * d) * RAD, Ms = norm360(357.529 + 0.98560028 * d) * RAD;
    var lam = L + 6.289 * Math.sin(M) + 1.274 * Math.sin(2 * D - M) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * M)
      - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F);
    var bet = 5.128 * Math.sin(F) + 0.281 * Math.sin(M + F) + 0.278 * Math.sin(M - F);
    var e = (23.439 - 0.00000036 * d) * RAD, l = lam * RAD, b = bet * RAD;
    var ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)) * DEG;
    var dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)) * DEG;
    return { ra: norm360(ra) / 15, dec: dec, lambda: norm360(lam), beta: bet };
  }

  /** Da equatoriali a orizzontali: { altitude, azimuth } in gradi (azimut da nord verso est). */
  function altAz(raHours, decDeg, date, lat, lon) {
    var H = (lstHours(date, lon) - raHours) * 15 * RAD, la = lat * RAD, de = decDeg * RAD;
    var sinAlt = Math.sin(la) * Math.sin(de) + Math.cos(la) * Math.cos(de) * Math.cos(H);
    var alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    var az = Math.atan2(-Math.cos(de) * Math.sin(H), Math.sin(de) * Math.cos(la) - Math.cos(de) * Math.cos(H) * Math.sin(la));
    return { altitude: alt * DEG, azimuth: norm360(az * DEG) };
  }

  /** Altezza e azimut del Sole per un luogo. */
  function sun(date, lat, lon) { var s = sunEquatorial(date); return altAz(s.ra, s.dec, date, lat, lon); }
  /** Altezza e azimut della Luna per un luogo (geocentrica: errore fino a ~1° vicino all'orizzonte). */
  function moon(date, lat, lon) { var m = moonEquatorial(date); return altAz(m.ra, m.dec, date, lat, lon); }

  var PHASES = ["luna nuova", "luna crescente", "primo quarto", "gibbosa crescente", "luna piena", "gibbosa calante", "ultimo quarto", "luna calante"];
  /** Fase della Luna: { fraction (parte illuminata 0..1), age (0..1 lungo il mese), waxing, name }. Uguale in ogni città. */
  function moonPhase(date) {
    var s = sunEquatorial(date), m = moonEquatorial(date);
    var elong = norm360(m.lambda - s.lambda);
    var fraction = (1 - Math.cos(elong * RAD)) / 2;
    var idx = Math.floor(((elong + 22.5) % 360) / 45);
    return { fraction: fraction, age: elong / 360, waxing: elong < 180, name: PHASES[idx] };
  }

  /** Momento della giornata dal Sole: "notte" | "crepuscolo" | "alba/tramonto" | "giorno". */
  function dayPart(altitude) {
    if (altitude > 6) return "giorno";
    if (altitude > -0.833) return "alba/tramonto";
    if (altitude > -12) return "crepuscolo";
    return "notte";
  }

  /** Alba e tramonto del giorno locale che contiene `date`: { sunrise: Date|null, sunset: Date|null }. */
  function sunTimes(date, lat, lon, tz) {
    tz = fixTz(tz, date);
    // mezzanotte locale: si parte da `date` e si torna indietro delle ore locali trascorse
    var parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
    var get = function (t) { return +parts.find(function (p) { return p.type === t; }).value; };
    var start = date.getTime() - ((get("hour") * 60 + get("minute")) * 60 + get("second")) * 1000;
    var H0 = -0.833, step = 5 * 60000, prev = sun(new Date(start), lat, lon).altitude, out = { sunrise: null, sunset: null };
    for (var t = start + step; t <= start + 86400000; t += step) {
      var cur = sun(new Date(t), lat, lon).altitude;
      if ((prev - H0) * (cur - H0) <= 0 && prev !== cur) {
        var a = t - step, b = t;
        for (var i = 0; i < 20; i++) { var mid = (a + b) / 2; if ((sun(new Date(mid), lat, lon).altitude - H0) * (prev - H0) > 0) a = mid; else b = mid; }
        if (cur > prev && !out.sunrise) out.sunrise = new Date((a + b) / 2);
        if (cur < prev && !out.sunset) out.sunset = new Date((a + b) / 2);
      }
      prev = cur;
    }
    return out;
  }

  /** Direzione della qibla (gradi da nord verso est) e distanza dalla Kaʿba in km, lungo il cerchio massimo. */
  function qibla(lat, lon) {
    var kLat = 21.4225 * RAD, kLon = 39.8262 * RAD, la = lat * RAD, lo = lon * RAD, dL = kLon - lo;
    var y = Math.sin(dL) * Math.cos(kLat), x = Math.cos(la) * Math.sin(kLat) - Math.sin(la) * Math.cos(kLat) * Math.cos(dL);
    var h = Math.pow(Math.sin((kLat - la) / 2), 2) + Math.cos(la) * Math.cos(kLat) * Math.pow(Math.sin(dL / 2), 2);
    return { bearing: norm360(Math.atan2(y, x) * DEG), distanceKm: 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h))) };
  }

  /** Il Marocco è a UTC+0 tutto l'anno dal 20 settembre 2026 (tzdata 2026c): i telefoni con dati vecchi direbbero UTC+1. */
  function fixTz(tz, date) {
    return tz === "Africa/Casablanca" && date.getTime() >= Date.UTC(2026, 8, 20, 1) ? "UTC" : tz;
  }

  /** Ora locale "21:07" di un fuso IANA. Usa sempre questa funzione per le ore delle città. */
  function localTime(date, tz, withSeconds) {
    tz = fixTz(tz, date);
    return new Intl.DateTimeFormat("it-IT", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: withSeconds ? "2-digit" : undefined, hourCycle: "h23" }).format(date);
  }
  /** Differenza in ore tra un fuso e Torino (Europe/Rome) in quell'istante, es. +2. */
  function offsetFromRome(date, tz) {
    tz = fixTz(tz, date);
    var f = function (z) {
      var p = new Intl.DateTimeFormat("en-GB", { timeZone: z, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
      var g = function (t) { return +p.find(function (x) { return x.type === t; }).value; };
      return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
    };
    return (f(tz) - f("Europe/Rome")) / 3600000;
  }

  /** Data locale, es. "mercoledì 11 novembre". */
  function localDate(date, tz) {
    return new Intl.DateTimeFormat("it-IT", { timeZone: fixTz(tz, date), weekday: "long", day: "numeric", month: "long" }).format(date);
  }

  var api = { localDate: localDate, fixTz: fixTz, lstHours: lstHours, sunEquatorial: sunEquatorial, moonEquatorial: moonEquatorial, altAz: altAz, sun: sun, moon: moon,
    moonPhase: moonPhase, dayPart: dayPart, sunTimes: sunTimes, qibla: qibla, localTime: localTime, offsetFromRome: offsetFromRome };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ImadAstro = api;
})(typeof window !== "undefined" ? window : globalThis);
