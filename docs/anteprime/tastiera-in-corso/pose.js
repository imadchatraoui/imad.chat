/* pose.js — le pose di lavoro di Dot per la macchina da scrivere. Sono aggiunte al nostro scheletro attraverso l'interfaccia
   pubblica (rig.poses + DOT.pose): niente di ../gatto/ viene toccato. Le prime erano composte dal seduto e si leggevano male:
   queste partono dal gatto in piedi sulle zampe di dietro («ritto») o piegato in avanti, e sono pensate di profilo, di tre
   quarti e di spalle (lo sguardo del corpo lo sceglie la storia: Y.right, Y.viewRight, Y.backLeft…). */
export function aggiungiPose(P, pose) {
  P.ritto = pose({ hx: -2.6, hy: 9.4, cx: 1.6, cy: 19.4, dx: 2.4, dy: 9.6, f0x: 7.4, f0y: 12.5, f1x: 6.2, f1y: 12, f2x: -1.2, f3x: -3.4, tby: -3, te: 0.5, tc: 0.7 }, P.stand);
  P.porta = pose({ f0x: 8.6, f0y: 14.5, f1x: 7.6, f1y: 14.5, fs: 0.7, hp: -0.12 }, P.ritto);                       /* porta un pezzo con due zampe, davanti al petto */
  P.portaSu = pose({ f0x: 4.5, f0y: 30, f1x: 3.5, f1y: 30, fs: 1.6, hp: 0.25, eye: 1.1 }, P.ritto);                /* lo porta sopra la testa (i pezzi lunghi) */
  P.martSu = pose({ f0x: 1, f0y: 30, f1x: 8, f1y: 8, cy: 20, hp: 0.12, eye: 1.12 }, P.ritto);                      /* il martello alzato */
  P.martGiu = pose({ f0x: 11.5, f0y: 7, f1x: 7, f1y: 9, cx: 3.4, cy: 17.6, hp: -0.34, eye: 0.85 }, P.ritto);       /* il colpo */
  P.avvitaA = pose({ hx: -5.5, hy: 10.5, cx: 4.2, cy: 14, dx: 5, dy: 7.6, f0x: 10.4, f0y: 8.5, f1x: 9.6, f1y: 12, f2x: -5, f3x: -7, hp: -0.4, hr: 0.1 }, P.stand);   /* chino sul cacciavite, due zampe sul manico */
  P.avvitaB = pose({ f0x: 9.8, f0y: 12, f1x: 10.2, f1y: 8.5, hr: -0.1 }, P.avvitaA);                               /* le zampe si scambiano: gira */
  P.olia = pose({ f0x: 11.5, f0y: 9.5, fo0: 1, hp: -0.34, hr: 0.14, eye: 0.82, lid: 0.15, dx: 3.2, dy: 9.2 }, P.sit);   /* una goccia d'olio, con attenzione */
  P.soffia = pose({ hx: -6.5, hy: 10, cx: 5.6, cy: 9, dx: 7.4, dy: 5.6, f0x: 9.5, f1x: 8.2, mouth: 0.55, eye: 0.2, lid: 0.3, ear: 0.35, hp: 0.1, te: 0.9 }, P.stand);   /* soffia via la polvere */
  P.spinge = pose({ hx: -8, hy: 9.4, cx: 5, cy: 11.6, dx: 6, dy: 6.2, f0x: 13, f0y: 6.5, f1x: 12, f1y: 8, f2x: -11, f3x: -13.5, hp: -0.18, ear: 0.35, eye: 0.7, brow: 0.3, te: 1.0, tc: 0.3 }, P.stand);   /* spinge un pezzo pesante */
  P.tira = pose({ hx: -6.5, hy: 8.6, cx: 0.5, cy: 17, dx: 1, dy: 9.4, f0x: 8.5, f0y: 13.5, f1x: 7.5, f1y: 12.5, f2x: -1, f3x: -4, hp: 0.2, eye: 0.8, ear: 0.3, te: 0.2 }, P.stand);   /* tira (il nastro) */
  P.gira = pose({ f0x: 9.5, f0y: 19, fo0: 1.5, f1x: 6.4, f1y: 11, hp: 0.08, hr: 0.16, eye: 1.1 }, P.ritto);         /* una zampa sulla manopola, in alto */
  P.gira2 = pose({ f0x: 10.5, f0y: 14.5, hr: 0.05 }, P.gira);                                                      /* … e in basso: ha girato */
  P.scuote = pose({ f0x: 10.5, f0y: 17, fo0: 4, pad: 1, hp: 0.05, hr: -0.2, eye: 0.6, brow: 0.5, ear: 0.4 }, P.sit);   /* scuote la zampa sporca d'inchiostro */
  P.tocca = pose({ hy: 8.2, cy: 12.6, cx: 3.6, dx: 2.6, dy: 8.4, f0x: 9.6, f0y: -7.5, fo0: 4.2, f1x: 5.2, f1y: 0, hp: -0.4, hr: 0.16, eye: 1.12 }, P.sit);   /* prova un tasto con una zampa sola */
  return ['ritto', 'porta', 'portaSu', 'martSu', 'martGiu', 'avvitaA', 'avvitaB', 'olia', 'soffia', 'spinge', 'tira', 'gira', 'gira2', 'scuote', 'tocca'];
}
