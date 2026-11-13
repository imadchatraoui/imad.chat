/* Convertitore — la pagina: un campo solo, i risultati mentre scrivi, un tocco per copiare.
   Si capisce da sé cosa si sta scrivendo (#3b82f6 è un colore, 0xff una base, 15:30 Torino un'ora, 12 km un'unità): la pillola
   scivola sulla categoria giusta. Toccando una categoria il campo ritrova quello che ci avevi scritto. Un dubbio vero (1.500,
   «oz», «gradi», un'ora che viene due volte) si chiede con due o tre pastiglie, mai si indovina.
   Si ricordano (localStorage, se c'è): la categoria, «più cifre», le risposte ai dubbi, i fusi aggiunti, formato e qualità delle
   immagini. Mai quello che scrivi. ?q=… apre la pagina con un valore (è il link che si condivide); ?c=… con una categoria.
   window.__cv (per le prove): { set(testo), cat(nome), stato() }. Plain script, ES2017. */
(function () {
  "use strict";
  var CV = window.CV, doc = document, P = CV.P, el = CV.el;
  var $ = function (id) { return doc.getElementById(id); };
  var Qs = new URLSearchParams(location.search);
  var ORDINE = ["unita", "colori", "basi", "ore", "immagini"];
  var CHIAVE = "imad.converti";

  /* ---------------------------------------------------------------- quello che si ricorda */
  var S = { cat: "unita", piu: false, scelte: {}, zone: [], img: {} };
  try { var sal = JSON.parse(localStorage.getItem(CHIAVE) || "null"); if (sal && typeof sal === "object") { if (ORDINE.indexOf(sal.cat) >= 0) S.cat = sal.cat; S.piu = !!sal.piu; S.scelte = sal.scelte || {}; S.zone = Array.isArray(sal.zone) ? sal.zone.slice(0, 12) : []; S.img = sal.img || {}; } } catch (e) { /* senza memoria */ }
  function salva() { try { localStorage.setItem(CHIAVE, JSON.stringify({ cat: S.cat, piu: S.piu, scelte: S.scelte, zone: S.zone, img: S.img })); } catch (e) { /* va bene lo stesso */ } }
  var memoria = {};                    /* il testo di ogni categoria, solo in questa visita */
  var lettura = 10;                    /* Basi: come leggere un numero senza prefisso */

  var inp = $("in"), bX = $("bX"), letto = $("letto"), lettoT = $("lettoT"), dubbio = $("dubbio"), dubbioD = $("dubbioD"), dubbioO = $("dubbioO");
  var main = $("main"), mainS = $("mainS"), mainV = $("mainV"), mainU = $("mainU"), come = $("come"), comeF = $("comeF"), comeN = $("comeN");
  var pannelli = $("pannelli"), cat = $("cat"), pill = $("catPill"), barra = $("barra"), bCopia = $("bCopia"), bCopiaT = $("bCopiaT"), bCifre = $("bCifre"), bCondividi = $("bCondividi"), bCondividiT = $("bCondividiT");
  var campo = $("campo"), file = $("file"), annuncio = $("annuncio"), scheda = $("scheda");
  var notaS = el("p", "cv-notas"); notaS.hidden = true; letto.parentNode.insertBefore(notaS, dubbio);

  /* le righe in vista rotolano; le altre si scrivono e basta */
  var inVista = typeof WeakSet !== "undefined" ? new WeakSet() : null;
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) inVista.add(e.target); else inVista.delete(e.target); }); }, { rootMargin: "40px 0px" }) : null;

  var ctx = {
    piu: S.piu, scelte: S.scelte, zone: S.zone, anima: false, dentro: false, testo: "", lettura: 10, img: S.img,
    cat: function () { return S.cat; },
    adesso: function () { return window.PAGINA ? PAGINA.now().getTime() : Date.now(); },
    osserva: function (b) { if (io) io.observe(b); },
    visibile: function (b) { return !io || inVista.has(b); },
    scrivi: function (t) { inp.value = t; aggiorna("esempio"); if (!matchMedia("(pointer: coarse)").matches) inp.focus(); },
    copia: function (b, testo, detto) { CV.copia(testo).then(function (ok) { CV.bolla(b, ok ? "Copiato" : "Non riesco a copiare"); annuncia(ok ? "Copiato: " + detto : "Il telefono non mi lascia copiare."); }); },
    leggiCome: function (b) { lettura = b; aggiorna("scelta"); },
    aggiungiZona: function (tz, nome) { if (!S.zone.some(function (z) { return z.tz === tz; }) && !CV.ore.RIGHE.some(function (z) { return z.tz === tz; })) { S.zone.push({ tz: tz, nome: nome }); salva(); } aggiorna("scelta"); },
    togliZona: function (tz) { S.zone = ctx.zone = S.zone.filter(function (z) { return z.tz !== tz; }); salva(); aggiorna("scelta"); },
    salva: salva, annuncia: function (t) { annuncia(t); }, aggiorna: function (o) { aggiorna(o || "scelta"); }
  };

  /* ---------------------------------------------------------------- i pannelli, uno per categoria, fatti la prima volta che servono */
  var box = {};
  function pannello(c) {
    if (!box[c]) { box[c] = el("div", "cv-pan"); box[c].setAttribute("data-p", c); box[c].hidden = true; pannelli.appendChild(box[c]); P[c].costruisci(box[c], ctx); }
    return box[c];
  }

  /* ---------------------------------------------------------------- capire cosa si sta scrivendo */
  function interpreta(t) {
    var ris = {};
    function prova(c) {
      if (c === "immagini") return { stato: "no" };
      if (ris[c]) return ris[c];
      ctx.dentro = c === S.cat; ctx.lettura = lettura;
      try { ris[c] = P[c].leggi(t, ctx); } catch (e) { ris[c] = { stato: "errore", messaggio: "Qui mi sono perso: riprova con un'altra scrittura." }; }
      return ris[c];
    }
    if (!t.trim()) return { cat: S.cat, r: { stato: "vuoto" } };
    var qui = prova(S.cat);
    if (qui.stato === "ok" || qui.stato === "dubbio") return { cat: S.cat, r: qui };
    var altro = ["colori", "basi", "ore", "unita"].filter(function (c) { return c !== S.cat; });
    for (var i = 0; i < altro.length; i++) { var r = prova(altro[i]); if (r.stato === "ok" || r.stato === "dubbio") return { cat: altro[i], r: r }; }
    /* un colore o una base scritti a metà (#3b, 0b2): il loro errore, nella loro categoria */
    var segnale = /^#/.test(t.trim()) ? "colori" : /^-?0[xbo]/i.test(t.trim()) ? "basi" : null;
    if (segnale && prova(segnale).stato === "errore") return { cat: segnale, r: ris[segnale] };
    /* nessuno lo legge: l'errore più utile (quello della categoria, o delle unità se lì c'era un numero) */
    if (qui.stato === "errore" || qui.stato === "senzaunita") return { cat: S.cat, r: qui };
    /* un numero con un'unità sbagliata è delle unità; un numero solo, scritto altrove, è forse l'inizio d'altro (2 di 2^64): si aspetta */
    var u = prova("unita"); if (u.stato === "errore") return { cat: "unita", r: u };
    if (u.stato === "senzaunita") return { cat: S.cat, r: { stato: "no" } };
    return { cat: S.cat, r: { stato: "errore", messaggio: "Non capisco «" + t.trim() + "». Prova: 12 km, #3b82f6, 0xff, 15:30 Torino." } };
  }

  /* ---------------------------------------------------------------- la pillola delle categorie */
  var pillX = null, pillW = null;
  function bottoneCat(c) { return cat.querySelector('[data-c="' + c + '"]'); }
  function metti(c, anima) {
    var b = bottoneCat(c); if (!b) return;
    var x = b.offsetLeft, w = b.offsetWidth;
    if (anima && pillX !== null && pill.animate && !CV.fermo() && (x !== pillX || w !== pillW)) {
      var dir = x > pillX ? 1 : -1;
      pill.animate([
        { transform: "translateX(" + pillX + "px)", width: pillW + "px" },
        { transform: "translateX(" + (pillX - dir * 3) + "px)", width: (pillW - 4) + "px", offset: 0.14 },
        { transform: "translateX(" + (x + dir * 5) + "px)", width: (w + 2) + "px", offset: 0.68 },
        { transform: "translateX(" + x + "px)", width: w + "px" }
      ], { duration: 470, easing: "cubic-bezier(.3,.7,.35,1)" });
    }
    pill.style.transform = "translateX(" + x + "px)"; pill.style.width = w + "px"; pillX = x; pillW = w;
    /* la pastiglia scelta resta in vista nella riga che scorre */
    var r = cat, sx = r.scrollLeft, vw = r.clientWidth;
    if (x < sx + 12 || x + w > sx + vw - 12) { var to = Math.max(0, x - (vw - w) / 2); if (r.scrollTo) r.scrollTo({ left: to, behavior: anima && !CV.fermo() ? "smooth" : "auto" }); else r.scrollLeft = to; }
  }
  var segnaposto = { unita: "12 km, 70 kg in lb, 100 °F", colori: "#3b82f6, rgb(…), hsl(…), oklch(…)", basi: "255, 0xff, 0b1010, 2^64", ore: "15:30 Torino, adesso, 9:00 Gaza", immagini: "" };
  function scegliCat(c, come) {
    if (c === S.cat) return;
    var prima = S.cat, dir = ORDINE.indexOf(c) > ORDINE.indexOf(prima) ? 1 : -1;
    S.cat = c; salva();
    Array.prototype.forEach.call(cat.querySelectorAll(".cv-cat__b"), function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-c") === c)); b.tabIndex = b.getAttribute("data-c") === c ? 0 : -1; });
    metti(c, true);
    inp.placeholder = segnaposto[c];
    var img = c === "immagini";
    campo.hidden = img; file.hidden = !img; bCifre.hidden = img;
    scheda.classList.toggle("is-img", img);
    /* il pannello di prima esce, il nuovo entra dal lato verso cui è andata la pillola */
    var vecchio = box[prima], nuovo = pannello(c);
    if (vecchio) vecchio.hidden = true;
    nuovo.hidden = false;
    if (!CV.fermo() && nuovo.animate && come !== "init") nuovo.animate([{ transform: "translateX(" + dir * 22 + "px)", opacity: 0 }, { transform: "translateX(" + (-dir * 2) + "px)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }], { duration: 400, easing: "cubic-bezier(.2,.9,.25,1)" });
  }

  /* ---------------------------------------------------------------- disegnare */
  var tErr = 0, tAnn = 0, tVivo = 0, ultimoMain = null, ultimaInfo = null;
  function annuncia(t) { annuncio.textContent = ""; setTimeout(function () { annuncio.textContent = t; }, 40); }
  function aggiorna(origine) {
    var t = inp.value;
    bX.hidden = !t;
    ctx.testo = t; ctx.piu = S.piu; ctx.anima = origine !== "init" && origine !== "digita-veloce";
    var info;
    if (S.cat === "immagini") info = P.immagini.rendi(null, ctx);
    else {
      var d = interpreta(t);
      if (d.cat !== S.cat) { memoria[S.cat] = ""; scegliCat(d.cat, "auto"); }
      pannello(S.cat);
      ctx.dentro = true;
      info = P[S.cat].rendi(d.r, ctx) || {};
    }
    ultimaInfo = info;
    /* la riga di lettura: un errore aspetta che smetti di scrivere (12 k non è ancora un errore: è 12 km a metà) */
    clearTimeout(tErr);
    function riga() {
      var L = info.letto || { testo: "" };
      letto.setAttribute("data-l", L.tipo || "");
      letto.classList.toggle("is-mono", !!L.mono);
      lettoT.textContent = L.testo;
    }
    if (info.ritarda && origine === "digita") { letto.setAttribute("data-l", "attesa"); tErr = setTimeout(riga, 650); } else riga();
    main.classList.toggle("is-fermo", !info.main);
    /* il dubbio: la domanda e le risposte, come pastiglie */
    var dd = info.dubbio;
    dubbio.hidden = !dd; dubbioO.textContent = "";
    if (dd) {
      dubbioD.textContent = dd.domanda;
      dd.opzioni.forEach(function (o, i) {
        var b = el("button", "cv-ris"); b.type = "button";
        b.appendChild(el("span", "cv-ris__t", o.testo)); if (o.nota) b.appendChild(el("span", "cv-ris__n", o.nota));
        b.addEventListener("click", function () { S.scelte[dd.chiave] = i; if (dd.chiave.indexOf("o:") !== 0 && dd.chiave.indexOf("n:") !== 0) salva(); aggiorna("scelta"); });
        dubbioO.appendChild(b);
      });
      if (origine !== "init" && !CV.fermo() && dubbio.animate) dubbio.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: 240, easing: "cubic-bezier(.2,.9,.25,1)" });
    }
    /* le note morbide: GB a 1000 o a 1024 */
    var nt = (info.note || []).filter(function (n) { return n.tipo === "windows"; })[0];
    notaS.hidden = !nt && !info.azione; notaS.textContent = "";
    if (nt) {
      notaS.appendChild(el("span", "", nt.testo + " "));
      var bn = el("button", "cv-notas__b", nt.bottone); bn.type = "button";
      bn.addEventListener("click", function () { S.scelte[nt.chiave] = nt.attiva ? 0 : 1; salva(); aggiorna("scelta"); });
      notaS.appendChild(bn);
    } else if (info.azione) {
      var ba = el("button", "cv-notas__b", info.azione.testo); ba.type = "button";
      ba.addEventListener("click", function () { scegliCat(info.azione.cat, "tocco"); aggiorna("cat"); });
      notaS.appendChild(ba);
    }
    /* il risultato grande */
    var m = info.main;
    main.hidden = !m && (!ultimoMain || !!dd || S.cat === "immagini" || ultimoMain.cat !== S.cat);
    if (m) {
      ultimoMain = m; m.cat = S.cat;
      mainS.textContent = m.segno || ""; mainS.className = "cv-main__s" + (m.colore ? " is-colore" : "");
      if (m.colore) { mainS.textContent = ""; mainS.style.background = m.colore; } else mainS.style.background = "";
      main.classList.toggle("is-lungo", !!m.lungo || m.valore.length > 16);
      CV.rullo(mainV, m.valore, { anima: ctx.anima, tipo: S.cat });
      mainU.textContent = m.unita || "";
      main.setAttribute("aria-label", (m.parlato || m.detto) + ". Tocca per copiare.");
      clearTimeout(tAnn); tAnn = setTimeout(function () { if (m.parlato) annuncia(m.parlato); }, 900);
    }
    if (info.vuoto) { main.hidden = true; ultimoMain = null; }
    bCopia.disabled = S.cat === "immagini" ? !info.salvabile : !m;
    /* come si calcola */
    var c = info.come;
    come.hidden = !c || !m;
    if (c) { comeF.textContent = c.f || ""; comeF.hidden = !c.f; comeN.textContent = c.n || ""; }
    bCifre.setAttribute("aria-pressed", String(S.piu));
    if (S.cat === "immagini") { bCopiaT.textContent = "Salva"; bCondividi.hidden = !info.condivisibile; bCondividiT.textContent = "Condividi"; }
    else { bCopiaT.textContent = "Copia"; bCondividi.hidden = false; bCondividiT.textContent = navigator.share ? "Condividi" : "Link"; }
    bCondividi.setAttribute("aria-label", S.cat === "immagini" ? "Condividi l'immagine" : navigator.share ? "Condividi il link a questo valore" : "Copia il link a questo valore");
    barra.classList.toggle("is-img", S.cat === "immagini");
    /* l'ora di adesso si aggiorna da sola, al cambio del minuto */
    clearTimeout(tVivo);
    if (info.vivo && !(window.PAGINA && PAGINA.still && PAGINA.still() && Qs.get("t"))) { var ms = 60000 - (ctx.adesso() % 60000) + 30; tVivo = setTimeout(function () { if (!doc.hidden) aggiorna("vivo"); }, ms); }
  }

  /* ---------------------------------------------------------------- il campo */
  var ultimoTasto = 0;
  inp.addEventListener("input", function () {
    var t = performance.now(), veloce = t - ultimoTasto < 70; ultimoTasto = t;
    aggiorna(veloce ? "digita-veloce" : "digita");
    if (veloce) { clearTimeout(inp.__v); inp.__v = setTimeout(function () { aggiorna("digita"); }, 140); }
  });
  inp.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && inp.value) { inp.value = ""; aggiorna("digita"); e.preventDefault(); }
    else if (e.key === "Enter") { if (matchMedia("(pointer: coarse)").matches) inp.blur(); else if (ultimoMain) ctx.copia(main, ultimoMain.copia, ultimoMain.detto); e.preventDefault(); }
  });
  bX.addEventListener("click", function () { inp.value = ""; aggiorna("digita"); inp.focus(); });
  /* «/» porta al campo, come nei siti che si usano con la tastiera */
  doc.addEventListener("keydown", function (e) {
    if (e.key === "/" && doc.activeElement !== inp && !/^(INPUT|TEXTAREA|SELECT)$/.test(doc.activeElement && doc.activeElement.tagName || "") && S.cat !== "immagini") { inp.focus(); inp.select(); e.preventDefault(); }
  });
  /* con la tastiera del telefono aperta la barra si toglie di mezzo (torna quando il campo perde il fuoco) */
  var grosso = matchMedia("(pointer: coarse)");
  doc.addEventListener("focusin", function (e) { if (grosso.matches && e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName) && !e.target.hasAttribute("data-appunti") && e.target.type !== "file" && e.target.type !== "range") { clearTimeout(barra.__t); barra.classList.add("is-via"); } });
  doc.addEventListener("focusout", function () { clearTimeout(barra.__t); barra.__t = setTimeout(function () { barra.classList.remove("is-via"); }, 120); });

  /* ---------------------------------------------------------------- le categorie: tocco, frecce */
  cat.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".cv-cat__b") : null; if (!b) return;
    var c = b.getAttribute("data-c"); if (c === S.cat) return;
    memoria[S.cat] = inp.value;
    var t = inp.value, tieni = false;
    if (t.trim() && c !== "immagini") { ctx.dentro = true; ctx.lettura = lettura; var r = P[c].leggi(t, ctx); tieni = r.stato === "ok" || r.stato === "dubbio"; }
    var vecchia = S.cat;
    S.cat = vecchia; scegliCat(c, "tocco");
    if (!tieni && c !== "immagini") inp.value = memoria[c] || "";
    aggiorna("cat");
  });
  cat.addEventListener("keydown", function (e) {
    var k = e.key, i = ORDINE.indexOf(S.cat);
    if (k !== "ArrowRight" && k !== "ArrowLeft" && k !== "Home" && k !== "End") return;
    e.preventDefault();
    var j = k === "Home" ? 0 : k === "End" ? ORDINE.length - 1 : (i + (k === "ArrowRight" ? 1 : -1) + ORDINE.length) % ORDINE.length;
    var b = bottoneCat(ORDINE[j]); b.click(); b.focus();
  });

  /* ---------------------------------------------------------------- il risultato grande e la barra */
  main.addEventListener("click", function () { if (S.cat === "immagini") return; if (ultimoMain) ctx.copia(main, ultimoMain.copia, ultimoMain.detto); });
  bCopia.addEventListener("click", function () {
    if (S.cat === "immagini") { P.immagini.salvaFile(bCopia); return; }
    if (ultimoMain) ctx.copia(bCopia, ultimoMain.copia, ultimoMain.detto);
  });
  bCifre.addEventListener("click", function () { S.piu = !S.piu; salva(); aggiorna("cifre"); annuncia(S.piu ? "Più cifre." : "Cifre arrotondate."); });
  bCondividi.addEventListener("click", function () {
    if (S.cat === "immagini") { P.immagini.condividi(bCondividi); return; }
    var u = location.origin + location.pathname + (inp.value.trim() ? "?q=" + encodeURIComponent(inp.value.trim()) : "?c=" + S.cat);
    if (navigator.share) { navigator.share({ title: "Convertitore", text: ultimoMain ? inp.value.trim() + " → " + ultimoMain.detto : "Convertitore", url: u }).then(function () { CV.bolla(bCondividi, "Condiviso"); }, function () {}); return; }
    CV.copia(u).then(function (ok) { CV.bolla(bCondividi, ok ? "Link copiato" : "Non riesco a copiare"); });
  });

  /* ---------------------------------------------------------------- partenza */
  var q = Qs.get("q"), c0 = Qs.get("c");
  if (c0 && ORDINE.indexOf(c0) >= 0) S.cat = c0;
  var primo = S.cat; S.cat = "__"; scegliCat(primo, "init");
  if (q) inp.value = q.slice(0, 400);
  aggiorna("init");
  /* i caratteri cambiano le misure delle pastiglie: la pillola si rimette quando arrivano, e a ogni cambio di misura */
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { metti(S.cat, false); });
  window.addEventListener("resize", function () { metti(S.cat, false); });
  doc.addEventListener("visibilitychange", function () { if (!doc.hidden && ultimaInfo && ultimaInfo.vivo) aggiorna("vivo"); });
  requestAnimationFrame(function () { doc.documentElement.classList.add("cv-pronto"); });

  window.__cv = {
    set: function (t) { inp.value = t; aggiorna("digita"); return ultimaInfo; },
    cat: function (c) { bottoneCat(c).click(); },
    stato: function () { return { cat: S.cat, main: ultimoMain && { valore: ultimoMain.valore, unita: ultimoMain.unita, copia: ultimoMain.copia, segno: ultimoMain.segno }, letto: lettoT.textContent, dubbio: !dubbio.hidden && dubbioD.textContent }; },
    scegli: function (i) { var b = dubbioO.children[i]; if (b) b.click(); },
    S: S
  };
})();
