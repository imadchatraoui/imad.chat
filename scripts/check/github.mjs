// Prove dei dati di GitHub (lib/github): parser, forme, filtro dei privati, rete con un finto fetch.
// Uso: node scripts/check/github.mjs
//
// Da questo ambiente GitHub non si raggiunge: le risposte qui sotto sono FIXTURE scritte a mano con la forma
// documentata da GitHub (GraphQL contributionCalendar, il frammento HTML /users/<utente>/contributions,
// REST /users/<utente>/repos e /repos/<utente>/<repo>/commits). Sono solo input di prova, mai dati del sito.
//
// 1. Traspila lib/github/*.ts (senza servizio.ts, che dipende da Next) in una cartella temporanea.
// 2. Prova ogni funzione pura e i caricatori con un finto fetch.

import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../..", import.meta.url));
const require = createRequire(join(repo, "package.json"));
const ts = require("typescript");

const out = mkdtempSync(join(tmpdir(), "check-github-"));
for (const m of ["types", "contributi", "progetti", "rete", "carica"]) {
  const src = readFileSync(join(repo, "lib/github", m + ".ts"), "utf8");
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  js = js.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(out, m + ".mjs"), js);
}
const imp = (m) => import(pathToFileURL(join(out, m + ".mjs")).href);
const C = await imp("contributi");
const P = await imp("progetti");
const R = await imp("rete");
const L = await imp("carica");

let passed = 0;
let failed = 0;
function ok(cond, name, extra) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log("FAIL", name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : "");
  }
}
function eq(a, b, name) {
  ok(JSON.stringify(a) === JSON.stringify(b), name, { got: a, want: b });
}

// ------------------------------------------------------------------ fixture: un anno di giorni

const LIV = ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"];
const START = Date.UTC(2025, 10, 9); // domenica 9 novembre 2025
function giorniFinti(settimane = 53) {
  const g = [];
  for (let w = 0; w < settimane; w++) {
    for (let d = 0; d < 7; d++) {
      const i = w * 7 + d;
      const date = new Date(START + i * 86400000).toISOString().slice(0, 10);
      const n = (i * 7) % 11 === 0 ? 0 : (i * 13) % 9; // deterministico, con zeri
      const l = n === 0 ? 0 : Math.min(4, 1 + Math.floor(n / 2.5));
      g.push({ date, n, l });
    }
  }
  return g;
}
const ANNO = giorniFinti();
const TOT = ANNO.reduce((s, g) => s + g.n, 0);

function graphqlFinto(giorni = ANNO, extra = {}) {
  const weeks = [];
  for (let i = 0; i < giorni.length; i += 7) {
    weeks.push({
      contributionDays: giorni.slice(i, i + 7).map((g) => ({
        date: g.date,
        contributionCount: g.n,
        contributionLevel: LIV[g.l],
      })),
    });
  }
  return {
    data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: TOT, weeks, ...extra } } } },
  };
}

function suffisso(day) {
  if (day % 10 === 1 && day !== 11) return "st";
  if (day % 10 === 2 && day !== 12) return "nd";
  if (day % 10 === 3 && day !== 13) return "rd";
  return "th";
}
const MESI = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function frase(g) {
  const t = new Date(g.date + "T00:00:00Z");
  const quando = MESI[t.getUTCMonth()] + " " + t.getUTCDate() + suffisso(t.getUTCDate());
  if (g.n === 0) return "No contributions on " + quando + ".";
  return g.n + (g.n === 1 ? " contribution" : " contributions") + " on " + quando + ".";
}

