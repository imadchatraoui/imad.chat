// Le richieste verso GitHub: timeout, User-Agent senza nomi, limite di dimensione, e un passo di `why` per ognuna.
// Niente Next qui: `fetch` si passa da fuori (le prove usano un finto fetch).

import type { FetchLike, Passo } from "./types";

export const USER_AGENT = "imad.chat-site";
export const TIMEOUT_MS = 6000;
/** Il tempo che un'intera risposta (tutti i passi insieme) può prendere: la pagina smette di aspettare a 8 s. */
export const SCADENZA_MS = 6500;
/** Sotto questo margine un passo non parte nemmeno: non farebbe in tempo. */
const MARGINE_MS = 250;
const MAX_BYTE = 3_000_000;

export type Richiesta = {
  source: string;
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Date.now() oltre cui la richiesta non deve andare (la scadenza della risposta intera). */
  deadline?: number;
  /** Valori da non scrivere mai in `why` (il token): se compaiono in un messaggio diventano "***". */
  segreti?: (string | null | undefined)[];
};

/** Toglie da un testo ogni valore segreto (il token), anche se un'eccezione lo riporta nel messaggio. */
export function censura(testo: string, segreti?: (string | null | undefined)[]): string {
  let t = testo;
  for (const s of segreti || []) if (s && s.length >= 4) t = t.split(s).join("***");
  return t;
}

/** Un messaggio d'errore breve e senza segreti (le richieste non hanno segreti nell'URL; il token sta solo nelle intestazioni, che non si riportano mai). */
function errore(e: unknown, segreti?: (string | null | undefined)[]): string {
  return censura(erroreGrezzo(e), segreti).slice(0, 160);
}
function erroreGrezzo(e: unknown): string {
  if (e && typeof e === "object") {
    const x = e as { name?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } };
    if (x.name === "AbortError" || x.name === "TimeoutError") return "timeout";
    const causa = x.cause && (typeof x.cause.code === "string" ? x.cause.code : typeof x.cause.message === "string" ? x.cause.message : "");
    const msg = typeof x.message === "string" ? x.message : String(e);
    return (msg + (causa ? " (" + causa + ")" : "")).slice(0, 400);
  }
  return String(e).slice(0, 400);
}

/**
 * Scarica un testo. Aggiunge sempre un passo a `why`; restituisce il testo solo con HTTP 200.
 * Il timeout copre anche la lettura del corpo, e non va mai oltre `deadline`: se non resta tempo il passo
 * non parte (step "deadline").
 */
export async function scarica(fetchImpl: FetchLike, r: Richiesta, why: Passo[]): Promise<string | null> {
  const t0 = Date.now();
  const passo: Passo = { source: r.source, url: r.url, status: null, bytes: null, step: "fetch" };
  why.push(passo);
  let attesa = r.timeoutMs || TIMEOUT_MS;
  if (r.deadline !== undefined) attesa = Math.min(attesa, r.deadline - t0);
  if (r.deadline !== undefined && r.deadline - t0 < MARGINE_MS) {
    passo.step = "deadline";
    passo.error = "tempo finito: passo saltato";
    passo.ms = 0;
    return null;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), attesa);
  try {
    const res = await fetchImpl(r.url, {
      method: r.method || "GET",
      headers: { "User-Agent": USER_AGENT, ...(r.headers || {}) },
      body: r.body,
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "follow",
    });
    passo.status = res.status;
    const rate = res.headers.get("x-ratelimit-remaining");
    if (rate !== null) passo.rateRemaining = rate;
    const dichiarati = Number(res.headers.get("content-length"));
    if (Number.isFinite(dichiarati) && dichiarati > MAX_BYTE) {
      passo.step = "size";
      passo.bytes = dichiarati;
      passo.error = "risposta troppo grande";
      try {
        await res.body?.cancel();
      } catch {}
      return null;
    }
    const text = await res.text();
    passo.bytes = text.length;
    if (res.status !== 200) {
      passo.step = "http";
      passo.error = "HTTP " + res.status;
      return null;
    }
    if (text.length > MAX_BYTE) {
      passo.step = "size";
      passo.error = "risposta troppo grande";
      return null;
    }
    passo.step = "ok";
    return text;
  } catch (e) {
    passo.error = errore(e, r.segreti);
    return null;
  } finally {
    clearTimeout(timer);
    passo.ms = Date.now() - t0;
  }
}

/** Come `scarica`, poi JSON.parse; un errore di JSON diventa il passo "json". */
export async function scaricaJson(fetchImpl: FetchLike, r: Richiesta, why: Passo[]): Promise<unknown | undefined> {
  const text = await scarica(fetchImpl, r, why);
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    const p = why[why.length - 1];
    p.step = "json";
    p.error = "JSON non valido";
    return undefined;
  }
}
