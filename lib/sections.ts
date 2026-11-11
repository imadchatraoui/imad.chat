// Le sezioni del sito: i file Markdown di content/sezioni/, ciascuno inciso come un segno sul lembo
// graduato dell'astrolabio. Solo lato server (legge il filesystem).
//
// Frontmatter:
//   title    il titolo                                   (obbligatorio; altrimenti il nome del file)
//   order    la posizione nel menu                        (predefinito: dopo le altre)
//   anchor   a cosa si lega sull'astrolabio: "cielo", "tariq", "qibla", "retro", "citta:<id>"
//   summary  una riga per il menu
//   angle    gradi sul lembo, da 0 in alto (sotto il trono) in senso orario (facoltativo:
//            senza, le sezioni si distribuiscono a intervalli uguali)
//
// I file che iniziano con "_" sono modelli e non vengono pubblicati.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { AstroSection } from "@/lib/astro/types";

export interface SectionMeta {
  /** Il nome del file senza .md. */
  id: string;
  title: string;
  order: number;
  /** Il legame con lo strumento, es. "tariq" o "citta:al-quds"; vuoto se non c'è. */
  anchor: string;
  summary: string;
  /** Gradi sul lembo (0 in alto, senso orario), già risolti. */
  angle: number;
}

export interface Section extends SectionMeta {
  /** Il corpo in Markdown, con i segnaposto {{verse:CHIAVE}}. */
  body: string;
}

const DIR = path.join(process.cwd(), "content", "sezioni");

let cache: Section[] | null = null;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function normalizeAngle(a: number): number {
  const r = a % 360;
  return r < 0 ? r + 360 : r;
}

function readAll(): Section[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  } catch {
    return [];
  }
  const raw = files.map((file) => {
    const id = file.replace(/\.md$/, "");
    const { data, content } = matter(fs.readFileSync(path.join(DIR, file), "utf8"));
    return {
      id,
      title: str(data.title) || id,
      order: num(data.order) ?? Number.MAX_SAFE_INTEGER,
      anchor: str(data.anchor),
      summary: str(data.summary),
      fixedAngle: num(data.angle),
      body: content.trim(),
    };
  });
  raw.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "it"));
  // a intervalli uguali, sfalsati di mezzo passo: nessun segno cade sotto il trono, a 0°
  const step = 360 / Math.max(1, raw.length);
  return raw.map(({ fixedAngle, ...s }, i) => ({
    ...s,
    angle: normalizeAngle(fixedAngle ?? (i + 0.5) * step),
  }));
}

/** Tutte le sezioni, nell'ordine del frontmatter. In sviluppo rilegge i file a ogni chiamata. */
export function getSections(): Section[] {
  if (process.env.NODE_ENV !== "production") return readAll();
  if (!cache) cache = readAll();
  return cache;
}

export function getSection(id: string): Section | undefined {
  return getSections().find((s) => s.id === id);
}

/** Le sezioni senza il corpo: quanto serve al menu. */
export function sectionMetas(list: readonly Section[] = getSections()): SectionMeta[] {
  return list.map(({ body: _body, ...meta }) => meta);
}

/** I segni da incidere sul lembo dell'astrolabio (prop `sections` di <Astrolabe />). */
export function sectionAnchors(list: readonly SectionMeta[] = getSections()): AstroSection[] {
  return list.map((s) => ({ id: s.id, title: s.title, angle: s.angle }));
}