// Come il frammento vero di GitHub: una riga per giorno della settimana (le date non sono in ordine nel testo),
// tooltip dopo la tabella, attributi in ordini diversi, a volte virgolette singole.
function htmlFinto({ giorni = ANNO, tooltip = true, titolo = true, totale = "1,234" } = {}) {
  const righe = [];
  for (let d = 0; d < 7; d++) {
    let r = '<tr style="height: 10px">\n<td class="ContributionCalendar-label" style="position: relative"><span class="sr-only">Sunday</span></td>\n';
    for (let w = 0; w * 7 + d < giorni.length; w++) {
      const g = giorni[w * 7 + d];
      const id = "contribution-day-component-" + d + "-" + w;
      if ((w + d) % 3 === 0) {
        r += `<td tabindex="0" data-ix="${w}" aria-selected="false" aria-describedby="contribution-graph-legend-level-${g.l}" style="width: 10px" data-date="${g.date}" id="${id}" data-level="${g.l}" role="gridcell" data-view-component="true" class="ContributionCalendar-day"></td>\n`;
      } else if ((w + d) % 3 === 1) {
        r += `<td data-level='${g.l}' class="ContributionCalendar-day" id='${id}' data-date='${g.date}' role="gridcell"></td>\n`;
      } else {
        r += `<td\n  id="${id}"\n  data-date="${g.date}"\n  class="ContributionCalendar-day"\n  data-level="${g.l}"\n></td>\n`;
      }
    }
    righe.push(r + "</tr>");
  }
  const tips = tooltip
    ? giorni
        .map((g, i) => {
          const w = Math.floor(i / 7);
          const d = i % 7;
          return `<tool-tip id="tooltip-${i}" for="contribution-day-component-${d}-${w}" popover="manual" data-direction="n" data-type="label" data-view-component="true" class="sr-only position-absolute">${frase(g)}</tool-tip>`;
        })
        .join("\n")
    : "";
  const h2 = titolo
    ? `<h2 id="js-contribution-activity-description" class="f4 text-normal mb-2">\n      ${totale}\n      contributions\n        in the last year\n    </h2>`
    : "";
  return `<div class="js-yearly-contributions">${h2}<div class="border py-2 graph-before-activity-overview">
<table data-hydro-click="..." class="ContributionCalendar-grid js-calendar-graph-table" role="grid" aria-readonly="true">
<caption class="sr-only">Contribution Graph</caption>
<thead><tr style="height: 13px"><td style="width: 28px"><span class="sr-only">Day of Week</span></td></tr></thead>
<tbody>${righe.join("\n")}</tbody></table></div>
<div class="width-full f6 px-0 px-md-5 py-1"><div class="float-left">Learn how we count contributions</div>
<div class="float-right color-fg-muted d-flex flex-items-center">Less
<div id="contribution-graph-legend-level-0" class="ContributionCalendar-day" data-level="0"></div>
<div id="contribution-graph-legend-level-1" class="ContributionCalendar-day" data-level="1"></div>
More</div></div>${tips}</div>`;
}

// ------------------------------------------------------------------ GraphQL

{
  const p = C.parseGraphql(graphqlFinto());
  ok(p.ok, "graphql: ok", p);
  if (p.ok) {
    eq(p.value.days.length, 371, "graphql: 53 settimane = 371 giorni");
    eq(p.value.total, TOT, "graphql: totale");
    eq(p.value.days[0], { d: ANNO[0].date, n: ANNO[0].n, l: ANNO[0].l }, "graphql: primo giorno");
    eq(p.value.days[370].d, ANNO[370].date, "graphql: ultimo giorno");
    ok(p.value.days.every((g, i, a) => i === 0 || a[i - 1].d < g.d), "graphql: ordinati");
    ok(p.value.days.some((g) => g.l === 4) && p.value.days.some((g) => g.l === 0), "graphql: livelli 0 e 4 presenti");
  }
  // settimane al contrario → ordinate lo stesso
  const rov = graphqlFinto();
  rov.data.user.contributionsCollection.contributionCalendar.weeks.reverse();
  const p2 = C.parseGraphql(rov);
  ok(p2.ok && p2.value.days[0].d === ANNO[0].date, "graphql: riordina le settimane");
  ok(!C.parseGraphql({ errors: [{ type: "NOT_FOUND", message: "Could not resolve to a User" }], data: { user: null } }).ok, "graphql: errors → fallisce");
  ok(!C.parseGraphql({ data: { user: null } }).ok, "graphql: user null → fallisce");
  ok(!C.parseGraphql({ message: "Bad credentials" }).ok, "graphql: 401 JSON → fallisce");
  ok(!C.parseGraphql(graphqlFinto(ANNO.slice(0, 70))).ok, "graphql: 10 settimane → fallisce (non è un anno)");
  ok(!C.parseGraphql(null).ok && !C.parseGraphql("x").ok, "graphql: non oggetto → fallisce");
  // un livello sconosciuto con conteggio > 0 scarta quel giorno, non inventa
  const strano = graphqlFinto();
  strano.data.user.contributionsCollection.contributionCalendar.weeks[0].contributionDays[1].contributionLevel = "FIFTH";
  strano.data.user.contributionsCollection.contributionCalendar.weeks[0].contributionDays[1].contributionCount = 5;
  const p3 = C.parseGraphql(strano);
  ok(p3.ok && p3.value.days.length === 370 && p3.info.scartati === 1, "graphql: livello sconosciuto → giorno scartato", p3.info);
}

