# imad.chat — project memory

Personal site of Imad Chatraoui (Italian, Muslim, near Turin). Visitors arrive from his Instagram bio: **phones in portrait first**. Reply to Imad in **Italian**, plainly, step by step; he writes informally and is not a designer or a sysadmin. He wants to be asked questions and shown previews before big changes ("fammi tante domande prima di iniziare, mostrami anteprime").

## What the site is (direction of 2026-11-11; it replaces the astrolabe-centred site)

"hello, imad's world": an opening where `hello, world` is typed, `world` is erased and becomes `imad's world`; then the phrase condenses into `imad.chat` (white text) and a **bento grid of live tiles** opens around it. Apple-like style, rounded tiles of different sizes, light and dark theme following the phone.

Tiles, by importance:

- big: **Corano** (interactive mushaf), **Le città, adesso** (Gaza, Torino, Medina, Makkah, Casablanca: local time, sky, qibla), **Palestina**;
- second tier: **Su di me**;
- small: **Cubo di Rubik** (small on purpose: "non è così importante"), **Cielo** (the astrolabe with the real sky, now a secondary extra), **Saluti** (the "chat"), **Codice**, **Curiosità e folklore**;
- a logo slot top-left.

The "chat" of imad.chat is **greetings that become stars**: a visitor picks a greeting from a fixed list in many languages (no free text) and it becomes a star in the site's sky, visible to everyone. It needs a small shared store on Vercel (not set up yet).

## Imad's decisions (do not relitigate)

- **Style: modern, Apple-like, "aesthetic" bento UI**: rounded corners, a modern upright sans, great care in details and motion. **No italic type.** Rejected: the photoreal gold astrolabe with italic serif ("mi fa schifo la grafica, con il font in corsivo"); the cartoon/comic look ("troppo cartoonish"): no thick outlines, halftone, hand-drawn wobble, emoji as icons.
- **The astrolabe is not the main thing** ("va bene come feature secondaria ma non come roba principale"). Nobody comes to spin the sky through the days.
- **No Islamic geometric ornament anywhere** (no eight-pointed stars, crescents, arabesques, girih, zellige, lanterns, arches, dome/minaret silhouettes, tatreez as decoration). **The one Islamic element is the interactive Quran**, set plainly.
- **Cities: only Gaza, Torino, Medina, Makkah, Casablanca.** Removed: Istanbul, Samarcanda, Kyoto, Cusco, Al-Quds, Fès.
- **Palestina**: he wants a part that talks about Palestine, the conflict included, and **he writes and manages that content himself**. Give him the page and an easy way to edit it; do not write that content for him, no invented facts, no slogans of ours.
- **Su di me**: a second-tier tile. No personal details (studies, job, age, address) unless he writes them himself.
- Rejected as banal: a desk with interactive objects; a terminal with commands; a diary/blog he must keep updating; an AI chatbot.
- Quran text only verbatim from `content/astro/verses.json` (byte-identical to api.quran.com Uthmani; Italian by Hamza Roberto Piccardo). Never type or alter Arabic; never apply effects to it; never truncate a verse. No "scientific miracle" claims. Add ﷺ after the Prophet's name.
- No Arabic is typed by hand anywhere: names come from a source (Wikidata labels, quran.com) recorded in `docs/fonti.md`.
- **Cube**: he offered his own repo `github.com/imadchatraoui/cube`, his fork of "The Cube" by Boris Šehovac (three.js; upstream `bsehovac/the-cube` now targets three 0.187 like this repo; package licence field ISC, no LICENSE file). His addition is the pastel theme **Kukko**: U `#ffb6c1`, D `#fdfd96`, F `#ffb347`, R `#77dd77`, B `#aec6cf`, L `#ff6961`, white plastic. Use those colours and that way of playing; credit the original author.
- **Components**: he allows **React Bits** (reactbits.dev) through the shadcn registry: in `components.json`, `"registries": { "@react-bits": "https://reactbits.dev/r/{name}.json" }` (names like `GlassSurface-TS-CSS`). Use one only where it serves the design, never as a bolted-on effect.
- He likes previews drawn by code, without Higgsfield ("mi piace questa tua iniziativa di creare quelle anteprime senza usare higgsfield o altro").
- He pre-authorised publishing to `main` when a build passes checks ("ti do l'ok"), and likes seeing demos online early.

## Branches and deploy

