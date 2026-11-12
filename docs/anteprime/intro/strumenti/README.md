# Strumenti per l'anteprima dell'intro

Si lanciano da una cartella di lavoro qualsiasi (scrivono lì i loro file).

```bash
node docs/anteprime/intro/strumenti/frames.mjs stella f "200,2350,3900,5700,7700"   # fotogrammi a istanti scelti (ms)
```

```bash
python3 docs/anteprime/intro/strumenti/sheet.py f foglio.jpg 5 300                   # li mette in un foglio solo
```

```bash
node docs/anteprime/intro/strumenti/live.mjs                                         # riproduzione dal vivo: errori, durata, stato finale
```

```bash
node docs/anteprime/intro/strumenti/video.mjs stella vid-stella                      # 60 fotogrammi al secondo, poi ffmpeg
```

```bash
ffmpeg -framerate 60 -i vid-stella/f-%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 19 -movflags +faststart intro-stella.mp4
```

La pagina si comanda dall'indirizzo: `v=stella|cursore`, `seek=1` (ferma: `window.__ni.seek(ms)` disegna un istante), più i parametri della home (`shot=1`, `theme`, `t`).

Per la casa nuova (`docs/anteprime/casa/home`, che usa la copia `intro-gatto.js`), con `node docs/anteprime/casa/strumenti/servi.mjs --port <porta>` acceso:

```bash
node docs/anteprime/intro/strumenti/casa-fotogrammi.cjs --url "http://127.0.0.1:<porta>/casa/home/index.html?seme=7&t=2026-11-12T17:30:00Z" --out f --from 5700 --to 9600 --every 50 --clip 0,0,390,640 --jpg
```

```bash
node docs/anteprime/intro/strumenti/casa-passaggio.cjs "http://127.0.0.1:<porta>/casa/home/index.html?seme=7" p 390 844 3 dark && python3 docs/anteprime/intro/strumenti/diff.py p/prima.png p/dopo.png
```

Il primo scrive i fotogrammi su un orologio finto (`vclock.js`: ogni orologio della pagina, 60 al secondo, lo stesso film a ogni giro); il secondo misura il passaggio di mano dei nove tasti dall'intro alla scena di Dot (il fotogramma prima e quello dopo, nell'area dei tasti: devono essere uguali entro pochi livelli). Nel resto della pagina le prove non sono deterministiche (il dock entra con una transizione CSS, i riquadri vivi girano da soli): per confrontare l'intro con se stessa si usa `?seek=1` e `window.__ni.seek(ms)`, che disegna qualunque istante.

## Dot nell'intro (versione «gatto», `intro-gatto.js`)

Con `node docs/anteprime/casa/strumenti/servi.mjs --port <porta>` acceso. Tutti disegnano con `window.__ni.seek(ms)` oppure su un orologio finto, e scrivono dove dici.

```bash
node docs/anteprime/intro/strumenti/gatto-striscia.cjs --url "http://127.0.0.1:<porta>/casa/home/index.html?primo=1" --out scenetta.jpg --every 40 --dpr 2
node docs/anteprime/intro/strumenti/gatto-striscia.cjs --url "http://127.0.0.1:<porta>/casa/home/index.html?primo=1" --scena salto --out salto.jpg --clip 130,330,260,514
```

Strisce di fotogrammi: `--scena gag` (la scenetta della riga, da `T.gag` = l'ultimo tasto) o `salto` (il salto nel quadrato del punto, da `T.jump`); `--from`/`--to` in ms dall'inizio della scena; senza `--clip` il ritaglio è quello che l'intro dice (`__ni.box`). Mette il foglio insieme `striscia.py`.

```bash
node docs/anteprime/intro/strumenti/gatto-confronta.cjs --base http://127.0.0.1:<porta> --w 390 --h 844 --dpr 3
```

«stella» e «cursore» della copia contro `intro.js` (servito al posto della copia), dieci istanti più la fine: pixel della tela e quello che l'intro scrive nella pagina. Devono essere uguali.

```bash
node docs/anteprime/intro/strumenti/gatto-seek.cjs --base http://127.0.0.1:<porta> --ogni 5
```

`seek` contro la riproduzione vera (orologio finto) nella scenetta e nel salto. La riga «seek nella stessa pagina» deve dire «nessuno»; tra due pagine diverse può differire il primo fotogramma con le foto (il browser le decodifica in modo diverso la prima volta), non la logica.

```bash
node docs/anteprime/intro/strumenti/gatto-film.cjs --base http://127.0.0.1:<porta> --out prima-visita.mp4 --a 16800 --momenti momenti.jpg
```

Il film della prima visita (60 al secondo, H.264), con quando la pagina si libera, quando appare «salam, sono Dot.», gli errori e le richieste fallite.

Nota per tutti: in `?seek=1` l'intro misura le lettere una volta, all'avvio; se il carattere arriva dopo, le misure sono di quello di riserva. Gli strumenti caricano prima i caratteri (o rifanno l'avvio togliendo `ni-on`).