// ------------------------------------------------------------------ HTML

{
  eq(C.leggiConteggio("3 contributions on November 4th."), 3, "conteggio: 3");
  eq(C.leggiConteggio("1 contribution on November 4th."), 1, "conteggio: 1");
  eq(C.leggiConteggio("No contributions on November 4th."), 0, "conteggio: No");
  eq(C.leggiConteggio("  1,024&nbsp;contributions on May 1st."), 1024, "conteggio: migliaia e &nbsp;");
  eq(C.leggiConteggio("<span>12</span> contributions on May 1st"), 12, "conteggio: con tag dentro");
  eq(C.leggiConteggio("Contributions on May 1st"), null, "conteggio: senza numero → null");
  eq(C.attributo('<td data-level="2" id=x data-date=\'2025-01-01\'>', "data-date"), "2025-01-01", "attributo: virgolette singole");
  eq(C.attributo('<td data-level="2" id=x data-date=\'2025-01-01\'>', "id"), "x", "attributo: senza virgolette");
  eq(C.attributo('<td aria-describedby="a" data-id="no" id="si">', "id"), "si", "attributo: id non confuso con data-id");
  eq(C.leggiTotale("<h2>\n  1,234\n  contributions\n  in the last year\n</h2>"), 1234, "totale: titolo su più righe");
  eq(C.leggiTotale("<h2>1 contribution in 2025</h2>"), 1, "totale: anno");
  eq(C.leggiTotale("<h2>nothing</h2>"), null, "totale: assente");

  const p = C.parseCalendarioHtml(htmlFinto());
  ok(p.ok, "html: ok", p.ok ? undefined : p);
  if (p.ok) {
    eq(p.value.days.length, 371, "html: 371 giorni (le celle della legenda senza data non contano)");
    eq(p.value.total, 1234, "html: totale dal titolo");
    ok(p.value.days.every((g, i, a) => i === 0 || a[i - 1].d < g.d), "html: ordinati anche se il testo va per righe");
    const atteso = ANNO.map((g) => ({ d: g.date, n: g.n, l: g.l }));
    eq(p.value.days, atteso, "html: ogni giorno con conteggio e livello giusti");
  }

  const s = C.parseCalendarioHtml(htmlFinto({ tooltip: false }));
  ok(s.ok, "html senza tooltip: ok");
  if (s.ok) {
    ok(s.value.days.every((g) => g.n === null), "html senza tooltip: n null");
    eq(s.value.days.map((g) => g.l), ANNO.map((g) => g.l), "html senza tooltip: livelli letti");
    eq(s.value.total, 1234, "html senza tooltip: totale dal titolo");
  }
  const s2 = C.parseCalendarioHtml(htmlFinto({ tooltip: false, titolo: false }));
  ok(s2.ok && s2.value.total === null, "html senza tooltip né titolo: total null");
  const s3 = C.parseCalendarioHtml(htmlFinto({ titolo: false }));
  ok(s3.ok && s3.value.total === TOT, "html senza titolo ma con i conteggi: totale = somma");

  // il vecchio calendario SVG: <rect data-count data-date data-level>
  const rect = ANNO.map((g) => `<rect width="10" height="10" x="0" y="0" class="ContributionCalendar-day" data-count="${g.n}" data-date="${g.date}" data-level="${g.l}"></rect>`).join("");
  const v = C.parseCalendarioHtml(`<svg>${rect}</svg><h2>${TOT} contributions in the last year</h2>`);
  ok(v.ok && v.value.days[5].n === ANNO[5].n && v.value.total === TOT, "html vecchio (rect data-count): ok");

  ok(!C.parseCalendarioHtml("").ok, "html: vuoto → fallisce");
  ok(!C.parseCalendarioHtml("<html><body>Rate limit</body></html>").ok, "html: pagina d'errore → fallisce");
  ok(!C.parseCalendarioHtml(htmlFinto({ giorni: ANNO.slice(0, 28) })).ok, "html: 4 settimane → fallisce");
  const fuori = htmlFinto().replace(/data-level="(\d)"/g, 'data-level="9"').replace(/data-level='(\d)'/g, "data-level='9'");
  ok(!C.parseCalendarioHtml(fuori).ok, "html: livelli fuori scala → fallisce");

  const f = C.formaContributi("imadchatraoui", p.value.days, 1234, new Date("2026-11-12T10:00:00Z"));
  eq(Object.keys(f), ["ok", "user", "total", "from", "to", "days", "updated"], "forma contributi: chiavi del contratto");
  eq([f.from, f.to, f.updated], [ANNO[0].date, ANNO[370].date, "2026-11-12T10:00:00.000Z"], "forma contributi: from, to, updated");
  eq(Object.keys(f.days[0]), ["d", "n", "l"], "forma contributi: giorno {d, n, l}");
}

