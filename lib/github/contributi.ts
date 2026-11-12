// Il calendario dei contributi: funzioni pure (niente rete, niente Next), provate da scripts/check/github.mjs.
//
// Due fonti:
// - con un token, la GraphQL API: user(login) { contributionsCollection { contributionCalendar { ... } } };
// - senza, il frammento HTML pubblico https://github.com/users/<utente>/contributions: le celle hanno
//   data-date e data-level, i conteggi stanno nei tooltip che puntano all'id della cella
//   ("3 contributions on November 4th.", "No contributions on ..."), il titolo dice
//   "N contributions in the last year". Si legge senza librerie HTML e senza contare sull'ordine degli attributi.

import type { ContributiOk, Esito, Giorno } from "./types";

/** Un calendario vero copre un anno (53 settimane): meno di così vuol dire che abbiamo letto altro. */
export const MIN_GIORNI = 300;

const LIVELLI: Record<string, number> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(s: unknown): s is string {
  if (typeof s !== "string" || !DATA.test(s)) return false;
  const t = Date.parse(s + "T00:00:00Z");
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}

function intero(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

/** Ordina per data e toglie i doppioni (tiene il primo). */
function ordina(giorni: Giorno[]): Giorno[] {
  const visti = new Set<string>();
  const out: Giorno[] = [];
  for (const g of giorni) {
    if (visti.has(g.d)) continue;
    visti.add(g.d);
    out.push(g);
  }
  out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return out;
}

// ---------------------------------------------------------------- GraphQL

export const QUERY_CALENDARIO =
  "query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } } } } }";

/** La risposta (già JSON) della GraphQL API → giorni e totale. */
export function parseGraphql(json: unknown): Esito<{ days: Giorno[]; total: number | null }> {
  if (!json || typeof json !== "object") return { ok: false, error: "graphql: risposta non è un oggetto" };
  const j = json as { data?: unknown; errors?: unknown };
  if (Array.isArray(j.errors) && j.errors.length) {
    const e = j.errors[0] as { type?: unknown; message?: unknown };
    const msg = [typeof e.type === "string" ? e.type : "", typeof e.message === "string" ? e.message : ""]
      .filter(Boolean)
      .join(": ")
      .slice(0, 160);
    return { ok: false, error: "graphql errors: " + (msg || "sconosciuto") };
  }
  const user = (j.data as { user?: unknown } | undefined)?.user;
  if (user === null) return { ok: false, error: "graphql: utente non trovato" };
  const cal = (user as { contributionsCollection?: { contributionCalendar?: unknown } } | undefined)
    ?.contributionsCollection?.contributionCalendar as { totalContributions?: unknown; weeks?: unknown } | undefined;
  if (!cal || !Array.isArray(cal.weeks)) return { ok: false, error: "graphql: manca contributionCalendar.weeks" };

  const giorni: Giorno[] = [];
  let scartati = 0;
  for (const w of cal.weeks) {
    const days = (w as { contributionDays?: unknown }).contributionDays;
    if (!Array.isArray(days)) continue;
    for (const raw of days) {
      const day = raw as { date?: unknown; contributionCount?: unknown; contributionLevel?: unknown };
      const n = intero(day.contributionCount);
      let l = typeof day.contributionLevel === "string" ? LIVELLI[day.contributionLevel] : undefined;
      if (l === undefined && n === 0) l = 0;
      if (!dataValida(day.date) || n === null || l === undefined) {
        scartati++;
        continue;
      }
      giorni.push({ d: day.date, n, l });
    }
  }
  const days = ordina(giorni);
  const info = { giorni: days.length, scartati };
  if (days.length < MIN_GIORNI) return { ok: false, error: "graphql: pochi giorni (" + days.length + ")", info };
  return { ok: true, value: { days, total: intero(cal.totalContributions) }, info };
}

// ---------------------------------------------------------------- HTML

/** Il valore di un attributo in un tag (virgolette doppie, singole o nessuna), o null. */
export function attributo(tag: string, nome: string): string | null {
  const re = new RegExp("[\\s\"'/]" + nome.replace(/[-]/g, "\\-") + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'>]+))", "i");
  const m = re.exec(tag);
  if (!m) return null;
  const v = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
  return v === undefined ? null : decodifica(v);
}

function decodifica(s: string): string {
  return s
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'");
}

function soloTesto(html: string): string {
  return decodifica(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** "3 contributions on November 4th." → 3; "No contributions on ..." → 0; "1,024 contributions" → 1024; altro → null. */
export function leggiConteggio(testo: string): number | null {
  const t = soloTesto(testo);
  const m = /^(no|[\d][\d.,]*)\s+contributions?\b/i.exec(t);
  if (!m) return null;
  if (m[1].toLowerCase() === "no") return 0;
  const n = parseInt(m[1].replace(/[.,]/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** "1,234 contributions in the last year" (o "in 2025") ovunque nel testo → 1234, o null. */
export function leggiTotale(html: string): number | null {
  const t = soloTesto(html);
  const m = /([\d][\d.,]*)\s+contributions?\s+in\s+(?:the\s+last\s+year|\d{4})/i.exec(t);
  if (!m) return null;
  const n = parseInt(m[1].replace(/[.,]/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Il frammento HTML del calendario pubblico → giorni (con n, o n: null se i conteggi non si leggono) e totale. */
export function parseCalendarioHtml(html: string): Esito<{ days: Giorno[]; total: number | null }> {
  if (typeof html !== "string" || !html.length) return { ok: false, error: "html: vuoto" };

  // 1. I testi dei tooltip, per id della cella: <tool-tip for="contribution-day-component-0-0">3 contributions on ...</tool-tip>
  const tooltip = new Map<string, string>();
  const reTip = /<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/gi;
  let m: RegExpExecArray | null;
  while ((m = reTip.exec(html))) {
    const per = attributo(" " + m[1], "for");
    if (per) tooltip.set(per, m[2]);
  }

  // 2. Le celle: qualsiasi tag con data-date (oggi <td>, una volta <rect>), attributi in qualsiasi ordine.
  const giorni: Giorno[] = [];
  let celle = 0;
  let scartate = 0;
  let conConteggio = 0;
  const reCella = /<[a-z][\w-]*\b[^>]*?[\s"']data-date\s*=[^>]*>/gi;
  while ((m = reCella.exec(html))) {
    const tag = m[0];
    celle++;
    const d = attributo(tag, "data-date");
    const lv = attributo(tag, "data-level");
    const l = lv !== null && /^[0-4]$/.test(lv.trim()) ? parseInt(lv, 10) : null;
    if (!dataValida(d) || l === null) {
      scartate++;
      continue;
    }
    let n: number | null = null;
    const dc = attributo(tag, "data-count"); // il vecchio calendario SVG
    if (dc !== null && /^\d+$/.test(dc.trim())) n = parseInt(dc, 10);
    if (n === null) {
      const id = attributo(tag, "id");
      const tip = id ? tooltip.get(id) : undefined;
      if (tip !== undefined) n = leggiConteggio(tip);
    }
    if (n === null) {
      const aria = attributo(tag, "aria-label");
      if (aria) n = leggiConteggio(aria);
    }
    if (n !== null) conConteggio++;
    giorni.push({ d, n, l });
  }

  const days = ordina(giorni);
  let total = leggiTotale(html);
  if (total === null && days.length && days.every((g) => g.n !== null)) {
    total = days.reduce((s, g) => s + (g.n as number), 0);
  }
  const info = { celle, scartate, giorni: days.length, tooltip: tooltip.size, conteggi: conConteggio, totale: total !== null };
  if (days.length < MIN_GIORNI) return { ok: false, error: "html: pochi giorni (" + days.length + ")", info };
  return { ok: true, value: { days, total }, info };
}

// ---------------------------------------------------------------- forma finale

export function formaContributi(user: string, days: Giorno[], total: number | null, adesso: Date): ContributiOk {
  return {
    ok: true,
    user,
    total,
    from: days[0].d,
    to: days[days.length - 1].d,
    days,
    updated: adesso.toISOString(),
  };
}
