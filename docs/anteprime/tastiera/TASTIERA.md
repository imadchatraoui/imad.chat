# La tastiera di Dot — design of the section below the tiles (preview, 2026-11-14)

This folder is a **preview, not published**: a working prototype with one deterministic timeline, made so that Imad can see pictures before anything is built for real. Nothing here is linked from the site and `scripts/home/build.mjs` does not know it.

## 1. What he asked for (his words are the brief)

- "vorrei che mentre scrolli giù, la faccia del cubo con le lettere del dominio si ricomponga in una scatola, dentro entri il gatto e che tiri fuori velocemente attrezzi cavi tasti switch ecc, per creare una macchina da scrivere o tastiera, deve essere tutto velocissimo con effetti di polvere di elettricità eccetera, per poi lasciare una zona con scritto tipo contattami, e se le persone scrivono anche i tasti della tastiera si muovono, deve essere fatta in 3d, quindi credo che threejs sia la migliore scelta"
- "vicino alla tastiera alla fine voglio che il gattino tiri fuori dalla scatola l'ultimo elemento, un bottone rosso con scritto do not press, piccolino proprio"
- "voglio che dot crei proprio pezzo per pezzo la macchina da scrivere/tastiera, non che tipo crei una nube o che venga coperta una parte del sito dove ci saranno scintille polvere ecc per poi far comparire la macchina; riempi di dettagli; prima di iniziare mandami foto anteprime per capire come sta venendo"
- "sto immaginando come se fosse un timelapse dove lui fa tutto velocemente, però deve essere ricco di dettagli"
- On the cat: "non lo voglio in 3d, fallo in 2d ma con profondità […] fa schifo fatto così con sfere cilindri e parallelogrammi". Always: "fallo bene per favore, non fare AI slop, animato bene".

What follows from them, and binds whoever builds this:

1. **Every piece is seen going to its place.** No cloud, no cover, no burst that hides the work. Dust and electricity are tiny and local: a thin ring where a part lands, one spark at the plug, one point of light on the soldering iron.
2. **Dot stays the 2D cat** (look "Manifesto"), never modelled.
3. **No primitive shapes.** If a part reads as a box or a cylinder it is not finished.
4. The site's rules: no italic; no Islamic geometric ornament; no emoji as icons; no cartoon look; the Kukko pastels only on the cube (never on keycaps); no Arabic typed by hand; Dot never imitates prayer and carries no religious, flag or conflict props; nothing invented about Imad; interface words in plain informal Italian, no exclamation marks. "Contattami" is the title of the zone.
5. What happens when the red button is pressed (the site coming apart, a verse left at the end) is **not** part of this round.

## 2. The preview: files and how to look at it

| file | what it is |
| --- | --- |
| `index.html`, `main.js` | the page: the sky (CSS), the canvas, the machine's line, the contact zone; reads the address |
| `forme.js` | the modelling tools: `loft` (a skin over rounded-rectangle rings: keycaps, shells, handles, domes, with hard edges, vertex colours and a legend area), `tornio` (lathe), `estruso` (plates with real holes and bevels), `tubo`, `molla` |
| `parti.js` | the keyboard: layout (68 keys), legend atlas, keycap, switch (whole and taken apart), plate, PCB and its two textures, case, standoffs, screw, stabilizer, cable |
| `banco.js` | the slab, Dot's box, the nine tiles of imad.chat, the five tools, the screw dish, the tea glass, the red button, dust rings, spark |
| `macchina.js` | look 2, the typewriter: every part is its own object |
| `gatto.js` | Dot in the scene (section 6) |
| `scena.js` | renderer, sky and sun by the hour, camera, the reflection on the slab, all objects built once |
| `storia.js` | **the timeline**: every transform is a function of one time `t` |
| `tavole.js` | the still views (two looks, pieces, typewriter contact, reduced motion, pose sheet) |
| `vendor/` | three.js 0.187 (`three.module.js`, `three.core.js`, `RoomEnvironment.js`, `RoundedBoxGeometry.js`, `BufferGeometryUtils.js`), Manrope, Geist Mono, their licences. Nothing loads from another host. |
| `FONTI.md` | sources and licences |

