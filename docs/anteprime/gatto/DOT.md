# Dot — the mascot of imad.chat

The single source of truth for the cat. Read it before touching anything in this folder; keep its last section up to date.
Imad's words are quoted in Italian. Everything he sees must be in Italian.

## 1. Who Dot is (Imad's decisions, do not relitigate)

- "chat" is cat in French: the site's mascot is a **cat called Dot**. It comes out of the dot key of `imad.chat`.
- **Black cat, green eyes, stylised and cute** ("lo voglio stilizzato cute carino, non deve essere un gatto vero"), but **a cat with a real build: separate legs and body**, not a ball ("più gatto con zampe e corpo distinti").
- **2D with depth** ("fallo in 2d ma con profondità"). The first draft in real 3D, made of spheres and cylinders, was rejected ("fa schifo fatto così con sfere cilindri e parallelogrammi"). No visible 3D primitives, ever. No three.js here.
- **A red Moroccan fez** with a tassel. "magari crea anche l'animazione che a volte quando ci clicchi sopra gli cade."
- "altre volte quando clicchi su di lui miagola, se lo svegli si infastidisce e si allontana, tutte queste cose del genere devi pensare e fare"; "devi anche creare molti modi in cui interagirà il gattino nel sito, pensaci tu."
- First time it appears, a tiny bubble: **"salam, sono Dot."** Nothing else in it.
- Only when the visitor has been still for a long time, or the site has been open for a long time, a bubble: **"Lo sapevi che «chat» vuol dire gatto in francese?"**
- The opening he approved ("l'animazione dalle immagini che ho visto mi piace"): the nine keys of `imad.chat` (a 3x3 face, the dot in the centre) fold onto the dot key, the key drops and becomes a box, the lid opens, the cat peeks, looks left and right, jumps out, sits, says who it is. Keys and box are **2D with depth** too.
- "fallo bene per favore, non fare AI slop, animato bene."
- His references (black sticker-like cats: ring or round eyes, a few whisker ticks, lots of character in the poses, cats peeking over a ledge, draped on a ledge, hanging, sliding down with claw marks, long "liquid" cats) are in the session's working folder, never in the repo. He says his friends drew them and allow copying; **we still draw an original cat**: it is his mascot, and a rig that moves cannot be traced from stills anyway. Never reproduce one specific character.
- Our own limits, told to him: Dot **never imitates prayer**; Dot **never stands on, covers or plays over the Corano tile**; Dot is quiet (asleep or away) on the page about the world's conflicts.

## 2. The look

Model units: 1 unit is about 1.5 CSS px on a phone, so Dot sits about 60 px tall and its head is about 35 px wide.

- **Silhouette first.** One near-black shape that reads at a glance in every pose. Big head (wider than tall), short neck, compact body, four short legs that are clearly legs, round paws, a thick expressive tail.
- **Eyes carry the character.** Big, round, green, with a black pupil and one small highlight; the pupils follow the finger. Lids make the mood: wide (startled), half closed and slanted (annoyed), soft arcs (happy, asleep), slow blink (trust).
- **Fez**: red, a short cone with a flat top, a thin black tassel with a bead that swings late. It sits between the ears, tilted a little.
- **Details, few**: two or three thin light whiskers per side; a tiny nose; inner ear in a muted pink or grey; a small pink mouth only when it meows or yawns.
- **Depth without 3D**: far legs and far ear a shade lighter than the body; near limbs overlap the body with a hairline or a soft edge of light; eyes, ears, nose and fez slide across the head when it turns (the rig places them on a sphere); a soft contact shadow on the tile; squash and stretch.
- **Readable on dark and on light**: the site follows the phone's theme and the wallpaper is Torino's sky. On dark, a thin cool edge of light on the top-left of the shapes keeps the black cat visible; on light, none is needed.
- Not wanted: thick outlines, hand-drawn wobble, halftone, emoji faces, gradients that look like plastic, anything that looks like stacked circles.

Three looks are being tried on the same skeleton so Imad can pick one live (a toggle in the preview): `adesivo` (sticker: soft, glossy round eyes, pink inner ears), `manifesto` (poster: graphic, flatter, hairlines between limbs, long tail), `pelo` (charcoal with soft lighter planes and an edge of light: the most depth).

## 3. What Dot does

Tiers: **P1** is the first preview, **P2** next, **P3** later on the real site.

Everyday life (P1): sits on a tile's top edge; walks along it; jumps between tiles; sits and looks around; loafs; sleeps (slow breathing, fez sliding over one eye); wakes with a stretch and a yawn; blinks; ears twitch; tail always alive.

Edges (from his references): **peeks from behind a tile's top edge** (ears, eyes, two paws on the edge), then climbs up (P1); **lies draped over the edge**, a front leg, a hind leg and the tail hanging down over the tile (P1); **hangs from a tile's lower edge** by the front paws, swinging (P2); **slides down the face of a tile leaving claw marks** that fade, eyes wide, when dropped there (P1).

