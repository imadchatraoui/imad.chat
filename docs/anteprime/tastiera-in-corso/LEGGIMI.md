# La macchina da scrivere: lavoro a metà (in pausa dal 14 novembre 2026)

Copia dei file dell'agente che stava facendo la macchina da scrivere costruita da Dot (ramo locale `macchina`, commit `3878d77`), messa qui perché non vada persa se la sessione si chiude. Imad ha messo in pausa il lavoro: non riparte finché non lo dice lui.

- Non è collegata a niente e non va online: `scripts/home/build.mjs` legge solo `docs/anteprime/tastiera/`.
- Manca la cartella `vendor/` (three.js e i caratteri): è la stessa di `docs/anteprime/tastiera/vendor/`.
- Nuovi rispetto a `docs/anteprime/tastiera/`: `macchina.js` (il modello nuovo; quello vecchio è `macchina0.js`), `effetti.js` (polvere, scintille), `pose.js` (le pose di Dot al lavoro), `racconto.js` (la sequenza della costruzione). Cambiati: `forme.js`, `gatto.js`, `scena.js`, `tavole.js`.
- Fatto: modello, effetti, pose, sequenza; un solo giro di immagini di prova. Da fare: rifinire guardando le immagini, la scrittura vera sul foglio, il tocco, le clip, le prove, le note in `TASTIERA.md`, la pubblicazione.
- Per riprendere: copiare questi file in `docs/anteprime/tastiera/` di un ramo di lavoro e continuare dal compito scritto in `CLAUDE.md` (sezione State).
