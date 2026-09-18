# SMASH — Movement Lab

A Melee-first, original platform-fighter prototype for GitHub Pages. Preserve the duel; make extra movement and elemental chaos a choice. Version 0.3.0 is a substantial playable foundation, **not a frame-accurate Melee recreation or a competitively balanced release**.

No runtime dependencies, build step, external fonts, downloaded assets, analytics, or network services. Two mirror fighters, two stages, local keyboard/touch/standard gamepad input, a simple seeded CPU, and a training lab.

## Play and test

Open `index.html` in a modern browser with JavaScript enabled, keeping `engine.js`, `animation.js`, `game.js`, and `style.css` beside it. For a local HTTP origin, use Node 18 or newer:

```sh
npm run serve
# Open http://127.0.0.1:8080
```

No `npm install` is needed. The server binds only to localhost. For GitHub Pages, serve this branch's repository root; publishing or merging is a separate step. The existing `main` is deliberately not replaced by this implementation branch.

```sh
npm run check
npm test
npm run build   # dist/smash-movement-lab.html, one offline file
npm run verify  # syntax + tests + reproducible build
```

Optional browser QA requires Python 3, Playwright, and Chromium. `python tests/browser_smoke.py` and `python tests/browser_expansion.py` write their results and screenshots to `qa-output/`. `CHROMIUM` can select another installed Chromium executable; `QA_OUTPUT` selects another results directory. Read `docs/VALIDATION.md` for the exact coverage and browser-environment limitations.

## Three rulesets

| Ruleset | Purpose | Additional systems |
| --- | --- | --- |
| Duel (default) | Learn spacing, movement, combos, defense, and recovery. | No environmental materials or dedicated slide/wall-kick extension. |
| Flow | Carry momentum through more routes. | Dedicated slide, slide-jump carry, wall slide, one wall kick per airborne sequence. |
| Alchemy | Explore readable, risky chain reactions. | Flow plus fire, water, spark, and oil on bounded platform cells. |

All three retain the same platform-fighter combat rules. Assist L-cancel, Turbo hit-cancels, and the input buffer are separate settings. Manual L-cancel is the default; the default buffer is three simulation frames. Changing match settings restarts the round.

Alchemy is not a pixel-fluid simulator or destructible-terrain engine. Fire ignites oil into a burst, water meeting fire creates a temporary steam updraft, and spark electrifies connected water cells. Oil carries horizontal momentum. Reactions can hurt their creator as well as the opponent. In Alchemy training, use **Load reaction demo** or click a platform to paint with Blue's selected element.

## Controls

Directions also aim attacks, throws, dodges, and specials. Keyboard movement uses physical key positions; `/` additionally has a character fallback. Original A/D/W/F and arrow/up/slash controls remain usable.

| Action | Blue / player 1 | Red / player 2 |
| --- | --- | --- |
| Move / aim | A/D, W/S | Arrow keys |
| Jump | Space or W | Up arrow |
| Directional normal / aerial | F or J | / |
| Charge directional smash | Hold T or I, release | Hold ; or Numpad 1, release |
| Shield / dodge / tech | G or L | Right Shift |
| Special: neutral pulse, side burst, up recovery, down field | R or K | . or Numpad 2 |
| Directional grab-throw | E or H | , or Numpad 3 |
| Slide (Flow / Alchemy) | C | Right Ctrl |
| Cycle element (Alchemy) | V | Numpad 0 |

Escape pauses; Backspace restarts; N advances one frame in paused training. The arena must have focus. Focus loss clears held inputs and pauses the match. Text fields do not receive gameplay shortcuts.

Standard-mapped gamepad: left stick moves/aims, A jumps, X attacks, B uses a special, Y grabs, RB charges a smash, triggers shield, LB slides, and D-pad right cycles the element. The right stick performs quick grounded smashes or aerials independently of left-stick movement; return it to center before another attack. Controller slots remain stable on disconnect and the match pauses. The first connected pad controls Blue; the second controls Red in local mode. Non-standard adapters require mapping outside the app. **A physical GameCube controller/adapter has not been validated.** Small/touch layouts expose on-screen controls.

## New in v0.3: moves and animation

The **Move workshop** documents 21 moves: 20 collision-based attacks/specials plus the neutral projectile. It includes an actual playable training demonstration for every entry, not a detached animation player. Watching a demo resets the training scene and positions the participants; subsequent movement, hits, projectiles, and reactions use the normal fixed-step engine. Move or attack to take control, including with a gamepad. A completed demo pauses for inspection.

Six new moves extend the existing set: **Cross** and **Heel Turn** branch from deliberate jab inputs; **Shoulder Drive** commits a running approach; **Slipstream Sweep** converts a Flow/Alchemy slide into a low launcher; **Vector Burst** is a telegraphed horizontal special; **Flux Field** is a brief projectile reflector, not melee armor. Comet Knee has two clean-hit frames followed by weaker late contact. Hold jump during a successful Meteor Heel contact to rebound once per airborne sequence, without restoring jumps or recovery.