// ------------------------------------------------------------------ progetti

const U = "imadchatraoui";
function repoFinto(name, extra = {}) {
  return {
    id: name.length,
    name,
    full_name: U + "/" + name,
    private: false,
    visibility: "public",
    owner: { login: U, id: 1, type: "User" },
    html_url: "https://github.com/" + U + "/" + name,
    description: "Descrizione di " + name,
    fork: false,
    homepage: null,
    language: "JavaScript",
    stargazers_count: 2,
    pushed_at: "2026-10-01T12:00:00Z",
    ...extra,
  };
}
const LISTA = [
  repoFinto("vecchio", { pushed_at: "2025-01-01T00:00:00Z", description: "   ", language: null }),
  repoFinto("threejs-journey", { pushed_at: "2026-11-10T09:00:00Z" }),
  repoFinto("segreto", { private: true, visibility: "private" }),
  repoFinto("segreto2", { private: false, visibility: "private" }),
  repoFinto("interno", { private: false, visibility: "internal" }),
  repoFinto("senza-visibilita", { visibility: undefined }),
  repoFinto("privato-ambiguo", { private: undefined }),
  repoFinto("un-fork", { fork: true, pushed_at: "2026-11-11T00:00:00Z" }),
  repoFinto("altro-fork", { fork: true, pushed_at: "2026-01-11T00:00:00Z" }),
  repoFinto("di-altri", { owner: { login: "someoneelse" } }),
  repoFinto("sito", { homepage: "gmitorino.org", pushed_at: "2026-11-01T00:00:00Z" }),
  repoFinto("cattivo", { homepage: "javascript:alert(1)", pushed_at: "2026-09-01T00:00:00Z" }),
  repoFinto("vuoto", { homepage: "", pushed_at: "2026-08-01T00:00:00Z" }),
  repoFinto("link-strano", { html_url: "https://evil.example/imadchatraoui/x" }),
];

