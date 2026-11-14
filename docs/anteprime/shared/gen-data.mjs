// Genera shared/data.js dai contenuti verificati del repo. Nessun testo arabo è scritto a mano:
// i versetti arrivano da content/astro/verses.json, le cinque città (con i nomi arabi, etichette di Wikidata) da content/astro/cities.json.
// Uso: node gen-data.mjs <cartella del repository>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(process.argv[2] || ".");
const read = (p) => JSON.parse(fs.readFileSync(path.join(repo, p), "utf8"));

const verses = read("content/astro/verses.json").items.map((v) => ({
  key: v.key, surah: v.surah, surahName: v.surahName, ayahs: v.ayahs, ar: v.ar, it: v.it, translator: v.translator, source: v.source,
}));

// Torino, Gaza, Medina, Makkah, Casablanca: i nomi arabi sono le etichette di Wikidata (arSource), copiate da codice (docs/fonti.md)
const cities = read("content/astro/cities.json").items.map((c) => ({ id: c.id, name: c.name, country: c.country, tz: c.tz, lat: c.lat, lon: c.lon, ar: c.ar, arSource: c.arSource }));

const starsAll = read("content/astro/stars.json").items;
const stars = starsAll.map((s) => ({ id: s.id, name: s.name, ar: s.ar, translit: s.translit, meaning: s.meaning, ra: s.ra, dec: s.dec, mag: s.mag, constellation: s.constellation }));

const curIds = ["stessa-luna", "al-shira", "cielo-arabo", "mole-sinagoga", "il-mare-di-gaza", "raccolta-olive", "kaaba-e-canopo", "prima-qibla", "at-tariq-chi-bussa", "torino-magica"];
const curAll = read("content/astro/curiosities.json").items;
const curiosities = curIds.map((id) => curAll.find((c) => c.id === id)).filter(Boolean).map((c) => ({ id: c.id, title: c.title, text: c.text, tags: c.tags }));

// Saluti: forme comuni e informali di "ciao". L'arabo in caratteri arabi arriverà dal file verificato del sito;
// qui resta la traslitterazione.
const greetings = [
  { lang: "it", label: "italiano", text: "ciao" },
  { lang: "ar-Latn", label: "arabo", text: "salam" },
  { lang: "en", label: "inglese", text: "hello" },
  { lang: "fr", label: "francese", text: "salut" },
  { lang: "es", label: "spagnolo", text: "hola" },
  { lang: "tr", label: "turco", text: "merhaba" },
  { lang: "de", label: "tedesco", text: "hallo" },
  { lang: "pt", label: "portoghese", text: "olá" },
  { lang: "ja", label: "giapponese", text: "こんにちは" },
  { lang: "zh", label: "cinese", text: "你好" },
  { lang: "ko", label: "coreano", text: "안녕" },
  { lang: "hi", label: "hindi", text: "नमस्ते" },
  { lang: "ru", label: "russo", text: "привет" },
  { lang: "sw", label: "swahili", text: "jambo" },
  { lang: "id", label: "indonesiano", text: "halo" },
  { lang: "el", label: "greco", text: "γεια" },
];

// Il codice vero che nel sito calcola l'angolo del cielo (lib/astro/time.ts).
const time = fs.readFileSync(path.join(repo, "lib/astro/time.ts"), "utf8");
const m = time.match(/export function reteAngle[\s\S]*?\n}\n/);
const code = m ? m[0].trim() : "";

// Colori del cubo di Imad (il suo tema "Kukko": pastello, plastica bianca).
const cube = { U: "#ffb6c1", D: "#fdfd96", F: "#ffb347", R: "#77dd77", B: "#aec6cf", L: "#ff6961", plastic: "#ffffff" };

const data = {
  note: "Dati veri per le anteprime. Non modificare a mano: rigenera con gen-data.mjs.",
  kaaba: { lat: 21.4225, lon: 39.8262 },
  cities, verses, stars, curiosities, greetings, code, cube,
  sampleStars: 128, // quanti saluti-stella mostrare come esempio
};

const out = "/* imad.chat — dati per le anteprime (generato, non modificare a mano) */\nwindow.IMAD_DATA = " + JSON.stringify(data, null, 1) + ";\n";
fs.writeFileSync(path.join(here, "data.js"), out);
console.log("data.js", out.length, "byte;", cities.map((c) => c.id + " " + c.ar).join(" | "));
console.log("versetto di prova:", verses[0].key, verses[0].ar === read("content/astro/verses.json").items[0].ar ? "identico" : "DIVERSO");