Neutral special fires Pulse, side special performs Vector Burst, up special performs Skyburn, and down special creates Flux Field. Alchemy's down special additionally coats the floor. Air Vector Burst ends helpless, its use is limited per airtime, and Turbo cannot remove a recovery commitment. Flux's air brake is limited; reflected projectiles change ownership and disperse after three successful reflections.

`animation.js` supplies a separate, pure, articulated animation rig with authored anticipation/strike/follow-through/recovery poses for every collision move. Two-bone limbs preserve length; movement adds speed-linked strides, landing compression, takeoff stretch, recoil, spins, and a velocity-responsive scarf. Per-move arcs and field geometry replace the old generic hit flashes. Hit freeze also freezes the pose; paused effects remain paused. Fractional limb sampling does not move the authoritative collision root or change gameplay timing.

Training now shows a **live startup / active / recovery meter**. Move-workshop timing values come from the same engine tables that control collision. The `?` shortcut opens controls.

Audit corrections include offensive respawn invulnerability, projectile hit attribution, same-tick shield breaks, analog ledge release, stacked steam acceleration, repeated ignition lockouts, and controller reassignment on disconnect. Details and tradeoffs: `docs/ITERATION-03.md`.

## Movement and combat lab

Tap jump for a short hop; hold through the three-frame jumpsquat for a full hop. Dash back and forth, use aerial drift, fast fall after the apex, and drop through one-way platforms. Jump then air-dodge diagonally down to land into a momentum-preserving slide. The simulation does not identify or automatically execute a special "wavedash" command: it emerges from jump, dodge, and landing rules.

Tap shield within seven frames before an aerial landing to halve landing lag. Tap shield before a hard hitstun landing to tech; aim sideways for a tech roll. Hold a direction during hit freeze to influence the launch angle. Shield early to parry; grab beats shield. Directional attacks have explicit startup, active, and recovery frames, with each move hitting a target once. Opposing active attacks can trade in the same tick.

Up + special is a committed recovery with a helpless ending. Ledges have occupancy, limited hang time, regrab lockout, and no repeated invincibility refresh before returning to the stage. Inward climbs, jump hops, and down/outward drops. Flow's wall kick does not refill jumps or recovery.

Training offers an inert dummy, damage slider, slow motion, hitbox overlays, velocity/state/frame readouts, combo tracking, and actual single-frame advancement. Turbo is an experimental **successful-hit-only** cancel into a different move; blocked and missed attacks cannot cancel. It is not a reproduction of every Project M Turbo rule.

## Architecture and performance

- `engine.js`: pure fixed-60-Hz UMD simulation, serializable state, seeded CPU, central tuning/move tables, collision, combat, materials, bounded catch-up clock. Node tests use this same file.
- `animation.js`: read-only pose sampling, authored move keyframes, and analytic two-bone limbs.
- `scripts/build.cjs`: reproducible standalone bundling with source/bundle SHA-256 hashes.
- `game.js`: browser-only input, UI, canvas drawing, camera, bounded visual effects, optional synthesized sound, safe preferences, and focus/pause handling.
- `index.html` / `style.css`: compact responsive match interface; no external assets or libraries.
- `tests/`: engine regression tests and optional real-Chromium UI checks.
- `serve.cjs`: dependency-free localhost server.

The renderer draws the newest simulation state rather than interpolating from an older combat frame. Camera/effects smooth independently. Rendering cannot alter simulation RNG. Paused scenes redraw only when dirty; DOM updates are throttled. Catch-up work, projectiles, particles, rings, events, audio voices, and device pixel ratio are bounded. These are concrete resource controls, not a claim of a measured speed-up on every device.

## Scope and next steps

See `docs/AUDIT.md` for the baseline defects, design reasoning, implemented repairs, and prioritized next slice. See `docs/VALIDATION.md` for 100 passing Node tests and 83 passing browser/HTTP checks.

Known simplifications: two mirror fighters; geometric procedural art; a heuristic CPU; immediate directional grab-throws rather than a hold/pummel/escape subsystem; a shared moveset and special kit; no SDI, full stale-move system, exact Melee shield/ledge/frame data, online play, rollback, persistent replay UI, destructible terrain, or full fluid simulation. Same-seed tests establish reproducibility in the tested JavaScript runtime, not bit-identical cross-browser networking.

The next priority is controller-led game-feel testing and frame-data tuning, followed by replay/state-restoration tests and a small distinct roster. Broad new subsystems should wait until the duel is satisfying without them. All visuals are original procedural shapes; no Nintendo or other third-party game assets are included.
