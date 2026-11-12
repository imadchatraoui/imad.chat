/* imad.chat — Progetti: il cubo in cima, poi l'elenco dei repository pubblici di Imad, da /api/github/progetti (PAGINA.api).
   Ogni scheda: il nome, la descrizione di GitHub (se non c'è, niente: mai una nostra), il linguaggio, l'ultimo aggiornamento,
   il link al repository e al sito quando GitHub ha «homepage». Prima i suoi, in fondo i fork sotto «Fork».
   Senza risposta: «L'elenco si aggiorna tra poco.» e il suo profilo. Mai un elenco d'esempio.
   Plain script, ES2017 al massimo. Viene dopo comune/pagina.js e cubo.js. */
(function () {
  "use strict";
  var P = window.PAGINA, doc = document;
  if (window.ImadCubo) window.ImadCubo(doc.getElementById("pjCubo"));
  if (!P) return;

  /* il suggerimento «trascina di lato» se ne va al primo giro di dito */
  var cv = doc.getElementById("pjCubo"), dito = doc.querySelector(".pj-cubo__dito");
  if (cv && dito) cv.addEventListener("pointerdown", function () { dito.classList.add("is-via"); }, { once: true });

  var elenco = doc.getElementById("pjElenco"), suoi = doc.getElementById("pjSuoi"), fork = doc.getElementById("pjFork"), forkL = doc.getElementById("pjForkL");
  var stato = doc.getElementById("pjStato"), agg = doc.getElementById("pjAgg");
  var esc = P.esc, PROFILO = "https://github.com/imadchatraoui";
  var MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  var FRECCIA = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 16l8-8"/><path d="M9.5 8H16v6.5"/></svg>';

  /* «aggiornato oggi / ieri / 3 giorni fa / 4 nov 2026», nel giorno di chi guarda */
  function quando(iso) {
    var d = new Date(iso); if (!iso || isNaN(d.getTime())) return null;
    var now = P.now(), a = new Date(d.getFullYear(), d.getMonth(), d.getDate()), b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var giorni = Math.round((b - a) / 86400000), testo;
    if (giorni <= 0) testo = "aggiornato oggi";
    else if (giorni === 1) testo = "aggiornato ieri";
    else if (giorni < 7) testo = "aggiornato " + giorni + " giorni fa";
    else testo = "aggiornato il " + d.getDate() + " " + MESI[d.getMonth()] + " " + d.getFullYear();
    return { testo: testo, iso: d.toISOString() };
  }
  /* il sito: solo http(s); senza schema si aggiunge https:// (su GitHub capita «gmitorino.org») */
  function sito(h) {
    if (!h || typeof h !== "string") return null;
    h = h.trim(); if (!h) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(h)) h = "https://" + h;
    if (!/^https?:\/\//i.test(h)) return null;
    var nome = h.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
    if (!nome || /\s/.test(nome)) return null;
    return { url: h, nome: nome };
  }
  function soloGithub(u) { return typeof u === "string" && /^https:\/\/github\.com\//.test(u) ? u : null; }

  function scheda(r) {
    var url = soloGithub(r.url) || PROFILO + "/" + encodeURIComponent(r.name), q = quando(r.pushedAt), s = sito(r.homepage);
    var h = '<li class="pg-card pj-r">';
    h += '<h3 class="pj-r__n"><a class="pj-r__a" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(r.name) + '<span class="sr">, su GitHub, in una nuova scheda</span></a></h3>';
    h += '<span class="pj-r__go">' + FRECCIA + "</span>";
    if (r.description && String(r.description).trim()) h += '<p class="pj-r__d">' + esc(String(r.description).trim()) + "</p>";
    var meta = [];
    if (r.language) meta.push('<span class="pj-r__l">' + esc(r.language) + "</span>");
    if (q) meta.push('<time datetime="' + esc(q.iso) + '">' + esc(q.testo) + "</time>");
    if (meta.length) h += '<p class="pj-r__m">' + meta.join('<span class="pj-r__sep" aria-hidden="true"></span>') + "</p>";
    if (s) h += '<a class="pj-r__sito" href="' + esc(s.url) + '" target="_blank" rel="noopener"><span class="sr">Il sito: </span>' + esc(s.nome) + FRECCIA + '<span class="sr">, in una nuova scheda</span></a>';
    return h + "</li>";
  }
  function tempo(r) { var t = new Date(r.pushedAt).getTime(); return isNaN(t) ? 0 : t; }
  function ordina(list) { return list.map(function (r, i) { return { r: r, i: i }; }).sort(function (a, b) { return tempo(b.r) - tempo(a.r) || a.i - b.i; }).map(function (x) { return x.r; }); }

  /* le schede entrano una dopo l'altra (poco: 40 ms l'una, al più mezzo secondo in tutto) */
  function entra(ul) {
    var li = ul.children;
    if (P.still()) return;
    for (var i = 0; i < li.length; i++) { li[i].classList.add("is-prima"); li[i].style.transitionDelay = Math.min(i, 12) * 40 + "ms"; }
    void ul.offsetWidth;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      for (var j = 0; j < li.length; j++) li[j].classList.remove("is-prima");
      setTimeout(function () { for (var k = 0; k < li.length; k++) li[k].style.transitionDelay = ""; }, 1100);
    }); });
  }
  function vuoto() {
    suoi.innerHTML = '<li class="pj-vuoto"><p>L\'elenco si aggiorna tra poco.</p><a class="pg-pill" href="' + PROFILO + '" target="_blank" rel="noopener">Il suo profilo GitHub' + FRECCIA + '<span class="sr">, in una nuova scheda</span></a></li>';
    stato.innerHTML = '<span class="sr">L\'elenco non è arrivato: si aggiorna tra poco.</span>';
  }

  P.api("progetti").then(function (j) {
    elenco.setAttribute("aria-busy", "false");
    var repos = j && j.ok && Array.isArray(j.repos) ? j.repos.filter(function (r) { return r && typeof r.name === "string" && r.name; }) : [];
    if (!repos.length) { vuoto(); return; }
    var own = ordina(repos.filter(function (r) { return !r.fork; })), frk = ordina(repos.filter(function (r) { return !!r.fork; }));
    suoi.innerHTML = own.length ? own.map(scheda).join("") : "";
    if (!own.length) suoi.setAttribute("hidden", "");
    if (frk.length) { forkL.innerHTML = frk.map(scheda).join(""); fork.hidden = false; }
    var u = new Date(j.updated);
    if (!isNaN(u.getTime())) { agg.textContent = "Da GitHub, letto alle " + ("0" + u.getHours()).slice(-2) + ":" + ("0" + u.getMinutes()).slice(-2) + " del " + u.getDate() + " " + MESI[u.getMonth()] + "."; agg.hidden = false; }
    stato.innerHTML = '<span class="sr">Elenco caricato.</span>';
    entra(suoi); if (frk.length) entra(forkL);
  });
})();
