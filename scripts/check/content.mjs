// Validate content/astro/*.json and content/sezioni/*.md against the shared schema (lib/astro/types.ts).
// Usage: node validate.mjs /home/user/imad.chat
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repo = path.resolve(process.argv[2] || '.');
const require = createRequire(path.join(repo, 'package.json'));
const matter = require('gray-matter');
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const load = (f) => JSON.parse(fs.readFileSync(path.join(repo, 'content/astro', f), 'utf8'));
const isStr = (v) => typeof v === 'string';
const nonEmpty = (v) => isStr(v) && v.trim().length > 0;
const isUrl = (v) => isStr(v) && /^https:\/\/[^\s]+$/.test(v);
const AR = /^[ء-ي ]+$/; // unvocalised Arabic letters and spaces only
const words = (t) => t.replace(/[’']/g, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const HTML = /<[^>]+>|foot_note|&[a-z]+;/i;

function exactKeys(where, obj, keys) {
  const k = Object.keys(obj);
  for (const key of keys) if (!(key in obj)) fail(where, `missing field ${key}`);
  for (const key of k) if (!keys.includes(key)) fail(where, `unexpected field ${key}`);
}
function topLevel(file, d) {
  if ('placeholder' in d) fail(file, 'placeholder key still present');
  const extra = Object.keys(d).filter((k) => k !== 'items');
  if (extra.length) fail(file, `unexpected top-level keys ${extra}`);
  if (!Array.isArray(d.items) || !d.items.length) fail(file, 'items must be a non-empty array');
}
function sources(where, s, min = 1) {
  if (!Array.isArray(s) || s.length < min) return fail(where, 'sources must be a non-empty array');
  s.forEach((u) => { if (!isUrl(u)) fail(where, `bad source ${u}`); });
  if (new Set(s).size !== s.length) fail(where, 'duplicate sources');
}

// ---------- verses
const verses = load('verses.json');
topLevel('verses.json', verses);
const VKEYS = ['86:1-3', '53:49', '16:16', '6:97', '67:5', '37:6', '10:5', '36:38-40', '55:5', '2:144'];
const verseKeys = new Set();
verses.items.forEach((v, i) => {
  const w = `verses[${i}] ${v.key}`;
  exactKeys(w, v, ['key', 'surah', 'surahName', 'ayahs', 'ar', 'it', 'translator', 'source']);
  const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(v.key || '');
  if (!m) return fail(w, 'bad key');
  const s = +m[1], a0 = +m[2], a1 = m[3] ? +m[3] : a0;
  if (v.surah !== s) fail(w, 'surah does not match key');
  const exp = Array.from({ length: a1 - a0 + 1 }, (_, k) => a0 + k);
  if (JSON.stringify(v.ayahs) !== JSON.stringify(exp)) fail(w, `ayahs ${v.ayahs} != ${exp}`);
  if (!nonEmpty(v.surahName)) fail(w, 'surahName empty');
  if (!nonEmpty(v.ar) || !/[؀-ۿ]/.test(v.ar) || v.ar !== v.ar.trim()) fail(w, 'ar empty, not Arabic or untrimmed');
  if (/[A-Za-z<>]/.test(v.ar)) fail(w, 'ar contains Latin or markup');
  if (!nonEmpty(v.it) || HTML.test(v.it)) fail(w, 'it empty or contains HTML/footnote');
  if (/\s[,.;:!?]/.test(v.it)) fail(w, 'space before punctuation in it');
  if (!/^Hamza Roberto Piccardo( \(testo Tanzil\))?$/.test(v.translator || '')) fail(w, `unexpected translator ${v.translator}`);
  // Quran.com's page, or for the two ayahs taken from Tanzil's it.piccardo (10:5, 67:5) Tanzil's own link to that ayah
  const fromTanzil = v.translator === 'Hamza Roberto Piccardo (testo Tanzil)';
  if (fromTanzil && !['10:5', '67:5'].includes(v.key)) fail(w, 'only 10:5 and 67:5 use the Tanzil text');
  const okSource = fromTanzil ? v.source === `https://tanzil.net/#trans/it.piccardo/${v.key}` : isUrl(v.source) && v.source.startsWith('https://quran.com/');
  if (!okSource) fail(w, `bad source ${v.source}`);
  verseKeys.add(v.key);
});
VKEYS.forEach((k) => { if (!verseKeys.has(k)) fail('verses.json', `missing ${k}`); });
if (verseKeys.size !== verses.items.length) fail('verses.json', 'duplicate keys');
// 86:1-3 must contain the three ayahs (two words each for 1 and 3, four for 2)
const tariq = verses.items.find((v) => v.key === '86:1-3');
if (tariq && tariq.ar.split(' ').length !== 8) fail('verses 86:1-3', `expected 8 words, got ${tariq.ar.split(' ').length}`);

// ---------- stars
const stars = load('stars.json');
topLevel('stars.json', stars);
const SKEYS = ['id', 'name', 'latin', 'ar', 'translit', 'meaning', 'ra', 'dec', 'mag', 'constellation', 'pointer', 'quran', 'note', 'sources'];
const ids = new Set();
stars.items.forEach((s, i) => {
  const w = `stars[${i}] ${s.id}`;
  exactKeys(w, s, SKEYS);
  if (!/^[a-z][a-z0-9-]*$/.test(s.id || '')) fail(w, 'bad id');
  if (ids.has(s.id)) fail(w, 'duplicate id');
  ids.add(s.id);
  for (const k of ['name', 'latin', 'translit', 'meaning', 'constellation', 'note']) if (!nonEmpty(s[k])) fail(w, `${k} empty`);
  if (!isStr(s.ar) || (s.ar !== '' && !AR.test(s.ar))) fail(w, `ar must be unvocalised Arabic or empty: ${s.ar}`);
  if (!(Number.isFinite(s.ra) && s.ra >= 0 && s.ra < 24)) fail(w, 'ra out of range');
  if (!(Number.isFinite(s.dec) && s.dec >= -90 && s.dec <= 90)) fail(w, 'dec out of range');
  if (!(Number.isFinite(s.mag) && s.mag > -2 && s.mag < 5)) fail(w, 'mag out of range');
  if (typeof s.pointer !== 'boolean') fail(w, 'pointer not boolean');
  if (!(s.quran === null || /^\d+:\d+(-\d+)?$/.test(s.quran))) fail(w, 'quran must be a verse key or null');
  if (s.quran && !verseKeys.has(s.quran)) fail(w, `quran ${s.quran} not in verses.json`);
  if (s.note.split(/(?<=[.!?»])\s+(?=[A-ZÀ-ÖÈÉ«])/u).length > 2) fail(w, 'note longer than 2 sentences');
  sources(w, s.sources, 2);
});
const pointers = stars.items.filter((s) => s.pointer).length;
if (stars.items.length < 38 || stars.items.length > 45) fail('stars.json', `expected about 40 stars, got ${stars.items.length}`);
if (pointers < 20 || pointers > 24) fail('stars.json', `expected 20-24 pointers, got ${pointers}`);
const sirius = stars.items.find((s) => s.id === 'sirius');
if (!sirius || sirius.quran !== '53:49') fail('stars.json', 'sirius must have quran 53:49');
for (const need of ['aldebaran', 'rigel', 'betelgeuse', 'sirius', 'procyon', 'regulus', 'spica', 'arcturus', 'antares', 'vega', 'altair', 'deneb',
  'fomalhaut', 'capella', 'pollux', 'castor', 'algol', 'alphard', 'alphecca', 'mirfak', 'alkaid', 'dubhe', 'polaris', 'markab', 'scheat',
  'alpheratz', 'rasalhague', 'diphda', 'achernar', 'canopus', 'menkar', 'alcyone']) {
  if (!ids.has(need)) fail('stars.json', `missing required star ${need}`);
}

// ---------- cities
const cities = load('cities.json');
topLevel('cities.json', cities);
const CKEYS = ['id', 'name', 'nameLocal', 'country', 'lat', 'lon', 'tz', 'motif', 'blurb', 'facts', 'sources'];
const MOTIFS = ['liberty', 'tatreez', 'sea', 'zellige', 'iznik', 'girih', 'seigaiha', 'inca'];
const CITY_ORDER = ['torino', 'al-quds', 'gaza', 'fes', 'istanbul', 'samarcanda', 'kyoto', 'cusco'];
if (JSON.stringify(cities.items.map((c) => c.id)) !== JSON.stringify(CITY_ORDER)) fail('cities.json', 'ids/order differ from CITY_ORDER');
cities.items.forEach((c, i) => {
  const w = `cities[${i}] ${c.id}`;
  exactKeys(w, c, CKEYS);
  for (const k of ['name', 'country', 'blurb']) if (!nonEmpty(c[k])) fail(w, `${k} empty`);
  if (!isStr(c.nameLocal)) fail(w, 'nameLocal must be a string');
  if (!(Number.isFinite(c.lat) && Math.abs(c.lat) <= 90 && Number.isFinite(c.lon) && Math.abs(c.lon) <= 180)) fail(w, 'bad lat/lon');
  try { new Intl.DateTimeFormat('it-IT', { timeZone: c.tz }).format(new Date()); } catch { fail(w, `invalid tz ${c.tz}`); }
  if (!MOTIFS.includes(c.motif)) fail(w, `bad motif ${c.motif}`);
  const sentences = c.blurb.split(/(?<=[.!?»])\s+(?=[A-ZÀ-ÖÈÉ«])/u).length;
  if (sentences < 2 || sentences > 3) fail(w, `blurb has ${sentences} sentences`);
  if (!Array.isArray(c.facts) || c.facts.length < 2 || c.facts.length > 4 || !c.facts.every(nonEmpty)) fail(w, 'facts must be 2-4 strings');
  sources(w, c.sources);
});

// ---------- curiosities
const cur = load('curiosities.json');
topLevel('curiosities.json', cur);
const cids = new Set();
cur.items.forEach((c, i) => {
  const w = `curiosities[${i}] ${c.id}`;
  exactKeys(w, c, ['id', 'title', 'text', 'tags', 'sources']);
  if (!/^[a-z0-9-]+$/.test(c.id || '') || cids.has(c.id)) fail(w, 'bad or duplicate id');
  cids.add(c.id);
  if (!nonEmpty(c.title) || !nonEmpty(c.text)) fail(w, 'title/text empty');
  if (words(c.text) > 60) fail(w, `text has ${words(c.text)} words`);
  if (!Array.isArray(c.tags) || !c.tags.length || !c.tags.every((t) => /^[a-z0-9-]+$/.test(t))) fail(w, 'tags must be lowercase slugs');
  sources(w, c.sources);
});
if (cur.items.length < 28 || cur.items.length > 36) fail('curiosities.json', `expected about 30 items, got ${cur.items.length}`);

// ---------- no Arabic outside the fields meant for it
for (const [file, d, allowed] of [['stars.json', stars, ['ar']], ['cities.json', cities, ['nameLocal']], ['curiosities.json', cur, []]]) {
  d.items.forEach((it) => {
    for (const [k, v] of Object.entries(it)) {
      const s = JSON.stringify(v).replace(/https?:[^"]+/g, '');
      if (!allowed.includes(k) && /[؀-ۿ]/.test(s)) fail(`${file} ${it.id}`, `Arabic script in field ${k}`);
    }
  });
}

// ---------- sezioni
const dir = path.join(repo, 'content/sezioni');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
const ANCHORS = new Set(['cielo', 'tariq', 'qibla', 'retro', 'null']);
const wanted = { 'Il cielo di adesso': 'cielo', 'At-Tariq': 'tariq', 'Verso la qibla': 'qibla', 'Palestina': 'citta:al-quds', 'Torino': 'citta:torino', 'Il retro: il codice': 'retro' };
const seen = {};
const orders = new Set();
files.forEach((f) => {
  const w = `sezioni/${f}`;
  const { data, content } = matter(fs.readFileSync(path.join(dir, f), 'utf8'));
  exactKeys(w, data, ['title', 'order', 'anchor', 'summary']);
  if (!nonEmpty(data.title) || !nonEmpty(data.summary)) fail(w, 'title/summary empty');
  if (!Number.isInteger(data.order) || orders.has(data.order)) fail(w, 'order must be a unique integer');
  orders.add(data.order);
  const a = data.anchor;
  const cityOk = isStr(a) && a.startsWith('citta:') && CITY_ORDER.includes(a.slice(6));
  if (!(a === null || ANCHORS.has(a) || cityOk)) fail(w, `bad anchor ${a}`);
  seen[data.title] = a;
  const refs = [...content.matchAll(/\{\{verse:([^}]+)\}\}/g)].map((m) => m[1]);
  refs.forEach((r) => { if (!verseKeys.has(r)) fail(w, `verse placeholder ${r} not in verses.json`); });
  if (/[؀-ۿ]/.test(content)) fail(w, 'Arabic script in body (verses must be placeholders)');
  const text = content.replace(/\{\{verse:[^}]+\}\}/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const n = words(text);
  if (n < 80 || n > 200) fail(w, `body has ${n} words`);
  console.log(`  ${f}: order ${data.order}, anchor ${a}, ${n} words, verses [${refs}]`);
});
for (const [t, a] of Object.entries(wanted)) if (seen[t] !== a) fail('sezioni', `missing section "${t}" with anchor ${a}`);

console.log(`verses ${verses.items.length}, stars ${stars.items.length} (${pointers} pointers), cities ${cities.items.length}, curiosities ${cur.items.length}, sezioni ${files.length}`);
if (errors.length) { console.error(errors.join('\n')); console.error(`FAILED: ${errors.length} problems`); process.exit(1); }
console.log('ALL CHECKS PASSED');
