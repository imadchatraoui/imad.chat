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
