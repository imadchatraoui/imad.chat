/* dot-rig.js — lo scheletro di Dot (vedi DOT.md).
   Non disegna nulla e non decide nulla: tiene una posa (numeri), la insegue con dolcezza e la proietta in 2D.
   Il corpo è pensato in uno spazio «quasi 3D» (x in avanti, y in alto, z di lato) con tre rotazioni del corpo
   (yaw: dove guarda il corpo; pitch: muso su o giù; roll: rotola) e tre della testa; poi tutto finisce su un piano.
   È questo che dà profondità al 2D: occhi, orecchie, naso e fez scorrono sulla testa quando gira, le zampe lontane
   finiscono dietro il corpo.
   rig.frame() restituisce il «fotogramma»: solo geometria 2D in unità del modello, origine sul punto a terra sotto
   il gatto, x a destra, y IN ALTO. È il contratto con chi disegna (look-*.js): i campi si possono aggiungere,
   mai rinominare o togliere. Solo ES2017. */
(function () {
  "use strict";
  var DOT = (window.DOT = window.DOT || {});
  var PI = Math.PI;
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sat(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(t, a, b) { return sat((t - a) / (b - a)); }
  function smooth(a, b, x) { var t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function wrap(a) { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; }
  function eIO(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function eOut(u) { return 1 - Math.pow(1 - u, 3); }
  function eBack(u, s) { s = s == null ? 1.7 : s; return 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2); }
  DOT.util = { lerp: lerp, clamp: clamp, sat: sat, seg: seg, smooth: smooth, wrap: wrap, eIO: eIO, eOut: eOut, eBack: eBack };

  /* Dove guarda il corpo (yaw). La cinepresa guarda lungo -z: -PI/2 è «di fronte a chi guarda».
     «di lato» è un tre quarti (0.6), mai un profilo puro: si vedono sempre tutti e due gli occhi. */
  DOT.YAW = { right: -0.6, left: -PI + 0.6, front: -PI / 2, viewRight: -PI / 2 + 0.46, viewLeft: -PI / 2 - 0.46, backRight: PI / 2 - 0.5, backLeft: PI / 2 + 0.5 };

  /* ------------------------------------------------------------------ proporzioni (unità del modello) */
  DOT.PROPS = {
    headRx: 11.6, headRy: 9.8,                                   /* mezza larghezza e mezza altezza della testa vista di fronte */
    headDepth: 9.6,                                              /* mezza profondità: di profilo la testa è un po' meno larga */
    eye: { fwd: 8.3, up: -0.6, side: 4.7, r: 3.5 },
    ear: { fwd: -1.0, up: 6.4, side: 6.0, tipFwd: -1.6, tipUp: 15.4, tipSide: 8.4, w: 4.4 },
    nose: { fwd: 9.9, up: -2.6 }, mouth: { fwd: 9.5, up: -4.6 },
    whisk: { fwd: 8.2, up: -3.0, side: 6.6, len: 6.5 },
    fez: { fwd: -2.2, up: 8.9, h: 8.0, rBase: 4.6, rTop: 3.5, lean: -0.12, tassel: 6.4 },
    chestR: 7.4, hipR: 8.4,
    leg: { len: 10.6, r0: 3.3, r1: 2.6, paw: 3.0, frontSide: 3.6, hindSide: 4.2, frontJx: 1.0, frontJy: -3.6, hindJx: -0.8, hindJy: -3.8 },
    tail: { len: 29, r0: 2.7, r1: 1.7, n: 12, hook: 1, puffW: 0.25, life: 0.3 },   /* hook: 1 = il ricciolo sta verso la punta (0 = come prima); life: la punta si muove piano anche da fermo */
    tilt: 0.12,                                                  /* la cinepresa sta un filo in alto: ciò che è vicino scende */
    gaitT: 0.46, duty: 0.62, stepLift: 3.4,
    bob: 1.1, breath: 0.035, breathLift: 0.9,                    /* su e giù del passo (due volte per ciclo); respiro: raggio e quanto sale il petto */
    faceTurn: 0.4                                                /* di lato la testa si gira un poco verso chi guarda (mai un profilo puro) */
  };

  /* ------------------------------------------------------------------ le pose
     h = fianchi, c = petto, d = testa rispetto al petto; f0..f3 = piedi (0 davanti vicino, 1 davanti lontano,
     2 dietro vicino, 3 dietro lontano) in coordinate del corpo; fs/hs = quanto si allargano di lato le zampe
     davanti/dietro (spalle e piedi insieme); fo/ho = quanto in più si allargano solo i piedi (zampe divaricate); tuck = zampe nascoste sotto il corpo; t* = coda (tby attacco, te alzata, tc ricciolo,
     tw avvolta attorno al corpo, puff gonfia); eye = apertura, lid = palpebra calata, brow = palpebra inclinata
     (arrabbiato); hp/hr = testa su-giù / inclinata; ear = orecchie basse; mouth = bocca; sq = schiacciamento
     del corpo; arch = schiena inarcata; br = respiro; hu = quanto la testa NON segue il rotolare del corpo (0..1). */
  var BASE = { hx: -6, hy: 13.6, cx: 6, cy: 14, dx: 5.5, dy: 8.6, f0x: 7.6, f0y: 0, f1x: 6.4, f1y: 0, f2x: -6.4, f2y: 0, f3x: -7.6, f3y: 0, fs: 0, hs: 0, fo: 0, ho: 0, tuck: 0,
    tby: 2.5, te: 0.75, tc: 0.9, tw: 0, puff: 0, eye: 1, lid: 0, brow: 0, hp: 0, hr: 0, ear: 0, mouth: 0, sqx: 1, sqy: 1, arch: 0, br: 0.3, hu: 0 };
  var KEYS = Object.keys(BASE), FAST = { eye: 1, lid: 1, brow: 1, mouth: 1, ear: 1, puff: 1 };
  function pose(o, from) { var p = {}, k, b = from || BASE; for (k in b) p[k] = b[k]; for (k in o) p[k] = o[k]; return p; }
  var SIT = pose({ hx: -3.6, hy: 8.6, cx: 3.2, cy: 15.2, dx: 2.4, dy: 10.2, f0x: 5.6, f1x: 4.4, f2x: 2.6, f3x: 1.2, tby: -5.6, te: -0.15, tc: 0.15, tw: 1, br: 0.6 });
  /* le pose «da seduto»: si ricostruiscono sopra il «sit» dell'aspetto (makeRig), così un aspetto cambia il seduto una volta sola */
  var FROM_SIT = {
    yawn: { hp: 0.45, mouth: 1, eye: 0, ear: 0.35 },
    annoyed: { ear: 0.7, lid: 0.5, brow: 0.9, te: -0.1, tc: 0.1, tw: 0.35 },
    groom: { f0x: 8.6, f0y: 16, hp: -0.3, eye: 0, dx: 3.4, dy: 9.4 },
    hold: { f0x: 7.2, f0y: 9.5, f1x: 6.4, f1y: 9.2, fs: -0.8, dx: 2.8, dy: 10, hp: -0.12 },
    sip: { f0x: 8.4, f0y: 15.2, f1x: 7.6, f1y: 15, fs: -1.2, hp: 0.22, eye: 0, dx: 2.6, dy: 10.2 },
    bat: { f0x: 13, f0y: 15, hp: 0.12, eye: 1.15, dx: 3, dy: 10 },
    type: { f0x: 9.5, f0y: 4.5, f1x: 8.5, f1y: 5.2, hp: -0.18, dx: 3.2, dy: 9.6 }
  };
  DOT.POSES = {
    stand: pose({}),
    sit: SIT,
    loaf: pose({ hx: -6, hy: 7.6, cx: 5.6, cy: 8, dx: 6.4, dy: 5.6, tuck: 1, tby: -4, te: -0.2, tc: 0.2, tw: 1.5, lid: 0.25, br: 0.8 }),
    sleep: pose({ hx: -6, hy: 7.4, cx: 5.6, cy: 7.6, dx: 7, dy: 3.4, tuck: 1, tby: -4, te: -0.2, tc: 0.2, tw: 1.5, eye: 0, hp: -0.2, hr: 0.12, ear: 0.15, br: 1 }),
    puddle: pose({ hx: -9, hy: 4.6, cx: 8.6, cy: 4.6, dx: 7.6, dy: 4.4, tuck: 1, sqx: 1.2, sqy: 0.62, tby: -1.5, te: -0.05, tc: 0.05, tw: 0.25, eye: 0.8, lid: 0.3, br: 0.9 }),
    stretch: pose({ hx: -6, hy: 16.6, cx: 7.2, cy: 7.4, dx: 7.6, dy: 4.8, f0x: 19, f1x: 17.5, te: 1.35, tc: 0.3, eye: 0.12, hp: 0.3, br: 0.2 }),
    crouch: pose({ hx: -6, hy: 9.2, cx: 6, cy: 9.6, dx: 6, dy: 7.2, tby: 2, te: 0.15, tc: 0.5, hp: 0.08 }),
    wiggle: pose({ hx: -6, hy: 12, cx: 6.6, cy: 7.8, dx: 6.6, dy: 6, f0x: 10, f1x: 8.8, tby: 2.4, te: 0.5, tc: 0.4, eye: 1.15, hp: 0.05 }),
    air: pose({ hx: -7, hy: 13, cx: 7, cy: 14, dx: 6, dy: 8, f0x: 17, f0y: 10, f1x: 15.5, f1y: 9.5, f2x: -16, f2y: 9, f3x: -17.5, f3y: 10, te: 0.15, tc: 0.12 }),
    land: pose({ hx: -6.5, hy: 7.6, cx: 6.5, cy: 8, dx: 6, dy: 6.4, f0x: 9, f1x: 7.8, f2x: -7.6, f3x: -8.8, sqx: 1.08, sqy: 0.9, te: 0.5, tc: 0.6 }),
    startle: pose({ hx: -5, hy: 15.6, cx: 5, cy: 15.2, arch: 4.5, dx: 5, dy: 8.6, f0x: 5.6, f1x: 4.6, f2x: -4.6, f3x: -5.6, tby: 3, te: 1.25, tc: 0.45, puff: 1, eye: 1.3, ear: 0.4 }),
    belly: pose({ hx: -6, hy: 6.6, cx: 6, cy: 6.9, dx: 7, dy: 2.5, f0x: 9, f0y: 4.5, f1x: 6.5, f1y: 5, f2x: -4.5, f2y: 4.5, f3x: -7, f3y: 5, te: -0.1, tc: 0.4, eye: 0.3, lid: 0.3, br: 0.8 }),
    /* preso per la collottola: l'origine è il punto di presa; il corpo pende (rig.long lo allunga: «gatto lungo») */
    held: pose({ hx: -0.5, hy: -21, cx: 1, cy: -9, dx: 3, dy: 8.5, f0x: 5.5, f0y: -17, f1x: 4, f1y: -18, f2x: 3.5, f2y: -32, f3x: 2, f3y: -31, tby: -6, te: -1.35, tc: 0.4, eye: 0.9, lid: 0.35, ear: 0.2 }),
    /* sui bordi: l'origine è sul bordo del riquadro (peek, drape, hang) o sulla faccia del riquadro (slide: le zampe davanti stanno sopra) */
    peek: pose({ hx: 0, hy: -18, cx: 0, cy: -7.5, dx: 0, dy: 13.4, f0x: 1.5, f0y: 1, f1x: 1.5, f1y: 1, fs: 8.6, f2x: 0, f2y: -28, f3x: 0, f3y: -28, tby: -6, te: -1.4, eye: 1.05 }),
    drape: pose({ hx: -7, hy: 5.2, cx: 6.4, cy: 5.4, dx: 7.6, dy: 4.2, f0x: 10.2, f0y: -7.6, f1x: 5, f1y: 2.5, f2x: -3.0, f2y: -6.8, f3x: -6, f3y: 2.5, tby: -1, te: -1.45, tc: -0.4, eye: 0.95, lid: 0.3, hp: 0.04, br: 0.7, sqy: 0.9 }),   /* la testa sta appoggiata sul bordo, non sotto: gli occhi restano interi */
    hang: pose({ hx: 0, hy: -26.5, cx: 0, cy: -8.4, dx: 0.4, dy: -1.6, f0x: 0.6, f0y: 0.9, f1x: 0.6, f1y: 0.9, fs: 2.6, fo: 5.4, f2x: 0.6, f2y: -39.5, f3x: 0.6, f3y: -39.5, hs: -1.2, ho: 0.6, tby: -4, te: -1.3, tc: 0.9, tw: 0.5, eye: 1.15, hp: 0.12, ear: 0.3 }),
    slide: pose({ hx: 0, hy: -16, cx: 0, cy: -7, dx: 0.6, dy: 8.6, f0x: 0.8, f0y: 6, f1x: 0.8, f1y: 6, fs: 2.4, fo: 10, f2x: 0.8, f2y: -22, f3x: 0.8, f3y: -22, hs: 1.5, ho: 8, tby: -6, te: -1.15, tc: 0.6, tw: -0.5, eye: 1.3, ear: 0.4, puff: 0.5 })
  };
  for (var fsn in FROM_SIT) DOT.POSES[fsn] = pose(FROM_SIT[fsn], SIT);
  DOT.FROM_SIT = FROM_SIT;
  /* dove sta la posa rispetto a un bordo (frame.edge), se chi la usa non lo dice */
  var EDGE = { peek: "top", drape: "top", hang: "hang", slide: "face" };
  DOT.pose = pose;

  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k] && typeof a[k] === "object" && !Array.isArray(a[k]) ? merge(a[k], (b && b[k]) || {}) : a[k]; if (b) for (k in b) if (!(k in a) || typeof b[k] !== "object") o[k] = b[k]; return o; }

  /* ------------------------------------------------------------------ lo scheletro */
  DOT.makeRig = function (preset) {
    var P = merge(DOT.PROPS, preset && preset.props), poses = {}, name, pp = (preset && preset.poses) || {};
    for (name in DOT.POSES) poses[name] = pose(pp[name] || {}, DOT.POSES[name]);
    if (pp.sit) for (name in FROM_SIT) poses[name] = pose(pp[name] || {}, pose(FROM_SIT[name], poses.sit));   /* le pose da seduto seguono il «sit» dell'aspetto */
    for (name in pp) if (!poses[name]) poses[name] = pose(pp[name]);
    var A = pose({}, poses.sit), V = {};
    for (name in A) V[name] = 0;
    var rig = {
      P: P, poses: poses, A: A, t: 0,
      pose: "sit", over: {}, rate: 12,                           /* posa voluta; valori forzati (es. { mouth: .8 }); prontezza */
      spring: 0, zeta: 0.78,                                     /* spring 1: le pose si inseguono con una molla (parte piano, arriva con un filo di rimbalzo); 0: come prima */
      poseAs: null, edge: null, eyeMood: null, faceTurn: null,   /* nome da dare alla posa nel fotogramma; bordo; perché gli occhi sono chiusi; giro della testa verso chi guarda (null = P.faceTurn) */
      yaw: DOT.YAW.front, yawT: DOT.YAW.front, turn: 9,          /* dove guarda il corpo */
      pitch: 0, pitchT: 0, roll: 0, rollT: 0, rollPivotY: null,  /* muso su/giù; rotolare (attorno a metà corpo, o a rollPivotY) */
      look: { yaw: 0, pitch: 0, ty: 0, tp: 0 }, headRoll: 0,     /* la testa rispetto al corpo */
      gaze: [{ x: 0, y: 0 }, { x: 0, y: 0 }], gazeT: [{ x: 0, y: 0 }, { x: 0, y: 0 }], pupil: 0.8, pupilT: 0.8,   /* pupille: -1..1; larghezza .2 (fessura) .. 1 (tonda) */
      pupilDot: 0, pupilDotT: 0,                                 /* 1 = pupille piccole e tonde (spavento), indipendente dalla larghezza */
      walk: 0, walkT: 0, speedU: 0, gait: 0, gaitT: null,        /* passo: peso 0..1, velocità in unità al secondo, fase, durata del ciclo (null = P.gaitT) */
      long: 0, longT: 0,                                         /* allungamento del corpo quando è preso */
      fezOn: true, fezRoll: 0,                                   /* il fez è in testa?; inclinazione di lato in più */
      tailSwish: 0, tailRate: 0, grounded: true,                 /* coda: nervosa di quanto, quanto veloce; a terra non buca il suolo */
      autoBlink: true, blink: 1, wx: 0, wy: 0,                   /* wx, wy: posizione nel mondo in unità (serve al fiocco per sentire il movimento) */
      earTwitch: true,                                           /* false: niente scatti d'orecchio a caso (li dà chi guida con rig.earKick) */
      _blinkAt: 2.5, _earAt: 3, _earT: -9, _earSide: 1, _ws: 1, _ta: 0, _tw: 0, _tp: null, _tvx: 0, _dt: 0,
      _yv: 0, _pv: 0, _rv: 0, _lyv: 0, _lpv: 0
    };
    rig.earKick = function (side) { rig._earT = rig.t; rig._earSide = side < 0 ? -1 : 1; };   /* un colpetto d'orecchio adesso */

    /* salta subito a una posa (per le prove e per i tagli netti) */
    rig.snap = function (n) { var p = rig.poses[n] || rig.poses.stand, k; rig.pose = n; for (k in p) { A[k] = rig.over.hasOwnProperty(k) ? rig.over[k] : p[k]; V[k] = 0; } rig.yaw = rig.yawT; rig.pitch = rig.pitchT; rig.roll = rig.rollT; rig.look.yaw = rig.look.ty; rig.look.pitch = rig.look.tp; rig.walk = rig.walkT; rig.long = rig.longT; rig.pupil = rig.pupilT; rig.pupilDot = rig.pupilDotT; rig._yv = rig._pv = rig._rv = rig._lyv = rig._lpv = 0; for (k = 0; k < 2; k++) { rig.gaze[k].x = rig.gazeT[k].x; rig.gaze[k].y = rig.gazeT[k].y; } };

    /* una molla smorzata: x insegue g con velocità v (o è la vecchia rincorsa esponenziale se la molla è spenta) */
    function sp(x, v, g, w, h) { var a = w * w * (g - x) - 2 * rig.zeta * w * v; v += a * h; return [x + v * h, v]; }
    rig.step = function (dt) {
      rig.t += dt; rig._dt += dt;
      var tgt = rig.poses[rig.pose] || rig.poses.stand, k = 1 - Math.exp(-dt * rig.rate), kf = 1 - Math.exp(-dt * rig.rate * 1.8), i, key, v, r, j;
      if (rig.spring) {
        var n = Math.max(1, Math.ceil(dt / 0.0175)), h = dt / n, w0 = rig.rate * 1.35;
        for (j = 0; j < n; j++) for (i = 0; i < KEYS.length; i++) { key = KEYS[i]; v = rig.over.hasOwnProperty(key) ? rig.over[key] : tgt[key]; r = sp(A[key], V[key], v, FAST[key] ? w0 * 1.7 : w0, h); A[key] = r[0]; V[key] = r[1]; }
        for (j = 0; j < n; j++) {
          r = sp(0, rig._yv, wrap(rig.yawT - rig.yaw), rig.turn * 1.3, h); rig.yaw = wrap(rig.yaw + r[0]); rig._yv = r[1];
          r = sp(rig.pitch, rig._pv, rig.pitchT, 14 * 1.3, h); rig.pitch = r[0]; rig._pv = r[1];
          r = sp(rig.roll, rig._rv, rig.rollT, 10 * 1.3, h); rig.roll = r[0]; rig._rv = r[1];
          r = sp(rig.look.yaw, rig._lyv, rig.look.ty, 9 * 1.6, h); rig.look.yaw = r[0]; rig._lyv = r[1];
          r = sp(rig.look.pitch, rig._lpv, rig.look.tp, 9 * 1.6, h); rig.look.pitch = r[0]; rig._lpv = r[1];
        }
      } else {
        for (i = 0; i < KEYS.length; i++) { key = KEYS[i]; v = rig.over.hasOwnProperty(key) ? rig.over[key] : tgt[key]; A[key] = lerp(A[key], v, FAST[key] ? kf : k); }
        rig.yaw += wrap(rig.yawT - rig.yaw) * (1 - Math.exp(-dt * rig.turn));
        rig.pitch = lerp(rig.pitch, rig.pitchT, 1 - Math.exp(-dt * 14));
        rig.roll = lerp(rig.roll, rig.rollT, 1 - Math.exp(-dt * 10));
        var lk = 1 - Math.exp(-dt * 9);
        rig.look.yaw = lerp(rig.look.yaw, rig.look.ty, lk); rig.look.pitch = lerp(rig.look.pitch, rig.look.tp, lk);
      }
      rig.walk = lerp(rig.walk, rig.walkT, 1 - Math.exp(-dt * 10));
      rig.gait = (rig.gait + dt / (rig.gaitT || P.gaitT)) % 1;
      rig.long = lerp(rig.long, rig.longT, 1 - Math.exp(-dt * 8));
      var gk = 1 - Math.exp(-dt * 16);
      for (i = 0; i < 2; i++) { rig.gaze[i].x = lerp(rig.gaze[i].x, rig.gazeT[i].x, gk); rig.gaze[i].y = lerp(rig.gaze[i].y, rig.gazeT[i].y, gk); }
      rig.pupil = lerp(rig.pupil, rig.pupilT, 1 - Math.exp(-dt * 6)); rig.pupilDot = lerp(rig.pupilDot, rig.pupilDotT, 1 - Math.exp(-dt * 10));
      if (rig.autoBlink) { if (rig.t > rig._blinkAt) rig._blinkAt = rig.t + 2.2 + Math.random() * 3.6; var bt = rig._blinkAt - rig.t; rig.blink = bt < 0.16 ? Math.abs(bt - 0.08) / 0.08 : 1; }
      if (rig.earTwitch && rig.t > rig._earAt) { rig._earT = rig.t; rig._earSide = Math.random() < 0.5 ? 1 : -1; rig._earAt = rig.t + 3 + Math.random() * 5; }
      rig._ws = lerp(rig._ws, Math.cos(rig.yaw) >= 0 ? 1 : -1, 1 - Math.exp(-dt * 6));
    };

    rig.frame = function () {
      var L = P.leg, i, sg, q;
      var psi = rig.yaw, cps = Math.cos(psi), sps = Math.sin(psi), cpt = Math.cos(rig.pitch), spt = Math.sin(rig.pitch), cr = Math.cos(rig.roll), sr = Math.sin(rig.roll), tilt = P.tilt;
      /* il passo: i fianchi salgono e scendono due volte per ciclo, il petto un po' dopo e meno, la testa quasi ferma */
      var gph = rig.gait * PI * 4, bob = rig.walk * Math.sin(gph) * P.bob, bobC = rig.walk * Math.sin(gph - 1.1) * P.bob;
      var bph = Math.sin(rig.t * 1.9), br = 1 + A.br * P.breath * bph, lift = A.br * P.breathLift * 0.5 * (1 + bph) * (1 - rig.walk);
      var cx = A.cx, cy = A.cy + bobC * 0.55 + lift, hx = A.hx, hy = A.hy + bob + lift * 0.35;
      var ddx = hx - cx, ddy = hy - cy, dl = Math.sqrt(ddx * ddx + ddy * ddy) || 1, lx = ddx / dl * rig.long, ly = ddy / dl * rig.long;
      hx += lx; hy += ly;
      var yR = rig.rollPivotY == null ? (hy + cy) / 2 : rig.rollPivotY;
      function P3c(x, y, z, c_r, s_r) {                          /* corpo → schermo: [x, y, profondità verso chi guarda] */
        var y0 = y - yR, yr = y0 * c_r - z * s_r, zr = y0 * s_r + z * c_r, y1 = yr + yR;
        var x2 = x * cpt - y1 * spt, y2 = x * spt + y1 * cpt, dp = -x2 * sps + zr * cps;
        return [x2 * cps + zr * sps, y2 - tilt * dp, dp];
      }
      function P3(x, y, z) { return P3c(x, y, z, cr, sr); }
      var qh = P3(hx, hy, 0), qc = P3(cx, cy, 0), o0 = P3(0, 0, 0), o1 = P3(1, 0, 0);
      var body = { hips: { x: qh[0], y: qh[1], r: P.hipR * br }, chest: { x: qc[0], y: qc[1], r: P.chestR * br }, mid: null, sx: A.sqx, sy: A.sqy };
      if (A.arch > 0.05) { q = P3((hx + cx) / 2, (hy + cy) / 2 + A.arch, 0); body.mid = { x: q[0], y: q[1], r: (P.hipR + P.chestR) / 2 }; }

      /* la testa: punti in (avanti, su, lato) della testa → corpo → schermo. Di lato si gira un poco verso chi guarda;
         con hu la testa non segue il rotolare del corpo (a pancia in su il muso resta verso di noi) */
      var ft = rig.faceTurn == null ? P.faceTurn : rig.faceTurn, tv = wrap(-PI / 2 - rig.yaw);
      var HX = cx + A.dx, HY = cy + A.dy + bob * 0.15 + lift * 0.25, hyw = rig.look.yaw + clamp(tv - rig.look.yaw, -ft, ft) * smooth(0.25, 0.9, Math.abs(cps)), hpt = A.hp + rig.look.pitch + rig.walk * 0.03 * Math.sin(gph - 0.6), hrl = A.hr + rig.headRoll;
      var chy = Math.cos(hyw), shy = Math.sin(hyw), chp = Math.cos(hpt), shp = Math.sin(hpt), chr = Math.cos(hrl), shr = Math.sin(hrl);
      var hu = sat(A.hu), rl2 = rig.roll * (1 - hu), cr2 = Math.cos(rl2), sr2 = Math.sin(rl2), hc0 = P3(HX, HY, 0), hc1 = P3c(HX, HY, 0, cr2, sr2);
      function HQ(f, u, s) {
        var u1 = u * chr - s * shr, s1 = u * shr + s * chr, f2 = f * chp - u1 * shp, u2 = f * shp + u1 * chp;
        if (hu < 0.001) return P3(HX + f2 * chy + s1 * shy, HY + u2, -f2 * shy + s1 * chy);
        var w = P3c(HX + f2 * chy + s1 * shy, HY + u2, -f2 * shy + s1 * chy, cr2, sr2);
        return [hc0[0] + w[0] - hc1[0], hc0[1] + w[1] - hc1[1], hc0[2] + w[2] - hc1[2]];
      }
      var hc = P3(HX, HY, 0), qf = HQ(1, 0, 0), qu = HQ(0, 1, 0), qs = HQ(0, 0, 1);
      var head = { x: hc[0], y: hc[1], rx: P.headRx, ry: P.headRy, depth: P.headDepth,
        f: [qf[0] - hc[0], qf[1] - hc[1]], u: [qu[0] - hc[0], qu[1] - hc[1]], s: [qs[0] - hc[0], qs[1] - hc[1]],
        fz: qf[2] - hc[2], uz: qu[2] - hc[2], sz: qs[2] - hc[2] };  /* fz: 1 = guarda chi guarda, 0 = di profilo, -1 = di spalle */

      var e = P.eye, en = Math.sqrt(e.fwd * e.fwd + e.up * e.up + e.side * e.side), eyes = [];
      for (i = 0; i < 2; i++) {
        sg = i ? -1 : 1; q = HQ(e.fwd, e.up, sg * e.side); var qn = HQ(e.fwd / en, e.up / en, sg * e.side / en), nz = qn[2] - hc[2], g = rig.gaze[i];
        eyes.push({ x: q[0], y: q[1], r: e.r, side: sg, nz: nz, vis: smooth(0.1, 0.3, nz), sx: clamp(0.3 + 0.82 * nz, 0.3, 1), open: clamp(A.eye * rig.blink, 0, 1.4), lid: A.lid, brow: A.brow, pupil: { dx: g.x, dy: g.y, w: rig.pupil, dot: sat(rig.pupilDot) } });   /* pupil.dot: 1 = puntino tondo (spavento) */
      }
      var er = P.ear, ears = [], fl = A.ear;
      for (i = 0; i < 2; i++) {
        sg = i ? -1 : 1; var tw = sg === rig._earSide ? Math.max(0, 1 - Math.abs(rig.t - rig._earT) / 0.16) : 0;
        var b = HQ(er.fwd, er.up - 1.2 * fl, sg * (er.side + 0.6 * fl)), tp = HQ(er.tipFwd - 1.2 * fl, er.tipUp - 4.4 * fl - 1.2 * tw, sg * (er.tipSide + 3.8 * fl + 1.6 * tw));
        ears.push({ bx: b[0], by: b[1], tx: tp[0], ty: tp[1], w: er.w, side: sg, depth: b[2] - hc[2], flat: fl });
      }
      var fv = smooth(-0.15, 0.35, head.fz), qno = HQ(P.nose.fwd, P.nose.up, 0), qmo = HQ(P.mouth.fwd, P.mouth.up, 0), wk = P.whisk, whiskers = [];
      var sl2 = Math.sqrt(head.s[0] * head.s[0] + head.s[1] * head.s[1]) || 1;
      for (i = 0; i < 2; i++) { sg = i ? -1 : 1; q = HQ(wk.fwd, wk.up, sg * wk.side); whiskers.push({ x: q[0], y: q[1], dx: head.s[0] * sg, dy: head.s[1] * sg, len: wk.len, side: sg, vis: smooth(-3.5, -0.5, q[2] - hc[2]) * smooth(0.12, 0.4, sl2) }); }

      /* il fez: base e cima proiettate; ell dice quanto si vede il cerchio in cima (0 di taglio, 1 da sopra) */
      var fz = P.fez, fb = HQ(fz.fwd, fz.up, 0), ft = HQ(fz.fwd + fz.h * Math.sin(fz.lean), fz.up + fz.h * Math.cos(fz.lean), fz.h * Math.sin(rig.fezRoll)), fez = null;
      if (rig.fezOn) {
        var pvx = rig.wx + ft[0], dtt = rig._dt;
        if (dtt > 0 && rig._tp != null) { var vx = (pvx - rig._tp) / dtt, ax = clamp((vx - rig._tvx) / dtt, -4000, 4000); rig._tvx = vx; rig._tw += (-81 * Math.sin(rig._ta) - 5 * rig._tw - ax / fz.tassel * Math.cos(rig._ta)) * dtt; rig._ta = clamp(rig._ta + rig._tw * dtt, -1.5, 1.5); }
        rig._tp = pvx;
        var az = (ft[2] - fb[2]) / fz.h, tx0 = ft[0] - fz.rTop * 0.7, ty0 = ft[1];
        fez = { x: fb[0], y: fb[1], tx: ft[0], ty: ft[1], rBase: fz.rBase, rTop: fz.rTop, h: fz.h, ell: clamp(Math.abs(az), 0.08, 1), top: az > 0, depth: fb[2] - hc[2],
          behind: head.uz < -0.25,                                   /* la testa guarda in su: il fez va disegnato sotto il muso */
          cord: { x: ft[0], y: ft[1] },                            /* il centro della cima: da qui parte il cordone del fiocco */
          tassel: { x0: tx0, y0: ty0, x1: tx0 + fz.tassel * Math.sin(rig._ta), y1: ty0 - fz.tassel * Math.cos(rig._ta), ang: rig._ta } };
      } else rig._tp = null;
      rig._dt = 0;

      /* zampe: due ossa uguali; il ginocchio piega all'indietro quando il piede è più vicino della lunghezza */
      var FX = [A.f0x, A.f1x, A.f2x, A.f3x], FY = [A.f0y, A.f1y, A.f2y, A.f3y], PH = [0, 0.5, 0.55, 0.05], legs = [], stride = rig.speedU * (rig.gaitT || P.gaitT) * P.duty;
      for (i = 0; i < 4; i++) {
        var front = i < 2; sg = i % 2 ? -1 : 1;
        var jz = sg * (front ? L.frontSide + A.fs : L.hindSide + A.hs), jx = front ? cx + L.frontJx : hx + L.hindJx, jy = (front ? cy + L.frontJy : hy + L.hindJy);
        var fx = FX[i] + (front ? 0 : lx), fy = FY[i] + (front ? 0 : ly), lift = 0;
        if (rig.walk > 0.01) { var ph = (rig.gait + PH[i]) % 1, ox; if (ph < P.duty) ox = stride * (0.5 - ph / P.duty); else { var u = (ph - P.duty) / (1 - P.duty); ox = stride * (-0.5 + eIO(u)); lift = Math.sin(PI * u) * P.stepLift; } fx += rig.walk * ox; fy += rig.walk * lift; }
        fx = lerp(fx, jx + (front ? 2.5 : -1), A.tuck); fy = lerp(fy, jy - 1.5, A.tuck);
        var ex = fx - jx, ey = fy - jy, d = Math.sqrt(ex * ex + ey * ey), kx, ky;
        if (d >= L.len || d < 0.001) { kx = (jx + fx) / 2; ky = (jy + fy) / 2; } else { var a = Math.acos(d / L.len), bb = Math.atan2(ey, ex) - a; kx = jx + L.len / 2 * Math.cos(bb); ky = jy + L.len / 2 * Math.sin(bb); }
        var fz2 = jz + sg * (front ? A.fo : A.ho), qj = P3(jx, jy, jz), qk = P3(kx, ky, (jz + fz2) / 2), qft = P3(fx, fy, fz2), rs = 1 - 0.85 * A.tuck;
        legs.push({ jx: qj[0], jy: qj[1], kx: qk[0], ky: qk[1], fx: qft[0], fy: qft[1], r0: L.r0 * rs, r1: L.r1 * rs, paw: L.paw * rs, front: front, side: sg, depth: qj[2], near: jz * cps > 0.3 || qj[2] > 2.5 || Math.abs(cps) < 0.25, up: front && qft[1] > hc[1], tuck: A.tuck, lift: lift * rig.walk });   /* near: davanti al corpo; up: zampa alzata sopra la testa (va disegnata davanti alla testa) */
      }

      /* coda: una linea di punti; può avvolgersi attorno al corpo dal lato di chi guarda */
      var T = P.tail, n = T.n, pts = [], px = hx - (P.hipR - 0.2), py = hy + A.tby, pz = 0, seglen = T.len / (n - 1), floor = rig.grounded ? T.r1 : -1e4, dsum = 0, dn = 0;
      for (i = 0; i < n; i++) {
        var s = i / (n - 1), sway = (0.14 + 0.3 * rig.walk + rig.tailSwish) * Math.sin(rig.t * (1.5 + 3.5 * rig.walk + rig.tailRate) - s * 2.4) * s;
        var hk = T.hook == null ? 0 : T.hook, curl = lerp(s * 1.7, s * s * 2.4, hk), tip = (T.life || 0) * smooth(0.5, 1, s) * Math.sin(rig.t * 1.05 - s * 1.8);   /* la punta si arriccia piano, sempre */
        var el = A.te + A.tc * curl + sway * (1 - 0.6 * sat(A.tw)) + tip, hd = PI - rig._ws * A.tw * 2.55 * s + (A.tw > 0.2 ? sway * 0.5 + tip * 0.6 : 0);
        q = P3(px, Math.max(floor, py), pz); pts.push({ x: q[0], y: q[1], r: lerp(T.r0, T.r1, s) * (1 + (T.puffW == null ? 0.55 : T.puffW) * A.puff) }); if (s > 0.6) { dsum += q[2]; dn++; }
        px += seglen * Math.cos(el) * Math.cos(hd); py += seglen * Math.sin(el); pz += seglen * Math.cos(el) * Math.sin(hd);
      }

      return {
        t: rig.t, P: P, yaw: rig.yaw, fwd: [o1[0] - o0[0], o1[1] - o0[1]], facing: o1[2] - o0[2],   /* fwd: verso dove punta il corpo sullo schermo; facing > 0 = verso chi guarda */
        body: body, head: head, eyes: eyes, ears: ears,
        nose: { x: qno[0], y: qno[1], vis: fv }, mouth: { x: qmo[0], y: qmo[1], open: A.mouth, vis: fv }, whiskers: whiskers,
        fez: fez, fezSeat: { x: (fb[0] + ft[0]) / 2, y: (fb[1] + ft[1]) / 2 },   /* dove sta il centro del fez in testa (anche quando è per terra) */
        legs: legs, tail: { pts: pts, front: dn ? dsum / dn > 1 : false, puff: A.puff },
        hold: { x: (legs[0].fx + legs[1].fx) / 2, y: (legs[0].fy + legs[1].fy) / 2 },                 /* dove sta un oggetto tenuto tra le zampe davanti */
        mood: { lid: A.lid, brow: A.brow, ear: A.ear, puff: A.puff, eye: A.eye, closed: closedMood() }, walk: rig.walk, long: rig.long, breath: br,
        pose: rig.poseAs || rig.pose,                                                                 /* il nome della posa voluta (es. "hang", "slide") */
        edge: rig.edge !== null && rig.edge !== undefined ? rig.edge : EDGE[rig.poseAs || rig.pose] || null,   /* "top" | "hang" | "face" | null */
        roll: rig.roll
      };
    };
    /* occhi chiusi: perché? "sleep" (arco in giù), "happy" (fusa, sorso: arco in su), "blink"; null se sono aperti */
    function closedMood() {
      var o = A.eye * rig.blink; if (o > 0.14) return null;
      if (rig.eyeMood) return rig.eyeMood;
      if (rig.blink < 0.6 && A.eye > 0.3) return "blink";
      return rig.pose === "sleep" || rig.pose === "loaf" ? "sleep" : "happy";
    }
    return rig;
  };
})();
