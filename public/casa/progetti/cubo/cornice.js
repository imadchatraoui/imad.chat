/* imad.chat — il cubo: la cornice intorno al gioco di Imad («The Cube» di Boris Šehovac, gioco/cube.js, copiato così com'è).
   Due cose. Chi apre il gioco per la prima volta lo trova nei colori Kukko (il gioco, da solo, parte dal tema «Cube»); chi ha già
   scelto un tema lo ritrova: le preferenze restano quelle che il gioco salva da sé (localStorage, chiavi theCube_*). Usa le funzioni
   del gioco stesso: themes.setTheme, il cursore «Color Scheme» delle preferenze, storage.savePreferences.
   E se il gioco non è partito (senza WebGL, o con la memoria del sito bloccata il suo costruttore si ferma e window.game non c'è),
   una riga quieta al centro invece di una pagina vuota.
   Viene subito dopo gioco/cube.js (che crea window.game); window.cuboPrimaVolta lo scrive lo script in testa a index.html, prima
   che il gioco legga le preferenze. Plain script, ES2017 al massimo. */
(function () {
  "use strict";
  var g = window.game;
  if (!g) { var guasto = document.getElementById("cbGuasto"); if (guasto) guasto.hidden = false; return; }
  if (!window.cuboPrimaVolta || !g.themes || !g.preferences || !g.storage) return;
  try {
    var fondo = g.dom && g.dom.back;
    if (fondo) fondo.style.transition = "none";   /* niente dissolvenza dal grigio del tema «Cube» al verde menta di Kukko */
    g.themes.setTheme("kukko");
    var r = g.preferences.ranges && g.preferences.ranges.theme;
    if (r && r.setValue) r.setValue(1);            /* Cube, Kukko, Dust, Camo, Rain: il secondo */
    g.storage.savePreferences();
    if (fondo) { void fondo.offsetWidth; fondo.style.transition = ""; }
  } catch (e) { /* se un giorno il gioco cambia queste funzioni, resta il suo tema di partenza */ }
})();
