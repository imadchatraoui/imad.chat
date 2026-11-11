# Higgsfield: cosa generare e come

L'illimitato di Higgsfield funziona da **ChatGPT** (verificato) e scade il **13 novembre 2026 alle 22:00** ora italiana. Da Claude Code non funziona.

## Configurazioni coperte dall'illimitato

Lette dal connettore in ChatGPT l'11 novembre 2026. Tutto ciò che sta fuori da queste righe costa crediti.

| Modello | Coperto |
|---|---|
| `nano_banana_pro`, `nano_banana_2_1`, `nano_banana_flash` | risoluzione 1k, 2k |
| `seedream_v5_pro`, `seedream_5_5` | risoluzione 1k, 1.5k, 2k |
| `gpt_image_2`, `gpt_image_2_5`, `gpt_image_2_6` | risoluzione 1k, 2k; quality low, medium |
| `seedance_2_0` | 480p, 720p; mode std o fast; fino a 15 s |
| `seedance_2_0_mini` | 480p, 720p; fino a 15 s |
| `seedance_2_5` | solo 480p; fino a 30 s |
| `text2speech_v2` | elevenlabs, minimax, seed_speech, vibe_voice |
| `seed_audio` | nessun limite |

Quindi: immagini al massimo **2k**, video al massimo **720p**. Niente 4k, niente 1080p, niente quality high/max, niente modelli 3D.

## Passo passo

1. In ChatGPT apri una **chat nuova**, chiamala "imad — immagini" e incolla il **Messaggio 1** nella casella normale (non nel pannello di Higgsfield).
2. ChatGPT genera 3 prove e si ferma. Guardale: se vanno bene scrivi **ok, continua**; se no, digli cosa cambiare.
3. Apri **un'altra chat nuova**, "imad — suoni e video", e incolla il **Messaggio 2**. Questa non dipende dalla prima: può lavorare in parallelo.
4. Se ChatGPT si ferma a metà, scrivi **continua**.
5. Se compare la scelta "Use unlimited generations / Use credits", scegli sempre **unlimited**.
6. Quando ognuna delle due chat ha finito, ti dà una tabella con `ID | job_id | stato`. **Incolla le due tabelle in Claude Code.**
7. Io scarico tutto, controllo la qualità e ti preparo il **Messaggio 3**: i video in loop delle città, fatti partendo dalle immagini già approvate, e il reel per Instagram.

## Dove finisce ogni asset nel sito

I job arrivati sono registrati in `scripts/media/jobs.json`. `python3 -I scripts/media/import.py` li scarica, li converte (JPEG/PNG ridimensionati, SVG ripuliti, MP3 rifilati e normalizzati, MP4 H.264 senza audio) e aggiorna `public/media/manifest.json`, che il sito legge per sapere cosa c'è.

| ID | File nel sito |
|---|---|
| T01–T06 | `public/media/tex/<id>.jpg` |
| O01S–O06S | `public/media/orn/<id>.svg` |
| O01P–O06P | `public/media/orn/<id>.png` |
| B-<CITTÀ> | `public/media/band/<città>.png` |
| N-<CITTÀ>-V / -H, D-<CITTÀ>-V / -H | `public/media/city/<città>-<night|day>-<v|h>.jpg` |
| H01–H04 | `public/media/hero/<id>.jpg` |
| S01–S11 | `public/media/sfx/<id>.mp3` |
| A-<LUOGO> | `public/media/amb/<luogo>.mp3` |
| V-TARIQ-V / -H | `public/media/video/tariq-<v|h>.mp4` |

## Messaggio 1 — immagini (ChatGPT, chat "imad — immagini")

