/* main.js — l'anteprima. Tutto si comanda dall'indirizzo, così ogni fotogramma si può rifare uguale:
   ?t=6.2            il tempo della sequenza, in secondi (senza: la sequenza scorre da sola e si tocca, vedi tocco.js)
   ?stile=tastiera|macchina    ?tema=scuro|chiaro    ?ora=22.2 (l'ora di «adesso», 0..24)
   ?vista=storia|due|pezzi|contatto|fermo  (fermo: la macchina finita e la zona contatto, come con «riduci movimento»)
   ?cam=largo|banco|finita|contatto|bottone|faccia   forza l'inquadratura     ?nudo=1  senza scritte     ?dpr=2 */
import { creaScena } from './scena.js';
import { creaStoria, T, FATTORE } from './storia.js';
import { seg, sat } from './forme.js';
import { avviaTocco } from './tocco.js';

const q = new URLSearchParams(location.search), tema = q.get('tema') === 'chiaro' ? 'chiaro' : 'scuro', stile = q.get('stile') === 'macchina' ? 'macchina' : 'tastiera';
let vista = q.get('vista') || 'storia';
if (matchMedia('(prefers-reduced-motion: reduce)').matches && !q.get('t') && vista === 'storia') vista = 'fermo';
document.documentElement.dataset.tema = tema;
const el = { c: document.getElementById('c'), cielo: document.documentElement, voce: document.getElementById('voce'), contatto: document.getElementById('contatto'), campo: document.getElementById('campo') };
const due = (n) => (n < 10 ? '0' : '') + n;

async function avvia() {
  try { await Promise.all([document.fonts.load('800 40px Manrope'), document.fonts.load('700 20px Manrope'), document.fonts.load('500 12px "Geist Mono"'), document.fonts.load('600 12px "Geist Mono"')]); } catch (e) { /* senza i caratteri si va avanti lo stesso */ }
  const sc = creaScena(el.c, { tema, dpr: q.get('dpr') ? +q.get('dpr') : undefined, ombre: q.get('ombre') ? +q.get('ombre') : undefined, toni: q.get('toni'), riflesso: q.get('riflesso') !== '0' });
  const st = creaStoria(sc, { ora: q.get('ora') ? +q.get('ora') : undefined });
  let tav = null;
  if (vista !== 'storia') { const m = await import('./tavole.js'); tav = m.creaTavole(sc, st, { stile, vista, q }); }
  window.__sc = sc; window.__st = st;

  function scritte(info) {
    if (q.get('nudo')) { el.voce.style.opacity = 0; el.contatto.style.opacity = 0; return; }
    const t = info.t, o = ((info.ora % 24) + 24) % 24, hh = Math.floor(o), mm = Math.floor((o - hh) * 60);
    const parte = o < 5.5 || o >= 21 ? 'NOTTE' : o < 8 ? 'ALBA' : o < 12 ? 'MATTINA' : o < 17 ? 'POMERIGGIO' : 'SERA';
    el.voce.style.opacity = info.fermo ? 0 : Math.min(seg(t, T.fuori, T.fuori + 0.25), 1 - seg(t, T.cavo, T.cavo + 0.5));
    el.voce.innerHTML = 'TIMELAPSE <b>×' + FATTORE + '</b><i></i>' + due(hh) + ':' + due(mm) + '<i></i>' + parte;
    const c = info.fermo ? 1 : Math.min(seg(t, T.contatto + 0.45, T.contatto + 0.9), 1 - seg(t, T.bottone, T.bottone + 0.3));
    el.contatto.style.opacity = c; el.contatto.style.transform = 'translateY(' + (1 - sat(c)) * 14 + 'px)';
    if (info.macchina) { document.getElementById('campoBox').style.display = 'none'; document.getElementById('riga').textContent = 'Scrivi. La macchina batte sul foglio.'; }
    const txt = info.testo || '';
    if (txt) { el.campo.className = ''; el.campo.textContent = txt; el.campo.appendChild(document.createElement('u')); } else { el.campo.className = 'vuoto'; el.campo.textContent = 'Scrivi qualcosa'; }
  }
  const camq = (s) => { const v = s.split(',').map(Number); return { tx: v[0], ty: v[1], tz: v[2], larg: v[3], alt: 0, pitch: v[4] == null ? 0.9 : v[4], su: 0 }; };   /* ?camq=tx,ty,tz,larghezza,inclinazione: un'inquadratura libera */
  function render(t, extra) {
    sc.misura();
    const info = tav ? tav.applica(t, extra) : st.applica(t, Object.assign({ cielo: el.cielo, cam: q.get('camq') ? camq(q.get('camq')) : q.get('cam') ? st.CAM[q.get('cam')] : null }, extra));
    if (extra && extra.testo != null) info.testo = extra.testo;      /* quello che ha scritto chi guarda (tocco.js) */
    if (extra && extra.prima) extra.prima(info);                      /* un ultimo ritocco ai pezzi prima di disegnare (il bottone premuto) */
    scritte(info); sc.disegna(); return info;
  }
  window.__render = (t, extra) => { render(t, extra); return true; };
  if (q.get('t') != null || vista !== 'storia') { render(q.get('t') != null ? +q.get('t') : vista === 'contatto' ? 16.6 : T.contatto); }
  else avviaTocco({ sc, st, T, render });   /* la sequenza scorre da sola fino a «Contattami» e si lascia toccare: tocco.js */
  addEventListener('resize', () => { if (q.get('t') != null) render(+q.get('t')); });
  window.__pronto = true;
}
avvia().catch((e) => { console.error(e); window.__errore = String(e && e.stack || e); });