{
  const r = P.formaRepos(LISTA, U);
  ok(r.ok, "repos: ok");
  const nomi = r.value.map((x) => x.name);
  eq(nomi, ["threejs-journey", "sito", "cattivo", "vuoto", "vecchio", "un-fork", "altro-fork"], "repos: suoi per ultimo push, poi i fork");
  ok(!nomi.some((n) => /segreto|interno|senza-visibilita|privato-ambiguo/.test(n)), "repos: MAI un privato o non dichiaratamente pubblico");
  ok(!nomi.includes("di-altri") && !nomi.includes("link-strano"), "repos: niente di altri, niente link fuori da github.com");
  const by = Object.fromEntries(r.value.map((x) => [x.name, x]));
  eq(Object.keys(by.sito), ["name", "description", "language", "url", "homepage", "pushedAt", "stars", "fork"], "repos: chiavi del contratto");
  eq(by.sito.homepage, "https://gmitorino.org/", "repos: homepage senza schema → https");
  eq(by.cattivo.homepage, null, "repos: homepage javascript: → null");
  eq(by.vuoto.homepage, null, "repos: homepage vuota → null");
  eq([by.vecchio.description, by.vecchio.language], [null, null], "repos: descrizione vuota e lingua assente → null");
  eq(by["threejs-journey"].pushedAt, "2026-11-10T09:00:00.000Z", "repos: pushedAt ISO");
  ok(!P.formaRepos({ message: "API rate limit exceeded" }, U).ok, "repos: risposta d'errore → fallisce");
  eq(P.formaRepos([], U).value, [], "repos: lista vuota → ok, nessun repo");
}

{
  const commits = [
    { sha: "a", commit: { message: "Lezione 12: luci\n\nDettagli lunghi", author: { date: "2026-11-10T08:00:00Z" }, committer: { date: "2026-11-10T09:00:00Z" } } },
    { sha: "b", commit: { message: "Fix\r\nsecondo", author: { date: "2026-11-09T08:00:00Z" }, committer: null } },
    { sha: "c", commit: { message: "x".repeat(300), author: { date: "2026-11-08T08:00:00Z" }, committer: { date: "2026-11-08T08:00:00Z" } } },
    { sha: "d", commit: { message: "quarto", author: { date: "2026-11-07T08:00:00Z" } } },
  ];
  const c = P.formaCommit(commits);
  ok(c.ok && c.value.length === 3, "commits: al massimo tre");
  eq(c.value[0], { message: "Lezione 12: luci", date: "2026-11-10T09:00:00.000Z" }, "commits: prima riga e data");
  eq(c.value[1].message, "Fix", "commits: \\r\\n");
  ok(c.value[2].message.length <= 120 && c.value[2].message.endsWith("…"), "commits: titolo lunghissimo accorciato");
  ok(!P.formaCommit({ message: "Not Found" }).ok, "commits: 404 JSON → fallisce");
}

// ------------------------------------------------------------------ rete e caricatori (finto fetch)

const TOKEN = "ghp_FINTO0123456789abcdefFINTO";
function finto(rotte) {
  const chiamate = [];
  const f = async (url, init = {}) => {
    chiamate.push({ url, init });
    for (const [pref, r] of rotte) {
      if (url.startsWith(pref)) {
        const v = typeof r === "function" ? await r(url, init) : r;
        if (v instanceof Error) throw v;
        const body = typeof v.body === "string" ? v.body : JSON.stringify(v.body);
        return new Response(body, { status: v.status || 200, headers: v.headers || {} });
      }
    }
    return new Response("not found", { status: 404 });
  };
  f.chiamate = chiamate;
  return f;
}
const ADESSO = () => new Date("2026-11-12T10:00:00Z");
const nessunSegreto = (x) => !JSON.stringify(x).includes(TOKEN) && !/authorization/i.test(JSON.stringify(x));