Dot's scripts are loaded from `../gatto/` (`dot-rig.js`, `look-manifesto.js`) and **not modified**.

Serve `docs/anteprime/` with any static server and open `tastiera/index.html`. Everything is set from the address, so any frame can be made again:

- `?t=6.2` the time in seconds (without it the sequence plays in a loop; space pauses, arrows step, and after beat 10 the keys follow the real keyboard);
- `?stile=tastiera|macchina`, `?tema=scuro|chiaro`, `?ora=22.2` (the hour of "now", 0 to 24);
- `?vista=storia|due|pezzi|contatto|fermo|pose` (`fermo` is the reduced-motion version; it is also chosen by `prefers-reduced-motion`);
- `?cam=faccia|largo|cantiere|finita|contatto|bottone` forces a framing, `?camq=tx,ty,tz,width,pitch` a free one; `?nudo=1` hides the words; `?dpr=`, `?ombre=`, `?riflesso=0`, `?toni=aces|agx`.

`window.__render(t)` draws one frame (used by the capture scripts). Checked only in headless Chromium with software WebGL (SwiftShader): **nothing here was tested on Safari or on a real phone.**

## 3. The idea in one paragraph

Below the last tile there is one more tile: a slab of the site's glass floating in the site's sky, lit by the site's one sun. The 3x3 face of `imad.chat` comes down onto it, folds (columns, then rows, as in the opening of the site), tips back and becomes Dot's box, the key with the gold dot as its lid. Dot jumps in and throws out his glass of mint tea, five tools, the cable, 68 switches and 68 keycaps, which land in an ordered layout; then he builds a 65% mechanical keyboard piece by piece, as a timelapse of a whole day: the sky goes through night, dawn, day and dusk and comes back to now, the sun and the shadows sweep, and a line in the machine's voice counts the hours. The last keycaps are the letters of `imad.chat`; the very last is the gold dot. Everything goes back into the box, the cable is plugged (one spark), a small light breathes, Dot sits beside the keyboard. The page says "Contattami", the visitor types and the keys go down. Then Dot goes back to the box for the last thing: a tiny red button, "DO NOT PRESS".

## 4. The stage

Units are centimetres; x right, y up, z toward the viewer. On a 390 px phone the build is framed at about 10.6 px per cm.

