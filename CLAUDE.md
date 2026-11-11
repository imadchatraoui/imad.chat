# imad.chat — project memory

Personal site of Imad Chatraoui (Italian, Muslim, near Turin). Visitors arrive from his Instagram bio: **phones in portrait first**. Reply to Imad in **Italian**, plainly, step by step; he writes informally and is not a designer or a sysadmin.

## What the site is

"hello, imad's world": an intro where `hello, world` is typed, `world` is erased and becomes `imad's world`; then an interactive **astrolabe** showing the real sky now (drag the rete = travel in time), with city plates (torino, al-quds, gaza, fes, istanbul, samarcanda, kyoto, cusco), star panels with Arabic names, at-Tariq (a star knocks three times, a needle of light pierces the night), qibla, the back with the real `reteAngle` code engraved, sections (Markdown), sounds.

## Imad's decisions (do not relitigate)

- **Visual style: stylised cartoon / comic-book**, in the family of *Spider-Verse*'s graphic language but with its own identity (no copying, no characters/logos). He rejected the photoreal gold astrolabe with italic serif ("mi fa schifo la grafica, con il font in corsivo"). **No italic type.**
- **No Islamic geometric ornament anywhere** (no eight-pointed stars, crescents, arabesques, girih, zellige, lanterns, dome/minaret silhouettes, tatreez as decoration). **The one Islamic element is an interactive Quran** (a mushaf you open and leaf through; each sky verse acts on the astrolabe).
- Rejected as banal: a desk with interactive objects; a terminal with commands; a diary/blog he must keep updating; a chatbot.
- **No personal details** about him (studies, job, age, address). The site shows what he loves: coding, the Quran, stars and space, travel and cultures, folklore and curiosities, Turin, Palestine (dignified, cultural; no war imagery, no slogans).
- Quran text only verbatim from `content/astro/verses.json` (byte-identical to api.quran.com Uthmani; Italian by Hamza Roberto Piccardo). Never type or alter Arabic; never apply effects to it. No "scientific miracle" claims. Add ﷺ after the Prophet's name.
- He pre-authorised publishing to `main` when a build passes checks ("ti do l'ok"), and likes seeing demos online early.

## Branches and deploy

- Work on **`claude/zen-pascal-9mndeq`**; commit and push often. Commits whose message starts with `WIP` are skipped by Vercel (`vercel.json` ignoreCommand).
- Production = `main` → **https://imadchat.vercel.app** (Vercel project "imadchat"). The domain **imad.chat is not connected yet**: Imad must add it in Vercel → Settings → Domains and set the DNS records at Spaceship (it still points to Spaceship parking).
- To publish: create a worktree at the commit to ship, `npm ci`, `npm run build`, smoke-test with Playwright, then `git merge -s ours origin/main -F <msgfile>` (main has its own history) and `git push origin <branch>:main`. Never push a `WIP` message to main.
- This is **Next.js 16** (see `AGENTS.md`): read `node_modules/next/dist/docs/` before writing Next-specific code. Several dev servers can run at once with `NEXT_DIST_DIR=.next-<name> npx next dev -p <port>`.

## Map

- `app/` — layout, home (`page.tsx` → `components/site/Home.tsx`), `sezioni/[slug]`, OG image, icons, `lab/` test benches (noindex).
- `components/intro/` — Canvas 2D intro (`Intro.tsx`, `engine.ts`); props `onDone, targetRect, skip, onEvent`.
- `components/astrolabe/` — R3F 3D astrolabe + `AstrolabeFallback` (2D SVG); see its `README.md` for the API (ref methods `assemble, explode, flip, triggerTariq, setTime, resetNow, pointQibla`).
- `components/site/` — shell: chrome, sheets/panels, control bar, city backdrop, sound toggle.
- `components/quran/` — the interactive mushaf (`QuranBook`, `QuranAction`), style-agnostic via `--q-*` CSS variables. Not yet mounted in the home.
- `lib/astro/` — verified astronomy (astronomy-engine): projection, plates, rete, sky, qibla. `lib/media.ts`, `lib/sound.ts`, `lib/sections.ts`, `lib/site.ts`.
- `content/astro/*.json` (stars, cities, verses, curiosities), `content/sezioni/*.md`; sources in `docs/fonti.md`.
- `public/media/` + `manifest.json` — generated assets; the code must work without them and pick them up from the manifest.
- `scripts/media/jobs.json` + `import.py` — registry of Higgsfield jobs and the importer (download, convert, write the manifest). `scripts/check/` — content validator and astronomy check.
- `docs/higgsfield.md` (what to generate and how), `docs/riferimenti.md` (public-domain references uploaded to Higgsfield), `docs/mio-mondo.md` (concept).

## Higgsfield (generated media)

- Imad has a free trial: **unlimited generations work only from ChatGPT / Claude chat, not from Claude Code** (from here: read history with `show_generations`, never call `generate_*`: it would spend his 10 credits). Auto-renewal is already cancelled. **Trial ends 2026-11-13 21:00 UTC.**
- Covered by unlimited: images up to **2k** (nano_banana_pro, nano_banana_2_1, seedream; gpt_image_2_6 at quality medium), video **seedance_2_0 720p ≤ 15 s**, audio `seed_audio`. About one job per type at a time, ~16 minutes each: prioritise.
- Flow: I write a message → Imad pastes it in a normal ChatGPT chat (not the Higgsfield panel) → results appear in the account → sync with `show_generations` → add to `scripts/media/jobs.json` → `python3 -I scripts/media/import.py`.
- Imported so far: sounds S01–S11 and the night ambience, at-Tariq video (v and h), Turin night still. The brass textures (T02) are unusable. **Image generation is paused until the cartoon style is chosen**; then rewrite the image prompts in that style.

## State on 2026-11-11 (update this section)

- Online demo on main: intro → 3D astrolabe → panels, old gold/italic look, Quran not included.
- In flight when this was written: integration review (5 lenses) and fixes; intro motion/perf fixes; two cartoon style-frame proposals (`scratchpad/style-fumetto`, `style-mano`) to show Imad; the Quran component with two reviews.
- Next: Imad picks a style → restyle intro, astrolabe and shell (cartoon shading/outlines, new type, no ornament: also remove the star logo mark, the kursi piercings and city motifs such as tatreez/zellige/girih from plates) → mount `QuranBook` in the home and wire `QuranAction` to the astrolabe → new Higgsfield image prompts in the chosen style → publish.
- Live demo checked on an emulated iPhone (2026-11-11): intro, assembly, rete drag (+4 h 36 min), city switch with the right local time, at-Tariq, Sezioni menu and a section panel all work, zero console errors.
- Known gaps: after a drag, "Adesso" returned to now very slowly in the software-rendered test (about 2 minutes of sky time per second): check that `resetNow` is time-based, not frame-based. The moon disc can sit half off-screen at the right edge on phones.
- Checks: `npm run check:content` (schema, limits, verse placeholders) and `npm run check:astro` (lib/astro against astronomy-engine). `npm run media` imports Higgsfield results.