```text
Usa Higgsfield. Regole fisse per tutta questa chat:
1. Per OGNI generazione passa use_unlim: true. Se l'illimitato viene rifiutato o la configurazione non è coperta, fermati e dimmelo. Non usare mai i crediti e non scegliere mai "Use credits".
2. Resta dentro le configurazioni coperte: nano_banana_pro e nano_banana_2_1 con resolution 2k; gpt_image_2_6 con resolution 2k e quality medium. Mai 4k, mai quality high o max.
3. Nessuna immagine deve contenere testo leggibile, lettere, numeri o scrittura araba: se servono incisioni, devono essere segni decorativi illeggibili.
4. Lancia le generazioni in parallelo quando puoi (in batch se lo strumento lo permette), poi controllane lo stato. Non ripetere un lavoro già partito. Se ti fermi, al mio "continua" riprendi dal punto esatto.
5. Quando dico "image_references" passa i media_id o i job_id indicati con il ruolo image_references.
6. Alla fine dammi una sola tabella in un blocco di codice, una riga per asset: ID | job_id | stato.

FASE 0 — PROVE. Genera solo T02, N-TORINO-V e O01S, mostramele e aspetta il mio ok.
FASE 1 — poi tutto il resto, in quest'ordine: blocco A, B, C, D, E.

STILE CITTÀ DI NOTTE (lo chiamo [NOTTE]): "Photorealistic, cinematic, 35mm lens, natural colours, warm city lights against a deep blue night. Composition: the city occupies only the lower third of the frame; the upper two thirds is a clean, smooth deep-blue-to-black sky with NO stars, NO moon, NO clouds, NO birds (an interactive star map will be drawn there). No people in the foreground, no text, no signs, no logos, no watermark."
STILE CITTÀ DI GIORNO (lo chiamo [GIORNO]): "The same place, the same viewpoint and the same composition as the reference image, in a clear late afternoon with warm golden light. The upper two thirds is a clean, smooth clear sky with no sun, no clouds and no birds. No people in the foreground, no text, no logos, no watermark."

LUOGHI (lo chiamo [LUOGO]):
TORINO = "Turin, Italy, seen from the hill of Monte dei Cappuccini: the Mole Antonelliana rising above the rooftops, the dome of the Gran Madre and the river Po with its bridges, the snowy Alps faint on the horizon."
ALQUDS = "The Old City of Al-Quds (Jerusalem) seen from the Mount of Olives: ancient stone walls, domes, minarets and bell towers, the golden Dome of the Rock at the centre."
GAZA = "The Mediterranean shore of Gaza, Palestine: the small old fishing harbour with colourful wooden fishing boats, the long sandy beach and the low lights of the coastal city, calm sea. Peaceful and dignified: no damage, no military, no smoke."
BATTIR = "The ancient stone agricultural terraces of Battir, Palestine, with olive trees and vineyards on the hills and a small stone village."
FES = "The medina of Fes el-Bali, Morocco, seen from the hills: a dense sea of flat rooftops, green-tiled roofs and minarets, the hills around."
ISTANBUL = "Istanbul seen across the Golden Horn: the domes and minarets of the Süleymaniye Mosque on the hill, the Galata Bridge, small ferries on the water."
SAMARCANDA = "The Registan square in Samarkand, Uzbekistan: the three madrasas with turquoise domes and tiled portals."
KYOTO = "Kyoto's Higashiyama district, Japan: the Yasaka pagoda above traditional wooden machiya roofs, forested hills behind."
CUSCO = "Cusco, Peru, seen from above: red-tiled roofs, the cathedral and the Plaza de Armas, the Andes all around."

=== FASE 0 (prove) ===
T02 — nano_banana_pro, 2k, 1:1: "Seamless tileable texture of aged brass: warm golden tone, soft dark patina in the recesses, fine micro scratches and tiny dents. Flat even studio lighting, top-down orthographic view, no objects, no shadows, no text."
N-TORINO-V — nano_banana_pro, 2k, 9:16: "Night view of " + [LUOGO TORINO] + " " + [NOTTE]
O01S — gpt_image_2_6, 2k, quality medium, output_format svg, 1:1 (nessun riferimento): "Flat vector silhouette of the throne (kursi) of a medieval Islamic brass astrolabe: symmetric crenellated outline with scalloped steps, pierced with trefoil and quatrefoil openings and a central lobed arch, with a small shackle and a suspension ring on top. Solid black shape on pure white, no shading, no text, no numerals, centered."

=== BLOCCO A (materiali e ornamenti) ===
T01 — nano_banana_pro, 2k, 1:1: "Seamless tileable texture of polished antique brass sheet with very fine concentric lathe brushing, warm golden tone. Flat even studio lighting, top-down orthographic view, no objects, no shadows, no text."
T03 — nano_banana_pro, 2k, 1:1, image_references d82bdcfb-1eee-44b1-a09b-aef1a7574e1c: "Macro photograph of engraved brass like the reference: fine V-cut engraved lines filled with dark patina, graduated scale ticks and an arabesque scroll, raking light. The engraved marks are decorative and illegible: no readable letters, no numerals."
O02S — gpt_image_2_6, 2k, medium, svg, 1:1: "Flat vector silhouette of the 'horse', the wedge that locks the central pin of an astrolabe, shaped as a stylised horse head with an arabesque curl. Solid black on pure white, side view, no shading, no text."
O03S — gpt_image_2_6, 2k, medium, svg, 1:1: "A sheet of 12 separate star pointers from an Islamic astrolabe rete, flame-shaped and dagger-shaped, each a small solid black silhouette ending in a sharp point, arranged in a 4 by 3 grid with generous white space between them. Solid black on pure white, no shading, no text, no numbers."
O04S — gpt_image_2_6, 2k, medium, svg, 1:1: "A set of 8 separate ornamental pieces for an Islamic astrolabe rete: arabesque connecting bars, split palmettes, lobed loops and half-palmette scrolls. Solid black silhouettes on pure white, generous spacing, no shading, no text."
O05S — gpt_image_2_6, 2k, medium, svg, 1:1: "Islamic geometric medallion (shamsa): an eight-pointed star interlace, perfectly symmetric, black line art on pure white, no shading, no text."
O06S — gpt_image_2_6, 2k, medium, svg, 1:1: "A set of 6 small rosettes and floral stops used on the graduated rim of an astrolabe, solid black silhouettes on pure white, evenly spaced, no text, no numbers."
O01P — nano_banana_pro, 2k, 1:1, image_references 1837950c-3a02-4d21-b423-8da69fe0d8ac, fc97b555-b0ee-44dc-962d-2c227528ae53: "The throne (kursi) of the astrolabe in the references, redrawn as a flat solid black silhouette on pure white, front view, symmetric, with all its piercings as white holes, the shackle and the suspension ring. No shading, no text."
O02P — nano_banana_pro, 2k, 1:1, image_references fc97b555-b0ee-44dc-962d-2c227528ae53: "The 'horse' wedge of an astrolabe, stylised horse head with an arabesque curl, as a flat solid black silhouette on pure white, side view, no shading, no text."
O03P — nano_banana_pro, 2k, 1:1, image_references 5c8a7d25-95e7-4428-b90a-bf8cec19dcf1, bd233565-0321-4782-9a57-e197e55e6bbf: "12 separate star pointers in the style of the astrolabe retes in the references, flame-shaped and dagger-shaped, each a flat solid black silhouette on pure white, arranged in a 4 by 3 grid with generous spacing, no shading, no text."
O04P — nano_banana_pro, 2k, 1:1, image_references 5c8a7d25-95e7-4428-b90a-bf8cec19dcf1, bd233565-0321-4782-9a57-e197e55e6bbf: "8 separate ornamental pieces in the style of the retes in the references: arabesque connecting bars, split palmettes, lobed loops, half-palmette scrolls, as flat solid black silhouettes on pure white, generous spacing, no shading, no text."
O05P — nano_banana_pro, 2k, 1:1: "Islamic geometric medallion (shamsa), an eight-pointed star interlace, perfectly symmetric, crisp black line art on pure white, no shading, no text."
O06P — nano_banana_pro, 2k, 1:1, image_references d82bdcfb-1eee-44b1-a09b-aef1a7574e1c: "6 small rosettes and floral stops like those on the graduated rim in the reference, as flat solid black silhouettes on pure white, evenly spaced, no text, no numbers."

=== BLOCCO B (città di notte, verticali) ===
Per ognuno: nano_banana_pro, 2k, 9:16, prompt "Night view of " + [LUOGO] + " " + [NOTTE]
N-ALQUDS-V, N-GAZA-V, N-BATTIR-V, N-FES-V, N-ISTANBUL-V, N-SAMARCANDA-V, N-KYOTO-V, N-CUSCO-V

=== BLOCCO C (città di giorno, verticali) ===
Per ognuno: nano_banana_pro, 2k, 9:16, image_references = il job_id della N-...-V dello stesso luogo, prompt [GIORNO] + " The place: " + [LUOGO]
D-TORINO-V, D-ALQUDS-V, D-GAZA-V, D-BATTIR-V, D-FES-V, D-ISTANBUL-V, D-SAMARCANDA-V, D-KYOTO-V, D-CUSCO-V

=== BLOCCO D (bande decorative per le piastre) ===
Per ognuna: nano_banana_2_1, 2k, aspect_ratio 8:1. Inizio comune: "Seamless horizontal ornamental band whose left and right edges tile perfectly. Engraving-style line art in solid black on pure white, consistent fine line weight, no shading, no text, no letters. Motif: "
B-TORINO: "Turin Liberty (Art Nouveau): whiplash curves, irises and lilies, wrought-iron style."
B-ALQUDS (image_references 3c62fea9-b5fa-4563-a64f-17a437f0862d, ac5a750a-02d4-4ffd-81c1-98f950e7cfc4): "Palestinian tatreez cross-stitch like the embroidery in the references: rows of eight-pointed stars, cypress trees and chevrons, drawn as small crosses on a square grid."
B-GAZA: "the sea of Gaza: stylised waves, small fishing boats with lateen sails, fish and nets."
B-FES: "Moroccan zellige star interlace with 8- and 16-pointed stars."
B-ISTANBUL: "Ottoman Iznik ornament: tulips, carnations, hyacinths and saz leaves."
B-SAMARCANDA: "Timurid girih strapwork with stars and polygons."
B-KYOTO: "Japanese seigaiha waves and plum blossoms."
B-CUSCO: "Andean stepped frets, stepped crosses, zigzags and tocapu squares."
B-OLIVA: "olive branches with leaves and olives, flowing continuously."

=== BLOCCO E (orizzontali per computer, eroi e altri materiali) ===
N-<LUOGO>-H per tutti e 9 i luoghi: nano_banana_pro, 2k, 16:9, image_references = il job_id della N-<LUOGO>-V, prompt "Wide view of " + [LUOGO] + " " + [NOTTE]
D-<LUOGO>-H per tutti e 9 i luoghi: nano_banana_pro, 2k, 16:9, image_references = il job_id della N-<LUOGO>-H, prompt [GIORNO] + " The place: " + [LUOGO]
H01 — nano_banana_pro, 2k, 9:16, image_references fc97b555-b0ee-44dc-962d-2c227528ae53, 96a5d9ef-4b68-4609-8350-d0395c91cdb8, bd233565-0321-4782-9a57-e197e55e6bbf: "A medieval Islamic brass planispheric astrolabe in the style of the references, floating upright in a deep lapis-blue night, museum lighting with a warm key light and a cool rim light, crisp engraved lines, the pierced rete with flame-shaped star pointers, the throne with its suspension ring. All engraved marks are decorative and illegible. Centered, with dark space above and below. No text, no logos."
H02 — come H01 ma 16:9, composizione larga.
H03 — nano_banana_pro, 2k, 9:16, image_references fc97b555-b0ee-44dc-962d-2c227528ae53, 5c8a7d25-95e7-4428-b90a-bf8cec19dcf1, e0e24f83-2e62-4283-b95f-83bf5bb0d718: "Exploded view of a brass astrolabe in the style of the references: its parts float apart along one vertical axis — the throne and mother disc, two engraved plates, the pierced rete, the rule, the pin and the horse wedge — in deep lapis darkness, soft studio lighting. All engraved marks are decorative and illegible. No text."
H04 — nano_banana_pro, 2k, 9:16, image_references 5c8a7d25-95e7-4428-b90a-bf8cec19dcf1, bd233565-0321-4782-9a57-e197e55e6bbf: "Macro photograph of the rete of a brass astrolabe like the references: flame-shaped star pointers over an engraved plate, shallow depth of field, warm light, deep shadows. No legible text."
T04 — nano_banana_pro, 2k, 1:1: "Seamless tileable texture of polished lapis lazuli: deep ultramarine blue with tiny golden pyrite flecks and faint white veins. Flat even light, top-down, no text."
T05 — nano_banana_pro, 2k, 1:1: "Seamless tileable texture of deep midnight-blue velvet with a soft sheen. Flat even light, top-down, no text."
T06 — nano_banana_pro, 2k, 1:1: "Seamless tileable texture of aged cream laid paper with subtle fibres and faint foxing. Flat even light, top-down, no text, no writing."

Ricordati: alla fine una sola tabella in un blocco di codice, ID | job_id | stato, con tutti gli asset (T, O, N, D, B, H).
```

