# Fonti e licenze — anteprima della tastiera

Tutto ciò che questa cartella usa sta nella cartella stessa o in `../gatto/`: nessuna richiesta ad altri siti.

| cosa | da dove | licenza |
| --- | --- | --- |
| three.js 0.187.0 (`vendor/three.module.js`, `vendor/three.core.js`, `vendor/RoomEnvironment.js`, `vendor/RoundedBoxGeometry.js`, `vendor/BufferGeometryUtils.js`) | il pacchetto `three` già installato nel progetto (`node_modules/three`: `build/` ed `examples/jsm/`), copiato senza modifiche | MIT, © 2010-2026 three.js authors: `vendor/LICENSE-three.txt` |
| Manrope (`vendor/manrope-latin.woff2`) | la copia del sito: `docs/anteprime/casa/tools/qr/vendor/` | SIL Open Font License 1.1: `vendor/manrope-latin.LICENSE` |
| Geist Mono (`vendor/geist-mono-latin.woff2`) | la copia del sito: `docs/anteprime/casa/comune/vendor/` | SIL Open Font License 1.1: `vendor/geist-mono-latin.LICENSE` |
| Dot (lo scheletro e l'aspetto «Manifesto») | `../gatto/dot-rig.js`, `../gatto/look-manifesto.js`, caricati così come sono | del sito |

## Modelli 3D

**Nessun modello preso da fuori.** Ogni pezzo (tasti, switch, piastra, scheda, guscio, viti, stabilizzatori, cavo, attrezzi, scatola, bottone, macchina da scrivere) è costruito dal codice di questa cartella (`forme.js`, `parti.js`, `banco.js`, `macchina.js`).

Un solo tentativo è stato fatto, il 2026-11-14: l'elenco dei modelli di Poly Haven (CC0, `https://api.polyhaven.com/assets?t=models`, 522 modelli) si scarica, ma non contiene tastiere, tasti, switch né macchine da scrivere; le sole voci vicine sono tre cacciaviti fotografati dal vero, consumati e sporchi («flathead_screwdriver», «screwdriver», «screwdrivers_02»), lontani dall'aspetto del sito. Non è stato scaricato nessun modello.

## Testi e immagini

Le scritte sulla scheda (`imad.chat`, `65% · 68 TASTI · FATTA DA DOT`, `K1`…`K68`), sulla targhetta della macchina (`imad.chat`) e sul cartellino del bottone (`DO NOT PRESS`) sono disegnate dal codice. Le parole della zona contatto («Scrivi qui. I tasti si muovono con te.», «Scrivi. La macchina batte sul foglio.», «Scrivi qualcosa», «Invia») sono nostre e provvisorie: le scrive Imad. Nessuna fotografia, nessuna immagine presa da archivi.
