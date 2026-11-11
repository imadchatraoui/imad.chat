# L'astrolabio

Il cuore di *imad's world*: un astrolabio d'ottone vero, in 3D (React Three Fiber), che legge il cielo
in tempo reale. Senza WebGL, o con "riduci movimento", diventa la sua versione 2D in SVG con la stessa
matematica e gli stessi metodi.

```
components/astrolabe/
  index.ts              API pubblica
  Astrolabe.tsx         il componente (sceglie 3D o 2D, espone i metodi)
  AstrolabeScene.tsx    Canvas R3F, luci da studio con Lightformer (niente HDR esterni)
  AstrolabeFallback.tsx versione 2D in SVG
  AstrolabeLab.tsx      banco di prova per /lab/astrolabio (non indicizzato)
  types.ts              props e metodi
  engine/               il motore, senza React
    engine.ts           tempo, gesti, animazioni, piastre, Tariq, qibla, rompicapo
    model.ts            geometrie e materiali dell'ottone
    paint.ts            le incisioni (canvas) e le sagome traforate
    contours.ts         dalla sagoma dipinta ai contorni da estrudere (marching squares)
    sky.ts              il cielo vero dietro lo strumento: gradiente, stelle, Luna
    fx.ts               bagliori, linea della qibla, strato di at-Tariq
    motifs.ts           i motivi delle città (tatreez, Liberty, onde, zellige...)
lib/astro/              la matematica, senza React (vedi sotto)
```

## Uso

Il componente usa WebGL e `window`: si importa solo nel browser.

```tsx
"use client";
import dynamic from "next/dynamic";
import type { AstrolabeHandle } from "@/components/astrolabe";

const Astrolabe = dynamic(() => import("@/components/astrolabe").then((m) => m.Astrolabe), { ssr: false });

export function Strumento() {
  const api = useRef<AstrolabeHandle | null>(null);
  return (
    <div style={{ position: "relative", height: "100svh" }}>
      <Astrolabe
        city="al-quds"
        observer={{ lat: 45.07, lon: 7.69 }}
        sections={[{ id: "palestina", title: "Palestina", angle: 298 }]}
        onReady={(h) => (api.current = h)}
        onStarSelect={(id) => apriScheda(id)}
        onSectionSelect={(id) => apriSezione(id)}
        onEvent={(name) => suona(name)}
        onTimeChange={(date, isNow) => mostraOra(date, isNow)}
      />
    </div>
  );
}
```

Il componente riempie il suo contenitore (`width: 100%; height: 100%`): il contenitore deve avere
un'altezza. Con `next/dynamic` il `ref` può non arrivare: per questo `onReady` riceve gli stessi metodi.

`AstrolabeFallback` si può usare anche da solo, per esempio come segnaposto mentre si carica il 3D:
è SVG puro, accetta le stesse props e lo stesso `ref`.

### Props

| prop | tipo | |
|---|---|---|
| `city` | `string` | id della città in `content/astro/cities.json`; predefinita `torino`. Cambiandola la piastra si scambia con un'animazione meccanica (la rete si solleva, la vecchia piastra esce a sinistra, la nuova entra da destra e si assesta) e il cielo dietro diventa quello della città, alla sua ora vera. |
| `observer` | `{ lat, lon } \| null` | dove si trova chi guarda, per la qibla; senza, si usa la città della piastra. |
| `sections` | `{ id, title, angle }[]` | segni incisi sul lembo: `angle` in gradi da 0 in alto (sotto il trono) in senso orario, come la scala del lembo. |
| `onStarSelect` | `(id) => void` | tocco su un puntatore della rete (id di `stars.json`). |
| `onSectionSelect` | `(id) => void` | tocco su un segno del lembo. |
| `onReady` | `(api) => void` | lo strumento è pronto; riceve i metodi qui sotto. |
| `onEvent` | `(name) => void` | per i suoni, vedi "Eventi". |
| `onTimeChange` | `(date, isNow) => void` | l'istante mostrato dalla rete (al massimo ~8 volte al secondo). |
| `initialState` | `"assembled" \| "exploded" \| "hidden"` | `hidden` per l'intro: lo strumento aspetta `assemble()`. |
| `framing` | `{ top, bottom, side }` | spazio libero attorno allo strumento, in frazioni del contenitore (per logo, menu, comandi). Predefinito `{ top: .06, bottom: .1, side: .035 }`. |
| `sky` | `"full" \| "stars" \| "none"` | `full`: cielo disegnato; `stars`: sfondo trasparente con stelle e Luna, da mettere sopra uno sfondo della pagina (le foto delle città); `none`: solo lo strumento. |
| `tariqVideo` | `"auto" \| "procedural"` | `auto`: se il manifesto elenca `video/tariq-v.mp4` (verticale) o `video/tariq-h.mp4`, at-Tariq è quel video al posto del cielo; altrimenti la versione disegnata. |
| `forceFallback` | `boolean` | forza la versione 2D. |
| `className` | `string` | sul contenitore. |

### Metodi (ref o `onReady`)

