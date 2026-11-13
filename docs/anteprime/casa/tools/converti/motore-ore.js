/* Convertitore — i fusi orari. Le cinque città del sito prima (Torino, Casablanca, Makkah e Medina, Gaza), poi qualsiasi fuso IANA.
   L'ora legale la sa Intl (i dati dei fusi del telefono). Una cosa sola si corregge a mano: il Marocco è a UTC+0 tutto l'anno dal
   20 settembre 2026, 01:00 UTC (tzdata 2026c); un telefono con dati più vecchi direbbe UTC+1. Si riconosce e si dice (datiVecchi).
   Un'ora che quel giorno non esiste (le 2:30 quando gli orologi saltano avanti) si dice; una che esiste due volte si chiede.
   Plain script, ES2017. */
(function (G) {
  "use strict";
  var CV = G.CV = G.CV || {};
  var MAROCCO_DA = Date.UTC(2026, 8, 20, 1, 0, 0), MAROCCO = { "Africa/Casablanca": 1, "Africa/El_Aaiun": 1 };
  var CITTA = [
    { id: "torino", nome: "Torino", tz: "Europe/Rome", nomi: ["torino", "turin", "italia", "roma", "milano", "europe/rome"] },
    { id: "casablanca", nome: "Casablanca", tz: "Africa/Casablanca", nomi: ["casablanca", "marocco", "rabat", "marrakech", "fes", "fès", "africa/casablanca"] },
    { id: "makkah", nome: "Makkah", tz: "Asia/Riyadh", nomi: ["makkah", "mecca", "la mecca", "medina", "madinah", "arabia saudita", "riyadh", "riad", "asia/riyadh"] },
    { id: "gaza", nome: "Gaza", tz: "Asia/Gaza", nomi: ["gaza", "palestina", "asia/gaza"] }
  ];
  var RIGHE = [{ nome: "Torino", tz: "Europe/Rome" }, { nome: "Casablanca", tz: "Africa/Casablanca" }, { nome: "Makkah e Medina", tz: "Asia/Riyadh" }, { nome: "Gaza", tz: "Asia/Gaza" }];
  var ESONIMI = { londra: "Europe/London", parigi: "Europe/Paris", berlino: "Europe/Berlin", madrid: "Europe/Madrid", lisbona: "Europe/Lisbon", bruxelles: "Europe/Brussels",
    amsterdam: "Europe/Amsterdam", vienna: "Europe/Vienna", zurigo: "Europe/Zurich", ginevra: "Europe/Zurich", atene: "Europe/Athens", mosca: "Europe/Moscow", varsavia: "Europe/Warsaw",
    istanbul: "Europe/Istanbul", "il cairo": "Africa/Cairo", cairo: "Africa/Cairo", tunisi: "Africa/Tunis", algeri: "Africa/Algiers", dakar: "Africa/Dakar", lagos: "Africa/Lagos",
    nairobi: "Africa/Nairobi", gerusalemme: "Asia/Jerusalem", amman: "Asia/Amman", beirut: "Asia/Beirut", damasco: "Asia/Damascus", baghdad: "Asia/Baghdad", doha: "Asia/Qatar",
    dubai: "Asia/Dubai", "abu dhabi": "Asia/Dubai", teheran: "Asia/Tehran", karachi: "Asia/Karachi", "nuova delhi": "Asia/Kolkata", delhi: "Asia/Kolkata", mumbai: "Asia/Kolkata",
    giacarta: "Asia/Jakarta", "kuala lumpur": "Asia/Kuala_Lumpur", singapore: "Asia/Singapore", pechino: "Asia/Shanghai", "hong kong": "Asia/Hong_Kong", seul: "Asia/Seoul",
    tokyo: "Asia/Tokyo", sydney: "Australia/Sydney", "new york": "America/New_York", washington: "America/New_York", toronto: "America/Toronto", chicago: "America/Chicago",
    "los angeles": "America/Los_Angeles", "san francisco": "America/Los_Angeles", "città del messico": "America/Mexico_City", "san paolo": "America/Sao_Paulo",
    "buenos aires": "America/Argentina/Buenos_Aires", utc: "UTC", gmt: "UTC", "ora di greenwich": "UTC" };

  /* ------------------------------------------------------------------ i dati del telefono, con la correzione del Marocco */
  var finti = false;                                        /* per le prove: si fa finta di avere dati di prima del 2026 */
  function zona(tz, t) { return MAROCCO[tz] && t >= MAROCCO_DA ? "UTC" : tz; }
  var cacheF = {};
  function fmt(tz) {
    var k = tz; if (cacheF[k]) return cacheF[k];
    return (cacheF[k] = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", weekday: "short" }));
  }
  function partiGrezze(tz, t) {
    var o = {}; fmt(tz).formatToParts(new Date(t)).forEach(function (p) { o[p.type] = p.value; });
    var h = parseInt(o.hour, 10); if (h === 24) h = 0;
    return { y: parseInt(o.year, 10), mo: parseInt(o.month, 10), d: parseInt(o.day, 10), h: h, mi: parseInt(o.minute, 10), s: parseInt(o.second, 10), wd: o.weekday };
  }
  function offsetGrezzo(tz, t) {
    var p = partiGrezze(tz, t); var off = Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000) / 60000);
    if (finti && MAROCCO[tz] && t >= MAROCCO_DA) off = 60;   /* come direbbe un telefono vecchio */
    return off;
  }
  function offset(tz, t) { return offsetGrezzo(zona(tz, t), t); }
  function parti(tz, t) { var off = offset(tz, t), d = new Date(t + off * 60000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay(), off: off }; }
  /* un telefono con dati vecchi crede Casablanca a UTC+1 dopo il 20 settembre 2026 */
  function datiVecchi() { try { return offsetGrezzo("Africa/Casablanca", Date.UTC(2026, 9, 15, 12)) !== 0; } catch (e) { return false; } }
  function valida(tz) { try { fmt(tz).format(0); return true; } catch (e) { return false; } }

  /* ------------------------------------------------------------------ i nomi dei fusi */
  var indice = null, tutte = [];
  function costruisci() {
    indice = {};
    try { tutte = Intl.supportedValuesOf("timeZone").slice(); } catch (e) { tutte = []; }
    if (tutte.indexOf("UTC") < 0) tutte.push("UTC");
    tutte.forEach(function (z) {
      indice[z.toLowerCase()] = z;
      var ultima = z.split("/").pop().replace(/_/g, " ").toLowerCase(); if (!indice[ultima]) indice[ultima] = z;
    });
    Object.keys(ESONIMI).forEach(function (k) { indice[k] = ESONIMI[k]; });
    CITTA.forEach(function (c) { c.nomi.forEach(function (n) { indice[n] = c.tz; }); });
  }
  function nomeCitta(tz, testo) {
    for (var i = 0; i < CITTA.length; i++) if (CITTA[i].tz === tz && (!testo || CITTA[i].nomi.indexOf(testo) >= 0)) return /medin|madin/.test(testo || "") ? "Medina" : CITTA[i].nome;
    if (tz === "UTC") return "UTC";
    for (var k in ESONIMI) if (ESONIMI[k] === tz && k === testo) return k.split(" ").map(function (w, i) { return i && /^(?:del|di|da|la)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
    return tz.split("/").pop().replace(/_/g, " ");
  }
  /* «utc+3», «gmt-5», un nome → { tz, nome } | null */
  function trovaZona(s) {
    if (!indice) costruisci();
    var t = String(s || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/^(?:a|di|da|per|in) /, "");
    if (!t) return null;
    var m = t.match(/^(?:utc|gmt) ?([+-−])\s?(\d{1,2})(?::?(\d{2}))?$/);
    if (m) {
      var ore = parseInt(m[2], 10), min = m[3] ? parseInt(m[3], 10) : 0; if (ore > 14 || min > 59) return null;
      var sg = m[1] === "+" ? 1 : -1;
      if (!min) { var etc = "Etc/GMT" + (sg > 0 ? "-" : "+") + ore; if (ore === 0) etc = "UTC"; if (valida(etc)) return { tz: etc, nome: "UTC" + (ore ? (sg > 0 ? "+" : "−") + ore : "") }; }
      return { fisso: sg * (ore * 60 + min), tz: null, nome: "UTC" + (sg > 0 ? "+" : "−") + ore + ":" + ("0" + min).slice(-2) };
    }
    var z = indice[t];
    if (z) return { tz: z, nome: nomeCitta(z, t) };
    return null;
  }
  function cerca(s, quante) {
    if (!indice) costruisci();
    var t = String(s || "").trim().toLowerCase(); if (!t) return [];
    var visti = {}, out = [];
    Object.keys(indice).forEach(function (k) {
      if (out.length >= (quante || 8) * 3) return;
      var z = indice[k], pos = k.indexOf(t); if (pos < 0 || visti[z + k]) return;
      visti[z + k] = 1; out.push({ tz: z, nome: k.indexOf("/") >= 0 ? z.replace(/_/g, " ") : nomeCitta(z, k), pos: pos, k: k });
    });
    out.sort(function (a, b) { return a.pos - b.pos || (ESONIMI[a.k] ? 0 : 1) - (ESONIMI[b.k] ? 0 : 1) || a.k.length - b.k.length; });
    var unici = {}; return out.filter(function (o) { if (unici[o.tz]) return false; unici[o.tz] = 1; return true; }).slice(0, quante || 8);
  }

  /* ------------------------------------------------------------------ dall'ora sul muro di un fuso all'istante */
  function istante(tz, y, mo, d, h, mi, fisso) {
    var muro = Date.UTC(y, mo - 1, d, h, mi);
    if (tz === null) return { t: muro - fisso * 60000, tipo: "ok" };
    var o1 = offset(tz, muro - 86400000 / 2), o2 = offset(tz, muro + 86400000 / 2), cand = [];
    [o1, o2].forEach(function (o) {
      var t = muro - o * 60000, p = parti(tz, t);
      if (p.y === y && p.mo === mo && p.d === d && p.h === h && p.mi === mi && cand.indexOf(t) < 0) cand.push(t);
    });
    cand.sort(function (a, b) { return a - b; });
    if (cand.length === 2) return { t: cand[0], tipo: "doppia", tutti: cand };
    if (cand.length === 1) return { t: cand[0], tipo: "ok" };
    var t2 = muro - Math.min(o1, o2) * 60000;               /* nel salto: l'ora non c'è, si va avanti */
    return { t: t2, tipo: "manca", salto: Math.abs(o2 - o1) };
  }

  /* ------------------------------------------------------------------ leggere: «15:30», «15:30 Torino», «9 Makkah in Gaza», «adesso» */
  function leggi(testo, inOre, scelte, adesso) {
    scelte = scelte || {}; adesso = adesso || Date.now();
    var s = String(testo || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!s) return { stato: "vuoto" };
    var orig = s;
    s = s.replace(/\s*(?:->|→|=>)\s*/g, " in ");
    /* la destinazione */
    var a = null, mA = null, re = /\s(?:in|a|per|to)\s/g, mm, lastOk = null;
    while ((mm = re.exec(s))) { var coda = s.slice(mm.index + mm[0].length); var z = trovaZona(coda); if (z) lastOk = { i: mm.index, z: z }; }
    if (lastOk) { a = lastOk.z; mA = lastOk; s = s.slice(0, lastOk.i); }
    var ore = null, data = null, adessoParola = false, m;
    if ((m = s.match(/(?:^|\s)(adesso|ora|now|subito)(?=\s|$)/))) { adessoParola = true; s = s.replace(m[0], " "); }
    if ((m = s.match(/(?:^|\s)(oggi|domani|dopodomani|ieri)(?=\s|$)/))) { data = { rel: { oggi: 0, domani: 1, dopodomani: 2, ieri: -1 }[m[1]] }; s = s.replace(m[0], " "); }
    if ((m = s.match(/(?:^|\s)(\d{4})-(\d{1,2})-(\d{1,2})(?=\s|$)/))) { data = { y: +m[1], mo: +m[2], d: +m[3] }; s = s.replace(m[0], " "); }
    else if ((m = s.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s|$)/))) { data = { d: +m[1], mo: +m[2], y: m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null }; s = s.replace(m[0], " "); }
    if ((m = s.match(/(?:^|\s)(?:alle |ore |h)?(\d{1,2})(?:[:.h](\d{2}))?\s?(am|pm|a\.m\.|p\.m\.)?(?=\s|$)/))) {
      var hh = +m[1], mi = m[2] ? +m[2] : 0, ap = m[3] ? m[3].charAt(0) : null;
      var sicuro = !!(m[2] || ap);
      if (ap) { if (hh < 1 || hh > 12) return { stato: "errore", messaggio: "Con am e pm le ore vanno da 1 a 12." }; hh = hh % 12 + (ap === "p" ? 12 : 0); }
      if (hh > 23 || mi > 59) return inOre || sicuro ? { stato: "errore", messaggio: "«" + m[0].trim() + "» non è un'ora: si va da 0:00 a 23:59." } : { stato: "no" };
      ore = { h: hh, mi: mi, sicuro: sicuro }; s = s.replace(m[0], " ");
    }
    if ((m = s.match(/(?:^|\s)(mezzogiorno|mezzanotte)(?=\s|$)/))) { ore = { h: m[1] === "mezzogiorno" ? 12 : 0, mi: 0, sicuro: true }; s = s.replace(m[0], " "); }
    var resto = s.replace(/(?:^|\s)(?:a|di|da|alle|ore|è|e|che|ora|sono)(?=\s|$)/g, " ").trim();
    var da = resto ? trovaZona(resto) : null;
    if (resto && !da) {
      if (inOre || ore && ore.sicuro || a) return { stato: "errore", messaggio: "Non conosco il fuso «" + resto + "»: prova una città (Torino, Gaza, Londra, New York) o UTC+2." };
      return { stato: "no" };
    }
    /* senza un'ora sicura, una città o «adesso», non è un orario (12 km resta alle unità) */
    if (!inOre && !(ore && ore.sicuro) && !da && !adessoParola && !(a && (ore || data))) return { stato: "no" };
    var qui = (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } })();
    if (!da) da = { tz: qui, nome: nomeCitta(qui), qui: true };
    if (!ore && !data) return { stato: "ok", t: adesso, adesso: true, da: da, a: a, note: [] };
    var oggi = da.tz === null ? (function () { var d = new Date(adesso + da.fisso * 60000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() }; })() : parti(da.tz, adesso);
    var Y = oggi.y, MO = oggi.mo, D = oggi.d;
    if (data && data.rel !== undefined) { var g = new Date(Date.UTC(Y, MO - 1, D + data.rel)); Y = g.getUTCFullYear(); MO = g.getUTCMonth() + 1; D = g.getUTCDate(); }
    else if (data) {
      Y = data.y || Y; MO = data.mo; D = data.d;
      var prova = new Date(Date.UTC(Y, MO - 1, D));
      if (MO < 1 || MO > 12 || prova.getUTCDate() !== D) return { stato: "errore", messaggio: "Il " + D + "/" + MO + " non c'è nel calendario." };
    }
    var H = ore ? ore.h : (data ? 12 : oggi.h), MI = ore ? ore.mi : (data ? 0 : oggi.mi);
    var ist = istante(da.tz, Y, MO, D, H, MI, da.fisso), note = [];
    var chiave = "o:" + da.tz + ":" + Y + "-" + MO + "-" + D + "-" + H + ":" + MI;
    if (ist.tipo === "doppia") {
      if (scelte[chiave] === undefined) return { stato: "dubbio", dubbio: { chiave: chiave, domanda: "Quel giorno le " + H + ":" + ("0" + MI).slice(-2) + " a " + da.nome + " vengono due volte: gli orologi tornano indietro di un'ora.", opzioni: [
        { testo: "La prima (" + utc(offset(da.tz, ist.tutti[0])) + ")", t: ist.tutti[0] }, { testo: "La seconda (" + utc(offset(da.tz, ist.tutti[1])) + ")", t: ist.tutti[1] }] } };
      ist.t = ist.tutti[scelte[chiave]] || ist.tutti[0];
    }
    if (ist.tipo === "manca") { var p2 = parti(da.tz, ist.t); note.push({ tipo: "salto", testo: "Quel giorno le " + H + ":" + ("0" + MI).slice(-2) + " a " + da.nome + " non esistono: gli orologi saltano avanti di un'ora. Diventano le " + p2.h + ":" + ("0" + p2.mi).slice(-2) + "." }); }
    return { stato: "ok", t: ist.t, adesso: false, da: da, a: a, note: note, data: !!data };
  }
  function utc(off) { if (!off) return "UTC"; var a = Math.abs(off), h = Math.floor(a / 60), m = a % 60; return "UTC" + (off > 0 ? "+" : "−") + h + (m ? ":" + ("0" + m).slice(-2) : ""); }
  var GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"], MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  /* come si presenta un fuso a un istante; rif: le parti del fuso di partenza (per dire «domani») */
  function info(tz, t, fisso) {
    var p = tz === null ? (function () { var d = new Date(t + fisso * 60000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay(), off: fisso }; })() : parti(tz, t);
    var legale = false;
    if (tz !== null && tz !== "UTC" && !/^Etc\//.test(tz)) {
      var gen = offset(tz, Date.UTC(p.y, 0, 15)), lug = offset(tz, Date.UTC(p.y, 6, 15));
      legale = gen !== lug && p.off === Math.max(gen, lug);
    }
    return { ora: p.h + ":" + ("0" + p.mi).slice(-2), hh: ("0" + p.h).slice(-2), mm: ("0" + p.mi).slice(-2), giorno: GIORNI[p.wd] + " " + p.d + " " + MESI[p.mo - 1], y: p.y, mo: p.mo, d: p.d, off: p.off, utc: utc(p.off), legale: legale };
  }
  CV.ore = { RIGHE: RIGHE, CITTA: CITTA, leggi: leggi, info: info, offset: offset, istante: istante, trovaZona: trovaZona, cerca: cerca, utc: utc,
    datiVecchi: datiVecchi, MAROCCO: MAROCCO, MAROCCO_DA: MAROCCO_DA, finti: function (v) { finti = !!v; } };
})(typeof window !== "undefined" ? window : globalThis);
