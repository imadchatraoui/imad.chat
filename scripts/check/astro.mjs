// Verifica della matematica dell'astrolabio contro astronomy-engine.
// Uso: node check.mjs   (dalla cartella astro-lab; legge i sorgenti TS di /home/user/imad.chat/lib/astro)
//
// 1. Traspila lib/astro/*.ts in build/ con il compilatore TypeScript del progetto.
// 2. Per 3 stelle e 3 città a un istante UTC fisso: trova quando la stella, sulla rete ruotata
//    da reteAngle(), attraversa il cerchio dell'orizzonte della piastra, e chiede ad astronomy-engine
//    l'altezza in quell'istante (deve essere ~0). Trova quando attraversa il meridiano in alto
//    e controlla che sia il transito (angolo orario 0, azimut sud o nord, altezza 90-|lat-dec|).
//    Controlla est/ovest: sorge a sinistra (x<0, azimut<180), tramonta a destra.
// 3. Controlla che il codice inciso sul retro sia identico alla funzione vera.

import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = "/home/user/imad.chat";
const require = createRequire(join(repo, "package.json"));
const ts = require("typescript");
const aePath = require.resolve("astronomy-engine");
const ae = require("astronomy-engine");

const build = join(here, "build");
mkdirSync(build, { recursive: true });
const modules = ["types", "projection", "time", "sky", "plate", "rete", "qibla", "catalog", "engraving"];
for (const m of modules) {
  const src = readFileSync(join(repo, "lib/astro", m + ".ts"), "utf8");
  let out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText;
  out = out.replace(/from\s+"\.\/([a-z]+)"/g, 'from "./$1.mjs"');
  out = out.replace(/from\s+"astronomy-engine"/g, `from "${pathToFileURL(aePath).href}"`);
  writeFileSync(join(build, m + ".mjs"), out);
}
const imp = (m) => import(pathToFileURL(join(build, m + ".mjs")).href);
const P = await imp("projection");
const T = await imp("time");
const S = await imp("sky");
const PL = await imp("plate");
const R = await imp("rete");
const Q = await imp("qibla");
const E = await imp("engraving");

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) {
    failures++;
    console.log("  FALLITO: " + msg);
  }
};
const f = (x, d = 3) => (x >= 0 ? " " : "") + x.toFixed(d);

// ---- 3. il codice inciso
const timeSrc = readFileSync(join(repo, "lib/astro/time.ts"), "utf8");
console.log("Codice inciso sul retro identico a lib/astro/time.ts:", timeSrc.includes(E.RETE_SOURCE) ? "sì" : "NO");
ok(timeSrc.includes(E.RETE_SOURCE), "RETE_SOURCE non coincide con la funzione in time.ts");

// ---- 2. stelle e città
const date0 = new Date("2026-11-11T18:00:00Z");
const stars = [
  { id: "sirius", name: "Sirio", ra: 6.7525, dec: -16.7161 },
  { id: "vega", name: "Vega", ra: 18.6156, dec: 38.7837 },
  { id: "aldebaran", name: "Aldebaran", ra: 4.5987, dec: 16.5093 },
];
const cities = [
  { id: "torino", lat: 45.0703, lon: 7.6869 },
  { id: "al-quds", lat: 31.7767, lon: 35.2345 },
  { id: "cusco", lat: -13.532, lon: -71.9675 },
];

console.log(`\nIstante di partenza: ${date0.toISOString()}  (obliquità ${P.OBLIQUITY}°, R_eq ${P.R_EQ.toFixed(5)})`);

