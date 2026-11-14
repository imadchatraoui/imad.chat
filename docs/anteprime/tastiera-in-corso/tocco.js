/* tocco.js — l'anteprima si tocca (solo nella vista che scorre: senza ?t= e senza ?vista=).
   - Il tempo: trascina su e giù sulla scena (su = avanti, come scorrere la pagina), la rotella, la barra in basso, ferma/vai, da capo.
     Da sola la sequenza va fino alla zona «Contattami» e lì aspetta chi guarda; con «vai» riparte e si ferma al bottone rosso.
   - «Contattami»: un tocco su un tasto 3D lo abbassa e scrive la sua lettera; il campo è vero (apre la tastiera del telefono) e ogni
     lettera scritta abbassa il suo tasto; «Invia» non manda niente, e lo dice.
   - Il bottone rosso: si preme (la cupola scende), il bordo lampeggia due volte al secondo per un secondo e mezzo, la scena trema
     mezzo secondo, e una riga dice che cosa succederà qui. Lo smontaggio del sito non è ancora disegnato. */
import { tastoDi } from './parti.js';

export function avviaTocco({ sc, st, T, render }) {
  const THREE = sc.THREE, doc = document, canvas = sc.renderer.domElement, $ = (id) => doc.getElementById(id);
  const ui = { vai: $('vai'), ico: $('vaiIco'), barra: $('barra'), barraI: $('barraI'), barraB: $('barraB'), capo: $('capo'), aiuto: $('aiuto'), vero: $('vero'), invia: $('invia'), box: $('campoBox'), riga: $('riga'), allarme: $('allarme'), dopo: $('dopo') };
  const SOSTA = T.contatto + 1.05;          /* la zona contatto è entrata: qui la sequenza aspetta */
  const POSATO = 20.95;                      /* il bottone è sul banco */
  const RIGA = 'Scrivi qui. I tasti si muovono con te.';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ora = () => performance.now() / 1000;
  let tt = 0, va = true, prima = 0, sostaFatta = false, fineDetta = false, utente = null, premutoA = -9, allarmeA = -9, drag = null, trascinato = false, rigaT = 0;
  doc.documentElement.classList.add('tocca');

  const dico = (s) => { ui.aiuto.textContent = s || ''; ui.aiuto.classList.toggle('su', !!s); };
  const inContatto = () => tt >= T.contatto + 0.8 && tt < T.bottone;
  setTimeout(() => { if (!trascinato && tt < SOSTA) dico('Trascina su e giù per andare avanti e indietro'); }, 1400);
  setTimeout(() => { if (!trascinato && tt < SOSTA) dico(''); }, 7000);

  /* ---- che cosa c'è sotto il dito: il bottone rosso, un tasto, o niente (allora il dito trascina il tempo) */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), v = new THREE.Vector3();
  function sulloSchermo(o, r) { o.getWorldPosition(v).project(sc.camera); return { x: (v.x + 1) / 2 * r.width + r.left, y: (1 - v.y) / 2 * r.height + r.top }; }
  function colpisci(x, y) {
    const r = canvas.getBoundingClientRect(); ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, sc.camera);
    const b = sc.P.bottone;
    if (tt >= POSATO && b && b.visible) { if (ray.intersectObject(b, true).length) return { bottone: true }; const p = sulloSchermo(b, r); if (Math.hypot(p.x - x, p.y - y) < 36) return { bottone: true }; }
    if (inContatto()) {
      const h = ray.intersectObjects(sc.P.caps, false); if (h.length && h[0].object.userData.tasto.code) return { tasto: h[0].object.userData.tasto };
      let best = null, bd = 26;                                   /* il dito è più largo di un tasto: vale il tasto più vicino */
      for (const m of sc.P.caps) { const k = m.userData.tasto; if (!k.code) continue; const p = sulloSchermo(m, r), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = k; } }
      if (best) return { tasto: best };
    }
    return null;
  }

  /* ---- scrivere: dai tasti 3D, dalla tastiera vera, dal campo (la tastiera del telefono) */
  function rigaPerUnPo(s) { ui.riga.textContent = s; clearTimeout(rigaT); rigaT = setTimeout(() => { ui.riga.textContent = RIGA; }, 3200); }
  function invia() { const n = ora(); st.premi('enter', n); setTimeout(() => st.lascia('enter', ora()), 110); rigaPerUnPo(utente ? 'Per ora non parte niente: è un’anteprima.' : 'Prima scrivi qualcosa.'); }
  function batti(code, daCampo) {
    st.premi(code, ora());
    if (daCampo) { setTimeout(() => st.lascia(code, ora()), 95); return; }
    if (utente == null) utente = '';
    if (code === 'backspace') utente = utente.slice(0, -1); else if (code === 'enter') { invia(); return; } else if (code.length === 1 && utente.length < 36) utente += code;
    ui.vero.value = utente;
  }
  ui.vero.addEventListener('input', () => {
    const val = ui.vero.value, era = utente || ''; utente = val;
    if (val.length > era.length) { const ch = val.slice(-1).toLowerCase(); if (tastoDi(ch)) batti(ch, true); } else if (val.length < era.length) batti('backspace', true);
  });
  ui.vero.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); invia(); } });
  ui.invia.addEventListener('click', invia);
  addEventListener('keydown', (e) => {
    if (e.target === ui.vero || e.metaKey || e.ctrlKey || e.altKey) return; const k = e.key.toLowerCase();
    if (inContatto() && (k === 'backspace' || k === 'enter' || (k.length === 1 && tastoDi(k)))) { if (!e.repeat) batti(k); e.preventDefault(); return; }
    if (k === ' ') { va = !va; e.preventDefault(); } else if (k === 'arrowright' || k === 'arrowleft') { va = false; tt = clamp(tt + (k === 'arrowright' ? 0.1 : -0.1), 0, T.fine); }
  });
  addEventListener('keyup', (e) => { if (e.target !== ui.vero) st.lascia(e.key.toLowerCase(), ora()); });

  /* la tastiera del telefono copre mezza pagina: la scena si stringe nella parte che resta in vista */
  const vv = window.visualViewport;
  function adatta() { if (!vv) return; const chiusa = vv.height > innerHeight - 120; canvas.style.height = chiusa ? '' : Math.round(vv.height) + 'px'; if (!chiusa) scrollTo(0, 0); }
  if (vv) { vv.addEventListener('resize', adatta); vv.addEventListener('scroll', adatta); }
  ui.vero.addEventListener('blur', () => setTimeout(adatta, 80));

  /* ---- il bottone rosso */
  function premiBottone() {
    const n = ora(); premutoA = n; if (n - allarmeA < 2.2) return; allarmeA = n;
    ui.allarme.classList.remove('va'); canvas.classList.remove('trema'); void ui.allarme.offsetWidth;
    ui.allarme.classList.add('va'); canvas.classList.add('trema'); ui.dopo.classList.add('su'); dico('');
  }
  function dopoStoria() {                                         /* dopo che la storia ha messo i pezzi, prima di disegnare */
    const b = sc.P.bottone, c = b && b.userData.cupola; if (!c) return;
    const u = (ora() - premutoA) / 0.36, giu = drag && drag.bott ? 1 : u < 0 || u > 1 ? 0 : u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8;
    c.position.y = 0.74 - 0.2 * giu;
  }

  /* ---- il dito sulla scena */
  canvas.addEventListener('pointerdown', (e) => {
    if (drag) return; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fa lo stesso */ }
    const hit = colpisci(e.clientX, e.clientY); drag = { id: e.pointerId, y: e.clientY, mosso: 0, tasto: null, bott: false };
    if (hit && hit.bottone) { drag.bott = true; premiBottone(); } else if (hit && hit.tasto) { drag.tasto = hit.tasto.code; batti(hit.tasto.code); }
    if (doc.activeElement === ui.vero && !(hit && hit.tasto)) ui.vero.blur();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || drag.tasto || drag.bott) return; const dy = e.clientY - drag.y; drag.y = e.clientY; drag.mosso += Math.abs(dy);
    if (drag.mosso > 6) { va = false; trascinato = true; tt = clamp(tt - dy / Math.max(320, innerHeight) * 9, 0, T.fine); if (ui.aiuto.textContent.indexOf('Trascina') === 0) dico(''); }
  });
  const su = (e) => { if (!drag || e.pointerId !== drag.id) return; if (drag.tasto) st.lascia(drag.tasto, ora()); if (drag.bott) premutoA = ora() - 0.072; drag = null; };
  canvas.addEventListener('pointerup', su); canvas.addEventListener('pointercancel', su);
  addEventListener('wheel', (e) => { va = false; trascinato = true; tt = clamp(tt + e.deltaY / 700, 0, T.fine); }, { passive: true });

  /* ---- i comandi in basso */
  ui.vai.addEventListener('click', () => { if (tt >= T.fine - 0.02) daCapo(); else { va = !va; if (va) dico(''); } });
  function daCapo() { tt = 0; va = true; sostaFatta = false; fineDetta = false; utente = null; ui.vero.value = ''; ui.dopo.classList.remove('su'); ui.riga.textContent = RIGA; dico(''); }
  ui.capo.addEventListener('click', daCapo);
  let sullaBarra = false;
  const barraA = (e) => { const r = ui.barra.getBoundingClientRect(); tt = clamp((e.clientX - r.left) / r.width, 0, 1) * T.fine; va = false; trascinato = true; };
  ui.barra.addEventListener('pointerdown', (e) => { sullaBarra = true; try { ui.barra.setPointerCapture(e.pointerId); } catch (err) { /* fa lo stesso */ } barraA(e); });
  ui.barra.addEventListener('pointermove', (e) => { if (sullaBarra) barraA(e); });
  ui.barra.addEventListener('pointerup', () => { sullaBarra = false; }); ui.barra.addEventListener('pointercancel', () => { sullaBarra = false; });
  function comandi() {
    const p = tt / T.fine * 100; ui.barraI.style.width = p + '%'; ui.barraB.style.left = p + '%'; ui.barra.setAttribute('aria-valuenow', Math.round(p));
    const fermo = !va; if (ui.vai.dataset.f !== String(fermo)) { ui.vai.dataset.f = String(fermo); ui.ico.setAttribute('d', fermo ? 'M8 5v14l11-7z' : 'M7 5h4v14H7zM13 5h4v14h-4z'); ui.vai.setAttribute('aria-label', fermo ? 'Vai' : 'Ferma'); }
    ui.box.style.pointerEvents = inContatto() ? 'auto' : 'none';
    if (!inContatto() && doc.activeElement === ui.vero) ui.vero.blur();
    if (tt < POSATO) ui.dopo.classList.remove('su');
  }

  /* ---- il giro */
  let nF = 0, mediaF = 0, livello = 0;                          /* quanto dura un fotogramma: se il telefono arranca, la scena si alleggerisce */
  function giro(now) {
    const passo = prima ? now - prima : 0, dt = Math.min(0.12, passo / 1000); prima = now;
    if (passo > 0 && passo < 1000 && !doc.hidden && ++nF > 20) { mediaF += (passo - mediaF) / Math.min(nF - 20, 30);
      if (nF > 65 && mediaF > 34 && livello < 2 && sc.qualita) { livello++; sc.qualita(livello); nF = 0; mediaF = 0; } }
    if (va && !(drag && !drag.tasto && !drag.bott && drag.mosso > 6)) {
      tt += dt;
      if (!sostaFatta && tt >= SOSTA) { tt = SOSTA; va = false; sostaFatta = true; dico('Tocca i tasti, o scrivi nel campo'); }
      if (tt >= T.fine) { tt = T.fine; va = false; if (!fineDetta) { fineDetta = true; dico('Non premere il bottone rosso'); } }
    }
    render(tt, { ora: ora(), testo: utente, prima: dopoStoria });
    comandi(); requestAnimationFrame(giro);
  }
  requestAnimationFrame(giro);
  window.__tocco = { get livello() { return livello; }, get ms() { return Math.round(mediaF); }, get t() { return tt; }, set t(x) { tt = clamp(x, 0, T.fine); va = false; }, get va() { return va; }, vai() { va = true; }, testo: () => utente, colpisci };
}