## Messaggio 2 — suoni e video at-Tariq (ChatGPT, chat "imad — suoni e video")

```text
Usa Higgsfield. Regole fisse per tutta questa chat:
1. Per OGNI generazione passa use_unlim: true. Se l'illimitato viene rifiutato o la configurazione non è coperta, fermati e dimmelo. Non usare mai i crediti e non scegliere mai "Use credits".
2. Configurazioni coperte: seed_audio senza limiti; seedance_2_0 con mode std, resolution 720p (mai 1080p o 4k), durata massima 15 secondi.
3. In nessun audio ci devono essere voci, parole, canto, musica o recitazioni religiose (niente adhan, niente Corano). Solo suoni ed effetti.
4. Prima controlla i parametri di seed_audio (durata, formato) con lo strumento che elenca i modelli. Se un suono deve essere in loop, chiedilo nel prompt.
5. Lancia le generazioni in parallelo quando puoi, poi controllane lo stato. Se ti fermi, al mio "continua" riprendi dal punto esatto.
6. Alla fine dammi una sola tabella in un blocco di codice, una riga per asset: ID | job_id | stato.

=== SUONI (seed_audio) ===
S01: "A single tiny dry brass click, like a fine detent in a precision brass instrument, close-mic, no reverb. 0.3 seconds."
S02: "Three different tiny brass clicks one after another with one second of silence between them, precision instrument detents, close-mic, dry. 3 seconds."
S03: "Soft continuous friction of two brass discs rotating against each other, a delicate metallic whisper, seamless loop. 3 seconds."
S04: "A thin brass plate sliding out of a brass case, then another plate dropping in and seating with a soft resonant metallic clink. 2.5 seconds."
S05: "Precision brass parts sliding together and locking: several soft clicks, one deeper clunk, ending with a gentle resonant ring of brass. 4 seconds."
S06: "A soft whoosh as a heavy brass disc flips over, ending in a light clack. 1 second."
S07: "Night silence; three slow deep knocks with a long reverberating tail, like knocking on a vast wooden door under the open sky; then a pure crystalline high tone rises and pierces, and fades slowly. 7 seconds."
S08: "Soft quiet mechanical keyboard typing, about 12 keystrokes with a human rhythm and a short pause after the sixth, close-mic. 3 seconds."
S09: "Five quick soft backspace key presses on a mechanical keyboard. 1 second."
S10: "A delicate shimmering sparkle, like tiny glass stars twinkling, rising and fading, no melody. 2.5 seconds."
S11: "A soft rustle of an old manuscript page turning. 0.8 seconds."

=== AMBIENTI (seed_audio, seamless loop, 30 seconds, nessuna voce né musica) ===
A-NOTTE: "Quiet night ambience: soft wind, distant crickets."
A-TORINO: "Turin at night: distant city hum, a far tram bell, soft wind, very calm."
A-ALQUDS: "Evening in an ancient stone city: a soft breeze through narrow alleys, distant footsteps, swifts and small birds at dusk, very calm."
A-GAZA: "Calm Mediterranean shore at night: gentle waves on sand, light breeze, wooden fishing boats creaking softly, distant seagulls."
A-BATTIR: "Olive grove on terraced hills in the afternoon: breeze in olive leaves, birds, distant goat bells, a small stream."
A-FES: "Old medina: distant rhythmic tapping of coppersmiths' hammers, a fountain trickling, soft indistinct murmur with no intelligible words."
A-ISTANBUL: "Bosphorus at night: water lapping, seagulls, a distant ferry horn, soft wind."
A-SAMARCANDA: "Wide stone square at dusk: dry warm wind, swifts, distant footsteps."
A-KYOTO: "Kyoto evening: crickets, a wooden wind chime, a very distant temple bell."
A-CUSCO: "High Andes evening: thin mountain wind, a distant church bell, faint llama bells."

=== VIDEO AT-TARIQ (seedance_2_0, mode std, resolution 720p, duration 10, bitrate_mode high, generate_audio false) ===
V-TARIQ-V (aspect_ratio 9:16) e V-TARIQ-H (aspect_ratio 16:9): "Night sky over a dark desert horizon. One single star grows brilliant and pulses three times, like three slow knocks, each pulse sending out a soft ring of light; then a thin needle of white light pierces down through the darkness and slowly fades. Slow, majestic, cinematic, locked-off camera. No text, no people."

Ricordati: alla fine una sola tabella in un blocco di codice, ID | job_id | stato.
```

