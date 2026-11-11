# Widget — seconda stesura («più aesthetic»)

Imad ha scelto questa anteprima con le parole «usa questo però miglioralo più aesthetic».
La composizione è quella che ha visto; cambiano atmosfera, materiali, luce, respiro e dettagli vivi.
Confronto in una sola immagine: `prima-dopo.jpg`. Fogli: `sheet-home.jpg`, `sheet-dettagli.jpg`, `sheet-desktop.jpg`. Fotografie: `shots/`.

## L'idea, in tre frasi

Una schermata di widget fatti solo per Imad, posata su uno sfondo vivo che prende i colori dal cielo vero di Torino in questo momento.
Una sola luce, dall'alto: ogni superficie ha una sfumatura profonda, un filo di luce sul bordo alto e una grana finissima.
L'apertura è la stella che sale: si posa nel cielo dell'hero, resta lì come prima stella, e i saluti dei visitatori sono le sue compagne.

## Che cosa è cambiato rispetto alla bozza

1. **Regola fissa riparata**: nessun `letter-spacing` / `word-spacing` / ombra sul testo arabo (`[lang="ar"], .ayah` in `style.css`). Il controllo automatico dà 0 BLOCCHI e 0 AVVISI.
2. **Sfondo vivo**: quattro grandi campi sfocati (zenit, mezzo cielo, rosa, orizzonte del cielo di Torino), ricalcolati ogni minuto, che derivano piano; grana su tutto. Tema chiaro: lilla, pervinca e pesca su quasi-bianco.
3. **Materiali**: neutri smerigliati che lasciano trasparire lo sfondo; carta, oliva, inchiostro, notte e cielo con sfumature profonde, filo di luce in alto, ombra morbida e colorata nel tema chiaro. Raggi 32/34 px, righe interne concentriche (22/24 px).
4. **Hero**: cielo a quattro toni con bagliore all'orizzonte e grana, stelle più fini, la prima stella con il suo alone, una stella-saluto che porta la sua parola (ciao, salam, hello… cambia ogni 4 s; sul computer sono tre). L'etichetta «128 saluti nel cielo» è passata in alto a sinistra (bersaglio 44 px) perché in alto a destra riposa la prima stella. Chi ha lasciato un saluto vede la sua stella dorata con la sua parola.
5. **Corano**: etichetta «Versetto di oggi», scelto per giorno tra i versetti brevi (53:49, 16:16, 55:5); riferimento accanto al nome della sura. Il versetto non viene mai tagliato: se non sta, il corpo scende di poco, e se ancora non sta si passa a un versetto più breve.
6. **Città**: le cinque righe stanno tutte sopra la piega a 390×844 (hero e Corano più bassi); ore con i due punti che respirano, arco con la posizione del Sole (di notte il punto passa sotto l'orizzonte), disco della Luna con la fase vera accanto al titolo.
7. **Palestina**: oliva profondo con luce morbida e grana, proporzioni più strette (2,36 celle invece di 3), disco del cielo di Gaza più grande. Nessun contenuto inventato.
8. **Cubo**: riquadro quadrato suo, cubo sospeso con ombra a terra e riflesso che segue la luce; si trascina. **Avatar**: sfera morbida con l'iniziale.
9. **Bersagli** tutti da 44 px in su. **Suoni**: il pulsante funziona davvero (WebAudio: tic su apertura e chiusura, tre note quando un saluto diventa stella); spento finché non lo si tocca.
10. **Pagine aperte**: città con la striscia panoramica «Cinque città. Un solo cielo.» (ovest → est: Casablanca, Torino, Gaza, Medina, Makkah), Luna, archi, qibla; saluti con alone dietro il numero; lettore con «Versetto di oggi»; mappa del cielo con nomi a 12 px che evitano stelle e altri nomi; tutte le pagine «In arrivo: …» disegnate (cubo: «In arrivo: il gioco del cubo, con cronometro e tempi migliori.»).
11. **In fondo alla pagina**: «Il cielo di questa pagina è quello di Torino, adesso: 16:50, tramonto.» con ora e momento veri.
12. **Apertura**: una stella sale in verticale fino al suo posto mentre si scrive `hello, world` → `hello, imad's world`, si posa con un battito di luce, le compagne si accendono, la frase si raccoglie in `imad.chat`, il cielo si posa nel riquadro e gli altri entrano sfalsati. Circa 4,5 s, si salta con un tocco; con «meno movimento» si vede subito lo stato finale.
13. **Movimento solo con `transform` e `opacity`**: la metamorfosi di apertura non anima più il raggio (telefono: un «fantasma» grande quanto il riquadro cresce in scala uniforme; tablet e computer: la scheda cresce dal centro del riquadro; apertura: il cielo è grande quanto l'hero e ingrandito fino a coprire lo schermo).
14. Codice: riga «// adesso 296,0°» calcolata; «Lo sapevi»: contatore 1/10 e linea di avanzamento; segnaposto del logo (un quadratino con il cielo di adesso e la prima stella).
15. Computer: bento a 12 colonne su 7 righe (città a cinque righe, «Lo sapevi» piccolo), luce che segue il puntatore, sollevamento al passaggio, anello di fuoco da tastiera.

## Token

### Colori
| | Chiaro | Scuro |
|---|---|---|
| fondo / pagina aperta | `#f5f4f9` / `#f7f6fb` | `#070810` / `#0c0d16` |
| testo, secondo e terzo livello | `#16171d`, 66%, 44% | `#f4f5fa`, 66%, 42% |
| neutro smerigliato | bianco 88% → 62% | bagliore 7,5% in alto + bianco 9% → 5% |
| carta (Corano) | `#fffaf0` → `#f7efdc` + luce bianca in alto | `#2a241c` → `#1b1712` + luce calda 10% |
| oliva (Palestina) | `#6f7e4f` → `#515f37` → `#3a4627` + luce in alto a sinistra | `#4d5a37` → `#363f25` → `#242c17` |
| inchiostro (codice) | `#181e3c` → `#0c1022` + luce blu 16% | uguale |
| notte (mappa del cielo) | radiale `#1e2859` → `#111838` → `#0a0e24` | uguale |
| argilla (accento) | `#a4543b`; pulsante `#c9775a` → `#a4543b` | `#e3a48c` |
| oro delle stelle-saluto | `#f3dfa8` (su chiaro `#b98a2e`) | `#f3dfa8` |
| cubo | i pastelli di `IMAD_DATA.cube` | uguale |

- **Cielo**: tabella per altezza del Sole (60°, 15°, 6°, 2°, 0°, −3°, −7°, −12°, −18°) → zenit, mezzo cielo, orizzonte, colore e forza del bagliore; interpolazione in OKLab; il «rosa» tra mezzo cielo e orizzonte è una miscela in OKLCH lungo l'arco breve della tinta. Bagliore dal lato del Sole (20% se sale, 80% se scende).
- **Sfondo**: stessa tinta dei quattro toni del cielo di Torino, con luminosità e croma fissate per tema (scuro L 0,25–0,40, C 0,075–0,135; chiaro L 0,90–0,925, C 0,045–0,065). Due livelli, deriva 46 s e 58 s.
- **Grana**: tessera di rumore 128 px disegnata con canvas (seme fisso), mostrata a 96 px, alfa fino al 7,5% (media circa 3%); è il primo livello di sfondo di ogni superficie, sempre sotto il testo.
- **Filo di luce**: bordo a gradiente di 1 px (0,5 px sugli schermi 2x): bianco 100/75/45% sui neutri chiari, 20/7/3,5% sui neutri scuri, 30/9/4% sulle superfici colorate.
- **Ombra (chiaro)**: `0 12px 28px -12px` al 15% + `0 36px 64px -36px` al 22%, tinta viola-blu `46 40 100`; sotto i riquadri colorati prende il loro colore (30% / 42%).

### Forma
Riquadri 32 px (telefono), 34 px (tablet e computer); righe interne raggio − 10; pillole metà altezza; schede aperte su tablet e computer 40 px.
Griglia: 4 colonne, spazio 12 px, margine 16 px (8 colonne a 700 px, 12 colonne a 1100 px). Margine interno 20 px nei riquadri larghi, 18 px in quelli a due colonne (18/16 sotto i 375 px).

### Tipografia (Manrope di base; la barra prova Inter, Geist, Instrument Sans, Sistema)
| Ruolo | Corpo / interlinea | Peso | Spaziatura |
|---|---|---|---|
| marchio nell'hero | 0,79 × cella (≈ 64 px; 0,86 tablet; 1,02 computer) / 0,94 | 800 | −0,055em |
| Palestina | 0,56 × cella (≈ 45 px; 0,68 computer) / 1 | 700 | −0,05em |
| numeri grandi delle pagine | 32 px (ore), 84 px (saluti), tabellari | 700–800 | −0,045 / −0,06em |
| ore nelle righe | 20 px / 22 (23 px computer), tabellari | 700 | −0,03em |
| titolo di riquadro | 15–17,5 px / 1,18 | 700 | −0,028em |
| testo | 15–15,5 px / 1,42 | 500 | −0,012em |
| testo piccolo | 13–13,5 px / 1,44 | 500 | −0,006em |
| etichetta calma | 13 px / 18, al 66% | 600 | −0,008em |
| minimo | 12 px | | |
| Corano | Amiri Quran, 0,43 × cella (0,46 tablet, 0,5 computer), 32 px nel lettore; interlinea 2; nessuna spaziatura, nessun effetto | 400 | normale |

### Movimento
Pressione: scala 0,972 in 140 ms. Apertura: molla (ζ 0,8) 560 ms; chiusura 420 ms. Entrata dei riquadri: molla (ζ 0,66) 620 ms, sfalsata di 45 ms.
Stella dell'apertura: salita 2,6 s, battito 1,15 s. Continui: alone 5,6 s, due punti 2 s, scintillio 2,8–5,4 s, mappa del cielo 3,4–6,6 s, sfondo 46/58 s, cubo 5 s, curiosità 9,5 s, parole dei saluti 4,2 s.
Con «meno movimento»: stati finali, nessuna apertura, nessuna animazione continua (verificato: zero animazioni in corso), dissolvenze di 180/150 ms al posto dei movimenti.
Eccezioni dichiarate al «solo transform e opacity»: i cambi di colore di stato (pillole dei saluti, righe dell'elenco) usano una breve transizione di colore.

## Che cosa è vero e che cosa è finto

**Vero** (calcolato nel telefono con `ImadAstro`, congelabile con `?t=`): le ore delle cinque città (con la correzione per il Marocco); il colore del cielo di ogni città dall'altezza del Sole, ogni minuto; alba e tramonto e la posizione del Sole sull'arco; la fase della Luna; la mappa del cielo (42 stelle dove sono davvero sopra Torino, più Luna e Sole); direzione e distanza della qibla; la funzione nel riquadro del codice è quella vera e il valore «adesso» è calcolato (tempo siderale medio: differenza trascurabile); versetti, traduzione, curiosità, saluti e colori del cubo vengono solo da `IMAD_DATA`.

**Finto o provvisorio**: i 128 saluti sono stelle di esempio con posizioni a seme fisso; il saluto del visitatore resta solo su quel telefono (`localStorage`), non è condiviso; le parole portate dalle stelle nell'hero sono a rotazione dall'elenco, non saluti veri; il collegamento a Instagram è `#`; la riga di «Su di me» è provvisoria (la scriverà Imad: lo dico solo qui, non sulla pagina); Palestina ha solo il segnaposto; il cubo gira ma non si gioca; i suoni sono toni WebAudio, non i suoni importati; il logo è un segnaposto; l'arco del Sole è uno schema (stessa curva per tutte le città, conta la frazione di giornata trascorsa); la striscia panoramica sfuma tra i cinque cieli calcolati, non calcola ogni longitudine; le pagine «In arrivo».

## React Bits per la versione vera (nomi presenti nel registro salvato)

- `TextType`: `hello, world` nell'apertura e il codice battuto a macchina.
- `CountUp` / `Counter`: il contatore dei saluti (128 → 129).
- `GlassSurface`: solo per i tre piccoli vetri (barra attaccata, etichetta dell'hero, pulsanti rotondi), non per i riquadri.
- `SpotlightCard`: la luce che segue il puntatore sui riquadri, sul computer.
- `AnimatedContent` / `FadeContent`: l'entrata sfalsata dei riquadri.
- `Noise` oppure `Grainient`: la grana e, volendo, lo sfondo (a patto che prenda i quattro colori del cielo come parametri e resti leggero sul telefono; altrimenti il CSS di qui basta).
- `Galaxy` / `Particles`: il cielo della pagina dei saluti, se regge sui telefoni; le stelle dell'hero restano SVG (devono stare in posizioni esatte).
- `ClickSpark`: il momento in cui un saluto diventa stella (facoltativo).
- Da non usare: `MagicBento` (effetti troppo vistosi: semmai solo l'idea di griglia), `ShinyText` e qualsiasi effetto sul testo del Corano, `Cubes` / `ModelViewer` (il cubo vero è il gioco di Imad in three.js), `Dock`.

## Debolezze note

- Provato solo in Chromium senza interfaccia: mai su un iPhone vero, su Android o nel browser interno di Instagram. Bordi a gradiente con maschera, `color-mix`, molle `linear()`, unità `1lh`, `text-wrap` hanno un ripiego o degradano senza rompere, ma l'aspetto in Safari va guardato.
- Lo scorrimento è misurato solo qui (fotogrammi regolari a 16,7 ms, senza GPU): su un Android modesto lo sfondo che deriva (due livelli grandi) e la grana su una ventina di superfici vanno verificati. `backdrop-filter` è su tre soli elementi della home.
- «Cinque città sopra la piega» vale per la finestra 390×844 delle fotografie. Su un telefono vero le barre del browser tolgono altezza e l'ultima riga finisce sotto la piega; a 360×740 è già tagliata.
- Il testo piccolo bianco sulla parte bassa e calda dei cieli al tramonto (riga di Torino, striscia panoramica) è il contrasto più debole della pagina: ho aggiunto un velo scuro in basso e un'ombra, ma il controllo automatico non lo sa misurare.
- Nel riquadro del Corano la grana sta sotto il versetto (è lo sfondo del riquadro, non un effetto sul testo). Se si vuole un fondo del tutto piatto basta `--grain: none` su `.corano` e sul lettore.
- Il «Versetto di oggi» gira su tre soli versetti brevi; 37:6 e 86:1-3 compaiono solo nel lettore.
- Computer: a destra del marchio l'hero ha molto cielo vuoto; «Lo sapevi» mostra poche righe; fotografato solo a 1440×900 (sotto gli 880 px di altezza la griglia scorre). Tablet: una sola fotografia (820×1180, scuro).
- Il cubo è fatto di facce CSS: da certe angolazioni si vedono le giunture della plastica bianca.
- Le fotografie a pagina intera stendono lo sfondo su tutta la pagina; dal vivo lo sfondo è fisso allo schermo.

## Da fare

1. ~~Barra dell'anteprima: il nome del carattere era troncato a 360 e 390 px.~~ Corretto dopo la consegna con `.pv { width: max-content; }`.
2. Guardare la pagina su un iPhone vero e dentro Instagram: bordi sottili, grana, deriva dello sfondo, apertura, pulsante dei suoni, chiusura trascinando in giù.
3. Decidere se stringere ancora hero e Corano perché la quinta città resti sopra la piega anche con le barre del browser e a 360×740.
4. Contrasto delle etichette piccole sui cieli al tramonto: valutare un velo più scuro o 13 px.
5. Decidere se togliere la grana dal riquadro del Corano e dal lettore.
6. Computer: bilanciare l'hero (cielo vuoto a destra) e provare 1280×720 e 1920×1080; tablet in orizzontale mai provato.
7. Il volo della stella dopo la scelta di un saluto e il numero che scatta non sono stati rifotografati dopo il ridisegno (la logica è provata: 129, nota, memoria).
8. Lettori di schermo (VoiceOver, TalkBack) mai provati.
