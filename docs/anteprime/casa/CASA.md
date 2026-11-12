# La casa nuova — the new home, its pages and the tools

The plan Imad approved on 2026-11-12 ("va bene"), written down so that the work can go on without him and with any model. His words are in Italian. Read `CLAUDE.md` first (his decisions), then this; the cat is in `docs/anteprime/gatto/DOT.md`.

## 1. What he asked for

- "allora va bene lasciare la bento ui, puoi prendere ispirazione da https://www.ericwu.me/": a bento home, inspired by that site's ideas (filters in the bar, a hero with a sentence and link buttons, project tiles with pictures, a working mini-tool inside a tile), never its code or its look; no italic type.
- "metti anche la mia heatmap per tipo github"; "voglio che ci sia un riquadro tools con tanti strumenti da poter usare [...] ognuna di queste singole cose deve essere fatta bene bene bene, curata nei minimi dettagli e ogni singola cosa deve essere aesthetic con animazioni e cura"; "vorrei avere una sezione progetti, con tutti i progetti che ho fatto".
- The interactive element that is not inside a tile is now **Dot**, the cat, who lives over the tiles.
- "io sposterei cubo tra i progetti ma come immagine dei progetti mettere l'animazione del cubo; al posto di palestina, metti tipo world [...] dove parlo del sudan della bosnia di tutti i conflitti."
- Why all this: "non capisco cosa aggiunge nella vita delle persone [...] vorrei renderlo utile". The tools are what a visitor takes away; the rest says who he is.
- He works on a phone and judges on a phone. He said: work alone, no questions unless vital. **Replacing the real home at `/` needs his OK**; everything else goes online at its own address, not indexed, when the checks pass.

## 2. The home: nine tiles, like the nine squares of the intro

The intro stays as it is and lands on these nine (its `TILES` list in `docs/anteprime/intro/intro.js` must name them in this order of the 3x3 grid, or the squares fly to nothing).

| tile | size on a phone | what is alive in it | what it opens |
| --- | --- | --- | --- |
| **Corano** | wide, tall | nothing moves: paper, the verse of the day, verbatim from `content/astro/verses.json` (never typed, altered, truncated, never an effect on it) | the reader, later |
| **Le città** | wide, 4 rows | the dotted globe with real day and night, the five cities as lights (already built in `docs/anteprime/bento`) | the cities page |
| **Nel mondo** | wide | still and sober: the names of the places he has written about, the date of the last text; before he writes: "Presto, con le parole di Imad" | `/mondo`: one page per place |
| **Su di me** | half, tall | a photo window (placeholder until he sends one) | `/su-di-me`: his text (placeholder until he writes it) |
| **Saluti** | half | the visitor's star, greetings typed under the wordmark (built) | the greetings sheet (built) |
| **Progetti** | half | the cube that scrambles and solves itself (built in `bento/vivo.js`), in his Kukko colours | `/progetti` |
| **Tools** | wide | **a working mini QR**: paste or type a link and the code draws itself, module by module | `/tools` and each tool |
| **Heatmap** | wide | his GitHub year: the squares light up one after another; touching a day shows its count | his GitHub profile |
| **Sto imparando** | half | the last things pushed to his `threejs-journey` repo (title and date), a small line drawing that turns | that repo |

Gone from the home: Cielo, Terminale, Curiosità, and the Cubo as a tile of its own (it is a project now). Keep the code of what is removed out of the new page.

Above the tiles: the hero with `imad.chat_`, the line where greetings are typed, then **"Ciao, sono Imad."**, one sentence of his (a placeholder line that says it is waiting for his words: never invent facts about him) and link buttons (GitHub: `github.com/imadchatraoui`; Instagram only when he gives the handle). A floating bar with the 3x3 logo and **filters: Tutto / Su di me / Progetti / Tools**: a filter moves its tiles first and dims the others, with the cube-like motion by rows and columns; it never hides the Corano.

Dot on the home: its box stands on the top edge of the first tile under the hero. First visit: after the intro has typed the wordmark, the nine keys drop there and the opening plays. Later visits: no opening; Dot is already around (asleep on a tile, or peeking). Dot keeps off the Corano (`data-dot="no"`) and is quiet on Nel mondo (`data-dot="quiet"`).

## 3. Pages

All static, like the home: design sources under `docs/anteprime/casa/`, copied into `public/` by `scripts/home/build.mjs`, plain HTML, CSS and ES2017 scripts, no framework, shared tokens and a shared small header (logo, back, theme follows the phone). Dot comes along on every page, smaller and calmer (a corner, a peek), never on a page of `/mondo`.

