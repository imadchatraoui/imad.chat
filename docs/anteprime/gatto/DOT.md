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
- **Finger held still on it**: petting; it leans in, purrs, slow-blinks; after about 3.4 s it **melts flat** under the finger (body spread, chin on the ground, eyes two happy arcs, slow breath, the tail tip flicking slowly, the fez stays on); when the finger leaves it gets up with a stretch. (The old "rolls belly up" read as a dark blob in all three looks and was dropped on 2026-11-12.)
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

- `dot-rig.js` — the skeleton. `DOT.makeRig(preset)` gives a rig: poses (`DOT.POSES`), proportions (`DOT.PROPS`), a pseudo-3D pose (body yaw, pitch, roll; head yaw, pitch, roll) projected to 2D. `rig.step(dt)` smooths toward the target pose; `rig.frame()` returns the **frame**: plain 2D geometry in model units, origin at the ground point under the cat, x right, **y up**. The frame is the contract between movement and drawing: fields may be added, never renamed or removed. Two controls added on 2026-11-12: `rig.headMax` (how far, in radians, the head may turn away from the viewer; soft limit, `null` = none) and `rig.breathRate` (radians per second, default 1.9; changing it never jumps).
- `look-*.js` — a look registers `DOT.looks[name] = { label, preset, draw(ctx, frame, env), drawFez(ctx, fez, env), drawProp(ctx, name, p, env) }` (`drawProp` draws Dot's objects: `tea`, `cube`, `yarn`, `star`, `laptop`; origin at the object's base, y up). `ctx` arrives already transformed to model units with y up. A look never moves anything: it only draws the frame. Its `preset` may override proportions and pose numbers.
- `dot-brain.js` — behaviour: states, timing, physics, touch, bubbles, scratches, the loose fez, sounds. It talks to the rig by pose name, overrides and a few controls. It may register extra poses of its own; it does not edit the rig.
- `dot-stage.js` — the nine keys and the box, Canvas 2D.
- `dot-sound.js`, `media/` — sounds.
- `index.html`, `gatto.css` — the preview page: mock tiles, look toggle, dark and light, "Rivedi".
- `dot-fx.js` — the small things around Dot: the bubble, the scratches, the canvases of loose objects (fez, cube, yarn, star).
- `tavola.html`, `prova.html`, `scena.html`, `riordina.html`, `strumenti/` — tools for checking, never online (see section 6).

Drawing surfaces: canvases **positioned absolutely in page coordinates** inside one layer above the tiles, so they scroll with the page natively (a fixed full-screen canvas lags behind iOS scrolling). One small canvas follows the cat; the box and keys have their own; the loose fez and the scratches get theirs when needed. All of them `pointer-events: none`; one small transparent button over the cat takes the touches (`touch-action: none` on it only). "Behind a tile" is done by clipping the cat at the tile's edge.

Tiles tell Dot what they are with `data-dot`: `no` (never on it or over it: the Corano), `quiet` (stay away and still). Details in "How to mount Dot on a page" below.

### How to mount Dot on a page

**Markup.** The page needs the tiles (any elements matching one selector), a home tile for the box, and one empty clipping layer for Dot:

```html
<body style="position: relative">                      <!-- the clip layer below covers the whole page, not only the first screen -->
  <div class="dot-clip" id="dotclip"></div>              <!-- position:absolute; top:0; right:0; bottom:0; left:0; overflow:hidden; pointer-events:none; z-index under every sheet -->
  ... <div class="t" data-home>hero</div>
      <div class="t" data-dot="no">Corano</div>
      <div class="t" data-dot="quiet">Nel mondo</div>
      <div class="t">...</div> ...
</body>
```

Without the clipping parent the cat's canvas sticks out on the right near the screen edge and the phone widens the page (seen in the tests: `innerHeight` grew from 844 to 896). Write `top/right/bottom/left` next to any `inset` for older Safari.