## Limite: un lavoro alla volta per tipo

Al primo tentativo Higgsfield ha risposto `429 rate_limit_reached` a quasi tutti gli invii: con la prova accetta pochissimi lavori insieme, a quanto pare uno per tipo (un'immagine, un suono, un video). Non costa crediti; vuol dire solo "troppi lavori insieme". Da allora le chat lavorano in sequenza con i messaggi qui sotto, che sostituiscono l'ordine dei messaggi 1 e 2.

### Seguito per la chat "imad — immagini"

```text
Higgsfield ha un limite di lavori contemporanei: l'errore 429 vuol dire "troppi lavori insieme", non è un problema di crediti. Nuove regole da ora (quelle di prima restano: use_unlim: true sempre, mai crediti, configurazioni coperte, niente testo nelle immagini):
1. In questa chat al massimo UN'immagine e UN video attivi alla volta. Invia il successivo solo quando quello prima è completato o fallito.
2. Se ricevi 429, aspetta controllando lo stato del lavoro attivo e poi reinvia lo stesso asset. Non saltarlo e non passare mai ai crediti.
3. T02 è già in coda: non reinviarlo. Poi N-TORINO-V e O01S. Mostrami le 3 prove e aspetta il mio ok.
4. Dopo il mio ok, immagini in quest'ordine:
   N-ALQUDS-V, N-GAZA-V, N-FES-V, N-ISTANBUL-V, N-SAMARCANDA-V, N-KYOTO-V, N-CUSCO-V,
   B-TORINO, B-ALQUDS, B-GAZA, B-FES, B-ISTANBUL, B-SAMARCANDA, B-KYOTO, B-CUSCO,
   O02S, O03S, O04S, O05S, O06S, T01, T03,
   D-TORINO-V, D-ALQUDS-V, D-GAZA-V, D-FES-V, D-ISTANBUL-V, D-SAMARCANDA-V, D-KYOTO-V, D-CUSCO-V,
   H01, B-OLIVA, N-BATTIR-V, D-BATTIR-V,
   poi tutte le -H (prima le N, poi le D), poi H02, H03, H04, T04, T05, T06.
   Le O01P…O06P saltale: le faremo solo se servono.
5. Sempre dopo il mio ok, appena una N-<CITTÀ>-V è completata crea il suo loop L-<CITTÀ>-V, un video alla volta:
   seedance_2_0, mode std, resolution 720p, aspect_ratio 9:16, duration 10, bitrate_mode high, generate_audio false, start_image = job_id della N-<CITTÀ>-V, end_image = lo stesso job_id.
   Prompt: "Locked-off camera, no camera movement at all. The scene stays exactly as in the image; only very subtle living details move: " + [DETTAGLI] + " The sky stays clean and empty. The last frame matches the first frame exactly, for a seamless loop. No people walking into frame, no text."
   [DETTAGLI] per città:
   TORINO: "a few windows flicker, a faint haze drifts over the river Po, small reflections shimmer on the water."
   ALQUDS: "a few windows and lanterns flicker softly, a light warm haze drifts between the domes."
   GAZA: "gentle waves roll onto the sand, the fishing boats rock slowly, harbour lights shimmer on the water."
   FES: "a few rooftop lights flicker, a thin smoke drifts slowly."
   ISTANBUL: "ripples and reflections shimmer on the water, a small ferry's lights glide very slowly."
   SAMARCANDA: "the lights on the tiled portals glow and pulse very softly, a light breeze moves dust near the ground."
   KYOTO: "paper lanterns flicker softly, a few leaves stir in the breeze."
   CUSCO: "city lights twinkle softly, a thin mist drifts slowly over the mountains."
   Ordine dei loop: TORINO, ALQUDS, GAZA, FES, ISTANBUL, SAMARCANDA, KYOTO, CUSCO.
6. Ogni 10 asset completati scrivimi la tabella aggiornata in un blocco di codice (ID | job_id | stato), compresi i loop L-…. Se ti fermi, al mio "continua" riprendi dal primo asset non completato.
```

### Seguito per la chat "imad — suoni e video"

```text
Higgsfield ha un limite di lavori contemporanei: l'errore 429 vuol dire "troppi lavori insieme", non è un problema di crediti. Nuove regole da ora (quelle di prima restano: use_unlim: true sempre, mai crediti, niente voci, parole, musica o recitazioni):
1. In questa chat al massimo UN suono e UN video attivi alla volta. Invia il successivo solo quando quello prima è completato o fallito.
2. Se ricevi 429, aspetta controllando lo stato del lavoro attivo e poi reinvia lo stesso asset. Non saltarlo e non passare mai ai crediti.
3. S06 e V-TARIQ-V sono già partiti: non reinviarli.
4. Video: dopo V-TARIQ-V invia V-TARIQ-H. Poi basta video in questa chat.
5. Suoni in quest'ordine: S07, S05, S04, S01, S08, S09, S10, A-NOTTE, S03, S02, S11, A-TORINO, A-ALQUDS, A-GAZA, A-FES, A-ISTANBUL, A-SAMARCANDA, A-KYOTO, A-CUSCO, A-BATTIR.
6. Ogni 5 asset completati scrivimi la tabella aggiornata in un blocco di codice (ID | job_id | stato). Se ti fermi, al mio "continua" riprendi dal primo asset non completato.
```

## Messaggio 3 — reel e loop di giorno (lo preparo io)

I loop di notte delle città li fa già la chat delle immagini. Il resto (loop di giorno, versioni orizzontali, reel per Instagram) lo scrivo quando incolli in Claude Code le tabelle: uso le immagini approvate come primo e ultimo fotogramma dei video e metto io i job ID.