| metodo | |
|---|---|
| `assemble()` | le parti esplose (o nascoste) volano al loro posto con un'andatura meccanica: madre, trono, piastra, rete che gira fino all'ora vera, regola, perno, cavallo; alla fine l'anello dondola. Da `hidden` comincia con il lembo fermo al suo posto, per raccordarsi al cerchio disegnato dall'intro. |
| `explode()` | le parti si separano lungo l'asse, vista di tre quarti. |
| `flip()` | lo strumento si gira: sul retro scale, zodiaco, calendario, quadrato delle ombre e, inciso, il codice vero che calcola la rete (la camera si avvicina per leggerlo). Di nuovo `flip()` per tornare davanti. |
| `triggerTariq()` | at-Tariq (86:1-3): tre colpi luminosi e poi un raggio che trafigge il buio. La stella non è identificata con nessuna del catalogo: gli esegeti ne discutono. |
| `setTime(date, { animate? })` | porta la rete a un istante. |
| `resetNow()` | "Adesso": la rete torna al cielo vero e lo segue. |
| `pointQibla(on = true)` | la regola gira verso il punto dell'orizzonte della piastra all'azimut della qibla (Kaʿba 21.4225 N, 39.8262 E); una linea luminosa segna l'arco d'azimut fino allo zenit, un piccolo cubo nero con la fascia d'oro segna il punto. Ritorna l'azimut in gradi. `pointQibla(false)` torna al Sole. |
| `scramble()` / `realign()` | gli anelli (disco interno della piastra, corona esterna, lembo) si scombinano come strati di un cubo di Rubik; si rigirano col dito (scattano ogni 45°). Riallineati, si apre la piastra segreta: gli orizzonti di tutte le città su una sola piastra. Anche una pressione lunga sul trono scombina (o riallinea). |
| `selectStar(id \| null)` | evidenzia un puntatore. |
| `getTime()`, `isNow()` | l'istante mostrato. |
| `getLimbScreenCircle()` | il cerchio esterno del lembo sullo schermo, `{ cx, cy, r }` in pixel CSS dal canvas: per allineare il cerchio disegnato dall'intro. |
| `mode` | `"3d"` o `"2d"`. |

### Eventi (`onEvent`)

`tick` (scatto: ogni ora passata girando la rete, ogni pezzo che si incastra, ogni anello del rompicapo),
`plate`, `assemble`, `explode`, `flip`, `tariq` (inizio), `tariq-knock` (×3), `tariq-pierce`, `qibla`,
`select`, `scramble`, `unlock`.

### Gesti

- Trascinare sul disco gira la rete attorno al perno: un giro è un giorno siderale. Con inerzia; ci si
  appoggia morbidamente sull'ora intera se ci si ferma a meno di 7 minuti. Fuori dal disco la pagina
  scorre normalmente (il `touchstart` viene fermato solo se il dito parte sullo strumento).
- Tocco su un puntatore: `onStarSelect`. Tocco su un segno del lembo: `onSectionSelect`.
- Sul retro, trascinare gira l'alidada.
- Tastiera (lo strumento è focalizzabile): frecce = un'ora (con Maiusc dieci minuti), Home = adesso.

## Che cosa mostra, e perché è giusto

- **Proiezione**: stereografica dal polo sud celeste sul piano dell'equatore; unità: il tropico del
  Capricorno ha raggio 1. In alto il meridiano sud, a sinistra l'est (oriente), a destra l'ovest: le stelle
  sorgono a sinistra, culminano in alto, tramontano a destra, e col tempo la rete gira in senso orario.
- **La rete** gira con il tempo siderale locale apparente (`reteAngle`, inciso sul retro). Le stelle sono
  portate dal J2000 all'equatore e all'equinozio veri della data (precessione e nutazione di astronomy-engine).
  Ogni puntatore a fiamma ha la punta esattamente sulla stella; se la stella cade sull'ottone (Betelgeuse
  e Alpheratz sui coluri, Regolo sull'eclittica) è segnata da un foro. Sirio (al-Shiʿrā, Corano 53:49) ha
  una rosetta traforata alla base del suo puntatore. Antares entra appena: la piastra ha una corona larga
  apposta.
- **La piastra** di ogni città è calcolata per la sua latitudine: almucantarat ogni 6°, azimut ogni 15°,
  orizzonte, tropici, equatore, crepuscolo a -18° (tratteggiato), ore ineguali della notte; il cartiglio
  in basso porta nome, nome locale (dal JSON), coordinate e il motivo della città. Cusco, a sud, funziona:
  il cielo visibile è fuori dal cerchio dell'orizzonte.
- **La regola** segue il Sole sulla rete (un piccolo sole d'oro sull'eclittica): sotto la sua punta, sul
  lembo, si legge l'ora solare vera (anello delle 24 ore, mezzogiorno in alto).
- **Il cielo dietro** è quello vero della città: 1630 stelle del Yale Bright Star Catalogue (fino alla
  magnitudine 5), il gradiente dall'altezza vera del Sole (giorno, crepuscoli, notte), la Luna nella sua
  posizione topocentrica con la fase vera.
