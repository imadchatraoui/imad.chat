# imad.chat — project memory

Personal site of Imad Chatraoui (Italian, Muslim, near Turin). Visitors arrive from his Instagram bio: **phones in portrait first**. Reply to Imad in **Italian**, plainly, step by step; he writes informally and is not a designer or a sysadmin. Show him previews online, or as pictures and videos in the chat.

**Keep this file short.** It is loaded into every agent and every turn. The full history, with Imad's words for every decision, is in `docs/storia.md` (this file as it was until 2026-11-13). The design is written in `docs/anteprime/casa/CASA.md` (the home, the pages, the tools, the sky below the tiles) and `docs/anteprime/gatto/DOT.md` (the cat). Read the one you need before working.

`scratchpad/` below means `/tmp/claude-0/-home-user-imad-chat/ce1bc576-46f2-5005-bf4b-384611e2f4c7/scratchpad` (this session's scratch folder: worktrees, workflow scripts, pictures; it lives only in this container).

## What the site is

1. **The intro** (he loves it; about 8 s, silent, not skippable for now, on every load while he judges it; left out with reduced motion, `?shot=1`, `?open=` or a hash). On a dark sky `imad chatraoui` is typed, `raoui` goes away, a star falls and becomes the dot of `imad.chat`, `chat` grows and its letters are windows on his things, the nine characters settle into a 3x3 grid like a cube face, the grid opens into the home, the wordmark stays as `imad.chat_`. The live one is `docs/anteprime/intro/intro.js`. A second version to compare, `intro-gatto.js`, has Dot in it (a black paw pushes `raoui` off the line, Dot dives into the dot key) and the passage from the nine keys to Dot's box.
2. **The home: a bento of nine live tiles**, Apple-like, rounded, light and dark following the phone: Corano (the one still tile, on paper), Le città (a dotted globe with real day and night), Nel mondo (the world's conflicts), Su di me, Saluti, Progetti (its picture is the cube), Tools, Heatmap (his GitHub year), Sto imparando (Three.js Journey). A dock of filters. The page is Torino's real sky, the tiles are glass, one real sun lights the edges, one gold marks what is alive.
3. **Dot**: a black cat with green eyes and a red Moroccan fez, 2D, look "Manifesto". It comes out of a box made of the nine keys, says "salam, sono Dot.", lives on the tiles' edges, the dock and the footer logo, can be touched and dragged, and hints at it (a ghost fingertip once, a knock on the glass).
4. **Below the tiles** (designed in CASA.md 2e, not built): the real sky over Torino now, where a greeting chosen from a fixed list becomes a star. That is the "chat" of imad.chat: **greetings that become stars**, never free text. They stay on the visitor's phone until a small shared store exists on Vercel (Upstash; he must switch it on).
5. **Pages**: `/progetti`, `/mondo`, `/su-di-me`, `/tools` (QR Studio first, then Palette and Convertitore; each one "fatta bene bene", computed on the device).

All of this is online only as previews (`/anteprima`, `/gatto`, not indexed). **The home at `/` is still the first Widget page with the intro; replacing it needs his OK.**

## Imad's decisions (do not relitigate)

- **Style**: modern, Apple-like, "aesthetic" bento; rounded corners; an upright sans (Manrope; Geist Mono for the machine's voice); great care in details and motion, never basic ("non fare AI slop"). **No italic.** Rejected: the photoreal gold astrolabe, the cartoon look (thick outlines, halftone, wobble, emoji as icons).
- **No Islamic geometric ornament anywhere** (stars, crescents, arabesques, zellige, lanterns, arches, domes, tatreez), and no crescent as an icon. **The one Islamic element is the Quran**, set plainly: text only verbatim from `content/astro/verses.json` (Uthmani from quran.com; Italian by Hamza Roberto Piccardo), never typed, altered, truncated, animated or covered; no "scientific miracle" claims; ﷺ after the Prophet's name; never a depiction of him. No Arabic typed by hand anywhere: names come from a source recorded in `docs/fonti.md`.
- **Cities: only Gaza, Torino, Medina, Makkah, Casablanca.**
- **Nel mondo** (Palestine, Sudan, Bosnia, "tutti i conflitti") and **Su di me**: **he writes them.** We give the pages and an easy way to edit; no text, facts, slogans or personal details of ours. Sober and still. Placeholder: "Presto, con le parole di Imad."
- **Cube**: not a tile; one of his projects (his fork of "The Cube" by Boris Šehovac: credit him). His pastel theme **Kukko**: U `#ffb6c1`, D `#fdfd96`, F `#ffb347`, R `#77dd77`, B `#aec6cf`, L `#ff6961`, white plastic. Those colours only on the cube.
- **Dot**: stylised and cute, a real cat's build (legs and body distinct). "salam, sono Dot." is its only greeting; "Lo sapevi che «chat» vuol dire gatto in francese?" only after a long idle time; tapped, it sometimes loses the fez and sometimes meows; woken, it is annoyed and walks away; it has objects (mint tea, the gold star, a Kukko cube, yarn, a tiny laptop). Our own limits: it never imitates prayer, never stands on or over the Corano, never covers words or controls, carries no religious, flag or conflict props. The references he sent are other people's drawings: style only, the cat is ours.
- **The hint that Dot can be touched** must be "subdola, semplice, furba", without invading the screen.
- **Wanted next** (his words are in `docs/storia.md`): the page goes on below the tiles ("cose cariche", detailed); a theme button; yarn threads hanging from the sound and theme buttons, on which Dot can hang and tear the button off; a stylised cursor on computers; a menu that opens from the 3x3 logo; a box of keys to play with; every tile opens a section full of details, not a simple box; tools people really use.
- Rejected as banal: a desk with objects, a terminal with commands, a diary he must keep updating, an AI chatbot, a glass sphere.
- Media: placeholders only from free-licence archives (never Pinterest), sources in `docs/anteprime/intro/FONTI.md`; he will send his own. In the intro's windows Islam = the Kaʿba (a real picture, no effects), Palestine = the flag. No invented counts or sample data on anything public.
- **React Bits** components are allowed through the shadcn registry (`components/reactbits`), only where they serve the design.
- **How to work with him**: work alone for hours, no questions unless vital (then in plain text, few); previews at separate, non-indexed addresses may go online when the checks pass ("ti do l'ok"); he likes demos online early and previews drawn by code. He follows the usage limits closely and pauses or stops agents himself: **when he says stop, nothing restarts until he says so.**
- **His phone**: iPhone, iOS 18.0, Safari; it cannot open claude.ai artifacts. Nothing here can test Safari: say so and ask what he sees. Page scripts in ES2017; never `:has()` in a selector list with others; `top/right/bottom/left` beside `inset`; `-webkit-backdrop-filter`; inputs at 16 px.

## Branches and deploy

- Work on **`claude/zen-pascal-9mndeq`**; commit and push often (a stop hook asks for a clean tree). Commits whose message starts with `WIP` are skipped by Vercel. Push to no other branch, except `main` as below. No pull request unless he asks.
- Production = `main` → **https://imadchat.vercel.app**. The domain imad.chat is not connected: he must add it in Vercel and set the DNS at Spaceship.
- **To publish previews**: in the worktree `scratchpad/pubblica`, check out the commit (detached). `node scripts/home/build.mjs` must leave `public/home` unchanged; every script under `public/anteprima` and `public/gatto` must parse as ES2017 (esprima); `NEXT_DIST_DIR=.next-pub npm run build`; `next start` and the smoke test (`scratchpad/pub2/smoke.cjs`: 63 of 66, the 3 known fails are the removed look buttons of `/gatto`); then `git merge -s ours origin/main -F <msgfile>` (main has its own history; never a `WIP` title) and `git push origin HEAD:main`; check online. `scratchpad/pub4/run.sh` does all of it and publishes only if every gate passes.
- If he ever edits his texts on `main` from GitHub, bring them into the work branch before publishing: the `-s ours` merge would drop them.
- **Next.js 16** (`AGENTS.md`): read `node_modules/next/dist/docs/` before Next-specific code. A dev server with its own dist folder (`NEXT_DIST_DIR=.next-<name>`) adds lines to `tsconfig.json`: `git checkout -- tsconfig.json` before committing.
- The previews are static pages built by `scripts/home/build.mjs` from `docs/anteprime/` into `public/` (committed: Vercel does not run it): `public/home` from `c-widget` and `intro`; `public/anteprima` from `casa`, `gatto` and `intro-gatto.js`; `public/gatto` from `gatto`.

## Map

- `docs/anteprime/casa/` — the new home (`home/`: `index.html`, `style.css`, `casa.css`, `casa.js`, `app.js`, `vivo.js`, `vivi.js`, `vivi.css`, `moto.js`, `moto.css`, `terra.js`), `comune/` (the pages' frame), `progetti/`, `mondo/`, `su-di-me/`, `tools/` (the QR engine `qr/qr-core.js`), `strumenti/` (`servi.mjs`: a static server that answers the two GitHub routes from saved files, `scratchpad/casa/invio/contributi-veri.json` and `progetti-veri.json`; photo and film tools), **`CASA.md`**.
- `docs/anteprime/gatto/` — Dot: `dot-rig.js`, `look-manifesto.js`, `dot-brain.js`, `dot-stage.js`, `dot-fx.js`, `dot-sound.js`, sheets and tools, **`DOT.md`**.
- `docs/anteprime/intro/` — `intro.js` (live), `intro-gatto.js` (with Dot), `media/`, `FONTI.md`, tools. `docs/anteprime/c-widget/` — the page that is live at `/`.
- `app/api/github/contributi` and `progetti` — the two route handlers (public data only; his one private repository and the profile repository are never listed). `next.config.ts` rewrites `/` to `public/home`.
- `content/astro/*.json` (stars, verses, cities, curiosities), `lib/astro/` (verified astronomy), `docs/fonti.md` (sources). Morocco is at UTC+0 all year since 2026-09-20: guard `Africa/Casablanca` on devices with older time-zone data.
- The rest of the tree (`components/`, `app/lab`, `app/sezioni`) is the old astrolabe site, kept for parts.

## Agents and limits

- Usage has a 5-hour window and weekly limits, and he watches them. **Every agent starts with about 100,000 tokens of context** (this file is part of it), and a long conversation makes every orchestrating turn expensive. So: 2 or 3 agents at a time, crisp scopes, a cap on capture rounds, short orchestrating turns.
- Models: he sets the session's model himself; an agent that is not given a model inherits it. His rule since 2026-11-13: the strongest model at max effort with ultracode for the thinking agents; the agents that only save run on the small one. If the strongest model's limit ends he switches the session down and the agents follow.
- Teams that edit the same pages work in separate git worktrees on local branches (never pushed) and are merged into the work branch when done. No pictures or logs inside a checkout.
- The night loop (one reminder at a time, re-armed every two hours) is off since he stopped everything on 2026-11-13. Arm it again only if he asks to work unattended, and never past 2026-11-19 without asking.
- Higgsfield: his trial ends 2026-11-13 21:00 UTC. Never call `generate_*` or spend credits without his explicit OK; never ask him to paste codes or callback URLs; visuals drawn by code are preferred. He would pay for one very well made animation (the proposal is in `docs/storia.md`).

## State (2026-11-13, 13:00 Italian time)

- **Online** (main `2fed1a5`): `/anteprima` = the nine tiles after the "casa bella" round and its corrections, the intro with Dot, the passage to the box, the hint; `/gatto`; the three pages. `?v=stella` plays the intro without the cat; `?suggerimento=prova` makes the ghost fingertip come again on a phone that already touched Dot; `?shot=1` skips the intro. Checked only in headless Chromium.
- **Done**: `gatto-intro` (Dot in the intro, the passage, the hint, where Dot stays; final check 92 of 92) and `casa-bella` (CASA.md 2d; do not resume its workflow). The work branch holds what is online, plus notes.
- **Paused by him, ready to resume** with `Workflow({ scriptPath, resumeFromRunId })`:
  - `sotto-la-bento`: `scratchpad/sotto-scr/sotto-wf.js`, run `wf_12be6a01-305`, checkout `scratchpad/bella` (branch `casa-bella`). The direction is done (CASA.md 2e); next come its two builders.
  - `gioco-e-sezioni`: `scratchpad/gioco-scr/gioco-wf.js`, run `wf_00cd12da-336`, same checkout. Nothing done yet. After it, "Dot round 2" (the cat on the yarn) from its director's `dot` brief.
  - `tools`: `scratchpad/tools/strumenti-wf.js`, run `wf_9a5e4b75-2b1`, checkout `scratchpad/wt-tools` (branch `tools-qr`). The index page is built, QR Studio is half written (committed locally).
  - Before resuming a team in `scratchpad/bella`, merge the work branch into `casa-bella`.
- **Small jobs** (workflow `piccole-cose`, run `wf_909d4e1d-0d2`, script in the session folder `workflows/scripts/`): a read-only check of the live preview (scratch `vivo/`), and in `scratchpad/wt-piccole` (branch `piccole`) the bubble that must not cover the hero dateline, `riordina.html`, the mount example in DOT.md. When done: read both results, merge `piccole`, rebuild, publish.
- **Waiting for Imad**: what he sees on his iPhone (the intro with the cat, touch and drag, the meow, the ghost fingertip, which he did not see: `?suggerimento=prova`); his sentence for the hero; his texts and photos (Nel mondo, Su di me, the intro's windows); his Instagram handle; the store for shared greetings; the domain; his OK before anything replaces the home at `/`.
- **Known weak points**: at the end of CASA.md section 6 and of DOT.md section 6.
