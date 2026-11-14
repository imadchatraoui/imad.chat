# Anteprime

Le sorgenti delle pagine del sito, in forma di pagine semplici (HTML, CSS e JavaScript, senza build).
`node scripts/home/build.mjs` le copia in `public/` (`public/casa`, servita a `/`, e `public/gatto`).

- `casa/` — la casa (`home/`) e le sue pagine (`progetti/`, `mondo/`, `su-di-me/`, `tools/`, `scatola/`), la cornice comune
  (`comune/`) e gli strumenti di lavoro (`strumenti/`, mai online). Il disegno è in `casa/CASA.md`.
- `gatto/` — Dot, il gatto (la pagina di prova è `/gatto`). Il disegno è in `gatto/DOT.md`.
- `intro/` — l'intro (`intro-gatto.js`, `intro.css`), le sue foto (`media/`, fonti in `FONTI.md`) e i suoi strumenti (`strumenti/`).
- `shared/` — dati veri (`data.js`, scritto da `gen-data.mjs` dai contenuti verificati di `content/astro`), astronomia leggera
  (`astro-lite.js`) e strumenti.
- `BRIEF.md` — il brief del primo giro della home: le richieste di Imad con le sue parole, le regole fisse, il contratto tecnico.

Aprirle senza Next: `node casa/strumenti/servi.mjs`, poi `/casa/home/index.html`.

Parametri dell'indirizzo della casa: `shot=1` (niente intro, stato fermo per le fotografie), `theme=light|dark`, `t=<ISO>` (ferma «adesso»),
`open=<riquadro>`.

Strumenti, da questa cartella, sul sito in esecuzione (`npm run start`, oppure `servi.mjs` con l'indirizzo della casa):

```bash
node shared/capture.mjs <cartella-dove-salvare> --base http://localhost:3000     # fotografie su telefono, tablet e computer, nei due temi
```

```bash
node shared/verify.mjs --base http://localhost:3000 --repo ../..               # regole fisse: niente corsivo, arabo identico ai dati, niente emoji, niente scorrimento laterale
```

```bash
node shared/testo.mjs --base http://localhost:3000                             # tutte le parole che un visitatore può leggere
```

```bash
node shared/gen-data.mjs ../..                                                 # riscrive shared/data.js da content/astro
```

Le fotografie non stanno nel repository: si rigenerano con i comandi qui sopra.