Touch:
- **Tap**: never the same reaction twice in a row. It meows (mouth opens, a tiny "miao", a sound); or the **fez falls off**: it pops up, lands beside the cat, rolls a little, Dot looks at it, walks over and puts it back on; or a happy hop; or a purr with closed eyes (P1).
- **Tap while asleep**: it wakes **annoyed** (ears flat, half-lidded glare, tail thumping), gets up, turns its back, walks away to another tile and sits facing away for a while; later it looks back and forgives (P1).
- **Many taps in a row**: fed up, it walks off and hides in its box; two green eyes in the dark (P2).
- **Finger held still on it**: petting; it leans in, purrs, slow-blinks; after a few seconds it rolls belly up (P2).
- **Drag**: picked up by the scruff it becomes a **long cat** (the body stretches), legs limp, tail swinging, an unimpressed look. **Drop** on an edge: it lands and shakes; on a tile's face: it slides with claws; thrown: it flies, lands, tumbles (P1).
- **A finger moving fast nearby**: crouch, rear wiggle, pounce (P2).
- **Dragged into the box and the lid closed**: Dot stays inside until the box is tapped. This is the visitor's off switch (P2).

The page:
- Pupils and head follow the finger or the mouse (P1). With no finger, it looks at the visitor, with glances aside.
- Idle visitor: after about 25 s Dot grooms, yawns, loafs or sleeps; after about 90 s still, or 4 minutes open, once per visit, the French bubble (P1).
- Scrolling: Dot stays attached to its tile; if it ends up off screen it comes back by peeking from a visible tile or running in (P1). A fast scroll makes it brace, ears back (P2).
- It gets out of the way: if the visitor taps the tile under it, it hops aside (P2).
- Site things (P3): bats at the blinking cursor of `imad.chat_`; watches the globe turn; follows a greeting-star with its eyes; at night in Torino it sleeps more; on the tools pages it sits in a corner and watches.
- Reduced motion: Dot sits still and only blinks. Hidden tab: everything pauses.

Objects (asked on 2026-11-12: "crea anche delle immagini in cui ha dei gadget, degli oggetti, vedi te"). Dot has a few things of its own, each drawn by the look in its style and moved by the brain; they appear now and then, never all together, and each has its own small behaviour:
- **a glass of Moroccan mint tea**: it sits, holds it with both paws, sips with closed eyes, a wisp of steam (P1);
- **the star-dot of the site**, a small gold light that flits about: it follows it with its pupils, bats at it, pounces (P1);
- **a small cube in Imad's pastel colours** (the Kukko theme: `#ffb6c1`, `#fdfd96`, `#ffb347`, `#77dd77`, `#aec6cf`, `#ff6961`): it turns it over with a paw, tilts its head, puzzled; sometimes knocks it off the edge and looks down after it (P1);
- **a ball of yarn**: rear wiggle, pounce, it rolls away, a thread trails; now and then it ends up tangled (P2);
- **a tiny laptop**: it types fast with both paws, green lines of code scroll, it looks proud (P2);
- its **box** (home) and its **fez** are objects too.
Not objects for a cat: anything religious, any flag, anything about the conflicts.

Words and sound: "salam, sono Dot." / "miao" (also "mrr", "prr") / "Lo sapevi che «chat» vuol dire gatto in francese?". Sound only on a direct tap, short and quiet, from free-licence recordings recorded in `docs/fonti.md`; if none is good enough, no sound.

## 4. The quality bar for the motion

- Anticipation before every jump or pounce; squash on landing, settle after; nothing starts or stops dead.
- Arcs, not straight lines; ease in and out; hold the key poses long enough to read.
- Overlap and follow-through: tail, ears, whiskers, the fez and its tassel arrive late and overshoot.
- Feet never slide while walking; the body bobs twice per cycle; the head stays steadier than the body.
- Every state change is blended; no popping when legs change side or the tail wraps.
- Personality in the timing: curious (quick head, slow body), lazy (long holds), proud of its fez.
- It must run at 60 fps on a phone and cost nothing when off screen or hidden.

Check motion with frame strips (8 to 16 frames of one action side by side), not with single pictures.

## 5. How it is built

Plain scripts, no library, no build step. **ES2017 at most** (no optional chaining, no `??`, no class fields, no modules): the page must run on older iPhones. Imad's phone has iOS 18.0. Nothing here can test Safari: say so.

Files in `docs/anteprime/gatto/` (each has one owner while agents work in parallel):