- **The slab** (`banco.js` `LASTRA`): 40 x 60, 1.3 thick, corner radius 3.4 (a tile's 32 px at this scale), filleted edges. x from -20 to 20, z from -40 (back) to 20 (front). Its top is y = 0.
- **The keyboard** is assembled at the front: centre (0, 12), 31.5 x 10.55, its deck tilted 6 degrees (`INCL`), its case a wedge so the bottom lies flat.
- **The walkway** behind it (z 0.3 to 6.2) is Dot's.
- **The ordered layout** behind the walkway: keycaps in five rows of 16 units (z -13.2 to -5.4), in keyboard order, the wide ones in the last two rows; switches in 4 rows of 17 (z -22.6 to -17.4, pitch 1.72); the back row (z -28 to -37): four stabilizers, the screw dish with six screws, five tools (pitch 2.15, tips toward the viewer).
- **The box** stands back left at (-15.2, -33.6); the tea beside it, later at the right end of the walkway.
- **The cable** leaves a port in the box's front, runs along the left edge (x = -17.4) with its coil, and reaches the USB-C port in the case's back wall at x = -12.5.
- **The red button** ends at (17.7, 7.3), beside the keyboard's back right corner.

**Cameras** (`storia.js` `CAM`; a long lens, 15 degrees vertical on a phone; `larg` is the width of bench seen at the target, `alt` the least height seen, which decides on wide screens; `su` shifts the picture down to leave room for words):

| name | target (x, y, z) | larg | alt | pitch (rad) | when |
| --- | --- | --- | --- | --- | --- |
| `faccia` | 0, 8.2, 4.4 | 21.5 | 30 | 0.90 | beats 1 and 2 |
| `largo` | 0, 0, -9.2 | 41.6 | 64 | 0.96 | 2.5 to 5.9 s: the whole slab |
| `cantiere` | 0, 0, -8.4 | 36.8 | 60 | 0.93 | 7.0 to 13.4 s: the slab bleeds off both sides, parts are 13% bigger |
| `finita` | 0, 1.2, 8.5 | 33.5 | 32 | 0.58 | 15.1 s: low, the slab's far edge is a horizon |
| `contatto` | 0, 1.2, 8.5 | 34.5 | 34 | 0.60 | 16.0 s: the same, shifted down 15% for the title |
| `bottone` | 16.3, 3.1, 6.6 | 11 | 12 | 0.60 | from 20.8 s |

Between two framings every number is eased (`eIO`). On a screen wider than 1.15 : 1 the contact framing also shifts left by 7% (the box and Dot are on that side) and the title stands on the right.

## 5. The twelve beats (look 1)

Times are seconds of the prototype's timeline (`T` in `storia.js`). **The real section should map `t` to the scroll inside a pinned block**, or play it once when the block enters and let scroll only start it: see section 12. Beats 4 to 9 are the timelapse.

| # | name | from | lasts | what is seen |
| --- | --- | --- | --- | --- |
| 1 | `faccia` | 0.0 | 1.0 | The 3x3 face of nine cream keys (i m a / d . c / h a t; Manrope 800; the dot is gold), floating over the slab, facing the viewer. |
| 2 | `piega` | 1.0 | 1.3 | The left column folds behind the middle one (0.34 s), the right one behind both (from +0.16); the top row folds behind (from +0.52), the bottom row behind all (from +0.68): a pile of nine with the dot in front. From 2.0 the pile flies to the back left corner, tips so the dot looks up, shrinks to the box's height, lands at 2.32: it is the box (a squash of 16% that dies in 0.3 s). |
| 3 | `salto` | 2.3 | 1.3 | Dot drops in from above (from the tiles), lands at 2.74, crouches, wiggles; the lid pops open at 2.86; he jumps (3.12 to 3.36) and sinks into the box; the box rocks while he rummages (3.38 to 3.62). Real time, smooth. |
| 4 | `fuori` | 3.6 | 2.3 | Timelapse begins. Dot hangs on the rim, a new pose every 0.1 s. Out fly, in this order: the tea (first), five tools 75 ms apart, four stabilizers, the dish, six screws 50 ms apart into the dish, the cable (it slides out of the port, 4.30 to 4.92), 68 switches 8.3 ms apart, 68 keycaps 8.2 ms apart. Each flies 0.30 to 0.40 s and lands in its slot. |
| 5 | `guscio` | 5.9 | 0.9 | Dot hops out in three poses. The case comes out of the box edge-on, flies (5.94 to 6.36), lands 1.8 cm off and 5 degrees askew; Dot ducks under it, then squares it with two pushes (6.47, 6.60), one at each end. |
| 6 | `scheda` | 6.8 | 1.4 | The PCB flies (6.84 to 7.22), rests tilted on the standoffs, Dot presses it home (7.28). Six screws, 93 ms apart: each hops from the dish (0.15 s) and turns in (four turns, 0.12 s) while Dot hugs the screwdriver over it; back row left to right, front row on the way back. A sip of tea. Two solder joints by the processor: the iron's tip, one point of light each. |
| 7 | `piastra` | 8.2 | 1.1 | Four stabilizers, 0.1 s apart, each set with the tweezers. The plate flies (8.66 to 9.04); Dot yawns while it comes, ducks, taps it down at both back corners, wipes his brow. |
| 8 | `sw` | 9.3 | 2.0 | Five rows, 0.39 s each. In a row the switches leave the grid over 0.25 s, fly 0.15 s and click in (a dip of 1.1 mm that dies in 0.1 s). The wave runs left to right, then back. Dot's paw runs with it, one pose every 0.1 s; from the second row on he stands on the keyboard. A sip, a nap of one pose. |
| 9 | `tasti` | 11.3 | 2.6 | Five rows of keycaps, 0.29 s each, the same wave (opposite direction). The fez falls and is put back. The letters of imad.chat stay on the bench; then they go on one by one, 85 ms apart, in the order i m a d c h t, each with one full flip. At 13.44 Dot takes the gold dot key, holds it at his chest (13.52 to 13.68), sets it down (13.72 to 13.86): the timelapse ends here, the dot lights. |
| 10 | `cavo` | 13.9 | 1.3 | Real time. Tools, dish and glass fly back into the box (13.96 to 14.52), the lid closes (14.50 to 14.72). Dot hops off, trots to the plug, pushes it the last 6 cm into the port (14.66 to 14.95): one spark (0.14 s). The light on the case's front edge comes on and breathes. Dot sits behind the keyboard. |
| 11 | `contatto` | 15.2 | 3.0 | The camera goes low; "Contattami", one line and the field appear in the sky above the slab (from 15.65). Keys go down as the visitor types (in the prototype: "ciao imad, "); Dot watches the key that moves, then the viewer. |
| 12 | `bottone` | 18.2 | 3.2 | Dot runs to the box, the lid opens, he jumps in, rummages, comes up with the red button in his mouth (19.44), jumps out, runs to the keyboard's right end, sets it down (20.66 to 20.84, a small squash), tilts his head at the viewer, sits. |

The clip `E-timelapse.mp4` is beats 4 to 10 (3.6 to 15.2 s) at their real speed: 11.6 s.

## 6. Dot in the scene

- **He is drawn by the site's own rig and look.** `gatto.js` makes one rig (`DOT.makeRig(look.preset)`), sets a pose exactly as `gatto/tavola.html` does (`rig.snap`, yaw, look, gaze, pupil, walk phase; `autoBlink` and ear twitches off, the tassel's swing set by us, `rig.t` given by the timeline) and calls `look.draw` on a canvas. The canvas is the texture of a plane.
- **The plane stands upright** at Dot's depth, turned toward the camera, its origin at the point under his paws. Because the camera looks down, the plane is stretched in height by `1 / cos(pitch)` so that on screen Dot keeps his proportions (1.67 during the build, 1.21 in the contact shot). An upright plane, not one tilted toward the camera: parts behind him never cut through his head, and anything nearer the camera hides him by depth alone. The material is unlit (`MeshBasicMaterial`, no tone mapping): his colours are the site's.
- **Size**: 0.178 cm per model unit (`UN`): sitting, with the fez, he is 8 cm tall, about four keys. The canvas covers x -46 to 46 and y -16 to 60 units and is redrawn only when the pose changes; its density follows the size on screen (1.25 canvas pixels per device pixel, from 3 to 22 per unit). `env.scale` is the size on screen in CSS pixels per unit, so the rim light stays one pixel wide.
- **Depth**: his plane is transparent and does not write depth; opaque parts in front of him cover him, a part "in his paws" is a 3D object placed 0.32 cm in front of the plane at a point of his frame (`dot.punto(state, x, y)`: `frame.hold`, a paw, the mouth).
- **Shadows**: a soft contact blob under the paws (7.5 x 3 cm, 55% dark theme, 34% light), and a real shadow: a second, invisible plane with the same texture, turned toward the sun, written only into the shadow map (`customDepthMaterial`, alpha test 0.5).
- **Reflection**: the slab's reflection pass draws his plane too, so he is in the glass.
- **Poses added for the build**, on our rig only, through `rig.poses` and `DOT.pose` (nothing in `../gatto/` is edited): `premiA`, `premiB` (crouched, one paw reaching down and out, head tilted to it), `premi2` (both paws), `tiene` (both paws at the chest: the screwdriver, a part), `alza` (paws at the chin: the gold dot key), `asciuga` (a paw on the brow, eyes shut), `soddisfatto`. Stock poses used: `air`, `land`, `crouch`, `wiggle`, `peek`, `push`, `push-touch`, `push-sweep` (on the box's rim, with `clipY` and paws on the edge), `sit`, `stand` with the walk cycle, `sip`, `yawn`, `sleep`, `puddle` (he ducks under a flying board), `stretch`, `startle`. `?vista=pose&n=0..3` shows them.
- **On the keyboard** he stands 1.55 cm behind the row he works on (the paw lands on it on screen); for the first row he stands on the case's back lip.

## 7. The timelapse grammar (numbers)

- **Dot scatta.** From 3.6 to 13.4 s his state is a list of keys held, not eased: a new pose every 0.098 s (jitter of 16 ms, seeded). Behind him two afterimages, the two poses before, at 36% and 17% opacity, fading to nothing in 0.19 s, drawn 0.05 and 0.10 cm behind him. His fez's tassel swings left and right at each step.
- **Pieces fly, they never appear.** A flight is a straight line in plan and a parabola in height (`h` from 3 to 12 cm for small parts, growing with the distance; 19 for the three boards), 0.14 to 0.42 s, with one or one and a half turns about a horizontal axis that ends exactly at rest. Coming out of the box a piece is at 30% of its size and reaches full size in the first 60% of the flight.
- **Landing.** A squash that dies: scale y `1 - k`, x and z `1 + k/2`, `k = A · e^(-t/0.05) · cos(44 t)`, A from 0.03 (boards) to 0.16 (keycaps). Planted parts also dip along the deck's normal (`premi`: 0.5 to 1.6 mm, dying in 0.1 s). On the slab a dust ring: 1.3 mm wide, radius from 0.92 to 1.3 times the footprint, opacity 0.20 (dark) or 0.26 (light) falling with the square of time, gone in 0.24 s. A pool of 48 rings is enough.
- **Work in bursts.** Screws 93 ms apart; stabilizers 100 ms; a row of switches 0.39 s; a row of keycaps 0.29 s; the letters 85 ms; then one held moment (the gold dot, 0.42 s) which is where time becomes real again.
- **The light is the clock.** From 3.6 to 13.9 s the hour runs from now to now plus 24 (`smooth` at both ends): `TIMELAPSE ×8400 · 14:32 · POMERIGGIO` (Geist Mono 500, 10.5 px, +.06em, on the page's axis, 22 px from the top; the factor in gold; the hero's dateline words NOTTE, ALBA, MATTINA, POMERIGGIO, SERA). The sun rises at 7:12 on the right (east), passes behind the camera (south), sets at 17:00 on the left: the shadows sweep from left to back to right. At night the light stands high on the left in front. The sky's three colours are computed with the home's own formula (CASA.md 2d B), in `oklch`.
- **A long job, compressed**: the glass of tea empties in four sips (level 1, 0.72, 0.45, 0.2, 0); a yawn; a nap of one pose on the keys; the fez on the bench for one pose and back on; a paw on the brow.
- **Small electricity**: the spark is seven strokes of 2 mm that fly 8 mm and one glow 9 mm wide, 0.14 s; the solder light is a point 5 mm wide that flickers; the gold dot's halo swells to 3.7 cm when the key lands and settles at 1.5.

## 8. Parts and counts (look 1)

Keyboard: 65%, 68 keys, 16 units wide, 5 rows, ANSI. One unit is 1.905 cm.

| part | count | how it is made | material |
| --- | --- | --- | --- |
| keycap | 68: 57 of 1u, 3 of 1.25u, 2 of 1.5u, 2 of 1.75u, 1 of 2u, 2 of 2.25u, 1 of 6.25u | one skin (`loft`), 17 rings: hollow inside with the cross post, chamfered rim, walls that lean, a top tilted by row (heights 1.00, 0.90, 0.84, 0.87, 0.89 cm; tilts 0.13, 0.06, -0.015, -0.09, -0.11 rad), a dished face (0.6 mm; the bar is domed). 12 geometries | matte ceramic cream `#f2ede2`; modifiers stone `#d8cebb`; Esc and Enter graphite `#2c2d35`; the eight of imad.chat warm white `#fffcf6` |
| legends | 45 cells | one atlas 1280 px, 8 x 8; the face's uv maps a cell, the sides fall on its blank border | ordinary keys: Manrope 700 capitals at 60% ink; imad.chat: Manrope 800 lower case, full ink, as on the site's keys |
| the gold dot key | 1 (the full stop) | a warm white keycap with a gold dome 6.8 mm wide and a halo | the site's gold `#e9a93c`, lit from inside |
| switch | 68 | lower housing with flange, top housing that tapers with two clips, a chimney and the light window, the slider and its cross | graphite housings, a gold-yellow stem (`#e3aa3e`) |
| switch, taken apart | 1 (pieces sheet) | base with centre post, two legs, two brass pins and the leaf; a spring of 10 turns; the stem with its rails and pole; the top | |
| plate | 1 | extruded with bevel: 68 square windows of 14 mm, 8 for the stabilizers, 6 round ones over the screws | satin aluminium |
| PCB | 1 | a board 30.3 x 9.4, two textures 2048 x 640 (colour; roughness and metal): pads in gold, traces by row and by column, diodes, a light footprint per key, the processor and its neighbours, the cable socket, silkscreen `K1`…`K68`, `imad.chat`, `65% · 68 TASTI · FATTA DA DOT`; five small parts in relief | night blue `#121a3e`, gold pads that shine |
| case | 1 | one skin: outside, lip, inside and floor; a wedge under it; six brass standoffs; the light on the front edge (a pill 8 x 1.8 mm) | cream enamel `#ebe4d6` with a clear coat |
| screw | 6 | turned: domed head with a cross, threaded shank | steel |
| stabilizer | 4 (Backspace, Enter, left Shift, the bar) | two housings, two sliders with crosses, a bent steel wire | graphite, gold, steel |
| cable | 1 | a tube along one curve (2400 steps): lead, a coil of 28 turns that rests on the bench, a turned barrel connector, the USB-C plug (shell, metal tip). It is revealed along its path: the plug is the head | cream-stone sleeve `#cfc5b2`, enamel shell, steel |
| tools | 5, at 62% (they are Dot's size) | screwdriver (steel shank, knurled grip of nine rings, a cap that turns), tweezers (two bevelled blades that open), keycap puller (handle, two hooked wires), soldering iron (copper tip, barrel, collar, ringed handle, cord), brush (bristles, ferrule, handle) | steel, graphite, enamel, rubber |
| screw dish, tea glass | 1, 1 | turned; the glass has walls, tea whose level moves, a gold line, three mint leaves | graphite ceramic; glass, amber tea |
| Dot's box | 1 | a cream ceramic body (lighter band at the rim, dark inside, the colours of `dot-stage.js`), a port for the cable, a hinged lid that is the key with the gold dot | ceramic with a soft clear coat |
| the nine tiles | 9 | the site's key: cream, lighter band, a letter on the face (the dot is a gold dome) | the same |
| the red button | 1, small (2 cm) | graphite base, steel bezel, a glossy red dome, a leaning plate with DO NOT PRESS (Geist Mono 600, white) | red `#d3261d` with a clear coat |

The eight keys of imad.chat (i, m, a, d, c, h, t and the full stop) spell its nine characters: the "a" is typed twice. They are the same shape as the others and differ by colour and lettering.

## 9. Materials, light, and what follows the theme

- **One sun** (a directional light with a 2048 px shadow map, soft) and the sky as fill (a hemisphere light and a neutral room environment through PMREM for the reflections on enamel, steel and glass). Tone mapping: Khronos Neutral (the cream stays cream; ACES and AgX greyed it). Numbers in `scena.js` `illumina`.
- **The slab is the site's glass**: graphite `#24262e` in the dark theme, veiled white `#e6e7f1` in the light one, with a clear coat; its filleted edge catches the sun (the tile's rim). **It reflects**: the scene is drawn once more from under the glass at half size and added to the top face (25% dark, 6% light, more at low camera angles). `?riflesso=0` shows it without.
- **Follows the theme**: the sky's colours, the slab, the strength of sun, fill and reflection, the dust's colour (warm white on dark, warm grey on light), Dot's whiskers and rim (the look's `env.dark`), the words. **Does not follow the theme**: the machine, the box, the tools, Dot. They are objects with their own colours, like the keys of the site.
- **The one gold** is the dot key, the dot on the box, the light on the case, the factor in the machine's line. The stems of the switches are a duller yellow and disappear under the keycaps. Red belongs to the fez and to the button.
- **Dark theme**: at night the sky is near black and the key light is warm white from the upper left; by day the sky is the home's deep blue. **Light theme**: the sky stays pale at every hour, only its tint moves; exposure 0.94 so cream on white still has shadows.

