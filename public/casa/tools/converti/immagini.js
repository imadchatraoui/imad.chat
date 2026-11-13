/* Convertitore — le immagini: PNG, JPEG, WebP dentro e fuori; rimpicciolire e comprimere, con il peso vero del file che uscirà
   (si codifica davvero, sul telefono, a ogni cambio). Niente viene caricato: la foto passa da un <img> a una tela e torna file.
   L'orientamento della foto (EXIF) lo applica il browser quando la apre; la tela scrive i pixel già dritti e lascia fuori i dati
   della foto (luogo, modello del telefono): si dice. Quello che il telefono non sa leggere o scrivere si dice, con il nome.
   Plain script, ES2017. */
(function (G) {
  "use strict";
  var CV = G.CV, doc = document, el = CV.el, P = CV.P;
  var FORMATI = [{ id: "jpeg", nome: "JPEG", tipo: "image/jpeg", ext: "jpg", perde: true }, { id: "png", nome: "PNG", tipo: "image/png", ext: "png", perde: false }, { id: "webp", nome: "WebP", tipo: "image/webp", ext: "webp", perde: true }];
  var AREA_MAX = 16777216;                 /* Safari su iPhone non disegna tele più grandi di 4096 × 4096 */
  var scrive = { png: true, jpeg: null, webp: null }, legge = { webp: null, avif: null };
  function kb(n) {
    if (n < 1000) return n + " byte";
    if (n < 1e6) return (n < 1e4 ? (n / 1000).toFixed(1) : Math.round(n / 1000)).toString().replace(".", ",") + " kB";
    return (n / 1e6).toFixed(n < 1e7 ? 2 : 1).replace(".", ",") + " MB";
  }
  /* cosa sa scrivere e leggere questo telefono: si prova con una tela di 2 × 2 e due immagini minuscole */
  function prove() {
    var c = doc.createElement("canvas"); c.width = c.height = 2;
    var p = ["jpeg", "webp"].map(function (id) {
      return new Promise(function (ok) { try { c.toBlob(function (b) { scrive[id] = !!b && b.type === "image/" + id; ok(); }, "image/" + id, 0.8); } catch (e) { scrive[id] = false; ok(); } });
    });
    var IMG = { webp: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", avif: "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=" };
    Object.keys(IMG).forEach(function (k) {
      p.push(new Promise(function (ok) { var i = new Image(); i.onload = function () { legge[k] = i.naturalWidth > 0; ok(); }; i.onerror = function () { legge[k] = false; ok(); }; i.src = IMG[k]; }));
    });
    return Promise.all(p);
  }

  var M = P.immagini = {
    costruisci: function (box, ctx) {
      var me = this; me.ctx = ctx; me.st = ctx.img; if (!me.st.fmt) me.st.fmt = "jpeg"; if (!me.st.q) me.st.q = 82;
      /* l'invito: trascina o scegli */
      var v = me.vuoto = el("label", "pg-card cv-drop"); v.setAttribute("for", "fFile");
      v.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="10" width="34" height="28" rx="7"/><path d="M8.5 31.5l9.3-9 7.2 6.7 5.4-4.9 9.6 8.8"/><circle cx="31.5" cy="19.5" r="3"/></svg>';
      v.appendChild(el("span", "cv-drop__t", "Scegli un'immagine"));
      me.dropN = el("span", "cv-drop__n", "Oppure trascinala qui. Resta sul tuo telefono: niente viene caricato.");
      v.appendChild(me.dropN); box.appendChild(v);
      /* l'anteprima di quello che uscirà, su una scacchiera (la trasparenza si vede) */
      var a = me.anteprima = el("section", "pg-card cv-ante"); a.hidden = true;
      var fig = el("div", "cv-ante__f"); me.img = el("img", "cv-ante__i"); me.img.alt = ""; fig.appendChild(me.img);
      me.badge = el("span", "cv-ante__b num"); fig.appendChild(me.badge);
      a.appendChild(fig);
      me.orig = el("p", "cv-ante__o num"); a.appendChild(me.orig);
      box.appendChild(a);
      /* i comandi */
      var k = me.comandi = el("section", "pg-card cv-com"); k.hidden = true;
      k.appendChild(el("h2", "cv-h2", "Formato"));
      var seg = me.seg = el("div", "cv-seg"); seg.setAttribute("role", "radiogroup"); seg.setAttribute("aria-label", "Formato");
      FORMATI.forEach(function (f) {
        var b = el("button", "cv-seg__b", f.nome); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("data-f", f.id);
        b.addEventListener("click", function () { if (b.getAttribute("aria-disabled") === "true") { me.dettaNota = "Questo telefono non sa scrivere " + f.nome + ": scegli JPEG o PNG."; me.disegna(); return; } me.st.fmt = f.id; me.avvisoAlfa = null; ctx.salva(); me.codifica(); });
        seg.appendChild(b);
      });
      k.appendChild(seg);
      me.formNota = el("p", "cv-com__n"); k.appendChild(me.formNota);
      var r1 = el("div", "cv-com__r"); r1.appendChild(el("h2", "cv-h2", "Misura")); me.misT = el("span", "cv-com__v num"); r1.appendChild(me.misT); k.appendChild(r1);
      me.mis = el("input", "cv-range"); me.mis.type = "range"; me.mis.min = "4"; me.mis.max = "100"; me.mis.step = "1"; me.mis.value = "100"; me.mis.setAttribute("aria-label", "Misura, in percentuale dell'originale");
      k.appendChild(me.mis);
      var pr = me.preset = el("div", "cv-pre");
      [["Originale", 0], ["2048", 2048], ["1080", 1080], ["720", 720], ["Metà", -50]].forEach(function (x) {
        var b = el("button", "cv-pre__b", x[0]); b.type = "button"; b.__v = x[1];
        b.addEventListener("click", function () { me.lato = x[1] > 0 ? x[1] : 0; me.mis.value = String(me.pctDa(x[1])); me.codifica(); });
        pr.appendChild(b);
      });
      k.appendChild(pr);
      var r2 = me.rigaQ = el("div", "cv-com__r"); r2.appendChild(el("h2", "cv-h2", "Qualità")); me.qT = el("span", "cv-com__v num"); r2.appendChild(me.qT); k.appendChild(r2);
      me.q = el("input", "cv-range"); me.q.type = "range"; me.q.min = "30"; me.q.max = "100"; me.q.step = "1"; me.q.value = String(me.st.q); me.q.setAttribute("aria-label", "Qualità");
      k.appendChild(me.q);
      me.nota = el("p", "cv-com__n"); k.appendChild(me.nota);
      box.appendChild(k);
      me.mis.addEventListener("input", function () { me.lato = 0; me.codifica(); });
      me.q.addEventListener("input", function () { me.st.q = +me.q.value; ctx.salva(); me.codifica(); });
      /* il file: dal bottone della scheda, trascinato, incollato */
      var fi = doc.getElementById("fFile");
      fi.addEventListener("change", function () { if (fi.files && fi.files[0]) me.carica(fi.files[0]); fi.value = ""; });
      doc.addEventListener("dragover", function (e) { if (ctx.cat() !== "immagini") return; e.preventDefault(); v.classList.add("is-sopra"); });
      doc.addEventListener("dragleave", function (e) { if (!e.relatedTarget) v.classList.remove("is-sopra"); });
      doc.addEventListener("drop", function (e) { if (ctx.cat() !== "immagini") return; e.preventDefault(); v.classList.remove("is-sopra"); var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) me.carica(f); });
      doc.addEventListener("paste", function (e) { if (ctx.cat() !== "immagini") return; var it = e.clipboardData && e.clipboardData.files && e.clipboardData.files[0]; if (it) { e.preventDefault(); me.carica(it); } });
      me.pronte = prove().then(function () { me.disegna(); });
    },
    pctDa: function (v) {
      var s = this.src; if (!s) return 100; var lato = Math.max(s.w, s.h);
      if (v === 0) return 100; if (v < 0) return -v;
      return Math.max(1, Math.min(100, v / lato * 100));
    },
    misura: function () {
      var s = this.src, p = this.lato && this.lato < Math.max(s.w, s.h) ? this.lato / Math.max(s.w, s.h) : +this.mis.value / 100, w = Math.max(1, Math.round(s.w * p)), h = Math.max(1, Math.round(s.h * p)), limitata = false;
      if (w * h > AREA_MAX) { var k = Math.sqrt(AREA_MAX / (w * h)); w = Math.floor(w * k); h = Math.floor(h * k); limitata = true; }
      return { w: w, h: h, limitata: limitata };
    },
    carica: function (f) {
      var me = this; me.errore = null; me.uscita = null;
      var ext = (f.name.split(".").pop() || "").toLowerCase(), url = URL.createObjectURL(f), i = new Image();
      me.caricando = true; me.disegna();
      i.onload = function () {
        if (me.urlSrc) URL.revokeObjectURL(me.urlSrc); me.urlSrc = url;
        me.src = { img: i, w: i.naturalWidth, h: i.naturalHeight, nome: f.name.replace(/\.[^.]+$/, "") || "immagine", peso: f.size, tipo: (f.type || ext).replace("image/", "").toUpperCase().replace("JPG", "JPEG"), alfa: false };
        /* c'è trasparenza? (solo per i formati che la possono avere) */
        if (/png|webp|gif|avif/i.test(f.type || ext)) {
          try { var c = doc.createElement("canvas"), n = 64; c.width = c.height = n; var x = c.getContext("2d"); x.drawImage(i, 0, 0, n, n); var d = x.getImageData(0, 0, n, n).data; for (var k = 3; k < d.length; k += 4) if (d[k] < 250) { me.src.alfa = true; break; } } catch (e) { /* va bene */ }
        }
        /* parti trasparenti e JPEG: il JPEG le farebbe bianche, quindi si passa a un formato che le tiene, e si dice */
        if (me.src.alfa && me.st.fmt === "jpeg") { me.st.fmt = scrive.webp ? "webp" : "png"; me.avvisoAlfa = "Ha parti trasparenti: uso " + (scrive.webp ? "WebP" : "PNG") + " per tenerle. Il JPEG le farebbe bianche."; } else me.avvisoAlfa = null;
        me.lato = Math.max(me.src.w, me.src.h) > 2048 ? 2048 : 0;
        me.mis.value = String(me.pctDa(me.lato));
        me.caricando = false; me.codifica(true);
      };
      i.onerror = function () {
        URL.revokeObjectURL(url); me.caricando = false;
        var nome = /hei[cf]/.test(ext) ? "HEIC" : /avif/.test(ext) ? "AVIF" : /tiff?/.test(ext) ? "TIFF" : /svg/.test(ext) ? "SVG" : ext ? ext.toUpperCase() : "questo formato";
        me.errore = "Questo telefono non sa aprire «" + f.name + "» (" + nome + "). Prova con una foto in JPEG, PNG o WebP" + (/hei[cf]/.test(ext) ? ": su iPhone, Impostazioni → Fotocamera → Formati → «Più compatibile»." : ".");
        me.disegna();
      };
      i.src = url;
    },
    /* codificare davvero: il peso che si legge è quello del file che si salva */
    codifica: function (subito) {
      var me = this; if (!me.src) return;
      me.attesa = true; me.disegna();
      clearTimeout(me.t); me.t = setTimeout(function () { me.fai(); }, subito ? 0 : 140);
    },
    fai: function () {
      var me = this, s = me.src, m = me.misura(), f = FORMATI.filter(function (x) { return x.id === me.st.fmt; })[0];
      if (!scrive[f.id] && scrive[f.id] !== null) { f = FORMATI[0]; me.st.fmt = "jpeg"; }
      var giro = ++me.giro || (me.giro = 1);
      var c = me.tela || (me.tela = doc.createElement("canvas"));
      c.width = m.w; c.height = m.h;
      var x = c.getContext("2d");
      if (!f.perde || f.id === "webp") x.clearRect(0, 0, m.w, m.h);
      if (f.id === "jpeg") { x.fillStyle = "#ffffff"; x.fillRect(0, 0, m.w, m.h); }
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
      /* rimpicciolire molto in un colpo solo fa le scalette: si dimezza per gradi */
      var fonte = s.img, fw = s.w, fh = s.h;
      while (fw / 2 > m.w * 1.05 && fh / 2 > m.h * 1.05) {
        var t = doc.createElement("canvas"); t.width = Math.round(fw / 2); t.height = Math.round(fh / 2);
        var tx = t.getContext("2d"); tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = "high"; tx.drawImage(fonte, 0, 0, t.width, t.height);
        fonte = t; fw = t.width; fh = t.height;
      }
      x.drawImage(fonte, 0, 0, m.w, m.h);
      try {
        c.toBlob(function (b) {
          if (giro !== me.giro) return;
          me.attesa = false;
          if (!b) { me.errore = "La tela non è riuscita a scrivere il file (troppo grande per questo telefono?)."; me.disegna(); return; }
          if (b.type !== f.tipo) { scrive[f.id] = false; me.st.fmt = "jpeg"; me.dettaNota = "Questo telefono non sa scrivere " + f.nome + ": uso JPEG."; me.codifica(true); return; }
          if (me.urlOut) URL.revokeObjectURL(me.urlOut);
          me.uscita = { blob: b, w: m.w, h: m.h, f: f, limitata: m.limitata };
          me.urlOut = URL.createObjectURL(b); me.img.src = me.urlOut;
          me.disegna(true);
        }, f.tipo, f.perde ? me.st.q / 100 : undefined);
      } catch (e) { me.attesa = false; me.errore = "La tela non si lascia leggere: riprova con un'altra immagine."; me.disegna(); }
    },
    disegna: function (fatto) { if (this.ctx) this.ctx.aggiorna(fatto ? "img" : "img-attesa"); },
    rendi: function () {
      var me = this, s = me.src, u = me.uscita;
      me.vuoto.hidden = !!s && !me.errore ? true : false;
      me.anteprima.hidden = me.comandi.hidden = !s;
      if (legge.webp !== null) me.dropN.textContent = "Oppure trascinala qui. Apre PNG, JPEG" + (legge.webp ? ", WebP" : "") + (legge.avif ? ", AVIF" : "") + "; scrive PNG" + (scrive.jpeg ? ", JPEG" : "") + (scrive.webp ? ", WebP" : "") + ". Resta sul tuo telefono: niente viene caricato.";
      Array.prototype.forEach.call(me.seg.children, function (b) {
        var id = b.getAttribute("data-f"); b.setAttribute("aria-checked", String(id === me.st.fmt));
        b.setAttribute("aria-disabled", String(scrive[id] === false)); b.classList.toggle("is-no", scrive[id] === false);
      });
      var no = FORMATI.filter(function (f) { return scrive[f.id] === false; }).map(function (f) { return f.nome; });
      me.formNota.textContent = me.dettaNota || me.avvisoAlfa || (no.length ? "Questo telefono non sa scrivere " + no.join(" e ") + "." : "");
      me.dettaNota = null;
      if (me.errore) return { letto: { testo: me.errore, tipo: "errore" }, salvabile: false };
      if (me.caricando) return { letto: { testo: "Apro l'immagine…" }, salvabile: false };
      if (!s) return { letto: { testo: "Scegli un'immagine: la rimpicciolisco, la comprimo, la cambio di formato. Sul telefono." }, salvabile: false, vuoto: true };
      var m = me.misura(), f = FORMATI.filter(function (x) { return x.id === me.st.fmt; })[0];
      me.misT.textContent = m.w + " × " + m.h + " px";
      me.qT.textContent = f.perde ? me.st.q + "%" : "senza perdite";
      me.q.disabled = !f.perde; me.rigaQ.classList.toggle("is-spento", !f.perde); me.q.classList.toggle("is-spento", !f.perde);
      Array.prototype.forEach.call(me.preset.children, function (b) { var v = b.__v; b.disabled = v > 0 && v >= Math.max(s.w, s.h); b.setAttribute("aria-pressed", String(Math.abs(me.pctDa(v) - +me.mis.value) < 0.5)); });
      me.orig.textContent = "Originale: " + s.w + " × " + s.h + " px · " + s.tipo + " · " + kb(s.peso);
      var note = [];
      if (s.alfa && f.id === "jpeg") note.push("Il JPEG non ha trasparenza: dove era trasparente diventa bianco.");
      if (!f.perde) note.push("Il PNG non perde niente: per pesare meno, rimpicciolisci.");
      if (m.limitata) note.push("Più grande di così questo telefono non sa disegnarla: al massimo 16,7 milioni di pixel.");
      note.push("Si salvano solo i pixel, già dritti: luogo, data e modello della foto restano fuori.");
      me.nota.textContent = note.join(" ");
      me.anteprima.classList.toggle("is-attesa", !!me.attesa);
      if (!u) return { letto: { testo: "Calcolo il peso…" }, salvabile: false };
      var diff = u.blob.size - s.peso, pct = Math.round(diff / s.peso * 100);
      me.badge.textContent = u.f.nome + " · " + kb(u.blob.size);
      me.img.alt = "Anteprima: " + u.w + " × " + u.h + " pixel, " + u.f.nome;
      var detto = kb(u.blob.size);
      return {
        main: { segno: "", valore: detto, unita: u.f.nome, copia: detto, detto: detto, parlato: "Il file peserà " + detto + ", " + u.w + " per " + u.h + " pixel" },
        letto: { testo: u.w + " × " + u.h + " px  ·  " + u.f.nome + (u.f.perde ? " " + me.st.q + "%" : "") + "  ·  era " + kb(s.peso) + (pct ? ": " + (pct > 0 ? "+" : "−") + Math.abs(pct) + "%" : ""), tipo: me.attesa ? "attesa" : pct > 0 ? "avviso" : "ok", mono: true },
        come: { f: "", n: "Il peso è quello vero: il file si fa sul tuo telefono a ogni cambio. Per rimpicciolire molto si dimezza per gradi, così i bordi restano puliti." },
        salvabile: !me.attesa, condivisibile: !!(navigator.canShare && G.File && (function () { try { return navigator.canShare({ files: [new File([u.blob], "x." + u.f.ext, { type: u.f.tipo })] }); } catch (e) { return false; } })())
      };
    },
    nomeFile: function () { var u = this.uscita; return this.src.nome + "-" + u.w + "x" + u.h + "." + u.f.ext; },
    salvaFile: function (b) {
      var u = this.uscita; if (!u) return;
      var a = doc.createElement("a"); a.href = this.urlOut; a.download = this.nomeFile(); doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
      CV.bolla(b, "Salvata"); this.ctx.annuncia("Immagine salvata: " + this.nomeFile());
    },
    condividi: function (b) {
      var u = this.uscita; if (!u || !navigator.share) return;
      var f = new File([u.blob], this.nomeFile(), { type: u.f.tipo });
      navigator.share({ files: [f] }).then(function () { CV.bolla(b, "Condivisa"); }, function () {});
    },
    __prove: function () { return { scrive: scrive, legge: legge }; }
  };
})(window);
