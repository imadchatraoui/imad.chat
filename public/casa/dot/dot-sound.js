/* Dot, i suoni. DOT.sound = { meow(), purr(on), muted, setMuted(bool) }.
   Suona solo dopo un tocco diretto sul gatto: va chiamato dentro il gesto.
   Web Audio: un solo AudioContext, creato o ripreso al primo gesto (iOS lo vuole).
   I file si scaricano e si decodificano solo quando servono.
   Non lancia mai errori: senza audio, con un file mancante o un decode rifiutato, tace.
   Percorso dei file: DOT.mediaBase se c'e', altrimenti data-media (o data-dot-media) dello strato .dot-clip, altrimenti "media/".
   Un file che non arriva si riprova se il percorso cambia o dopo 30 s. ES2017, niente librerie. */
(function () {
  'use strict';
  var DOT = (window.DOT = window.DOT || {});

  var VOLUME = 0.35;          // volume dei miao
  var PURR_VOLUME = 0.22;     // le fusa ancora piu' piano
  var MEOWS = ['miao-1', 'miao-2', 'miao-3'];
  var PURR = 'fusa';

  var ctx = null;
  var master = null;
  var buffers = {};           // nome -> AudioBuffer
  var loading = {};           // nome -> true mentre si scarica
  var failed = {};            // nome -> { base, t } se il file non e' arrivato: si riprova se cambia DOT.mediaBase o dopo 30 s
  var RETRY_MS = 30000;
  var last = -1;              // ultimo miao scelto
  var purrNode = null;        // { src, gain } finche' le fusa girano
  var wantPurr = false;

  var sound = {
    muted: false,
    meow: meow,
    purr: purr,
    setMuted: setMuted
  };
  DOT.sound = sound;

  // base dei file
  // DOT.mediaBase, oppure l'attributo data-media dello strato di Dot (.dot-clip), letto al momento: cosi' anche un
  // tocco che arriva prima di DOT.start (durante l'intro) cerca i file nel posto giusto
  function base() {
    var b = DOT.mediaBase;
    if (typeof b !== 'string' || !b) {
      try { var el = document.querySelector('.dot-clip[data-media], [data-dot-media]'); if (el) b = el.getAttribute('data-dot-media') || el.getAttribute('data-media'); } catch (e) {}
    }
    if (typeof b !== 'string' || !b) b = 'media/';
    if (b.charAt(b.length - 1) !== '/') b += '/';
    return b;
  }

  // crea o riprende il contesto; torna null se non c'e' l'audio
  function wake() {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = sound.muted ? 0 : 1;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended' && ctx.resume) {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
      return ctx;
    } catch (e) {
      ctx = null;
      return null;
    }
  }

  // Safari vecchi preferiscono m4a; gli altri vanno bene con entrambi
  function pickExt() {
    try {
      var a = document.createElement('audio');
      if (a.canPlayType && a.canPlayType('audio/mp4; codecs="mp4a.40.2"')) return 'm4a';
    } catch (e) {}
    return 'mp3';
  }

  function fetchBuf(url, ok, ko) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.responseType = 'arraybuffer';
      x.onload = function () {
        if ((x.status === 200 || x.status === 0) && x.response && x.response.byteLength) ok(x.response);
        else ko();
      };
      x.onerror = ko;
      x.send();
    } catch (e) { ko(); }
  }

  function decode(data, ok, ko) {
    try {
      var done = false;
      var good = function (b) { if (!done) { done = true; ok(b); } };
      var bad = function () { if (!done) { done = true; ko(); } };
      // la forma con le callback va anche sui Safari vecchi; la promessa e' un di piu'
      var p = ctx.decodeAudioData(data, good, bad);
      if (p && p.then) p.then(good, bad);
    } catch (e) { ko(); }
  }

  // carica un file (prima m4a o mp3 a seconda del browser, poi l'altro)
  // un file che non e' arrivato non si richiede di continuo, ma nemmeno si abbandona per sempre: se la pagina
  // imposta DOT.mediaBase dopo il primo gesto (il primo tentativo cercava nella cartella sbagliata) o dopo 30 s, si riprova
  function gaveUp(name) {
    var f = failed[name];
    if (!f) return false;
    if (f.base !== base() || Date.now() - f.t > RETRY_MS) { delete failed[name]; return false; }
    return true;
  }
  function load(name, then) {
    if (buffers[name] || loading[name] || !ctx || gaveUp(name)) return;
    loading[name] = true;
    var b0 = base();
    var first = pickExt();
    var second = first === 'm4a' ? 'mp3' : 'm4a';
    var fin = function (b) {
      loading[name] = false;
      if (b) buffers[name] = b; else failed[name] = { base: b0, t: Date.now() };
      if (b && then) then(b);
    };
    var tryExt = function (ext, next) {
      fetchBuf(b0 + name + '.' + ext, function (data) {
        decode(data, function (b) { fin(b); }, function () { next(); });
      }, function () { next(); });
    };
    tryExt(first, function () { tryExt(second, function () { fin(null); }); });
  }

  // prepara i buffer in anticipo (si puo' chiamare al primo tocco)
  function warm() {
    if (!wake()) return;
    for (var i = 0; i < MEOWS.length; i++) load(MEOWS[i]);
  }

  function pickMeow() {
    var ready = [];
    for (var i = 0; i < MEOWS.length; i++) if (buffers[MEOWS[i]]) ready.push(i);
    if (!ready.length) return -1;
    var pool = ready.filter(function (i) { return i !== last; });
    if (!pool.length) pool = ready;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function playMeow(i) {
    try {
      var src = ctx.createBufferSource();
      src.buffer = buffers[MEOWS[i]];
      // altezza un po' a caso, piu' o meno 6 per cento
      src.playbackRate.value = 1 + (Math.random() * 0.12 - 0.06);
      var g = ctx.createGain();
      g.gain.value = VOLUME;
      src.connect(g);
      g.connect(master);
      src.start(0);
      last = i;
    } catch (e) {}
  }

  function meow() {
    try {
      if (sound.muted) return;
      if (!wake()) return;
      var i = pickMeow();
      if (i >= 0) { playMeow(i); return; }
      // primo tocco: i file non ci sono ancora; si scarica e suona appena pronto
      var started = false;
      var go = function () {
        if (started || sound.muted) return;
        var k = pickMeow();
        if (k >= 0) { started = true; playMeow(k); }
      };
      for (var n = 0; n < MEOWS.length; n++) load(MEOWS[n], go);
    } catch (e) {}
  }

  function startPurr() {
    try {
      if (purrNode || !ctx || !buffers[PURR] || sound.muted) return;
      var src = ctx.createBufferSource();
      src.buffer = buffers[PURR];
      src.loop = true;
      var g = ctx.createGain();
      var t = ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(PURR_VOLUME, t + 0.25);  // sale piano
      src.connect(g);
      g.connect(master);
      src.start(0);
      purrNode = { src: src, gain: g };
    } catch (e) { purrNode = null; }
  }

  function stopPurr() {
    var n = purrNode;
    purrNode = null;
    if (!n) return;
    try {
      var t = ctx.currentTime;
      n.gain.gain.cancelScheduledValues(t);
      n.gain.gain.setValueAtTime(n.gain.gain.value, t);
      n.gain.gain.linearRampToValueAtTime(0, t + 0.3);       // scende piano
      n.src.stop(t + 0.35);
    } catch (e) {
      try { n.src.stop(0); } catch (e2) {}
    }
  }

  function purr(on) {
    try {
      wantPurr = !!on;
      if (!wantPurr) { stopPurr(); return; }
      if (sound.muted || !wake()) return;
      if (buffers[PURR]) { startPurr(); return; }
      load(PURR, function () { if (wantPurr) startPurr(); });
    } catch (e) {}
  }

  function setMuted(v) {
    try {
      sound.muted = !!v;
      if (master && ctx) master.gain.value = sound.muted ? 0 : 1;
      if (sound.muted) stopPurr();
      else if (wantPurr) purr(true);
    } catch (e) {}
  }

  // al primo gesto sul documento si sveglia l'audio e si scaricano i miao
  function onFirst() {
    try { warm(); } catch (e) {}
    ['touchend', 'pointerdown', 'click'].forEach(function (t) {
      document.removeEventListener(t, onFirst, true);
    });
  }
  try {
    ['touchend', 'pointerdown', 'click'].forEach(function (t) {
      document.addEventListener(t, onFirst, true);
    });
  } catch (e) {}
})();