{
  // senza token: il calendario HTML
  const f = finto([["https://github.com/users/imadchatraoui/contributions", { body: htmlFinto() }]]);
  const r = await L.caricaContributi({ fetchImpl: f, adesso: ADESSO });
  ok(r.data && r.data.ok && r.data.days.length === 371 && r.data.total === 1234, "contributi senza token: dal calendario HTML", r.why);
  eq(f.chiamate.length, 1, "contributi senza token: una sola richiesta");
  eq(f.chiamate[0].init.headers["User-Agent"], "imad.chat-site", "rete: User-Agent senza nomi");
  ok(!("Authorization" in f.chiamate[0].init.headers), "rete: niente token verso github.com");
  ok(f.chiamate[0].init.signal instanceof AbortSignal, "rete: con timeout (signal)");
}
{
  // con token: GraphQL
  const f = finto([["https://api.github.com/graphql", { body: graphqlFinto() }]]);
  const r = await L.caricaContributi({ fetchImpl: f, token: TOKEN, adesso: ADESSO });
  ok(r.data && r.data.total === TOT && r.data.days[0].n === ANNO[0].n, "contributi con token: GraphQL", r.why);
  eq(f.chiamate[0].init.method, "POST", "graphql: POST");
  eq(f.chiamate[0].init.headers.Authorization, "Bearer " + TOKEN, "graphql: token solo nell'intestazione");
  eq(JSON.parse(f.chiamate[0].init.body).variables, { login: "imadchatraoui" }, "graphql: variabile login");
  ok(nessunSegreto(r.why) && nessunSegreto(r.data), "contributi: nessun token in why o nei dati");
}
{
  // token sbagliato → 401 → ripiega sull'HTML
  const f = finto([
    ["https://api.github.com/graphql", { status: 401, body: { message: "Bad credentials" } }],
    ["https://github.com/users/", { body: htmlFinto({ tooltip: false }) }],
  ]);
  const r = await L.caricaContributi({ fetchImpl: f, token: TOKEN, adesso: ADESSO });
  ok(r.data && r.data.days.every((g) => g.n === null), "contributi: GraphQL 401 → HTML (livelli soli)", r.why);
  eq(r.why[0].status, 401, "why: stato HTTP della fonte fallita");
  ok(nessunSegreto(r.why), "why: nessun token anche quando fallisce");
}
{
  // tutto giù → data null e why spiega
  const f = finto([
    ["https://github.com/users/", new TypeError("fetch failed")],
  ]);
  const r = await L.caricaContributi({ fetchImpl: f, adesso: ADESSO });
  ok(r.data === null, "contributi: rete giù → null");
  eq(r.why.map((p) => p.source + ":" + p.step), ["graphql:skipped", "html:fetch"], "why: passi");
  ok(/fetch failed/.test(r.why[1].error), "why: l'errore di rete", r.why);
  const g = finto([["https://github.com/users/", { body: "<html>Something went wrong</html>" }]]);
  const r2 = await L.caricaContributi({ fetchImpl: g, adesso: ADESSO });
  ok(r2.data === null && r2.why[r2.why.length - 1].step === "parse", "contributi: HTML strano → null, passo parse", r2.why);
  ok(typeof r2.why[1].bytes === "number" && r2.why[1].status === 200, "why: stato e byte");
}
{
  // timeout: un fetch che non risponde mai, ma rispetta il segnale
  const mai = (url, init) =>
    new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  const why = [];
  const t0 = Date.now();
  const t = await R.scarica(mai, { source: "x", url: "https://example.invalid/", timeoutMs: 80 }, why);
  ok(t === null && why[0].error === "timeout" && Date.now() - t0 < 1000, "rete: timeout", why);
  eq(R.TIMEOUT_MS, 6000, "rete: timeout di 6 s");
}
{
  // progetti: la lista, poi i commit del repository di studio
  const f = finto([
    ["https://api.github.com/users/imadchatraoui/repos", { body: LISTA, headers: { "x-ratelimit-remaining": "57" } }],
    ["https://api.github.com/repos/imadchatraoui/threejs-journey/commits", { body: [{ commit: { message: "Lezione 12\n\nx", committer: { date: "2026-11-10T09:00:00Z" } } }] }],
  ]);
  const r = await L.caricaProgetti({ fetchImpl: f, adesso: ADESSO });
  ok(r.data && r.data.ok && r.data.repos.length === 7, "progetti: ok", r.why);
  eq(f.chiamate[0].url, "https://api.github.com/users/imadchatraoui/repos?per_page=100&sort=pushed&type=owner", "progetti: l'endpoint dei soli pubblici");
  ok(!f.chiamate.some((c) => /\/user\/repos|\/orgs\/|type=all|visibility=/.test(c.url)), "progetti: mai un endpoint che elenca i privati");
  eq(r.data.learning, { repo: "threejs-journey", url: "https://github.com/imadchatraoui/threejs-journey", pushedAt: "2026-11-10T09:00:00.000Z", commits: [{ message: "Lezione 12", date: "2026-11-10T09:00:00.000Z" }] }, "progetti: learning");
  eq(Object.keys(r.data), ["ok", "repos", "learning", "updated"], "progetti: chiavi del contratto");
  eq(r.why[0].rateRemaining, "57", "why: limite rimasto");
  ok(!JSON.stringify(r.data).includes("segreto"), "progetti: nessun privato nella risposta");
}
{
  // il repository di studio è privato: i suoi commit non si chiedono nemmeno
  const lista = LISTA.map((x) => (x.name === "threejs-journey" ? { ...x, private: true, visibility: "private" } : x));
  const f = finto([["https://api.github.com/users/imadchatraoui/repos", { body: lista }]]);
  const r = await L.caricaProgetti({ fetchImpl: f, token: TOKEN, adesso: ADESSO });
  ok(r.data && r.data.learning === null, "progetti: studio privato → learning null");
  eq(f.chiamate.length, 1, "progetti: nessuna richiesta di commit per un repo non pubblico");
  eq(f.chiamate[0].init.headers.Authorization, "Bearer " + TOKEN, "progetti: token solo come aiuto al limite");
  ok(nessunSegreto(r.why) && nessunSegreto(r.data), "progetti: nessun token in why o nei dati");
}
{
  // commit giù → learning null, i repos restano
  const f = finto([
    ["https://api.github.com/users/imadchatraoui/repos", { body: LISTA }],
    ["https://api.github.com/repos/", { status: 409, body: { message: "Git Repository is empty." } }],
  ]);
  const r = await L.caricaProgetti({ fetchImpl: f, adesso: ADESSO });
  ok(r.data && r.data.repos.length === 7 && r.data.learning === null, "progetti: commit 409 → learning null");
  // lista giù → null
  const g = finto([["https://api.github.com/users/", { status: 403, body: { message: "API rate limit exceeded" }, headers: { "x-ratelimit-remaining": "0" } }]]);
  const r2 = await L.caricaProgetti({ fetchImpl: g, adesso: ADESSO });
  ok(r2.data === null && r2.why[0].status === 403 && r2.why[0].rateRemaining === "0", "progetti: 403 limite → null, why lo dice", r2.why);
}

{
  // token rifiutato (401) → si riprova una volta senza token
  const f = finto([
    ["https://api.github.com/users/imadchatraoui/repos", (url, init) =>
      init.headers.Authorization ? { status: 401, body: { message: "Bad credentials" } } : { body: LISTA }],
    ["https://api.github.com/repos/imadchatraoui/threejs-journey/commits", (url, init) =>
      init.headers.Authorization ? { status: 401, body: { message: "Bad credentials" } } : { body: [{ commit: { message: "ok", author: { date: "2026-11-10T09:00:00Z" } } }] }],
  ]);
  const r = await L.caricaProgetti({ fetchImpl: f, token: TOKEN, adesso: ADESSO });
  ok(r.data && r.data.repos.length === 7 && r.data.learning && r.data.learning.commits.length === 1, "progetti: token 401 → riprova senza", r.why);
  eq(f.chiamate.length, 4, "progetti: due richieste per fonte, non di più");
  ok(nessunSegreto(r.why), "progetti 401: nessun token in why");
}

rmSync(out, { recursive: true, force: true });
console.log((failed ? "FALLITE " + failed + ", " : "") + "superate " + passed + " prove (lib/github)");
process.exit(failed ? 1 : 0);