- **`/progetti`**: every public repository of `imadchatraoui` (never the private one; forks at the end, marked), newest first: name, his description from GitHub, language, last update, the site when it has one (gmitorino.org, musulmani.org, menu.musulmani.org). On top, featured ones with a picture: the cube (the live animation; "The Cube" is by Boris Šehovac, his fork adds the Kukko theme: credit the author), the sites he built (a screenshot taken at build time, or a plain card when it cannot be taken). Text comes only from GitHub or from him.
- **`/mondo`** and **`/mondo/<luogo>`**: one text file per place in `content/mondo/*.md` (title, date, optional picture, optional source links, the text). He writes them, in chat or on GitHub from the phone; we give the page and never write a line of that content, no slogans, no facts of ours. Sober: paper-like page, large quiet type, no animation, no Dot. If he edits the files on `main`, bring them into the work branch before every publish (the publish merge uses `-s ours`).
- **`/su-di-me`**: his words and his photo when he sends them; until then a short honest placeholder.
- **`/tools`**: the index of the tools, in families (creare, convertire, per chi programma, di tutti i giorni), each card with a small live picture of what it makes.

Data from GitHub (the contributions calendar and the list of repositories) cannot be read from the visitor's browser reliably and cannot be read from this workspace at all: two small route handlers in the Next app (`app/api/github/contributi`, `app/api/github/progetti`) fetch them on Vercel, cache for hours, and answer JSON; the static pages read those and show a quiet "si aggiorna tra poco" state when the answer is missing. **Never show sample numbers as if they were real.** A token is optional (he can add `GITHUB_TOKEN` in Vercel later; without it use the public pages and the public REST API, within their limits).

## 4. The tools

Rules for all of them: everything is computed on the visitor's phone, nothing is uploaded, no account, no ads, no tracking; each tool has its own address to send to a friend; it works one-handed on a phone first, then on a desktop; the result can be saved or copied in one tap; every control answers at once, with motion that explains (things draw themselves, colours flow, numbers roll), never decoration; dark and light; reachable by keyboard; honest about limits. One tool is finished before the next starts: "meglio tre fatti benissimo che venti a metà".

1. **QR Studio** (`/tools/qr`). What goes in: a link, plain text, Wi-Fi (name, password, type), a contact (vCard), an e-mail, a phone number. What it looks like: the shape of the modules (squares, dots, rounded, joined), the shape of the three corner eyes, colours (one, or a gradient) and background (also transparent), **a picture in the middle** (upload, with a clean margin around it and automatic high error correction so it still scans), a frame with a caption ("Scansiona"). The code redraws itself while he types. Checks that matter: enough contrast, quiet zone, the code is decoded again in the page to prove it scans before saving. Out: PNG (large), SVG, copy to clipboard, share sheet on phones.
2. **Palette** (`/tools/palette`). Five colours; tap or space to shuffle, lock the ones to keep; harmonies (analogous, complementary, triad, shades of one); **from a photo** (the main colours, computed on the device); every colour editable (hue, lightness, chroma in a perceptual space so steps look even); names of the nearest common colours; a contrast check for text on each pair; a preview on a small mock interface; export as CSS variables, Tailwind config, an image, a link that reopens the same palette.
3. **Convertitore** (`/tools/converti`). Units (length, weight, temperature, area, volume, speed, data), colours (HEX, RGB, HSL, OKLCH), number bases, time zones (the five cities of the site first), images (PNG, JPEG, WebP; resize and compress; say plainly when a format cannot be read on that phone). One field, live results, tap to copy.

After those, when he asks: wallpapers for the phone from a palette, a card with a sentence for stories, passwords, a random draw. The mini QR in the home tile is the first tool's engine with one field.

## 5. What is waiting for Imad (do not block on it)

His Instagram handle; his sentence for the hero; his photo and text for Su di me; his texts for Nel mondo; the pictures for the intro's letters; switching on a shared store for the greetings (Upstash on Vercel); the domain `imad.chat` (Vercel, then DNS at Spaceship); optionally a GitHub token.

## 6. State (update this)

- 2026-11-12: written while the agents were building Dot. Nothing of this document is built yet except what the table marks as built in `docs/anteprime/bento`. Next: the new home at `/anteprima` (replacing bento round 1 there), then `/progetti` and `/mondo`, then the tools one at a time, QR Studio first.
