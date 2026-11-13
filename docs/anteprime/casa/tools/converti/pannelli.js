/* Convertitore — i pannelli dei risultati: unità, colori, basi, fusi orari (le immagini sono in immagini.js).
   Ogni pannello è CV.P[nome] = { leggi(testo, ctx), costruisci(el, ctx), rendi(ris, ctx) → { main, letto, come, dubbio, note } }.
   converti.js sceglie il pannello, tiene la scheda in cima e la barra; qui si scrivono solo le righe. Ogni riga è un bottone:
   un tocco copia il valore così com'è scritto. Plain script, ES2017. */
(function (G) {
  "use strict";
  var CV = G.CV, doc = document, P = CV.P = CV.P || {};
  function el(tag, cls, testo) { var e = doc.createElement(tag); if (cls) e.className = cls; if (testo !== undefined) e.textContent = testo; return e; }
  CV.el = el;
  /* un valore esatto o arrotondato: esatto se ha al massimo 10 cifre, altrimenti 6 cifre e «≈»; con «più cifre» fino a 21 */
  CV.mostra = function (q, piu) {
    if (piu) return CV.scrivi(q, { sig: 21, max: 24 });
    var e = CV.scrivi(q, { sig: 10 }); if (e.esatto) return e;
    return CV.scrivi(q, { sig: 6 });
  };
  /* una riga: [≈ valore] [simbolo · nome]; chiave fissa così il valore rotola da un risultato all'altro */
  CV.riga = function (padre, chiave, ctx) {
    var b = el("button", "cv-riga"); b.type = "button"; b.setAttribute("data-k", chiave);
    var v = el("span", "cv-riga__v"), s = el("span", "cv-riga__s"), n = el("span", "cv-riga__n num");
    var e = el("span", "cv-riga__e"), u = el("span", "cv-riga__u"), t = el("span", "cv-riga__t");
    v.appendChild(s); v.appendChild(n); e.appendChild(u); e.appendChild(t);
    b.appendChild(v); b.appendChild(e); b.appendChild(el("span", "cv-bolla"));
    b.__n = n; b.__s = s; b.__u = u; b.__t = t;
    if (ctx.osserva) ctx.osserva(b);
    b.addEventListener("click", function () { if (b.__copia) ctx.copia(b, b.__copia, b.__detto); });
    padre.appendChild(b); return b;
  };
  CV.scriviRiga = function (b, o, ctx) {
    b.__s.textContent = o.esatto === false ? "≈" : "";
    CV.rullo(b.__n, o.valore, { anima: ctx.anima && ctx.visibile(b), ritardo: o.ritardo || 0 });
    if (b.__u.textContent !== o.simbolo) b.__u.textContent = o.simbolo || "";
    if (b.__t.textContent !== (o.nome || "")) b.__t.textContent = o.nome || "";
    b.__copia = o.copia; b.__detto = o.detto || o.copia;
    b.setAttribute("aria-label", (o.esatto === false ? "circa " : "") + o.valore + " " + (o.parlato || o.nome || o.simbolo || "") + ". Tocca per copiare.");
    b.classList.toggle("is-da", !!o.da); b.classList.toggle("is-a", !!o.a);
  };
  function esempi(padre, titolo, lista, ctx) {
    var box = el("div", "cv-esempi"); box.appendChild(el("p", "cv-h2", titolo));
    var r = el("div", "cv-esempi__r");
    lista.forEach(function (x) {
      var b = el("button", "cv-es"); b.type = "button";
      b.appendChild(el("span", "cv-es__v", x[0])); if (x[1]) b.appendChild(el("span", "cv-es__n", x[1]));
      b.addEventListener("click", function () { ctx.scrivi(x[0]); });
      r.appendChild(b);
    });
    box.appendChild(r); padre.appendChild(box); return box;
  }
  function scheda(padre, titolo) { var c = el("section", "pg-card cv-gruppo"); if (titolo) c.appendChild(el("h2", "cv-h2", titolo)); var l = el("div", "cv-righe"); c.appendChild(l); padre.appendChild(c); c.__l = l; return c; }
  function entra(nodi, ctx) {             /* le schede nuove arrivano dal basso, una dopo l'altra */
    if (!ctx.anima || CV.fermo()) return;
    nodi.forEach(function (n, i) { if (n.animate) n.animate([{ transform: "translateY(14px)", opacity: 0 }, { transform: "translateY(-1.5px)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }], { duration: 380, delay: 40 + i * 45, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" }); });
  }

  /* ================================================================ unità */
  var U = CV.unita;
  P.unita = {
    leggi: function (t, ctx) { return U.leggi(t, ctx.scelte); },
    costruisci: function (box, ctx) {
      this.box = box; this.fam = null;
      this.vuoto = esempi(box, "Prova", [["12 km"], ["70 kg in lb"], ["100 °F"], ["5'11\"", "piedi e pollici"], ["80 m²", "in piedi quadrati"], ["2 L in gal USA"], ["130 km/h"], ["1 TB", "quanto vale davvero"]], ctx);
      this.senza = el("div"); box.appendChild(this.senza);
      this.gruppi = el("div", "cv-gruppi"); box.appendChild(this.gruppi);
    },
    rendi: function (r, ctx) {
      var me = this;
      me.vuoto.hidden = r.stato !== "vuoto"; me.senza.hidden = r.stato !== "senzaunita";
      me.gruppi.hidden = r.stato === "vuoto" || r.stato === "senzaunita" || r.stato === "dubbio" || !me.fam;
      me.gruppi.classList.toggle("is-fermo", r.stato !== "ok");
      if (r.stato === "vuoto" || r.stato === "no") return { letto: { testo: "Scrivi un valore con la sua unità: 12 km, 70 kg in lb, 100 °F." }, vuoto: true };
      if (r.stato === "senzaunita") {
        var n = CV.scrivi(r.numero.valore || r.numero.dubbio[0].valore, { sig: 12 }).testo;
        me.senza.textContent = "";
        esempi(me.senza, "Manca l'unità", [[n + " km"], [n + " kg"], [n + " °C"], [n + " m²"], [n + " L"], [n + " km/h"], [n + " GB"]], ctx);
        return { letto: { testo: "Manca l'unità: " + n + " cosa? Oppure è un numero da scrivere in un'altra base.", tipo: "avviso" }, azione: { testo: "Apri in Basi", cat: "basi" } };
      }
      if (r.stato === "errore") return { letto: { testo: r.messaggio, tipo: "errore" }, ritarda: true };
      if (r.stato === "dubbio") return { letto: { testo: "Prima di convertire, una domanda.", tipo: "avviso" }, dubbio: r.dubbio };
      var fam = r.famiglia, F = U.FAMIGLIE[fam];
      if (fam !== me.fam) {
        me.fam = fam; me.gruppi.textContent = ""; me.righe = {};
        var nuovi = [];
        F.righe.forEach(function (g) {
          var c = scheda(me.gruppi, g[0] || F.nome); nuovi.push(c);
          g[1].forEach(function (id) { me.righe[id] = CV.riga(c.__l, id, ctx); });
        });
        me.gruppi.hidden = false;
        entra(nuovi, ctx);
      }
      var k = 0;
      Object.keys(me.righe).forEach(function (id) {
        var q = U.in(r.base, id), m = CV.mostra(q, ctx.piu), u = U.U[id];
        CV.scriviRiga(me.righe[id], { valore: m.testo, esatto: m.esatto, simbolo: u.simbolo, nome: U.nome(id, q), copia: m.copia + " " + u.simbolo, detto: m.testo + " " + u.simbolo, da: id === r.da, a: id === r.a, ritardo: (k++) * 10 }, ctx);
      });
      var qa = U.in(r.base, r.a), ma = CV.mostra(qa, ctx.piu), ua = U.U[r.a];
      var scritto = r.pezzi.map(function (p) { return CV.scrivi(p.q, { sig: 15 }).testo + " " + U.U[p.id].simbolo; }).join(" ");
      var come = null, f = U.fattore(r.da, r.a);
      if (f) { var mf = CV.mostra(f, ctx.piu); come = { f: "1 " + U.U[r.da].simbolo + (mf.esatto ? " = " : " ≈ ") + mf.testo + " " + ua.simbolo, n: U.U[r.da].def + (r.da !== r.a ? ". " + ua.def + "." : ".") };
      } else come = { f: fam === "temperatura" ? "°F = °C × 9/5 + 32   ·   K = °C + 273,15" : "", n: "Le temperature non si moltiplicano: si spostano lo zero e la scala. " + U.U[r.da].def + "." };
      come.n += ma.esatto && !ctx.piu ? "" : " «≈» vuol dire arrotondato: con «Più cifre» le vedi tutte.";
      return {
        main: { segno: ma.esatto ? "=" : "≈", valore: ma.testo, unita: ua.simbolo, copia: ma.copia + " " + ua.simbolo, detto: ma.testo + " " + ua.simbolo, parlato: scritto + (ma.esatto ? " sono " : " sono circa ") + ma.testo + " " + U.nome(r.a, qa) },
        letto: { testo: scritto + " → " + ua.simbolo + "  ·  " + F.nome.toLowerCase(), tipo: "ok", mono: true },
        note: r.note, come: come
      };
    }
  };

  /* ================================================================ colori */
  var C = CV.colori;
  P.colori = {
    leggi: function (t, ctx) { return C.leggi(t, ctx.dentro); },
    costruisci: function (box, ctx) {
      this.vuoto = esempi(box, "Prova", [["#3b82f6"], ["hsl(160 60% 40%)"], ["rgb(20 24 38)"], ["oklch(70% 0.15 60)"], ["oklch(75% 0.3 145)", "fuori dallo schermo"], ["#f3dfa8", "l'oro del sito"]], ctx);
      var c = this.tinta = el("section", "pg-card cv-tinta"); c.hidden = true;
      var t = this.campione = el("div", "cv-tinta__c"); t.setAttribute("aria-hidden", "true");
      this.chiesto = el("i", "cv-tinta__v"); t.appendChild(this.chiesto);
      this.etC = el("span", "cv-tinta__et"); t.appendChild(this.etC);
      this.etD = el("span", "cv-tinta__et cv-tinta__et--d"); t.appendChild(this.etD);
      c.appendChild(t);
      this.contr = el("p", "cv-tinta__k num"); c.appendChild(this.contr);
      box.appendChild(c);
      var g = this.g = scheda(box, "Formati"); g.hidden = true;
      this.righe = {};
      var me = this;
      [["hex", "HEX"], ["rgb", "RGB"], ["hsl", "HSL"], ["oklch", "OKLCH"]].forEach(function (x) { me.righe[x[0]] = CV.riga(g.__l, x[0], ctx); me.righe[x[0]].classList.add("cv-riga--mono"); me.righe[x[0]].__lab = x[1]; });
      this.okP3 = !!(G.CSS && CSS.supports && CSS.supports("color", "oklch(70% 0.3 145)"));
    },
    rendi: function (r, ctx) {
      var me = this, ok = r.stato === "ok";
      me.vuoto.hidden = r.stato !== "vuoto" && r.stato !== "no";
      me.tinta.hidden = me.g.hidden = !me.hex && !ok || r.stato === "vuoto";
      me.g.classList.toggle("is-fermo", !ok); me.tinta.classList.toggle("is-fermo", !ok);
      if (r.stato === "vuoto" || r.stato === "no") return { letto: { testo: "Scrivi un colore: #3b82f6, rgb(…), hsl(…), oklch(…)." }, vuoto: true };
      if (!ok) return { letto: { testo: r.messaggio, tipo: "errore" }, ritarda: true };
      var f = C.formati(r, { piu: ctx.piu }), rgb = C.clip(r.rgb);
      me.hex = f.hex.testo;
      var css = f.rgb.testo;
      me.campione.style.setProperty("--c", css);
      /* fuori dallo sRGB: a sinistra il colore chiesto (se lo schermo sa più colori lo mostra), a destra quello che si salva */
      me.campione.classList.toggle("is-diviso", !!r.fuori);
      if (r.fuori) me.chiesto.style.background = me.okP3 ? ctx.testo.trim() : css;
      me.etC.textContent = r.fuori ? (me.okP3 ? "chiesto" : "chiesto: lo schermo non lo sa fare") : "";
      me.etD.textContent = r.fuori ? "sRGB, si salva così" : "";
      var kb = C.contrasto(rgb, [1, 1, 1]), kn = C.contrasto(rgb, [0, 0, 0]);
      function k(v) { return v.toFixed(1).replace(".", ",") + " : 1"; }
      me.contr.textContent = "Testo bianco " + k(kb) + "  ·  testo nero " + k(kn) + "  ·  si legge meglio il " + (kb > kn ? "bianco" : "nero") + (Math.max(kb, kn) >= 4.5 ? "" : ", ma poco");
      var j = 0;
      ["hex", "rgb", "hsl", "oklch"].forEach(function (id) {
        var x = f[id], b = me.righe[id];
        CV.scriviRiga(b, { valore: x.testo, esatto: x.esatto, simbolo: b.__lab, nome: "", copia: x.testo, parlato: b.__lab, da: r.fonte === id, ritardo: (j++) * 14 }, ctx);
      });
      var dest = r.fonte === "hex" ? "oklch" : "hex";
      return {
        main: { segno: "", colore: css, valore: f[dest].testo, unita: "", copia: f[dest].testo, detto: f[dest].testo, lungo: dest === "oklch", parlato: "Il colore in " + dest.toUpperCase() + ": " + f[dest].testo },
        letto: { testo: (r.fonte === "hex" ? "HEX" : r.fonte.toUpperCase()) + (r.a < 1 ? " con trasparenza" : "") + (r.fuori ? "  ·  fuori dallo sRGB: HEX, RGB e HSL sono il colore più vicino" : "  ·  colore sRGB"), tipo: r.fuori ? "avviso" : "ok", mono: !r.fuori },
        come: { f: "sRGB → lineare → OKLab → OKLCH", n: "Le formule sono quelle di CSS Color 4 (OKLab di Björn Ottosson). Ogni formato, riletto, dà lo stesso HEX; il contrasto è quello delle WCAG 2.2." + (r.fuori ? " Il colore chiesto è più acceso di quanto lo sRGB sappia fare: si toglie croma finché la differenza non si vede quasi più (CSS Color 4)." : "") }
      };
    }
  };

  /* ================================================================ basi */
  var BA = CV.basi;
  P.basi = {
    leggi: function (t, ctx) { return BA.leggi(t, ctx.dentro, ctx.lettura); },
    costruisci: function (box, ctx) {
      var me = this;
      this.vuoto = esempi(box, "Prova", [["255"], ["0xff"], ["0b1010 1010"], ["2^64", "il primo che non entra in 64 bit"], ["-128"], ["255 in bin"]], ctx);
      var l = this.letture = el("section", "pg-card cv-letture"); l.hidden = true;
      l.appendChild(el("h2", "cv-h2", "Leggi come"));
      var seg = this.seg = el("div", "cv-seg"); seg.setAttribute("role", "radiogroup"); seg.setAttribute("aria-label", "Leggi il numero come");
      [10, 2, 8, 16].forEach(function (b) {
        var x = el("button", "cv-seg__b", BA.NOMI[b]); x.type = "button"; x.setAttribute("role", "radio"); x.setAttribute("data-b", String(b));
        x.addEventListener("click", function () { ctx.leggiCome(b); }); seg.appendChild(x);
      });
      l.appendChild(seg); box.appendChild(l);
      var g = this.g = scheda(box, "Basi"); g.hidden = true; this.righe = {};
      [[2, "bin", "binario"], [8, "oct", "ottale"], [10, "dec", "decimale"], [16, "hex", "esadecimale"]].forEach(function (x) { var b = me.righe[x[0]] = CV.riga(g.__l, "b" + x[0], ctx); b.classList.add("cv-riga--mono", "cv-riga--lunga"); b.__lab = x[1]; b.__nome = x[2]; });
      var i = this.info = el("section", "pg-card cv-info"); i.hidden = true;
      i.appendChild(el("h2", "cv-h2", "In un programma"));
      this.infoP = el("p", "cv-info__p"); i.appendChild(this.infoP);
      this.larg = el("div", "cv-larg"); i.appendChild(this.larg);
      this.c2 = el("div", "cv-righe"); i.appendChild(this.c2);
      this.rigaC2 = CV.riga(this.c2, "c2", ctx); this.rigaC2.classList.add("cv-riga--mono", "cv-riga--lunga");
      box.appendChild(i);
    },
    rendi: function (r, ctx) {
      var me = this, ok = r.stato === "ok";
      me.vuoto.hidden = r.stato !== "vuoto" && r.stato !== "no";
      [me.g, me.info].forEach(function (x) { x.hidden = !me.visto && !ok || r.stato === "vuoto"; x.classList.toggle("is-fermo", !ok); });
      me.letture.hidden = !ok || r.letture.length < 2;
      if (r.stato === "vuoto" || r.stato === "no") return { letto: { testo: "Scrivi un numero intero: 255, 0xff, 0b1010, 2^64." }, vuoto: true };
      if (!ok) return { letto: { testo: r.messaggio, tipo: "errore" }, ritarda: true };
      me.visto = true;
      Array.prototype.forEach.call(me.seg.children, function (x) { var b = +x.getAttribute("data-b"); x.hidden = r.letture.indexOf(b) < 0; x.setAttribute("aria-checked", String(b === r.base)); });
      var f = BA.formati(r.v), j = 0;
      [2, 8, 10, 16].forEach(function (b) {
        var x = f[b], riga = me.righe[b];
        CV.scriviRiga(riga, { valore: x.testo, simbolo: riga.__lab, nome: riga.__nome, copia: x.copia, parlato: riga.__nome, da: b === r.base && !r.conto, a: b === r.a, ritardo: (j++) * 14 }, ctx);
      });
      /* le larghezze fisse: dove entra, detto semplice */
      var L = f.larghezze, senza = L.filter(function (x) { return x.senza; })[0], con = L.filter(function (x) { return x.con; })[0];
      var neg = r.v < G.BigInt(0), frasi = [f.bit + (f.bit === 1 ? " bit" : " bit") + ", " + f.cifre + (f.cifre === 1 ? " cifra" : " cifre") + " in decimale."];
      if (neg) frasi.push(con ? "È negativo: senza segno non entra mai; con segno serve un intero da " + con.w + " bit." : "È negativo e non entra in nessun intero fino a 128 bit.");
      else if (senza) frasi.push("Entra in un intero senza segno da " + senza.w + " bit" + (con && con.w !== senza.w ? "; con segno ne servono " + con.w : con ? ", anche con segno" : "; con segno non entra in 128") + ".");
      else frasi.push("Non entra in un intero da 128 bit: il più grande senza segno è 2¹²⁸ − 1.");
      if (!neg && senza && senza.w > 8 && f.bit === senza.w / 2 + 1 && f.bit > 8) frasi.push("Il massimo da " + senza.w / 2 + " bit è 2^" + senza.w / 2 + " − 1: questo lo supera.");
      me.infoP.textContent = frasi.join(" ");
      me.larg.textContent = "";
      L.forEach(function (x) { var c = el("span", "cv-larg__w" + (x.senza ? " is-s" : "") + (x.con ? " is-c" : ""), x.w); c.title = x.w + " bit: " + (x.senza ? "entra senza segno" : "non entra senza segno") + ", " + (x.con ? "entra con segno" : "non entra con segno"); me.larg.appendChild(c); });
      me.larg.setAttribute("aria-label", L.map(function (x) { return x.w + " bit " + (x.senza || x.con ? "sì" : "no"); }).join(", "));
      me.c2.hidden = !f.complemento;
      if (f.complemento) CV.scriviRiga(me.rigaC2, { valore: f.complemento.hex, simbolo: "hex", nome: "complemento a due, " + f.complemento.w + " bit", copia: f.complemento.copiaHex, parlato: "in complemento a due su " + f.complemento.w + " bit" }, ctx);
      var dest = r.a || (r.base === 10 ? 16 : 10), md = f[dest];
      var scritto = r.conto ? "conto: " + ctx.testo.trim() : "letto come " + BA.NOMI[r.base];
      var come = null, va = r.v < G.BigInt(0) ? -r.v : r.v;
      if (va < G.BigInt(65536) && va > G.BigInt(9)) {
        var h = va.toString(16).toUpperCase(), parti = h.split("").map(function (c, i) { var e = h.length - 1 - i; return parseInt(c, 16) + (e ? " × 16" + (e > 1 ? ["", "", "²", "³"][e] : "") : ""); });
        come = { f: h + " = " + parti.join(" + ") + " = " + va.toString(10), n: "Ogni cifra vale la base elevata alla sua posizione, da destra. In binario la base è 2, in ottale 8, in esadecimale 16 (da A = 10 a F = 15)." };
      } else come = { f: "", n: "Ogni cifra vale la base elevata alla sua posizione, da destra. I numeri sono interi esatti fino a " + BA.LIMITE + " bit." };
      return {
        main: { segno: "", valore: md.testo, unita: { 2: "bin", 8: "oct", 10: "dec", 16: "hex" }[dest], copia: md.copia, detto: md.copia, lungo: md.testo.length > 18, parlato: "In " + BA.NOMI[dest] + ": " + md.copia },
        letto: { testo: scritto + "  ·  " + f.bit + " bit", tipo: "ok", mono: true }, come: come
      };
    }
  };

  /* ================================================================ fusi orari */
  var O = CV.ore;
  P.ore = {
    leggi: function (t, ctx) { return O.leggi(t, ctx.dentro, ctx.scelte, ctx.adesso()); },
    costruisci: function (box, ctx) {
      var me = this;
      this.vuoto = null;
      var g = this.g = scheda(box, "Le città del sito");
      this.righe = {};
      O.RIGHE.forEach(function (z) { me.righe[z.tz] = me.rigaOra(g.__l, z.tz, z.nome, ctx, false); });
      var a = this.altre = scheda(box, "Altri fusi"); a.hidden = true; this.altreR = {};
      var cerca = el("section", "pg-card cv-cerca");
      var lab = el("label", "cv-cerca__t"); lab.setAttribute("for", "inFuso"); lab.textContent = "Aggiungi una città o un fuso";
      var inp = this.inp = el("input", "cv-in cv-in--piccolo"); inp.id = "inFuso"; inp.type = "text"; inp.setAttribute("autocomplete", "off"); inp.setAttribute("autocapitalize", "off"); inp.setAttribute("spellcheck", "false"); inp.setAttribute("enterkeyhint", "done"); inp.placeholder = "Londra, New York, Asia/Tokyo, UTC+5:30";
      var sug = this.sug = el("div", "cv-sug"); sug.setAttribute("role", "listbox"); sug.setAttribute("aria-label", "Fusi trovati");
      cerca.appendChild(lab); cerca.appendChild(inp); cerca.appendChild(sug); box.appendChild(cerca);
      inp.addEventListener("input", function () { me.suggerisci(ctx); });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { var p = sug.querySelector("button"); if (p) p.click(); e.preventDefault(); } });
      this.nota = el("section", "pg-card cv-nota"); this.nota.hidden = true; box.appendChild(this.nota);
    },
    rigaOra: function (padre, tz, nome, ctx, togli) {
      var b = CV.riga(padre, "z:" + tz, ctx); b.classList.add("cv-riga--ora");
      b.__tz = tz; b.__nome = nome;
      if (togli) {
        var x = el("button", "cv-togli"); x.type = "button"; x.setAttribute("aria-label", "Togli " + nome);
        x.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 6.5l7 7M13.5 6.5l-7 7"/></svg>';
        x.addEventListener("click", function (e) { e.stopPropagation(); ctx.togliZona(tz); });
        var w = el("div", "cv-riga-w"); padre.insertBefore(w, b); w.appendChild(b); w.appendChild(x);
      }
      return b;
    },
    suggerisci: function (ctx) {
      var me = this, t = me.inp.value; me.sug.textContent = "";
      O.cerca(t, 6).forEach(function (z) {
        var b = el("button", "cv-sug__b"); b.type = "button"; b.setAttribute("role", "option");
        b.appendChild(el("span", "", z.nome)); b.appendChild(el("span", "cv-sug__z", z.tz));
        b.addEventListener("click", function () { ctx.aggiungiZona(z.tz, z.nome); me.inp.value = ""; me.sug.textContent = ""; });
        me.sug.appendChild(b);
      });
    },
    rendi: function (r, ctx) {
      var me = this, ok = r.stato === "ok";
      if (r.stato === "vuoto" || r.stato === "no") r = { stato: "ok", t: ctx.adesso(), adesso: true, da: null, a: null, note: [] }, ok = true;
      me.g.classList.toggle("is-fermo", !ok); me.altre.classList.toggle("is-fermo", !ok);
      me.g.hidden = !ok && !me.scritto; if (!ok && !me.scritto) me.altre.hidden = true;
      if (r.stato === "errore") return { letto: { testo: r.messaggio, tipo: "errore" }, ritarda: true };
      if (r.stato === "dubbio") return { letto: { testo: "Prima, una domanda.", tipo: "avviso" }, dubbio: r.dubbio };
      /* gli altri fusi: quelli aggiunti, più quello di partenza e quello di arrivo se non sono tra le città */
      var extra = ctx.zone.slice(), tutte = {};
      O.RIGHE.forEach(function (z) { tutte[z.tz] = 1; });
      [r.da, r.a].forEach(function (z) { if (z && z.tz && !tutte[z.tz] && !extra.some(function (e) { return e.tz === z.tz; })) extra.push({ tz: z.tz, nome: z.nome, tmp: true }); });
      var fissi = [r.da, r.a].filter(function (z) { return z && z.tz === null; });
      var chiavi = extra.map(function (z) { return z.tz + (z.tmp ? "*" : ""); }).join(",");
      if (chiavi !== me.chiavi) {
        me.chiavi = chiavi; me.altre.__l.textContent = ""; me.altreR = {};
        extra.forEach(function (z) { me.altreR[z.tz] = me.rigaOra(me.altre.__l, z.tz, z.nome, ctx, !z.tmp); });
      }
      if (fissi.length) fissi.forEach(function (z) { if (!me.altreR["f" + z.fisso]) { me.altreR["f" + z.fisso] = CV.riga(me.altre.__l, "f" + z.fisso, ctx); me.altreR["f" + z.fisso].classList.add("cv-riga--ora"); me.altreR["f" + z.fisso].__fisso = z.fisso; me.altreR["f" + z.fisso].__nome = z.nome; } });
      me.altre.hidden = !extra.length && !fissi.length;
      var daTz = r.da ? r.da.tz : null, daInfo = r.da ? O.info(r.da.tz, r.t, r.da.fisso) : null, vecchi = O.datiVecchi(), j = 0;
      function scrivi(b, tz) {
        var fisso = b.__fisso, i = O.info(fisso !== undefined ? null : tz, r.t, fisso), meta = [i.giorno, i.utc];
        if (i.legale) meta.push("ora legale");
        if (O.MAROCCO[tz] && vecchi && r.t >= O.MAROCCO_DA) meta.push("corretto");
        var diff = daInfo ? i.off - daInfo.off : null;
        var giorno = daInfo && (i.y !== daInfo.y || i.mo !== daInfo.mo || i.d !== daInfo.d) ? (Date.UTC(i.y, i.mo - 1, i.d) > Date.UTC(daInfo.y, daInfo.mo - 1, daInfo.d) ? "il giorno dopo" : "il giorno prima") : "";
        var dd = diff === null || diff === 0 ? "" : (diff > 0 ? "+" : "−") + Math.floor(Math.abs(diff) / 60) + (Math.abs(diff) % 60 ? ":" + ("0" + Math.abs(diff) % 60).slice(-2) : "") + " h";
        CV.scriviRiga(b, { valore: i.ora, simbolo: b.__nome, nome: meta.join(" · ") + (dd ? "  ·  " + dd : "") + (giorno ? "  ·  " + giorno : ""), copia: i.ora + " " + b.__nome, parlato: "a " + b.__nome + ", " + i.giorno + (i.legale ? ", ora legale" : ""), da: !!(r.da && !r.da.qui && (tz === daTz || fisso !== undefined && r.da.fisso === fisso)), a: !!(r.a && (tz === r.a.tz || fisso !== undefined && r.a.fisso === fisso)), ritardo: (j++) * 18 }, ctx);
        return i;
      }
      Object.keys(me.righe).forEach(function (tz) { scrivi(me.righe[tz], tz); });
      me.scritto = true; me.g.hidden = false;
      Object.keys(me.altreR).forEach(function (k) { if (me.altreR[k].isConnected) scrivi(me.altreR[k], me.altreR[k].__tz); });
      /* la nota: il Marocco con dati vecchi, le ore che saltano */
      var note = (r.note || []).map(function (n) { return n.testo; });
      if (vecchi && r.t >= O.MAROCCO_DA) note.push("Questo dispositivo ha i dati dei fusi di prima del 20 settembre 2026: per lui a Casablanca sarebbe un'ora più tardi. Da quel giorno il Marocco è a UTC+0 tutto l'anno: qui l'ora è già corretta.");
      me.nota.hidden = !note.length; me.nota.textContent = note.join(" ");
      /* il risultato grande: l'arrivo; senza, Makkah (o Torino, se si parte da lì) */
      if (!r.da) { try { daTz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { daTz = "UTC"; } }
      var arrivo = r.a || (daTz === "Europe/Rome" || !r.da ? { tz: daTz === "Europe/Rome" ? "Asia/Riyadh" : "Europe/Rome", nome: daTz === "Europe/Rome" ? "Makkah" : "Torino" } : { tz: "Europe/Rome", nome: "Torino" });
      var ia = O.info(arrivo.tz, r.t, arrivo.fisso);
      var lt = r.adesso ? "adesso" + (r.da && !r.da.qui ? " a " + r.da.nome : "") + "  ·  " + (daInfo || O.info(null, r.t, 0)).ora + (r.da && !r.da.qui ? "" : " qui") : "le " + daInfo.ora + " a " + r.da.nome + "  ·  " + daInfo.giorno;
      if (!r.da) { var qui = (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return "UTC"; } })(); lt = "adesso  ·  " + O.info(qui, r.t).ora + " qui (" + qui.replace(/_/g, " ") + ")"; }
      return {
        main: { segno: "", valore: ia.ora, unita: arrivo.nome, copia: ia.ora + " " + arrivo.nome, detto: ia.ora + " " + arrivo.nome, parlato: "A " + arrivo.nome + " sono le " + ia.ora + ", " + ia.giorno },
        letto: { testo: lt, tipo: r.note && r.note.length ? "avviso" : "ok", mono: true },
        come: { f: "", n: "L'ora legale e i fusi li conosce il tuo dispositivo (i dati IANA). Una sola correzione è scritta qui: il Marocco è a UTC+0 tutto l'anno dal 20 settembre 2026, e un dispositivo con dati vecchi direbbe UTC+1." },
        vivo: !!r.adesso
      };
    }
  };
})(window);
