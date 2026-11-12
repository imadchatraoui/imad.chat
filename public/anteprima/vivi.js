/* imad.chat — la casa nuova (anteprima): i tre riquadri vivi nuovi. QUESTO FILE È VUOTO DI PROPOSITO: lo riempie il prossimo agente.
   È già collegato in index.html (dopo app.js, vivo.js, gli script di Dot e casa.js), insieme a vivi.css (dopo casa.css).
   Plain script, ES2017 al massimo (niente ?., ??, campi di classe, moduli), nessuna libreria oltre al motore QR già caricato.

   I posti (tutti in index.html, con un testo di riposo dentro che puoi sostituire):
     #qrMini  dentro article.tile.tools[data-tile="tools"]      vetro, 4 colonne × 3 righe sul telefono (4×3 tablet, 4×3 computer)
              ha già pointer-events (classe .vivo--tocca) e data-jsqr = indirizzo di jsQR (250 KB, da caricare solo se serve verify)
     #heat    dentro article.tile.heatmap[data-tile="heatmap"]  inchiostro (--ink-mat), 4×2 telefono, 4×2 tablet, 4×2 computer; .vivo--tocca
     #impara  dentro article.tile.imparando[data-tile="imparando"] inchiostro, 2×2 telefono e tablet, 2×3 computer; tutto il riquadro è
              un link al repo threejs-journey (il .tile__hit sta sotto): qui niente pointer-events
   I riquadri non cambiano misura con i filtri del dock: cambiano posto (viaggiano con una trasformazione). Le misure cambiano solo
   girando il telefono o cambiando schermo: ascolta "resize" (o un ResizeObserver sul contenitore) e ridisegna.
   Dentro i riquadri, .tile__in ha pointer-events: none (tranne i contenitori .vivo--tocca).

   Gli aiuti comuni, in window.IMAD (li definisce app.js):
     IMAD.loop(el, fn)        fn(t) a ogni fotogramma finché el si vede; si ferma da solo a scheda nascosta, durante l'intro e
                              con una pagina aperta sopra la casa. Torna { stop(), start() }. Con «meno movimento» o ?shot=1 non gira:
                              disegna lo stato fermo da te.
     IMAD.onView(el, fn, s)   fn() la prima volta che el entra nello schermo (s = quota visibile, 0..1, di base .35): l'onda dei quadrati
     IMAD.whenFree(fn)        fn() quando la pagina è libera: caratteri pronti e intro finita (l'intro dura circa 7 s a ogni caricamento)
     IMAD.fit(canvas, cap)    adatta la tela alla sua misura CSS: { W, H, dpr } (dpr fino a cap, di base 2), o null se non si vede
     IMAD.api("contributi")   Promise che si risolve SEMPRE: la risposta di /api/github/contributi o { ok: false }. Idem "progetti".
                              Contratti in CASA.md 2b. Senza dati: "si aggiorna tra poco". Mai numeri di esempio.
     IMAD.still()             true con «meno movimento» o ?shot=1 (niente onde, niente rotazioni: lo stato finale subito)
     IMAD.reduced(), IMAD.shot, IMAD.now() (rispetta ?t=), IMAD.isDark(), IMAD.esc(s), IMAD.clamp(v, a, b)
     IMAD.ease.out | inOut | spring | pop    le curve della pagina (spring è una linear() a molla, se il browser la conosce)
     IMAD.sound.play("tap" | "star"), IMAD.sound.on()   (suonano solo se l'interruttore in alto è acceso; solo dopo un tocco)
     IMAD.relayout(sec)       se cambi l'altezza di qualcosa che sposta i riquadri, dillo a Dot
   Il motore QR: window.QRCore (../tools/qr/qr-core.js, con qrcode-generator), istruzioni in cima a quel file.

   I token (style.css, :root; cambiano da soli tra chiaro e scuro):
     colori   --ink --ink-2 --ink-3 (testo), --hair --fill --fill-2 (linee e campiture), --gold --gold-ink (l'oro del punto),
              --clay --clay-a --clay-b (l'accento), --bar-glass --btn-glass (vetri); dentro un riquadro --t-ink e --t-ink-2
              (sull'inchiostro valgono #e3e7f4 e rgba(227,231,244,.64))
     forme    --cell (lato di una cella, px), --gap, --r (raggio dei riquadri), --r-in (raggio concentrico interno), --p, --ps
     caratteri --font-sans (Manrope), --font-mono (Geist Mono); classi .label .title .sub .num (cifre tabellari)
     movimento --ease-out --ease-in-out --spring --d-press
   Regole: testo in italiano, niente corsivo, niente emoji come icone, input a 16 px (l'iPhone non zooma), bersagli da 44 px,
   «meno movimento» rispettato, niente dati inventati. */