## 10. The contact zone

- **Look 1.** In the sky above the slab's horizon: `Contattami` (the home's h1: Manrope 800, 40 px, -0.052em; 56 px on computers), one line (17/24, ink-3; ours, a placeholder: "Scrivi qui. I tasti si muovono con te."), a glass field 52 px tall (16 px text, the gold caret) with the gold capsule `Invia`. In the real section the field is a real `<input>` or `<textarea>`: the 3D keys only follow it. A key goes down 3.6 mm in 45 ms, stays 65 ms, comes back in 160 ms; keys with no cap on the 3D keyboard (accents, symbols) press nothing, Enter and Backspace have theirs. On a phone the system keyboard covers the lower half: the scene must sit in the upper half while the field has focus (not built).
- **Look 2.** The sheet of paper is the field: what the visitor types is struck by the typebars (large type, 7.2 mm a letter, so it can be read on a phone), the carriage moves one step left per letter, a key goes down and its typebar swings to the platen. The line under the title becomes "Scrivi. La macchina batte sul foglio." A real field must still exist for screen readers and phones.
- **Where the message goes is not decided** (section 13).
- **Reduced motion** (`?vista=fermo`, or the system setting): no sequence. The finished keyboard, the box closed, Dot sitting, the contact zone, all still; keys may still go down under the fingers (a response to an action, 0.1 s) or not at all if we want to be strict; the light does not breathe; no reflection pass is needed after the first frame.
- **Without WebGL**, or if three.js fails to load: a still picture of the finished machine (one of these frames, rendered at build time) under the same title and a working field.

