# imad.chat — brief for the bento previews

You are designing one of four competing previews of the new home of imad.chat. Imad will open them on his phone, look for a few seconds, touch things, and pick one. He has already thrown away two looks. This one has to land.

## Who it is for

Imad's personal site, linked from his Instagram bio. Visitors are on **phones in portrait** (iPhone and Android, often inside Instagram's in-app browser), curious for a few seconds. The UI is in **Italian**. English appears only in `hello, world`, `hello, imad's world` and `imad.chat`.

What he said, in his words:

- about the old look: "mi fa schifo la grafica, con il font in corsivo, volevo fosse più stilizzato creativo aesthetic"; then about the comic style: "è troppo cartoonish non mi piace".
- about the font: "non mi piace il font utilizzato, voglio che sia moderno".
- about the home: "griglia di riquadri vivi, ma devono essere aesthetic, con i bordi arrotondati, con magari una scritta bianca in mezzo di animazioni quando si apre il sito, tipo imad.chat animato (per ora puoi anche non metterlo animato, lo facciamo in seguito), in generale come se fosse una bento ui […] non tutti i riquadri devono essere della stessa grandezza, tipo il cubo deve avere un riquadro piccolino, non è così importante".
- about the level: "voglio che sia un'esperienza interattiva curata nei minimi dettagli".
- style he picked among modern references: **Apple**. Theme: **follows the phone** (light and dark, both first-class).

## The idea that holds it together: hello

The domain is imad.chat, and the chat is a **hello**. The site greets you (`hello, world` → `hello, imad's world`). You can greet back: you pick "ciao" in your language from a list, and your greeting becomes **a star in imad's sky** that everyone can see. No free text, no AI, no messages to moderate. Let this idea show: the sky with the greeting-stars should be felt on the home, not hidden in a corner.

## The tiles

By importance. Sizes must differ; the page must read as a composed bento, not as a list of equal cards.

