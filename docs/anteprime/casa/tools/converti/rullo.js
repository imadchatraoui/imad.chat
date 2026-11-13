/* Convertitore — i numeri che rotolano e il tocco per copiare.
   CV.rullo(el, testo, { anima }) scrive un valore carattere per carattere, allineato a destra (le unità restano ferme): ogni
   carattere cambiato esce verso l'alto (un piccolo carico in giù prima) e il nuovo sale dal basso, passa di poco e si posa.
   Ognuno parte 16 ms dopo quello alla sua destra; tutto finisce entro 560 ms. Un valore lungo (oltre 18 caratteri) o di un'altra
   categoria si posa intero (240 ms). Con «meno movimento» si scrive e basta.
   CV.copia(testo) → Promise<bool>; CV.bolla(bottone, testo): la parola che sale sopra il bottone («Copiato»).
   Plain script, ES2017. */
(function (G) {
  "use strict";
  var CV = G.CV = G.CV || {}, doc = document;
  var mq = G.matchMedia ? G.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  CV.fermo = function () { return mq.matches || !!(G.PAGINA && G.PAGINA.still && G.PAGINA.still()); };
  var animabile = typeof Element !== "undefined" && typeof Element.prototype.animate === "function";
  var ENTRA = [{ transform: "translateY(.64em)", opacity: 0 }, { transform: "translateY(-.07em)", opacity: 1, offset: 0.68 }, { transform: "translateY(0)", opacity: 1 }];
  var ESCE = [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(.05em)", opacity: 1, offset: 0.18 }, { transform: "translateY(-.66em)", opacity: 0 }];

  CV.rullo = function (el, testo, o) {
    testo = String(testo); var prima = el.__t, tipoPrima = el.__tipo; el.__t = testo; el.__tipo = o && o.tipo;
    if (prima === testo) return;
    if (!o || !o.anima || prima === undefined || prima === "" || CV.fermo() || !animabile) { el.textContent = testo; return; }
    /* un valore lungo (un colore, un numero in binario) o di un altro genere non rotola cifra per cifra: si posa intero */
    if (testo.length > 18 || prima.length > 18 || tipoPrima !== el.__tipo) {
      el.textContent = testo;
      el.animate([{ opacity: 0, transform: "translateY(.22em)" }, { opacity: 1, transform: "translateY(-.02em)", offset: 0.7 }, { opacity: 1, transform: "none" }], { duration: 240, easing: "cubic-bezier(.2,.8,.3,1)" });
      return;
    }
    var n = testo.length, p = prima.length, frag = doc.createDocumentFragment(), cambiati = [];
    for (var i = 0; i < n; i++) {
      var c = testo.charAt(i), j = p - (n - i), vecchio = j >= 0 ? prima.charAt(j) : "";
      var s = doc.createElement("span"); s.className = "r";
      var nu = doc.createElement("span"); nu.className = "r__n"; nu.textContent = c; s.appendChild(nu);
      if (vecchio !== c) {
        if (vecchio && vecchio !== " ") { var v = doc.createElement("span"); v.className = "r__o"; v.textContent = vecchio; v.setAttribute("aria-hidden", "true"); s.appendChild(v); }
        cambiati.push({ s: s, k: n - 1 - i });
      }
      frag.appendChild(s);
    }
    el.textContent = ""; el.appendChild(frag);
    var passo = cambiati.length > 14 ? Math.max(6, 220 / cambiati.length) : 16, ritardo = (o.ritardo || 0);
    cambiati.forEach(function (x, idx) {
      var d = Math.min(ritardo + Math.min(x.k, 14) * passo, 240);
      var nn = x.s.firstChild, oo = x.s.childNodes[1];
      nn.animate(ENTRA, { duration: 300, delay: d + (oo ? 40 : 0), easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" });
      if (oo) oo.animate(ESCE, { duration: 190, delay: d, easing: "cubic-bezier(.5,0,.9,.4)", fill: "both" }).onfinish = function () { if (oo.parentNode) oo.parentNode.removeChild(oo); };
    });
  };

  /* ---------------------------------------------------------------- copiare */
  CV.copia = function (testo) {
    function vecchioModo() {
      try {
        var ta = doc.createElement("textarea"); ta.value = testo; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "0"; ta.style.opacity = "0"; ta.style.fontSize = "16px";
        doc.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, testo.length); var ok = doc.execCommand("copy"); doc.body.removeChild(ta); return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(testo).then(function () { return true; }, function () { return vecchioModo(); });
    return Promise.resolve(vecchioModo());
  };
  /* la parola che sale sopra il bottone; una alla volta in tutta la pagina */
  var ultima = null;
  CV.bolla = function (b, testo) {
    var el = b.querySelector(".cv-bolla"); if (!el) return;
    if (ultima && ultima !== el) ultima.classList.remove("is-su");
    ultima = el; el.textContent = testo;
    el.classList.remove("is-su"); void el.offsetWidth; el.classList.add("is-su");
    clearTimeout(el.__t); el.__t = setTimeout(function () { el.classList.remove("is-su"); }, 1300);
    b.classList.add("is-fatto"); clearTimeout(b.__f); b.__f = setTimeout(function () { b.classList.remove("is-fatto"); }, 1300);
  };
})(window);