## 11. Look 2: the typewriter

A portable, 27 x 27 cm on the bench (modelled at 29.5 x 30 and scaled 0.9), in the same materials: cream enamel body, black rubber, steel, round graphite keys with cream capitals; the keys of imad.chat are cream with ink lower case, the full stop carries the gold dot.

| part | count | made as |
| --- | --- | --- |
| base | 1 | extruded with a soft bevel and two real wells (keys, basket), sloping down to the front; dark floor; four rubber feet |
| hood | 1 | extruded U around the basket with two round recesses for the spools, sloping to the keys; a small name plate |
| segment and typebars | 1 + 40 | a steel half ring; forty bars 6.2 cm long with a slug, fanned from 22 to 158 degrees, each on its pivot: rest at 20 degrees, strike at 125 |
| keys | 46: 43 round, 2 oval shifts, the bar | a turned top with a rim and a dished face (lettered through the same uv trick), a steel stem and a lever running back; four rows stepped in height |
| carriage | 1 group | body and end plates, the rubber platen with two ridged knobs, the paper table, the bail with two rollers, the scale, the return lever with its paddle. It slides one step per letter |
| ribbon | 2 spools + the ribbon + the guide | spools turned (flanges, wound ribbon, hub), the ribbon a band along a curve to the print point |
| paper | 1 | a sheet 21 cm wide bent along a curve, with a canvas for the typing |

