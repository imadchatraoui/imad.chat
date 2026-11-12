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
