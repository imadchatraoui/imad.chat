// Le richieste verso GitHub: timeout, User-Agent senza nomi, limite di dimensione, e un passo di `why` per ognuna.
// Niente Next qui: `fetch` si passa da fuori (le prove usano un finto fetch).

import type { FetchLike, Passo } from "./types";

export const USER_AGENT = "imad.chat-site";
export const TIMEOUT_MS = 6000;
const MAX_BYTE = 3_000_000;

export type Richiesta = {
  source: string;
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
};

/** Un messaggio d'errore breve e senza segreti (le richieste non hanno segreti nell'URL; il token sta solo nelle intestazioni, che non si riportano mai). */
function errore(e: unknown): string {
  if (e && typeof e === "object") {
    const x = e as { name?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } };
    if (x.name === "AbortError" || x.name === "TimeoutError") return "timeout";
    const causa = x.cause && (typeof x.cause.code === "string" ? x.cause.code : typeof x.cause.message === "string" ? x.cause.message : "");
    const msg = typeof x.message === "string" ? x.message : String(e);
    return (msg + (causa ? " (" + causa + ")" : "")).slice(0, 160);
  }
  return String(e).slice(0, 160);
}

/**
 * Scarica un testo. Aggiunge sempre un passo a `why`; restituisce il testo solo con HTTP 200.
 * Il timeout copre anche la lettura del corpo.
 */
export async function scarica(fetchImpl: FetchLike, r: Richiesta, why: Passo[]): Promise<string | null> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), r.timeoutMs || TIMEOUT_MS);
  const passo: Passo = { source: r.source, url: r.url, status: null, bytes: null, step: "fetch" };
  why.push(passo);
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
    passo.error = errore(e);
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