- Work on **`claude/zen-pascal-9mndeq`**; commit and push often. Commits whose message starts with `WIP` are skipped by Vercel (`vercel.json` ignoreCommand).
- Production = `main` → **https://imadchat.vercel.app** (Vercel project "imadchat"). The domain **imad.chat is not connected yet**: Imad must add it in Vercel → Settings → Domains and set the DNS records at Spaceship (it still points to Spaceship parking).
- To publish: create a worktree at the commit to ship, `npm ci`, `npm run build`, smoke-test with Playwright, then `git merge -s ours origin/main -F <msgfile>` (main has its own history) and `git push origin <branch>:main`. Never push a `WIP` message to main.
- This is **Next.js 16** (see `AGENTS.md`): read `node_modules/next/dist/docs/` before writing Next-specific code. Several dev servers can run at once with `NEXT_DIST_DIR=.next-<name> npx next dev -p <port>`.

## Map (the tree still holds the old astrolabe site; reuse what fits, remove the rest in the rebuild)

- `app/` — layout, home (`page.tsx` → `components/site/Home.tsx`), `sezioni/[slug]`, OG image, icons, `lab/` test benches (noindex).
- `components/intro/` — Canvas 2D intro (`Intro.tsx`, `engine.ts`); old gold/italic look, to be redone.
- `components/astrolabe/` — R3F 3D astrolabe + `AstrolabeFallback` (2D SVG); see its `README.md`. To become the secondary "Cielo" extra, restyled.
- `components/site/` — old shell: chrome, sheets/panels, control bar, city backdrop, sound toggle.
- `components/quran/` — the interactive mushaf (`QuranBook`, `QuranAction`), style-agnostic via `--q-*` CSS variables; unfinished (its review was stopped), not mounted.
- `lib/astro/` — verified astronomy (astronomy-engine): projection, plates, rete, sky, qibla. `lib/media.ts`, `lib/sound.ts`, `lib/sections.ts`, `lib/site.ts`.
- `content/astro/*.json` (stars, cities, verses, curiosities), `content/sezioni/*.md`; sources in `docs/fonti.md`. `cities.json` still lists the old eight cities.
- `public/media/` + `manifest.json`, `scripts/media/` — Higgsfield assets and importer. `scripts/check/` — content validator and astronomy check (`npm run check:content`, `npm run check:astro`).
- Morocco is at UTC+0 all year since 2026-09-20 (tzdata 2026c): guard `Africa/Casablanca` for devices with older time-zone data.

## Higgsfield (generated media)

- Free trial, **ends 2026-11-13 21:00 UTC**; auto-renewal already cancelled. Unlimited generations work only from ChatGPT / Claude chat, not from Claude Code (from here only read history with `show_generations`; never call `generate_*`: it would spend his 10 credits).
- On 2026-11-11 Imad asked to **stop ChatGPT**: the old prompts (brass textures, ornaments, old cities) are obsolete. Imported and still usable: sounds S01–S11, night ambience, at-Tariq video, Turin night still. Ambiences for Torino and Gaza exist in the account but are not imported.
- New media only if the chosen design needs it; visuals drawn by code are preferred.

## State on 2026-11-11 evening (update this section)

- Online on main: the OLD demo (intro → gold 3D astrolabe). It is not what he wants any more.
- Answers collected so far: bento grid of live tiles; chat = greetings that become stars; contents = Corano, città, Palestina (his text), Su di me, cielo as an extra, codice, curiosità e folklore, cubo small; Casablanca for Morocco; opening = hello, world → imad's world → imad.chat; theme follows the phone; style Apple.
- More answers: the cube opens his full game; Corano = a different verse every day for now (later the whole Quran or verses he picks, "ma non ora"); Su di me he writes himself; Higgsfield "non sta lavorando" for now, so everything is drawn by code, including the opening with **the rising star** (he loved an earlier test video of a star rising into a blue-hour sky: "era un qualcosa di originale").
- **Imad chose the "Widget" preview** (an iPhone-like home of solid widgets on a calm dark ground: dusk-sky hero with the white wordmark, big Corano widget, five city rows coloured by their real sky, star map, greetings, olive Palestina, code editor, contact card, "Lo sapevi", small cube; palette night blue, cream/sand, olive, clay, cube pastels; font Manrope) with the words "usa questo però miglioralo più aesthetic". The other three takes (Vetro, Keynote, Tinta) are dropped; good ideas from them may be grafted.
- In flight: the improved Widget preview in the session scratchpad `anteprime/c-widget` (static HTML/CSS/JS, the design source for the real build), with an independent gate. The foundations workflow (cities, verse of the day, greetings API, cube port) was cut off by the 5-hour usage limit almost at the start: only the five-city order, the neutral plate band and the Morocco time guard landed. Usage limit: run few agents at a time; too many in parallel exhausts the window in half an hour.
- Next: show Imad the improved Widget (live page + pictures) and let him choose the font → build the real bento home in Next.js from that design (shell, tiles, opening, tile pages), foundations (cities data, verse of the day, greetings store on Vercel, cube port), restyle the Quran reader → review and fix → publish to main.
