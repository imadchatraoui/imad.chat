# Anteprime

Il disegno scelto da Imad per la home, in forma di pagina semplice (HTML, CSS e JavaScript, senza build).
È la **sorgente del disegno** per il sito vero: colori, materiali, misure, movimento e parole si copiano da qui.

- `c-widget/` — l'anteprima «Widget», seconda stesura («più aesthetic»). `NOTES.md` spiega i token, che cosa è vero e che cosa è finto, le debolezze note.
- `BRIEF.md` — le richieste di Imad con le sue parole, le regole fisse, il contratto tecnico.
- `shared/` — dati veri (`data.js`, generato da `gen-data.mjs`), astronomia leggera (`astro-lite.js`) e strumenti.

Aprirla: servire la cartella `c-widget` con un qualsiasi server statico e aprire `index.html`.

Parametri dell'indirizzo: `shot=1` (stato fermo per le fotografie), `theme=light|dark`, `t=<ISO>` (ferma «adesso»),
`open=<riquadro>` (citta, saluti, corano, cielo, palestina, codice, sudime, curiosita, cubo), `intro=1`,
`font=manrope|inter|geist|instrument|sistema`.

Strumenti, da questa cartella:

```bash
node shared/capture.mjs c-widget      # fotografie su telefono, tablet e computer, nei due temi
```

```bash
node shared/verify.mjs c-widget       # regole fisse: niente corsivo, arabo identico ai dati, niente emoji, niente scorrimento laterale
```

```bash
node shared/sheet.mjs c-widget "Widget" "una riga di descrizione"   # fogli di confronto dalle fotografie
```

```bash
node shared/testo.mjs c-widget        # tutte le parole che un visitatore può leggere
```

Le fotografie (`shots/`, `sheet-*.jpg`) non stanno nel repository: si rigenerano con i comandi qui sopra.
