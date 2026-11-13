// Mette insieme rete e parser: carica i contributi e i progetti di un utente.
// Niente Next qui (la cache sta nelle route): `fetch`, token e ora si passano da fuori, così le prove
// possono girare con un finto fetch. Restituisce sempre `why`; la route lo mostra solo con ?debug=<chiave>.
// Tutto il caricamento ha una scadenza sola (SCADENZA_MS, 6,5 s): ogni passo usa solo il tempo che resta,
// e un passo senza tempo si salta, restituendo quello che si sa già (per i progetti: i repository senza commit).

import { QUERY_CALENDARIO, formaContributi, parseCalendarioHtml, parseGraphql } from "./contributi";
import { MAX_COMMIT, REPO_IMPARANDO, formaCommit, formaLearning, formaRepos } from "./progetti";
import { SCADENZA_MS, censura, scarica, scaricaJson } from "./rete";
import type { ContributiOk, FetchLike, Learning, Passo, ProgettiOk } from "./types";

export const UTENTE = "imadchatraoui";

export type Opzioni = {
  user?: string;
  token?: string | null;
  fetchImpl?: FetchLike;
  adesso?: () => Date;
  /** Quanto può durare tutto il caricamento (ms; predefinito SCADENZA_MS): i passi lenti si accorciano, quelli senza tempo si saltano. */
  scadenzaMs?: number;
};

export type Risultato<T> = { data: T | null; why: Passo[] };

function apiHeaders(token: string | null | undefined): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h.Authorization = "Bearer " + token;
  return h;
}

function opzioni(o: Opzioni) {
  return {
    user: o.user || UTENTE,
    token: o.token ? String(o.token).trim() || null : null,
    fetchImpl: o.fetchImpl || ((u: string, i?: RequestInit) => fetch(u, i)),
    adesso: o.adesso || (() => new Date()),
    deadline: Date.now() + (o.scadenzaMs && o.scadenzaMs > 0 ? o.scadenzaMs : SCADENZA_MS),
  };
}

/** I contributi dell'ultimo anno: GraphQL con il token, altrimenti (o se GraphQL fallisce) il calendario HTML pubblico. */
export async function caricaContributi(o: Opzioni = {}): Promise<Risultato<ContributiOk>> {
  const { user, token, fetchImpl, adesso, deadline } = opzioni(o);
  const why: Passo[] = [];
  const segreti = [token];

  if (token) {
    const json = await scaricaJson(
      fetchImpl,
      {
        source: "graphql",
        url: "https://api.github.com/graphql",
        method: "POST",
        headers: { ...apiHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ query: QUERY_CALENDARIO, variables: { login: user } }),
        // GraphQL prende al massimo metà del tempo: se è lento resta il tempo per il calendario HTML.
        deadline: Math.min(deadline, Date.now() + Math.max(1500, (deadline - Date.now()) / 2)),
        segreti,
      },
      why,
    );
    if (json !== undefined) {
      // Qualsiasi sorpresa nella forma della risposta (anche un'eccezione) non ferma il ripiego sull'HTML.
      try {
        const p = parseGraphql(json);
        why.push({ source: "graphql", step: p.ok ? "ok" : "parse", error: p.ok ? undefined : censura(p.error, segreti), info: p.info });
        if (p.ok) return { data: formaContributi(user, p.value.days, p.value.total, adesso()), why };
      } catch (e) {
        why.push({ source: "graphql", step: "parse", error: censura("eccezione: " + String((e as Error)?.message || e), segreti).slice(0, 160) });
      }
    }
  } else {
    why.push({ source: "graphql", step: "skipped", error: "nessun token" });
  }

  const html = await scarica(
    fetchImpl,
    {
      source: "html",
      url: "https://github.com/users/" + encodeURIComponent(user) + "/contributions",
      headers: { Accept: "text/html" },
      deadline,
      segreti,
    },
    why,
  );
  if (html !== null) {
    const p = parseCalendarioHtml(html);
    why.push({ source: "html", step: p.ok ? "ok" : "parse", error: p.ok ? undefined : p.error, info: p.info });
    if (p.ok) return { data: formaContributi(user, p.value.days, p.value.total, adesso()), why };
  }
  return { data: null, why };
}

/**
 * Una richiesta REST: con il token se c'è (solo per avere un limite di richieste più alto); se GitHub
 * risponde 401 (token scaduto o sbagliato) si riprova una volta senza, perché questi dati sono pubblici.
 */
async function api(fetchImpl: FetchLike, source: string, url: string, token: string | null, why: Passo[], deadline: number) {
  const segreti = [token];
  const json = await scaricaJson(fetchImpl, { source, url, headers: apiHeaders(token), deadline, segreti }, why);
  if (json === undefined && token && why[why.length - 1].status === 401) {
    why.push({ source, step: "skipped", error: "token rifiutato (401): riprovo senza" });
    return scaricaJson(fetchImpl, { source, url, headers: apiHeaders(null), deadline, segreti }, why);
  }
  return json;
}

/** I repository pubblici e il riquadro "Sto imparando" (null se i suoi commit non arrivano). */
export async function caricaProgetti(o: Opzioni = {}): Promise<Risultato<ProgettiOk>> {
  const { user, token, fetchImpl, adesso, deadline } = opzioni(o);
  const why: Passo[] = [];
  const u = encodeURIComponent(user);

  const lista = await api(fetchImpl, "repos", "https://api.github.com/users/" + u + "/repos?per_page=100&sort=pushed&type=owner", token, why, deadline);
  if (lista === undefined) return { data: null, why };
  const repos = formaRepos(lista, user);
  why.push({ source: "repos", step: repos.ok ? "ok" : "shape", error: repos.ok ? undefined : repos.error, info: repos.info });
  if (!repos.ok) return { data: null, why };

  // I commit del repository di studio si chiedono solo se è nella lista pubblica appena filtrata.
  let learning: Learning | null = null;
  const studio = repos.value.find((r) => r.name.toLowerCase() === REPO_IMPARANDO.toLowerCase());
  if (!studio) {
    why.push({ source: "commits", step: "skipped", error: REPO_IMPARANDO + " non è nella lista pubblica" });
  } else {
    const url = "https://api.github.com/repos/" + u + "/" + encodeURIComponent(studio.name) + "/commits?per_page=" + MAX_COMMIT;
    const commits = await api(fetchImpl, "commits", url, token, why, deadline);
    if (commits !== undefined) {
      const c = formaCommit(commits);
      why.push({ source: "commits", step: c.ok ? "ok" : "shape", error: c.ok ? undefined : c.error, info: c.info });
      if (c.ok && c.value.length) learning = formaLearning(studio, c.value);
    }
  }

  return { data: { ok: true, repos: repos.value, learning, updated: adesso().toISOString() }, why };
}
