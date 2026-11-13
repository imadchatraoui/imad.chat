// I progetti: funzioni pure (niente rete, niente Next), provate da scripts/check/github.mjs.
//
// Fonte: GET https://api.github.com/users/<utente>/repos?per_page=100&sort=pushed&type=owner
// (questo endpoint elenca solo i repository pubblici). In più qui si scarta tutto ciò che non è
// dichiaratamente pubblico: un repository privato non deve mai comparire.

import type { Commit, Esito, Learning, Repo } from "./types";

export const REPO_IMPARANDO = "threejs-journey";

const MAX_DESCRIZIONE = 300;
const MAX_TITOLO = 120;

function testo(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

/** Solo indirizzi http(s) veri: una pagina statica li usa come link. */
function linkWeb(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let s = v.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s; // GitHub accetta "example.com" senza schema
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Un link a GitHub: deve essere https://github.com/<utente>/... */
function linkGithub(v: unknown, user: string): string | null {
  const u = linkWeb(v);
  if (!u) return null;
  const p = new URL(u);
  if (p.protocol !== "https:" || p.hostname !== "github.com") return null;
  if (p.pathname.split("/")[1]?.toLowerCase() !== user.toLowerCase()) return null;
  return u;
}

function quando(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function tempo(s: string | null): number {
  return s ? Date.parse(s) : 0;
}

/**
 * La lista di /users/<utente>/repos → i repository pubblici dell'utente, nella forma del contratto:
 * i suoi prima (per ultimo push), i fork in fondo (anche loro per ultimo push).
 * Il repository del profilo (quello che si chiama come l'utente, maiuscole a parte) si scarta.
 */
export function formaRepos(json: unknown, user: string): Esito<Repo[]> {
  if (!Array.isArray(json)) {
    const msg = json && typeof json === "object" && typeof (json as { message?: unknown }).message === "string"
      ? ": " + String((json as { message: string }).message).slice(0, 120)
      : "";
    return { ok: false, error: "repos: la risposta non è una lista" + msg };
  }
  const tenuti: Repo[] = [];
  let privati = 0;
  let altri = 0;
  let profilo = 0;
  let malformati = 0;
  for (const raw of json) {
    if (!raw || typeof raw !== "object") {
      malformati++;
      continue;
    }
    const r = raw as Record<string, unknown>;
    // Mai un privato: deve dire private: false E visibility: "public". Qualsiasi altra cosa si scarta.
    if (r.private !== false || r.visibility !== "public") {
      privati++;
      continue;
    }
    const owner = (r.owner as { login?: unknown } | undefined)?.login;
    if (typeof owner !== "string" || owner.toLowerCase() !== user.toLowerCase()) {
      altri++;
      continue;
    }
    const name = typeof r.name === "string" && /^[\w.-]{1,100}$/.test(r.name) ? r.name : null;
    const url = linkGithub(r.html_url, user);
    if (!name || !url) {
      malformati++;
      continue;
    }
    // Il repository del profilo (<utente>/<utente>, il README della pagina GitHub) non è un progetto.
    if (name.toLowerCase() === user.toLowerCase()) {
      profilo++;
      continue;
    }
    tenuti.push({
      name,
      description: testo(r.description, MAX_DESCRIZIONE),
      language: testo(r.language, 40),
      url,
      homepage: linkWeb(r.homepage),
      pushedAt: quando(r.pushed_at),
      stars: typeof r.stargazers_count === "number" && r.stargazers_count >= 0 ? Math.floor(r.stargazers_count) : 0,
      fork: r.fork === true,
    });
  }
  tenuti.sort((a, b) => {
    if (a.fork !== b.fork) return a.fork ? 1 : -1;
    const d = tempo(b.pushedAt) - tempo(a.pushedAt);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
  return { ok: true, value: tenuti, info: { ricevuti: json.length, tenuti: tenuti.length, privati, altri, profilo, malformati } };
}

/** Quanti commit dà la rotta (CASA.md 2f G: la sezione «Sto imparando» ne mostra otto; il riquadro i primi). */
export const MAX_COMMIT = 8;
const SHA = /^[0-9a-f]{40}$/;
const COMMIT_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/commit\/[0-9a-f]{40}$/;

/** La lista di /repos/<utente>/<repo>/commits?per_page=8 → al massimo otto {message (solo la prima riga), date, sha7, url}. */
export function formaCommit(json: unknown): Esito<Commit[]> {
  if (!Array.isArray(json)) return { ok: false, error: "commits: la risposta non è una lista" };
  const out: Commit[] = [];
  for (const raw of json) {
    const r = raw as { sha?: unknown; html_url?: unknown; commit?: { message?: unknown; committer?: { date?: unknown }; author?: { date?: unknown } } } | null;
    const c = r?.commit;
    if (!c || typeof c.message !== "string") continue;
    const message = testo(c.message.split(/\r?\n/)[0], MAX_TITOLO);
    if (!message) continue;
    const sha = typeof r?.sha === "string" && SHA.test(r.sha) ? r.sha : null;
    const url = sha && typeof r?.html_url === "string" && COMMIT_URL.test(r.html_url) && r.html_url.endsWith("/" + sha) ? r.html_url : null;
    out.push({ message, date: quando(c.committer?.date) || quando(c.author?.date), sha7: sha ? sha.slice(0, 7) : null, url });
    if (out.length === MAX_COMMIT) break;
  }
  return { ok: true, value: out, info: { ricevuti: json.length, tenuti: out.length } };
}

/** Il riquadro "Sto imparando": il repository (già filtrato come pubblico) e i suoi ultimi commit. */
export function formaLearning(repo: Repo, commits: Commit[]): Learning {
  // il link di un commit solo se è di questo repository
  const base = repo.url + "/commit/";
  const tenuti = commits.map((c) => (c.url && !c.url.startsWith(base) ? { ...c, url: null } : c));
  return { repo: repo.name, url: repo.url, pushedAt: repo.pushedAt, commits: tenuti };
}