**`data-dot` on a tile:**
- none: an ordinary tile. Dot sits, walks, sleeps, plays on its top edge, slides down its face, hangs from its bottom edge. Tiles smaller than 40 x 24 px and hidden tiles (`display: none`) are ignored; the corner radius is read once per full refresh so Dot keeps off the rounded corners.
- `no` (the Corano): Dot never stands on it, covers it or plays over it. Its own top edge is never used, and the part of any edge less than 84 px under it (Dot's height with the fez) is cut away. Jumps, throws, the loose fez and the objects never cross it (checked on the true arc, whole body). Dropped in front of it, or with any part of it in front of it at the moment of release, Dot leaps away at once. Only while the visitor drags it can it pass over it.
- `quiet` (the page about the world's conflicts): strict. Dot never chooses its edge nor an edge right under it (these are kept, but flagged); if it lands there (dropped, thrown, falling) it leaves at once with a quick jump: no shake, no bubble, no game, no sound; a tap there only hurries it away; dropped on its face it leaps away (no scratches, no hanging); no object, game, pounce, petting or bubble starts while any part of Dot is over it or within about 150 px; objects never rest on it. Jumping past in front of it is allowed. If no other edge is visible, Dot hides behind the edge and waits out of sight.
- `data-home` (or `home:` in the options): the tile whose top edge holds the box (at 72% of its width if wider than 220 px, else in the middle). It must have headroom: no `no` tile right above it (if there is one, the opening is skipped).

**Scripts, in this order** (plain scripts, no modules):

```html
<script>window.DOT = window.DOT || {}; window.DOT.mediaBase = "/gatto/media/";</script>   <!-- where the sounds are -->
<script src="dot-rig.js"></script>
<script src="look-base.js"></script>          <!-- the fallback look, always -->
<script src="look-adesivo.js"></script>       <!-- and/or look-manifesto.js, look-pelo.js: only the looks the page offers -->
<script src="dot-stage.js"></script>          <!-- the keys and the box (without it: no opening, no box) -->
<script src="dot-sound.js"></script>          <!-- optional -->
<script src="dot-fx.js"></script>
<script src="dot-brain.js"></script>
```

The keys of the opening use Manrope 800 (the stage redraws its letters when the font arrives).

**`DOT.start(options)`** (returns `DOT`; calling it again stops the previous Dot first):

| option | what it is | default |
| --- | --- | --- |
| `tiles` | CSS selector of the tiles | `".t, [data-tile]"` |
| `home` | the home tile (an element), or a page point `{ x, y }` on a top edge | the first ordinary tile wider than 150 px |
| `look` | `"adesivo"`, `"manifesto"`, `"pelo"` (must be loaded) | `"base"` if missing |
| `firstVisit` | `true`: the opening (keys, box, "salam, sono Dot."). `false`: no opening; from the very first painted frame the box stands closed in its place and Dot is already around: asleep on a visible edge (fez over one eye), loafing, or peeking from behind an edge, chosen at random | `true` |
| `reducedMotion` | force reduced motion (it is also read from `prefers-reduced-motion`): never the opening, Dot sits still and only blinks | `false` |
| `dark` | dark theme (whiskers, scratches, steam); change later with `DOT.setDark(bool)` | from `prefers-color-scheme` |
| `parent` | the clipping layer above | `document.body` (avoid) |
| `bottomInset` | pixels covered at the bottom of the screen (a dock, Safari's bar): a number, or a function read again at every world read. Edges there count as out of sight | `0` |
| `topInset` | the same for a strip covered at the top (a floating bar) | `0` |
| `k` | pixels per model unit (Dot's size) | 1.5 on phones, up to 1.9 on wide screens |

The page decides what a first visit is (for example a `sessionStorage` flag set after the opening) and passes `firstVisit`. The French bubble shows once per browser session by itself.

**Calls:**
- `DOT.refresh()`: re-read the tiles after a layout change (tiles reordered by a filter, resized, shown or hidden). Dot stays with its tile, at the same place on it; a jump in flight lands where its target is now (a target that moved more than 140 px is not chased: Dot drops from where it is, or jumps clear); the box follows the home tile; scratches, the loose fez and the objects move with their tiles. If Dot's edge is gone, or its spot is now under the Corano or on or under the quiet tile, it moves to a good visible edge (falls to the edge below, walks a few steps, or jumps). `DOT.refresh(seconds)`: also follow the tiles at every frame for that long, so Dot rides its tile during an animation. For a FLIP animation call `DOT.refresh(duration + 0.05)` right after setting the inverted transforms (tested: the cat stays exactly on its tile in every frame of a 450 ms animation). Window resizes and rotations are handled by Dot itself.
- `DOT.pause()` / `DOT.resume()`: freeze everything while a sheet covers the page: no frames (the animation loop stops), no sounds (the purr stops), the bubble and the touch target are hidden, touches are ignored, Dot's clock stops (so no timer runs on: the French bubble, sleep, moods). `resume()` re-reads the tiles first. `DOT.paused()` tells which.
- `DOT.setLook(name)`, `DOT.setDark(bool)`, `DOT.say(text, seconds)`, `DOT.replay()` (the opening again), `DOT.stop()` (removes everything).
- Sound: `DOT.sound.setMuted(bool)` (the site's sound button).
- `DOT.debug` is for the tools only (manual clock with `window.__manual = true` and `DOT.debug.tick(dt)`, `press()`/`lift()` for a finger held still, `refresh`, `quiet()`, `fezInfo()`, `bbox()`, ...).

**Layers.** Dot's layer has z-index 40 inside its parent; sheets and panels must be above the parent, and call `DOT.pause()` when they cover the page. Dot's canvases are drawn at the screen's real pixel ratio up to 3.

## 6. State (update this)

- 2026-11-12: the skeleton, three looks (`adesivo` chosen as default; then `manifesto`, `pelo`), the brain, the stage, the sounds and the preview page exist. The first draft (`gatto.js`, three.js) is deleted.
- **The preview**: `index.html` + `gatto.css`. Dark page (light with the toggle), ten mock tiles in a 4-column bento (30 px radius, frosted), one `data-dot="no"` (Corano, no text), one `data-dot="quiet"`. A dashed bar at the bottom (not part of the design): look, theme, sound, "Rivedi". Address: `?look=adesivo|manifesto|pelo`, `?tema=scuro|chiaro`, `?suono=no`; for tools `?manual=1`, `?seme=7`, `?primo=0`, `?k=3`. The opening plays on every load (for judging). Dot's layer sits in `#dotclip`, which cuts what sticks out on the right (without it the phone widens the page).
- **Online, prepared, not published**: `node scripts/home/build.mjs` also writes `public/gatto/` (addresses rewritten to `/gatto/...`); `next.config.ts` rewrites `/gatto` to it; `robots.ts` disallows `/gatto`; the page is `noindex`. `npm run build` passes; `public/home` and `public/anteprima` are unchanged.
- **Checked** in headless Chromium, phone viewport 390x844 with touch, served from `public/`: no console errors; the opening reaches the cat sitting with "salam, sono Dot." (about 8.3 s); taps give a different reaction each time; a tap while asleep wakes it annoyed and it walks off and sulks; drag → long cat, drop on a tile face → slide with scratches, drop above an edge → lands, throw → flies and lands; look, theme and sound toggles; reduced motion → no opening, sits; scrolling keeps it on its tile; hidden tab → 0 frames drawn; about 0.3 ms of work per frame on a desktop CPU. All scripts parse as ES2017.
- **Fixed while assembling**: a drop after holding the finger still threw the cat (the speed ignored the pause); the purr sound never started (it was called without `true`); `DOT.setDark()` added for the theme toggle; `DOT.start({ parent })` and `DOT.photoDpr` added.
- **Fixed after the review** (2026-11-12): dropped in front of the Corano (or on its top edge), Dot no longer vanishes and peeks elsewhere: it leaps out at once, from where it is, to the best edge (visible, near, upwards), and an escape never re-enters the tile; sliding down a tile with the Corano right under it, the tail curls aside and Dot stops when its lowest point reaches the bottom, then jumps away; coming back from off screen, the jump-in is checked against the Corano (otherwise it peeks). A fez left on the ground by an interrupted routine is always fetched (walk, or a jump to its tile, or, if out of reach, a head flick and it flies back); a drag during the toss lets the fez fall. A second finger on the cat is ignored, and a held cat with no finger on it is dropped. `DOT.start({ bottomInset })` (pixels, or a function) marks the bottom strip covered by a bar: edges under it count as out of view, and Dot comes back from there (the preview passes the height of its bar plus 12 px; the site should pass the Safari safe area plus a margin). Reduced motion: coming back it is simply placed, sitting, on a visible edge, and it never starts its life again (no head sway, no tail flicks, no ear twitches either). `set()` clears the tremble, the yarn tangle, the head tilt and the sleeping fez tilt, so an interrupted state leaves nothing behind; "Rivedi" also clears the mood, the taps and the bubble. Jumping or looking up, the head pitches up at most about 0.28 rad in all (pose, body and gaze together) and the pupils do the rest, so the fez stays on the crown instead of sliding onto the face (the "la stella" cell of the sheet follows the same limit). The frame has a new field `fezSeat` (where the fez sits on the head, also when it is on the ground).
- **Online** since 2026-11-12: `https://imadchat.vercel.app/gatto` (main at `ecffcf5`). After the workflow, by hand: the draped pose was raised (`dy` 4.2 to 4.4, `hp` 0.04: the head rests on the edge and the eyes are whole) in the rig and in the three looks; `tavola.html?pose=drape&prova=[{},{"dy":3}]` draws one pose with different numbers, a cell each.
- **Round 2, behaviour and the API for the real home** (2026-11-12, after the preview went online; all three looks share it, nothing was redrawn inside the `look-*.js` files):
  - **API**: `DOT.refresh([seconds])`, `DOT.pause()` / `DOT.resume()` / `DOT.paused()`, `DOT.start({ topInset })`, and `DOT.start({ firstVisit: false })` now right from the first painted frame (the box stands closed in its place, Dot is already asleep, loafing or peeking; `DOT.start` draws one frame synchronously before the page shows). The box lid now opens and closes with a short animation (when Dot hides in it, when the visitor drops it in, when it comes out) instead of snapping. Documented in section 5, "How to mount Dot on a page".
  - **Quiet tiles are strict** (see section 5): edges on and right under them are flagged; landing there means leaving at once; taps only hurry Dot away; no games, objects, petting, pounces or bubbles near them (a bubble left from before vanishes at once); no scratches or hanging on their face; objects never rest on them.
  - **The loose fez** stays on the tile it fell from (it stops at the ends of the edge, it only lands on that tile, and it is pushed out of any `no` tile); it flies back only along an arc that does not pass in front of the Corano. When it is out of reach (the Corano in between) and out of sight, or out of reach for 20 s, Dot ducks behind its edge and peeks up again wearing it (a fez still in sight fades out meanwhile). Checked on 228 fez drops from every point of every edge, with and without a drag during the toss, on a phone and a tablet: never over the Corano, always back on the head within 12 s.
  - **Belly up replaced by the melt** (state `melt`, then `getup`; the old `belly` and `unroll` names forward to them): under a finger held still Dot melts flat (the look's `puddle` pose with the chin on the ground, the brain's pose `b-melt`, turned a little more to the side, face `low`), eyes in happy arcs, slow breath (`rig.breathRate`), the tail tip moving slowly, the fez on; when the finger leaves it gets up with a stretch, rear up. Strip `striscia.mjs ... pet` in the three looks: readable, no roll, no blob, no jumps.
  - **Both eyes stay visible**: `rig.headMax` = 0.7 rad (found with the sheet: at 0.8 the far eye is a sliver, at 0.9 it is gone, in all three looks), a soft limit that only ever turns the head towards the viewer; off for the back view (sulking, turning to go) and the trot. Measured over 5 simulated minutes per look: 0.2% of everyday frames show one eye, all in the 0.37 s turn from the back view into walking away.
  - **Sharpness**: the cat, the loose fez, the objects and the scratches use the screen's real pixel ratio up to 3 (was capped at 2); the scratch canvas is now a column as wide as the cat instead of the whole tile. At 3x the cat's canvas is 558 x 603 px; the frame costs about 0.3 ms (median) and 0.6 ms (95th percentile) on a desktop CPU, the same as at 2x.
  - **Smaller**: a jump in flight during a resize lands where its target is now (the offset blends into the rest of the flight; a target that moved more than 140 px is dropped and Dot falls or jumps clear); the jump about to start is re-checked; the fast-scroll test in `onScroll` now compares with the previous time; the sheet gives the long poses ("preso", "preso: gatto lungo", "a cavallo del bordo", "scivola con i graffi") taller rows (checked numerically in every cell, three looks, k 2.6 and 1.5), and the old belly cell is now "sciolto sotto il dito".
  - **Found by the soak and fixed**: jumps were checked with a parabola that was not the one flown, and only at the feet: now every jump is checked on its true arc with the whole body (`arcBlocked`), which removed the small grazes of the Corano; a throw that would cross a `no` tile loses strength until it does not (or becomes a plain drop), and a thrown cat entering one while still rising leaps away; dropped with its head or tail in front of the Corano, Dot leaps away at once; it hangs from a bottom edge only with free room below; the "Corano below" rule of the slide now looks 90 px down (the legs and tail hang that far).
  - **Not online yet**: `public/gatto` still holds round 1 (this round did not run `scripts/home/build.mjs`); whoever publishes rebuilds it.
  - **Checked** (headless Chromium, phone 390 x 844 with touch, served from the source folder, manual clock): a soak of 3 runs x 10 simulated minutes (`strumenti/soak.mjs` on `riordina.html`) on a test page whose tiles are reordered and hidden at random followed by `DOT.refresh()` (sometimes with seconds), with random taps, bursts of taps, drags, drops, throws, scrolls, look switches, petting, pauses and replays: no exception, no NaN, nothing stuck, never over the Corano outside the drag and the leap after a drop, never resting on or under the quiet tile (once a single frame when a reorder moved the quiet tile onto a loafing cat; it left on the next frame), no bubble over it; plus 10 minutes on `index.html` and 2 x 10 minutes on `prova.html`, clean. `DOT.refresh` probes: reordered (stays on its tile at the same relative place), hidden (drops onto the tile that took its place), moved under the Corano (jumps away), moved under the quiet tile (leaves), a 40 px move during a jump (lands on the new top), a 450 ms FLIP animation with `DOT.refresh(0.55)` (on its tile in every frame). Pause: no frames, clock frozen, purr stopped, bubble and touch target hidden, all back on resume. Top inset: never comes back on an edge under a 64 px top bar. Reduced motion: sits, never on the quiet tile. All scripts parse as ES2017 (esprima 4). The strips and the gallery tools still run without errors.
- **Left for the chosen look** (only once Imad has picked one): a cat's profile with a muzzle (the far turned head is a round head with one eye: today it is avoided, not drawn); darker whiskers on the light theme; the back view's tail in `adesivo` (a stump); the hind legs when hanging; the bubble's little tail (the rotated square shows a seam at 3x).
- **Not tested**: Safari, a real iPhone (Imad's is on iOS 18.0), the sounds by ear, touch on a real screen. Ask Imad what he sees.
- **Known limits**: while the visitor drags it, Dot can pass over the Corano tile (it never lands there); dropped in front of the Corano it is in front of it for the fraction of a second its leap takes; tiles right under another ordinary tile are used (in a bento with 12 px gaps that is almost every tile: Dot sits in the gap, in front of the bottom of the tile above), but never under the Corano or the quiet tile; when no edge that is not quiet or cut is in sight, Dot waits out of sight; the opening is skipped if the home tile ever ends up right under the Corano (the real home never moves the Corano).
- **Tools** (run from the repo root; pictures go wherever you say):
  - `node docs/anteprime/gatto/strumenti/tavola.mjs out.png "look=adesivo&bg=light"` — the pose sheet (`tavola.html`; a cell is 58 x k px wide).
  - `node docs/anteprime/gatto/strumenti/striscia.mjs out.png walk 14 adesivo` — a frame strip of one action on `prova.html` (scenes listed in the script).
  - `node docs/anteprime/gatto/strumenti/galleria.mjs out.png adesivo scuro` — twelve scenes at true size, 4x (add `candidati` to choose the instants).
  - `node docs/anteprime/gatto/strumenti/film.mjs outdir adesivo scuro` — `apertura.mp4` (opening + 20 s of life, 60 fps, H.264) and six key frames.
  - `scena.html?check=1` checks the stage contract; `prova.html` is the behaviour bench.
  - `node docs/anteprime/gatto/strumenti/soak.mjs 10 riordina.html 1,2,3` — the long test with the manual clock (minutes, page, seeds): random taps, drags, throws, scrolls, look switches, petting, pauses, replays and, on `riordina.html` (a test page like the new home, with a top bar and a dock, whose `order()`, `flip()` and `hide()` move the tiles), tiles reordered and hidden followed by `DOT.refresh()`. It reports exceptions, NaN, stuck states, frames over a `no` tile or resting on or under a `quiet` one, bubbles there, the fez over the Corano. About 2.5 minutes of real time per 10 simulated minutes.
  - The tools take the port from `PORT` (the agents use 4111). The smaller probes of round 2 (`quiet`, `fez`, `api`, `eyes`, `sheet`, `first`, `pause`) stayed in the session's scratch folder; `tavola.html` exposes `window.__cells` (where each cat and each label are) for numeric checks.
