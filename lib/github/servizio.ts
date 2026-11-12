// La parte "Next" delle due route: cache, risposta, ?debug=1.
//
// Come funziona la cache (Next 16, senza Cache Components, quindi il modello "previous" di
// node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md):
// - il calcolo sta in `unstable_cache` con `revalidate` di qualche ora: tra un aggiornamento e l'altro
//   la risposta esce dalla cache dei dati di Next (su Vercel è condivisa tra le istanze e sopravvive ai deploy);
// - quando è scaduta si serve quella vecchia e si ricalcola in sottofondo; se GitHub non risponde il calcolo
//   lancia un errore, Next lo registra e TIENE l'ultima risposta buona (unstable-cache.js: "Return the stale
//   value on error"), e riprova alla richiesta dopo;
// - un fallimento non entra mai in cache (si lancia, non si restituisce): senza una risposta buona si risponde
//   { ok: false } e si aspetta un minuto prima di riprovare (per istanza), con una cache CDN corta;
// - la route legge request.url (per ?debug=1), quindi è dinamica: niente `dynamic = "force-dynamic"`, che
//   imporrebbe fetchCache "force-no-store" e spegnerebbe unstable_cache.
// Sopra, l'intestazione Cache-Control lascia alla CDN di Vercel la risposta per un'ora.

import { unstable_cache } from "next/cache";
import type { Passo } from "./types";

type Carica<T> = () => Promise<{ data: T | null; why: Passo[] }>;

const CC_BUONA = "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400";
const CC_FALLITA = "public, max-age=60, s-maxage=120";
const ATTESA_DOPO_FALLIMENTO_MS = 60_000;

class GithubNonRisponde extends Error {
  why: Passo[];
  constructor(why: Passo[]) {
    super("GitHub: nessuna risposta utilizzabile");
    this.name = "GithubNonRisponde";
    this.why = why;
  }
}

function risposta(body: unknown, cacheControl: string): Response {
  return Response.json(body, {
    status: 200,
    headers: {
      "Cache-Control": cacheControl,
      "X-Robots-Tag": "noindex",
    },
  });
}

/** Una route GET con cache di qualche ora, ultima risposta buona in caso di guasto, e ?debug=1. */
export function routeGithub<T>(chiave: string, revalidate: number, carica: Carica<T>) {
  // Ultima risposta buona di questa istanza: serve solo se la cache dei dati non ne ha una.
  let ultimaBuona: T | null = null;
  let ultimoFallimento = 0;

  const inCache = unstable_cache(
    async () => {
      const r = await carica();
      if (!r.data) throw new GithubNonRisponde(r.why);
      return r.data;
    },
    [chiave],
    { revalidate, tags: ["github", chiave] },
  );

  return async function GET(request: Request): Promise<Response> {
    let debug = false;
    try {
      debug = new URL(request.url).searchParams.get("debug") === "1";
    } catch {}

    if (debug) {
      // Sempre una prova fresca, fuori dalla cache, con il racconto di cosa è successo.
      const t0 = Date.now();
      let data: T | null = null;
      let why: Passo[] = [];
      try {
        const r = await carica();
        data = r.data;
        why = r.why;
      } catch (e) {
        why.push({ source: "route", step: "fetch", error: String((e as Error)?.message || e).slice(0, 160) });
      }
      const corpo = data ? { ...(data as object) } : { ok: false };
      return risposta({ ...corpo, why, debug: { cache: "saltata", ms: Date.now() - t0 } }, "no-store");
    }

    if (!ultimaBuona && Date.now() - ultimoFallimento < ATTESA_DOPO_FALLIMENTO_MS) {
      return risposta({ ok: false }, CC_FALLITA);
    }
    try {
      const data = await inCache();
      ultimaBuona = data;
      return risposta(data, CC_BUONA);
    } catch (e) {
      ultimoFallimento = Date.now();
      if (!(e instanceof GithubNonRisponde)) console.error("[api/github/" + chiave + "]", (e as Error)?.message || e);
      if (ultimaBuona) return risposta(ultimaBuona, CC_FALLITA);
      return risposta({ ok: false }, CC_FALLITA);
    }
  };
}