function platePos(star, city, t) {
  const p0 = P.projectOnRete(star.raD, star.decD);
  return P.rotateClockwise(p0, T.reteAngle(t, city.lon));
}
function aboveHorizon(star, city, plate, t) {
  // distanza con segno dal cerchio dell'orizzonte, positiva nel cielo visibile
  const p = platePos(star, city, t);
  const h = plate.horizon;
  const d = Math.hypot(p.x - h.cx, p.y - h.cy) - h.r;
  return plate.skyInside ? -d : d;
}
function bisect(fn, a, b, iters = 60) {
  let fa = fn(a);
  for (let i = 0; i < iters; i++) {
    const m = new Date((a.getTime() + b.getTime()) / 2);
    const fm = fn(m);
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return new Date((a.getTime() + b.getTime()) / 2);
}
function crossings(fn, start, hours = 24, stepMin = 4) {
  const out = [];
  let prevT = start;
  let prev = fn(prevT);
  for (let m = stepMin; m <= hours * 60; m += stepMin) {
    const t = new Date(start.getTime() + m * 60000);
    const v = fn(t);
    if (Math.sign(v) !== Math.sign(prev)) out.push({ t: bisect(fn, prevT, t), dir: v > prev ? +1 : -1 });
    prevT = t;
    prev = v;
  }
  return out;
}

const bodies = [ae.Body.Star1, ae.Body.Star2, ae.Body.Star3];
console.log("\nOrizzonte: la stella sul cerchio dell'orizzonte della piastra, altezza secondo astronomy-engine (senza rifrazione)");
console.log("città     stella     evento    ora UTC              x piastra  alt AE (°)  az AE (°)  Δt vs SearchAltitude (s)");
for (const city of cities) {
  const plate = PL.plateGeometry(city.lat);
  const obs = new ae.Observer(city.lat, city.lon, 0);
  stars.forEach((s0, i) => {
    const d = S.toDateCoords(s0.ra, s0.dec, date0);
    const star = { ...s0, raD: d.ra, decD: d.dec };
    ae.DefineStar(bodies[i], s0.ra, s0.dec, 1000);
    const cs = crossings((t) => aboveHorizon(star, city, plate, t), date0);
    if (!cs.length) console.log(`${city.id.padEnd(9)} ${s0.name.padEnd(10)} (circumpolare o sempre sotto l'orizzonte)`);
    for (const c of cs) {
      const hor = ae.Horizon(c.t, obs, d.ra, d.dec);
      const p = platePos(star, city, c.t);
      const rising = c.dir > 0;
      const ref = ae.SearchAltitude(bodies[i], obs, rising ? +1 : -1, new Date(c.t.getTime() - 3 * 3600e3), 1, 0);
      const dts = ref ? (c.t.getTime() - ref.date.getTime()) / 1000 : NaN;
      console.log(
        `${city.id.padEnd(9)} ${s0.name.padEnd(10)} ${(rising ? "sorge" : "tramonta").padEnd(9)} ${c.t.toISOString().slice(0, 19)}  ${f(p.x)}     ${f(hor.altitude, 4)}     ${hor.azimuth.toFixed(2).padStart(6)}     ${dts.toFixed(1)}`,
      );
      ok(Math.abs(hor.altitude) < 0.05, `${city.id}/${s0.id}: altezza ${hor.altitude} non ~0`);
      ok(Math.abs(dts) < 20, `${city.id}/${s0.id}: ${dts}s di differenza con SearchAltitude`);
      if (rising) {
        ok(p.x < 0, `${city.id}/${s0.id}: sorge ma non a sinistra (x=${p.x})`);
        ok(hor.azimuth < 180, `${city.id}/${s0.id}: sorge ma azimut ${hor.azimuth}`);
      } else {
        ok(p.x > 0, `${city.id}/${s0.id}: tramonta ma non a destra (x=${p.x})`);
        ok(hor.azimuth > 180, `${city.id}/${s0.id}: tramonta ma azimut ${hor.azimuth}`);
      }
    }
  });
}

console.log("\nMeridiano: la stella sul meridiano in alto della piastra (x=0, y>0) deve essere al transito superiore");
console.log("città     stella     ora UTC              y piastra  alt AE (°)  atteso (°)  az AE (°)  Δt vs SearchHourAngle (s)");
for (const city of cities) {
  const obs = new ae.Observer(city.lat, city.lon, 0);
  stars.forEach((s0, i) => {
    const d = S.toDateCoords(s0.ra, s0.dec, date0);
    const star = { ...s0, raD: d.ra, decD: d.dec };
    ae.DefineStar(bodies[i], s0.ra, s0.dec, 1000);
    // attraversa x=0 da sinistra a destra stando in alto
    const cs = crossings((t) => platePos(star, city, t).x, date0).filter((c) => platePos(star, city, c.t).y > 0 && c.dir > 0);
    for (const c of cs) {
      const hor = ae.Horizon(c.t, obs, d.ra, d.dec);
      const expected = 90 - Math.abs(city.lat - d.dec);
      const ref = ae.SearchHourAngle(bodies[i], obs, 0, new Date(c.t.getTime() - 6 * 3600e3), +1);
      const dts = (c.t.getTime() - ref.time.date.getTime()) / 1000;
      const p = platePos(star, city, c.t);
      console.log(
        `${city.id.padEnd(9)} ${s0.name.padEnd(10)} ${c.t.toISOString().slice(0, 19)}  ${f(p.y)}     ${f(hor.altitude, 3)}    ${f(expected, 3)}    ${hor.azimuth.toFixed(2).padStart(6)}     ${dts.toFixed(1)}`,
      );
      ok(Math.abs(hor.altitude - expected) < 0.05, `${city.id}/${s0.id}: altezza al transito ${hor.altitude} invece di ${expected}`);
      const southOfZenith = d.dec < city.lat;
      const az = hor.azimuth;
      ok(southOfZenith ? Math.abs(az - 180) < 0.1 : Math.min(az, 360 - az) < 0.1, `${city.id}/${s0.id}: azimut al transito ${az}`);
      ok(Math.abs(dts) < 20, `${city.id}/${s0.id}: ${dts}s di differenza con SearchHourAngle`);
    }
  });
}

// ---- la piastra
console.log("\nPiastre:");
for (const city of cities) {
  const plate = PL.plateGeometry(city.lat);
  const h = plate.horizon;
  const eOnEq = Math.hypot(plate.east.x, plate.east.y);
  console.log(
    `${city.id.padEnd(9)} orizzonte c=(${h.cx.toFixed(4)}, ${h.cy.toFixed(4)}) r=${h.r.toFixed(4)}  zenit y=${plate.zenith.y.toFixed(4)}  cielo dentro=${plate.skyInside}  est=(${plate.east.x.toFixed(4)}, ${plate.east.y.toFixed(4)}) |est|=${eOnEq.toFixed(4)} (R_eq ${P.R_EQ.toFixed(4)})  almucantarat ${plate.almucantars.length}  azimut ${plate.azimuths.length}  ore ${plate.hours.length}`,
  );
  ok(Math.abs(eOnEq - P.R_EQ) < 1e-9, "il punto est non sta sull'equatore");
  ok(plate.east.x < 0 && plate.west.x > 0, "est a sinistra, ovest a destra");
  // ogni punto del cerchio dell'orizzonte ha altezza 0
  for (let k = 0; k < 12; k++) {
    const az = k * 30;
    const p = PL.horizonPoint(az, city.lat);
    const r = Math.hypot(p.x, p.y);
    const dec = P.decOfRadius(r);
    const H = Math.atan2(p.x, p.y);
    const back = P.equatorialToHorizontal(H, dec, city.lat);
    ok(Math.abs(back.alt) < 1e-6 && Math.abs(((back.az - az + 540) % 360) - 180) < 1e-6, `${city.id}: punto d'orizzonte az ${az} → alt ${back.alt} az ${back.az}`);
  }
}

// ---- la rete
const reteStars = stars.map((s) => {
  const d = S.toDateCoords(s.ra, s.dec, date0);
  return { id: s.id, ra: d.ra, dec: d.dec, mag: 1 };
});
const design = R.reteDesign(reteStars);
console.log("\nRete: puntatori", design.pointers.map((p) => `${p.id}:${p.kind}`).join(", "));
for (const p of design.pointers) {
  const s = reteStars.find((x) => x.id === p.id);
  const q = P.projectOnRete(s.ra, s.dec);
  const tipOnOutline = p.kind === "hole" || p.outline.some((v) => Math.hypot(v.x - q.x, v.y - q.y) < 1e-9);
  ok(tipOnOutline, `${p.id}: la punta della fiamma non cade sulla stella`);
}
const ecl = P.eclipticCircle();
for (const lon of [0, 90, 180, 270, 45]) {
  const q = P.eclipticPoint(lon);
  ok(Math.abs(Math.hypot(q.x - ecl.cx, q.y - ecl.cy) - ecl.r) < 1e-9, `eclittica: longitudine ${lon} fuori dal cerchio`);
}
// il Sole vero sta sul cerchio dell'eclittica
const sun = S.sunEquatorial(date0);
const sp = P.projectOnRete(sun.ra, sun.dec);
const sunOff = Math.hypot(sp.x - ecl.cx, sp.y - ecl.cy) - ecl.r;
console.log(`Sole il ${date0.toISOString().slice(0, 10)}: AR ${sun.ra.toFixed(4)} h, dec ${sun.dec.toFixed(4)}°, distanza dal cerchio dell'eclittica ${sunOff.toExponential(2)} (unità di piastra)`);
ok(Math.abs(sunOff) < 2e-4, "il Sole non cade sull'eclittica della rete");

// ---- qibla
console.log("\nQibla (azimut iniziale del cerchio massimo verso la Kaʿba, 21.4225 N 39.8262 E):");
for (const [name, lat, lon] of [
  ["Torino", 45.0703, 7.6869],
  ["Al-Quds", 31.7767, 35.2345],
  ["Gaza", 31.5017, 34.4668],
  ["Londra", 51.5074, -0.1278],
  ["Cusco", -13.532, -71.9675],
]) {
  console.log(`  ${name.padEnd(8)} ${Q.qiblaBearing(lat, lon).toFixed(2).padStart(7)}°   ${Q.kaabaDistanceKm(lat, lon).toFixed(0).padStart(6)} km`);
}

// ---- Luna
const mi = S.moonInfo(date0);
console.log(`\nLuna il ${date0.toISOString()}: ${mi.name}, illuminata ${(mi.illuminated * 100).toFixed(1)}%, elongazione ${mi.elongation.toFixed(1)}°`);

console.log(failures ? `\n${failures} controlli FALLITI` : "\nTutti i controlli sono passati.");
process.exit(failures ? 1 : 0);