| Tile | Size | What is alive on it | What opens |
|---|---|---|---|
| **Hero** `hello, imad's world` / `imad.chat` | wide, first | the white text; the opening sequence ends here | nothing, or "rivedi l'intro" |
| **Corano** | big | one short verse in Arabic with its Italian translation and reference, set plainly; or the closed mushaf that invites opening | a clean reader you leaf through |
| **Le città, adesso** | big | Gaza, Torino, Medina, Makkah, Casablanca: local time ticking, the colour of the real sky there right now (from the sun's altitude), day/night | each city: time, sunrise and sunset, moon, qibla direction and distance |
| **Palestina** | big | title, one quiet line, the time in Gaza | Imad's own text (placeholder now) |
| **Su di me** | medium | a short line and his links | his own text (placeholder now) |
| **Saluti** (the chat) | medium or small | the count of greeting-stars, the greeting chips | pick a greeting → it becomes a star |
| **Cielo** | small or medium | the real sky over Torino now (stars from data), with the greeting-stars in it | later: the astrolabe (a secondary extra) |
| **Cubo** | **small** | his pastel cube turning slowly; drag to spin | later: his cube game |
| **Codice** | small | the real function that computes the sky angle, typed in mono | later: how the site is made |
| **Curiosità e folklore** | small | one verified curiosity, cycling | later: all of them |

Top bar: a **logo slot top-left** (show the wordmark `imad.chat` as the placeholder logo), and at most one or two quiet controls on the right.

You may merge tiles when it makes the composition stronger (for instance the sky as the hero's background, or Saluti inside Cielo), as long as every item above is present and the sizes respect the importance. Above the fold on a 390×844 phone the visitor must already see the hero and at least two or three tiles, and it must look finished and beautiful as a still.

Copy for placeholders (Italian, plain, sentence case, no exclamation marks, no emoji):

- Palestina: title "Palestina", line "Presto, con le parole di Imad."
- Su di me: title "Su di me", line "Coding, Corano, stelle, un cubo di Rubik, Torino, Palestina." Links row: "Instagram" (href `#`).
- Saluti: "Lascia un saluto" / "Diventa una stella nel cielo di Imad." / counter "128 saluti nel cielo".
- Tiles that open to something not built yet: a designed sheet with the title and one line saying what will be there ("In arrivo: …"). Nothing is a dead end.

## Hard rules (a preview that breaks one is discarded)

1. **No italic** anywhere. Reset `em, i, cite, address, dfn, var { font-style: normal }`.
2. **No Islamic geometric ornament or religious imagery as decoration**: no crescents, eight-pointed stars, arabesques, girih, zellige, lanterns, arches, domes, minarets, mosque or Kaʿba silhouettes, prayer beads, calligraphy used as decoration, tatreez patterns. The single Islamic element is the Quran itself: its text, plainly set.
3. **Quran text**: only `IMAD_DATA.verses[i].ar`, inserted by script (never typed, never pasted into HTML by hand), in an element with `lang="ar" dir="rtl"`, font "Amiri Quran", generous line-height (about 2), on a calm flat background. No effects on it: no gradient, glow, shadow, animation per letter, letter-spacing, clipping, ellipsis. **Never truncate a verse**: choose one that fits (short ones: `53:49`, `55:5`, `37:6`, `16:16`, `86:1-3`). Always show the Italian translation `it`, the reference (e.g. "86:1-3") and "trad. Hamza Roberto Piccardo". No "scientific miracle" claims. If the Prophet is mentioned, add ﷺ.
4. **Cities are exactly** Gaza, Torino, Medina, Makkah, Casablanca (from `IMAD_DATA.cities`). Arabic names (`ar`) are available as an optional quiet secondary label, inserted by script. In Makkah the qibla line reads "la qibla è qui".
5. **Palestina**: Imad writes it himself. No war imagery, no slogans, no statistics, no invented facts, no flag emoji. Dignified and typographic. The four colours of the flag may appear as one quiet, abstract accent if you think it helps; it is optional.
6. **No personal details** about Imad. First name only.
7. **Not cartoonish**: no thick outlines, comic effects, halftone, hand-drawn wobble, mascots, emoji as icons, bubbly toy shapes.
8. **Not a copy of Apple**: take the principles (clarity, deference to content, depth, materials, type, motion), never the assets. No Apple logo, SF Symbols glyphs, Apple wallpapers or product images, no cursive "hello" lettering.
9. Everything is **drawn by code** (CSS, SVG, canvas). No external images, no icon fonts. Icons: your own simple SVGs, one stroke weight, drawn on a 24 grid.
10. Fonts: only the families listed under "Type". All upright.
11. No horizontal scroll at 360 px. No console errors. Both themes equally cared for.

## What "Apple-level" means here

- **Type**: big, tight, confident. Display sizes with negative tracking (about −0.02 to −0.045em), weights 600–700; body 15–17 px at 400–500; secondary text by colour, not by going below 12 px. Tabular numerals for clocks. Control line length and rag. Optical alignment over mathematical.
- **Shape**: one radius scale. Tiles about 28–32 px on phones; nested corners are concentric (inner radius = outer − padding). Gaps 10–14 px, page gutter 14–18 px.
- **Material and depth**: layered surfaces; hairline borders at low alpha; in light theme soft, large, low-alpha shadows; in dark theme elevation by lighter surfaces, not by shadow. Glass means blur plus saturation plus a bright top edge plus an inner highlight, with a scrim that keeps text readable.
- **Colour**: disciplined. Neutrals with a slight hue bias, one accent family, plus the natural colours of the live things (the sky gradients, the pastel cube). Never rainbow, never dull grey.
- **Motion**: short springs, purposeful. Press feedback (scale to about 0.97), tile-open morph from the tile's own rectangle, staggered entrance after the opening, live tickers. Animate only `transform` and `opacity`. Respect `prefers-reduced-motion` (show final states, cross-fade instead of moving).
- **Details**: live data everywhere; focus-visible rings; safe-area insets; hit targets ≥ 44 px; text contrast AA (4.5:1 body, 3:1 large); designed empty and placeholder states.

## Type

Load from Google Fonts: **Inter**, **Geist**, **Manrope**, **Instrument Sans** (the four candidates Imad will compare), **Geist Mono** (code and `hello, world`), **Amiri Quran** (Quran only). All text uses `var(--font-sans)`; your take has a default family (see your assignment). The preview bar lets Imad switch among the four, plus "Sistema" (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`, which is the real San Francisco on his iPhone). Make sure the layout survives all five.

## Opening sequence

About 3 to 4.5 s, once per session (or with `?intro=1`), skippable with a tap, final state shown directly under reduced motion. `hello, world` is typed with a caret; `world` is deleted; `imad's world` appears; the phrase condenses into `imad.chat`, which settles into its place in the hero while the tiles spring in around it with a stagger. **White text.** Imad said the animation can come later, so prefer a simple, solid sequence that cannot break over a fragile spectacular one; the settled home is what matters most.

## Interactions to build

1. Tile press feedback and **open/close** with a spring morph: tap → the tile grows from its own rectangle into a full-screen page; close with a visible button (≥ 44 px), swipe down, Esc and the browser Back (push a history state / hash). Focus moves into the page and returns to the tile.
2. **Città** open: the five cities, each with local time (seconds optional), the sky colour of right now, sunrise and sunset, the moon phase (the same everywhere: say so), qibla bearing and distance. Use `ImadAstro`.
3. **Saluti** open: chips with the greetings from `IMAD_DATA.greetings`; tapping one drops your star into the sky with a small, beautiful animation, the counter goes up by one, and a line says the greeting stays on this phone in this preview. Store in `localStorage` inside try/catch.
4. **Corano** open: a calm reader with three or four of the verses, one per page, horizontal pages with snap (like leafing), Arabic + Italian + reference + translator, a link "leggi su quran.com" (`source`). No ornament.
5. Live: clocks tick; sky colours follow the sun; the cube turns and can be dragged; stars twinkle very subtly; the code types; the curiosity cycles.

## Technical contract (all four previews share it so they can be compared)

Folder: your assigned folder under `anteprime/`. Files: `index.html` (you may split into `style.css` and `app.js`; no build step, no framework needed: vanilla JS), plus copies of `data.js` and `astro-lite.js` taken with `cp` from `anteprime/shared/` (never retype them). If you truly need a library, only from cdnjs with a pinned version; prefer none.

`index.html` must be a complete document (`<!doctype html>`, `lang="it"`, charset, `viewport` with `viewport-fit=cover`, `<title>`). Theme: tokens on `:root` (light), dark values under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` and again under `:root[data-theme="dark"]`; `color-scheme` set accordingly; `body` has an explicit background.

Query parameters the page must honour:

- `shot=1` — hide the preview bar, skip the opening, settle continuous animations in a good-looking final state (for screenshots).
- `theme=light|dark` — force the theme by setting `data-theme` on `<html>`.
- `t=<ISO date>` — freeze "now" at that instant (clocks, sky colours, moon). Without it, real time.
- `open=<id>` — load with that tile open. Ids: `citta`, `saluti`, `corano` (and yours for the others).
- `intro=1` — play the opening even with `shot=1`.
- `font=inter|geist|manrope|instrument|sistema` — force the family.

Set `window.__ready = true` when fonts are loaded and the layout is settled.

**Preview bar**: a small floating pill, bottom centre, safe-area aware, clearly not part of the design, labelled "anteprima", with: Tema (auto / chiaro / scuro), Carattere (the five families), "Rivedi intro". Hidden with `shot=1`.

Data and helpers (read both files before you start):

- `window.IMAD_DATA`: `cities` (id, name, country, tz, lat, lon, ar), `verses` (key, surahName, ar, it, translator, source), `stars` (name, ar, translit, ra in hours, dec in degrees, mag), `curiosities` (title, text), `greetings` (lang, label, text), `code` (the real function), `cube` (Imad's own pastel cube colours: faces U, D, F, R, B, L and white plastic), `kaaba`, `sampleStars`.
- `window.ImadAstro`: `sun(date, lat, lon)` → `{altitude, azimuth}`, `moon(...)`, `moonPhase(date)` → `{fraction, age, waxing, name}`, `dayPart(altitude)`, `sunTimes(date, lat, lon, tz)`, `altAz(raHours, decDeg, date, lat, lon)`, `qibla(lat, lon)` → `{bearing, distanceKm}`, `localTime(date, tz, withSeconds)`, `localDate(date, tz)`, `offsetFromRome(date, tz)`. **Always** use `ImadAstro.localTime` for city times (it corrects Morocco's time zone on phones with old data).

Capture and look (this is how you design: build, photograph, look, fix):

```bash
node anteprime/shared/capture.mjs anteprime/<your-folder>            # all shots into <your-folder>/shots
node anteprime/shared/capture.mjs anteprime/<your-folder> --only home   # faster loop: home|stati|intro|desktop
node anteprime/shared/capture.mjs anteprime/<your-folder> --t 2026-11-11T21:30:00Z --out shots-notte --only home
node anteprime/shared/sheet.mjs anteprime/<your-folder> "<Nome>" "<una riga in italiano>"
```

The default instant (2026-11-11 15:50 UTC) is chosen on purpose: sunset in Torino, afternoon in Casablanca, night in Gaza, Medina and Makkah, a thin waxing moon. Also check an all-night instant (`21:30Z`) and an all-day one (`10:30Z`). Open the PNGs with the Read tool and judge them as Imad would on his phone. Do at least four build–capture–look rounds on the home before moving to the opened tiles and the desktop layout. The capture script prints page errors and horizontal overflow: fix them all.

Layouts: phone 390×844 is the priority (also 360×740 and 430×932); desktop 1440×900 gets a wider bento (4 to 6 columns, max width about 1200 px, most of it in one screen) with hover states; tablet must not break.

## Deliver

- The folder with the working page, `shots/`, `sheet-home.jpg`, `sheet-dettagli.jpg`, `sheet-desktop.jpg`.
- `NOTES.md` (short): the concept in three sentences; the tokens (colours for both themes, type scale, radii, shadows, motion durations and easings); what is real and what is mocked; for the real Next.js build, which React Bits components could implement which effect (the registry list is in `anteprime/shared/reactbits-registry.json`; examples: `GlassSurface`, `TextType`, `MagicBento`, `Galaxy`, `CountUp`, `SpotlightCard`, `Dock`); the weaknesses you know about.

## Self-check before you say you are done

- Would this look at home next to iOS or apple.com, and still be clearly Imad's and not a template?
- Is the first phone screen beautiful as a still, in light and in dark?
- Sizes: Corano, Città, Palestina big; Su di me second; cube small. Hero text white.
- Search your CSS for `italic` and `oblique`: none. No emoji anywhere. No ornament.
- Arabic: `element.textContent === IMAD_DATA.verses[i].ar` for every verse shown; nothing truncated.
- Nothing clipped or overlapping at 360 px; tap targets ≥ 44 px; contrast AA; reduced motion handled.
- Capture script: zero problems reported.

## Updates (11 November, evening) — these override the text above where they differ

1. **The rising star.** Imad loved an earlier test animation: a single star rising slowly into a blue-hour sky, growing brilliant, with a soft halo ("era un qualcosa di originale"). Generated video is not available now, so **draw it by code** and make it the signature of the opening: while `hello, world` is typed and becomes `hello, imad's world`, one star rises from the bottom of the screen straight up to its resting place in the hero's sky, settles with one soft pulse of light, and stays there as the first star; the greeting-stars are its companions. Then the phrase condenses into `imad.chat` and the tiles spring in. Simple, slow, majestic, solid. White text. With reduced motion: the settled state directly.
2. **Corano**: Imad chose "a different verse every day" for now. Label the tile's verse as the verse of today ("Versetto di oggi"); in the preview pick it from the short verses by the day of the frozen date. The opened reader stays as described.
3. **Su di me**: Imad will write it himself. Keep the provisional line and the Instagram link, and make it obvious the text is provisional only in NOTES.md, not on the page.
4. **Cubo**: the tile will open Imad's own cube game (timer, best times, sizes 2x2 to 5x5). In the preview the opened page says so in one line ("In arrivo: il gioco del cubo, con cronometro e tempi migliori."). Colours stay his pastel theme from `IMAD_DATA.cube`.
5. **Automatic rule checker**: `node anteprime/shared/verify.mjs anteprime/<your-folder>` loads the page in many views and reports BLOCCHI (hard rules broken: italic, Arabic that is not the data or has effects, emoji, page errors, horizontal scroll, removed cities) and AVVISI (tap targets under 44px, text under 12px, low contrast on flat backgrounds, missing times). Zero BLOCCHI is mandatory. Read the AVVISI with judgment: the contrast figure is an estimate and is wrong where the text sits over a separate sky layer or canvas; tap-target warnings are real.