- **Il retro**: scala delle altezze, zodiaco, calendario allineato alla longitudine vera del Sole,
  quadrato delle ombre, la firma "hello, imad's world" e il codice di `reteAngle`.

### Verifica

`node check.mjs` (nella cartella di lavoro dell'agente, vedi il rapporto) traspila `lib/astro` e confronta
con astronomy-engine, per Sirio, Vega e Aldebaran a Torino, Al-Quds e Cusco: quando una stella sta sul
cerchio dell'orizzonte della piastra la sua altezza è 0,0000° (entro 1e-4°), e l'istante coincide entro
4 s con `SearchAltitude`; sorge a sinistra con azimut < 180°, tramonta a destra; sul meridiano in alto è
al transito (altezza 90-|φ-δ| esatta, azimut 180° o 0°, entro 1,3 s da `SearchHourAngle`). Controlla
anche che il codice inciso coincida con `lib/astro/time.ts` e che il Sole vero cada sull'eclittica della rete.

## lib/astro

Senza React, usabile ovunque (anche sul server):

- `projection.ts`: `radiusOfDec`, `projectHourAngle`, `projectOnRete`, `rotateClockwise`, `clockAngle`,
  `horizontalToEquatorial`, `equatorialToHorizontal`, `eclipticToEquatorial`, `eclipticCircle`,
  costanti `OBLIQUITY`, `R_EQ`, `R_CANCER`.
- `time.ts`: `reteAngle(date, lon)` (la funzione incisa), `localSiderealHours`, `msForReteTurn`,
  `localTimeString(date, tz)`, `localDateString(date, tz)`.
- `sky.ts`: `toDateCoords`, `toDateCoordsMany`, `horizontalOf`, `sunEquatorial`, `moonEquatorial`,
  `sunAltitude`, `skyPhase`, `moonInfo` (fase e nome italiano: "stanotte la stessa luna su Torino e su
  Gaza"), `brightStars`, `starColor`.
- `plate.ts`: `plateGeometry(lat)`, `almucantar`, `azimuthCurve`, `horizonPoint`, `isAboveHorizon`.
- `rete.ts`: `reteDesign(stars)`, `ZODIAC_IT`.
- `qibla.ts`: `KAABA`, `qiblaBearing(lat, lon)`, `kaabaDistanceKm` (Londra 118,99°, Torino 121,22°).
- `data.ts`: `STARS`, `CITIES`, `VERSES`, `CURIOSITIES`, `getCity`, `getStar`, `citiesInOrder`.
- `engraving.ts`: `RETE_SOURCE`, il testo inciso sul retro.

## Caratteri

Le incisioni si disegnano su canvas con i caratteri della pagina, letti da variabili CSS sull'elemento
che contiene l'astrolabio: `--font-newsreader` (serif, numeri e nomi), `--font-amiri` (arabo, dai JSON),
`--font-geist-mono` (solo dati: coordinate, gradi, il codice). Mancando, ripiega su Georgia e ui-monospace.
Il layout principale carica già Newsreader e Amiri; Geist Mono va aggiunto (`geist/font/mono`), come fa
`app/lab/astrolabio/page.tsx`.

## Asset generati (public/media/manifest.json)

Tutto funziona senza. Se il manifesto li elenca:

| percorso | uso |
|---|---|
| `tex/T02.jpg` (o `T01.jpg`) | dettaglio fotografico dell'ottone fuso nella patina di tutte le facce |
| `orn/O01S.svg` (o `O01P.png`) | sagoma del trono, tracciata ed estrusa al posto di quella procedurale (nasconde l'anello 3D) |
| `orn/O02S.svg` (o `O02P.png`) | sagoma del cavallo |
| `orn/O05S.svg` (o `O05P.png`) | la shamsa incisa (retro, piastra segreta) |
| `band/<città>.png`, `band/oliva.png` | fascia ornata sul bordo della piastra (8:1, nero su bianco) |
| `video/tariq-v.mp4`, `video/tariq-h.mp4` | at-Tariq in video al posto del cielo (vedi `tariqVideo`) |

Le foto e i loop delle città (`city/...`) non sono disegnati qui: con `sky="stars"` lo sfondo resta
trasparente e la pagina può metterli dietro. I suoni li suona la pagina con `onEvent`.

## Prestazioni

- `frameloop="demand"`: si disegna solo quando qualcosa si muove (gesti, animazioni) e ogni 15 s per
  seguire il cielo. DPR al massimo 1,75. Niente ombre in tempo reale (ombre di contatto finte, sfocate,
  sotto rete e regola), niente post-processing.
- Texture incise a 2048 px sugli schermi grandi, 1024 sui telefoni e sui dispositivi deboli; una sola
  texture per faccia (colore e rilievo), rugosità che cresce nei solchi via `onBeforeCompile`.
- Il modello si costruisce a piccoli passi cedendo il filo principale (circa 1 s di lavoro in tutto su un
  portatile): conviene montarlo presto, per esempio con `initialState="hidden"` durante l'intro.
- La rete è un'unica geometria estrusa dalla sua sagoma dipinta: tutti i trafori in una draw call.