Only three things were made for this look, as asked: the finished machine, its pieces laid out, its contact moment. There is no build sequence for it.

## 12. From this prototype to the real section

- **Driving `t`.** Two ways, to try on a phone: (a) a pinned block about 5 screens tall whose scroll position is `t` (beats 1 to 3 and 10 to 12 scrubbed, the timelapse too: scrolling back un-builds the keyboard, which is fun once); (b) scroll only brings the block in, then the sequence plays by itself in 15 s and the contact zone stays. With (a) nothing plays unless the visitor scrolls, and a fast flick skips it; with (b) the timelapse always reads as a timelapse. Our pick: **(b) for beats 4 to 10, (a) for 1 to 3**, the button beat started by the first pause in typing or after 6 s. Tiles above never move on scroll (CASA.md): this block is the only pinned one.
- **Loading.** three.js is 2.1 MB as vendored here, unminified (417 KB gzipped as it is; minify it at build time, which roughly halves that) and must load only when the block is one screen away (`IntersectionObserver`), after the home is free. Its modules need a modern browser (import maps, class fields): gate with `'noModule' in HTMLScriptElement.prototype` and a WebGL2 check, else the still. Our own files here are modules and must be bundled or rewritten; Dot's scripts stay plain ES2017.
- **One Dot.** On the home, Dot is alive on the tiles. When this block starts he should leave his perch (the brain's own exit) and the scene's Dot takes over; at the end the home's Dot may come back to the dock. Two Dots must never be seen together. Not designed further.
- **Phone budget** (measured here: 382 draw calls and 780,000 triangles at the worst frame, 259 meshes, 75 geometries, 15 textures; far too much for a phone at 60 frames per second). Targets: under 60 draw calls and 150,000 triangles.
  - `InstancedMesh` for the switches (one geometry, 68 instances), for the keycaps (one per geometry: 12), for screws and dust rings; the legend atlas cell as a per-instance attribute instead of 45 materials.
  - A light switch for the grid and the plate (about 300 triangles: it is 15 px wide), the detailed one only for the pieces sheet. The cable at 600 steps. Typebars instanced.
  - Pixel ratio capped at 2 (1.5 while pieces fly); shadow map 1024 on phones, updated only when something moved; the reflection pass at half size, off below 40 frames per second and with reduced motion, and skipped while nothing changes.
  - Render on demand: after beat 10 a frame is drawn only when a key moves, the light breathes (10 frames per second is enough) or Dot blinks.
  - Dot's canvas is redrawn only on a new pose (10 times a second in the timelapse); three canvases of at most 460 x 380 px on a phone.
  - No transmission, no post-processing, no blur. Free geometries and textures when the block is far away (as the home frees its star wall).
- **Accessibility.** The canvas is `aria-hidden`; the title, the line, the field and the button are HTML. The red button is a real `<button>` over its place in the picture, with its own label; what it does is a separate design. The machine's line is `aria-hidden`.
- **Flashing.** The spark is one flash of 0.14 s; nothing else flashes.

## 13. Not decided

- **Keyboard or typewriter**: Imad chooses from the pictures.
- **Where a message goes** (mail, a form service, a store on Vercel) and what is asked (a name, a way to answer). Nothing is sent by this preview.
- The line under "Contattami" and the placeholder are ours: he writes them.
- Scroll-driven or played (section 12); how long it may last on a phone.
- The Italian layout. The keyboard is ANSI and the typewriter is QWERTY, so the pressed key matches most keyboards; an ISO Italian set (ò à ù è, the tall Enter) is more work and more his.
- Whether `imad.chat_` should be typed somewhere as the eight keys go on (the first thing the keyboard writes).
- What happens after the red button, and the verse (if one: verbatim from `content/astro/verses.json`, still, untouched by any effect; remind him).
- What stands between the tiles and this block (he was given proposals on 2026-11-13).
- Sound (a click per key, the spark): none here; it would follow the site's sound button.

## 14. Weak points of this preview (say them to him)

- Checked only in headless Chromium with software rendering. Not on Safari, not on his iPhone; the frame rate on a phone is unknown and the scene is not yet instanced.
- Dot's working poses are composed from the sitting pose: his paws are black on black and read by their rim light only; a pose seen from behind or in three quarters while he presses would read better and needs the rig's owner.
- Dot's size is a choice (8 cm, about four keys): smaller than the keyboard he builds. On a phone he is about 85 px tall during the build, as on the tiles.
- During the timelapse a tool is at the work point with its handle toward his paw, not truly gripped; when a board flies over him he ducks, and the board still passes very close.
- The plug goes into the case's back wall: from the front the moment is seen as the cable arriving, Dot stretching and the spark's glow over the edge.
- The light theme was checked on fewer frames than the dark one.
- Labels on the pieces sheets are HTML placed by hand for a 390 px frame.
- The typewriter's letters on the paper are larger than a real machine's, on purpose.
- No 3D model was taken from outside: Poly Haven (CC0) was reachable and has no keyboard, keycap, switch or typewriter (only worn photo-scanned screwdrivers, which do not fit the look), so every part is procedural.
