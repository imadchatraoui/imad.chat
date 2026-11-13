// I dati di GitHub per la home: le forme delle risposte di /api/github/*.
// Il contratto è in docs/anteprime/casa/CASA.md, sezione 2b ("Data contracts").

/** Un giorno del calendario: data, quanti contributi (null se non leggibili), livello 0..4. */
export type Giorno = { d: string; n: number | null; l: number };

export type ContributiOk = {
  ok: true;
  user: string;
  total: number | null;
  from: string;
  to: string;
  days: Giorno[];
  updated: string;
};

export type Repo = {
  name: string;
  description: string | null;
  language: string | null;
  url: string;
  homepage: string | null;
  pushedAt: string | null;
  stars: number;
  fork: boolean;
};

/** sha7: le prime 7 cifre dello sha (null se lo sha non è esadecimale); url: la pagina del commit su GitHub, solo se è github.com/<utente>/<repo>/commit/<sha>. */
export type Commit = { message: string; date: string | null; sha7: string | null; url: string | null };

export type Learning = {
  repo: string;
  url: string;
  pushedAt: string | null;
  commits: Commit[];
};

export type ProgettiOk = {
  ok: true;
  repos: Repo[];
  learning: Learning | null;
  updated: string;
};

export type Fallito = { ok: false };

/**
 * Un passo di `why` (solo con ?debug, vedi servizio.ts): che fonte, che stato HTTP, quanti byte, che passo è fallito.
 * Mai un token, mai le intestazioni.
 */
export type Passo = {
  source: string;
  url?: string;
  status?: number | null;
  bytes?: number | null;
  ms?: number;
  step: "fetch" | "http" | "size" | "json" | "parse" | "shape" | "ok" | "skipped" | "deadline";
  error?: string;
  /** il resto del limite di richieste, se GitHub lo dice (aiuta a capire un 403) */
  rateRemaining?: string | null;
  /** conteggi utili per capire un parser: giorni letti, conteggi trovati, repository tenuti... */
  info?: Record<string, number | string | boolean | null>;
};

/** Esito di una funzione pura: un valore, oppure un errore breve da mettere in `why`. */
export type Esito<T> = { ok: true; value: T; info?: Passo["info"] } | { ok: false; error: string; info?: Passo["info"] };

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