- `dot-rig.js` — the skeleton. `DOT.makeRig(preset)` gives a rig: poses (`DOT.POSES`), proportions (`DOT.PROPS`), a pseudo-3D pose (body yaw, pitch, roll; head yaw, pitch, roll) projected to 2D. `rig.step(dt)` smooths toward the target pose; `rig.frame()` returns the **frame**: plain 2D geometry in model units, origin at the ground point under the cat, x right, **y up**. The frame is the contract between movement and drawing: fields may be added, never renamed or removed.
- `look-*.js` — a look registers `DOT.looks[name] = { label, preset, draw(ctx, frame, env), drawFez(ctx, fez, env), drawProp(ctx, name, p, env) }` (`drawProp` draws Dot's objects: `tea`, `cube`, `yarn`, `star`, `laptop`; origin at the object's base, y up). `ctx` arrives already transformed to model units with y up. A look never moves anything: it only draws the frame. Its `preset` may override proportions and pose numbers.
- `dot-brain.js` — behaviour: states, timing, physics, touch, bubbles, scratches, the loose fez, sounds. It talks to the rig by pose name, overrides and a few controls. It may register extra poses of its own; it does not edit the rig.
- `dot-stage.js` — the nine keys and the box, Canvas 2D.
- `dot-sound.js`, `media/` — sounds.
- `index.html`, `gatto.css` — the preview page: mock tiles, look toggle, dark and light, "Rivedi".
- `dot-fx.js` — the small things around Dot: the bubble, the scratches, the canvases of loose objects (fez, cube, yarn, star).
- `tavola.html`, `prova.html`, `scena.html`, `strumenti/` — tools for checking, never online (see section 6).

Drawing surfaces: canvases **positioned absolutely in page coordinates** inside one layer above the tiles, so they scroll with the page natively (a fixed full-screen canvas lags behind iOS scrolling). One small canvas follows the cat; the box and keys have their own; the loose fez and the scratches get theirs when needed. All of them `pointer-events: none`; one small transparent button over the cat takes the touches (`touch-action: none` on it only). "Behind a tile" is done by clipping the cat at the tile's edge.

Tiles tell Dot what they are with `data-dot`: `no` (never on it or over it: the Corano), `quiet` (stay away and still).

## 6. State (update this)

- 2026-11-12: the skeleton, three looks (`adesivo` chosen as default; then `manifesto`, `pelo`), the brain, the stage, the sounds and the preview page exist. The first draft (`gatto.js`, three.js) is deleted.
- **The preview**: `index.html` + `gatto.css`. Dark page (light with the toggle), ten mock tiles in a 4-column bento (30 px radius, frosted), one `data-dot="no"` (Corano, no text), one `data-dot="quiet"`. A dashed bar at the bottom (not part of the design): look, theme, sound, "Rivedi". Address: `?look=adesivo|manifesto|pelo`, `?tema=scuro|chiaro`, `?suono=no`; for tools `?manual=1`, `?seme=7`, `?primo=0`, `?k=3`. The opening plays on every load (for judging). Dot's layer sits in `#dotclip`, which cuts what sticks out on the right (without it the phone widens the page).
- **Online, prepared, not published**: `node scripts/home/build.mjs` also writes `public/gatto/` (addresses rewritten to `/gatto/...`); `next.config.ts` rewrites `/gatto` to it; `robots.ts` disallows `/gatto`; the page is `noindex`. `npm run build` passes; `public/home` and `public/anteprima` are unchanged.
- **Checked** in headless Chromium, phone viewport 390x844 with touch, served from `public/`: no console errors; the opening reaches the cat sitting with "salam, sono Dot." (about 8.3 s); taps give a different reaction each time; a tap while asleep wakes it annoyed and it walks off and sulks; drag → long cat, drop on a tile face → slide with scratches, drop above an edge → lands, throw → flies and lands; look, theme and sound toggles; reduced motion → no opening, sits; scrolling keeps it on its tile; hidden tab → 0 frames drawn; about 0.3 ms of work per frame on a desktop CPU. All scripts parse as ES2017.
- **Fixed while assembling**: a drop after holding the finger still threw the cat (the speed ignored the pause); the purr sound never started (it was called without `true`); `DOT.setDark()` added for the theme toggle; `DOT.start({ parent })` and `DOT.photoDpr` added.
- **Not tested**: Safari, a real iPhone (Imad's is on iOS 18.0), the sounds by ear, touch on a real screen. Ask Imad what he sees.
- **Known limits**: while the visitor drags it, Dot can pass over the Corano tile (it never lands there); on a tile right under another one there is no room to sit, so Dot only uses tiles with headroom; tiles under the Corano are never sat on.
- **Tools** (run from the repo root; pictures go wherever you say):
  - `node docs/anteprime/gatto/strumenti/tavola.mjs out.png "look=adesivo&bg=light"` — the pose sheet (`tavola.html`; a cell is 58 x k px wide).
  - `node docs/anteprime/gatto/strumenti/striscia.mjs out.png walk 14 adesivo` — a frame strip of one action on `prova.html` (scenes listed in the script).
  - `node docs/anteprime/gatto/strumenti/galleria.mjs out.png adesivo scuro` — twelve scenes at true size, 4x (add `candidati` to choose the instants).
  - `node docs/anteprime/gatto/strumenti/film.mjs outdir adesivo scuro` — `apertura.mp4` (opening + 20 s of life, 60 fps, H.264) and six key frames.
  - `scena.html?check=1` checks the stage contract; `prova.html` is the behaviour bench.
