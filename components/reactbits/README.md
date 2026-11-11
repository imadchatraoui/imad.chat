# React Bits

Componenti presi da [React Bits](https://reactbits.dev) di David Haz, attraverso il registro shadcn
configurato in `components.json` (`@react-bits`). Licenza: MIT + Commons Clause, testo in
`LICENSE-reactbits.txt`: si possono usare nel sito, non rivendere o ridistribuire come libreria.

I file di questa cartella sono copie fedeli del registro: non si modificano a mano. Chi li usa li avvolge
in un componente del sito (colori dai token, `prefers-reduced-motion`, pausa fuori schermo).

Aggiungerne uno:

```bash
npx shadcn@latest add @react-bits/NomeComponente-TS-CSS
```

Regola di Imad: un componente entra solo dove serve al disegno, mai come effetto appiccicato.
Quelli che alla fine non vengono usati si tolgono.

| Componente | A cosa serve nel sito |
|---|---|
| `TextType` | l'apertura: `hello, world` che diventa `hello, imad's world` |
| `ShinyText` | il riflesso sulla scritta `imad.chat` |
| `Grainient`, `SoftAurora` | lo sfondo vivo con i colori del cielo vero |
| `Noise` | la grana sopra la pagina |
| `Counter` | le cifre degli orologi delle città |
| `CountUp` | il numero dei saluti nel cielo |
| `ClickSpark`, `StarBorder` | il saluto che diventa una stella |
| `Stack` | le carte di "Lo sapevi" |
| `GlassSurface` | i pulsanti di vetro |
| `SpotlightCard`, `BorderGlow` | la luce che segue il puntatore sui riquadri, da computer |
| `BlurText`, `GradualBlur` | titoli delle pagine e bordi sfocati |
| `sounds/` | suoni Web Audio (tasti, apertura e chiusura, saluto, pagina): spenti finché il visitatore non li accende |
