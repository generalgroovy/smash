# Development

[Back to README](../README.md)

## Run, check, package

Node 18+; no `npm install` for the application or Node tests.

```sh
npm run serve    # localhost only; PORT overrides 8080
npm run check   # JavaScript syntax
npm test        # engine, animation, visual, documentation and packaging regressions
npm run build   # deterministic single HTML file + SHA-256 manifest in dist/
npm run verify  # check + test + build
```

Open `index.html` directly with its sibling runtime files, or serve the repository root. The standalone build needs no sibling files. GitHub Pages can serve the root after an explicit branch/publishing decision; this iteration neither merges `main` nor changes Pages settings.

## Where to change things

| File | Responsibility |
| --- | --- |
| `engine.js` | Fixed 60 Hz state, rules, moves, collision, CPU and materials. `MOVES` and `MOVE_INFO` are the move/timing source of truth. |
| `animation.js` | Read-only poses and fixed-length articulated limbs. |
| `visual.js` | Kinetic Print colors, shapes, material marks, platforms and backdrop. |
| `game.js` | Inputs, browser UI, canvas composition, cached backdrop and optional audio. |
| `style.css` / `index.html` | Responsive interface and labels. |
| `scripts/build.cjs` | Offline bundle and exact-source hash manifest. |
| `tests/` | Regression tests and real-browser checks. |

Version 0.4 changes presentation and documentation; `engine.js` and `animation.js` are byte-identical to v0.3. Package version and engine serialization version intentionally differ. Browser view preferences use `smash-view-v1`; match options retain `smash-lab-v2`. Invalid or unavailable storage falls back safely.

## Keep these boundaries

Rendering never advances combat, grants resources, changes hitboxes or uses gameplay RNG. Attack marks read the engine's phase; they are not extra hitboxes. Poses smooth within the current phase while the root uses the newest simulation position. Disabling effects must leave an identical input sequence with identical simulation state.

Duel remains the acceptance gate. Flow and Alchemy are opt-in. Extra mobility must retain recovery commitment. New moves need tests for hits, blocks, trades, misses and resource limits—not only a demonstration that the hit connects.

Catch-up is capped at eight ticks per callback; excess elapsed time is counted and dropped. Projectiles, material cells, effects and voices are bounded. Canvas density is capped at 2× and its backing size at 1920×1080, including fullscreen. The backdrop is a single detached canvas rebuilt only for size, stage or Focus-view changes. Paused scenes draw only when dirty. No measured hardware speed-up or cross-browser bit-identical networking is claimed.

## Browser checks

Install Python Playwright and a Chromium browser separately, then run:

```sh
python tests/browser_smoke.py
python tests/browser_expansion.py
python tests/browser_visual.py
```

`CHROMIUM` selects an installed Chromium executable. `QA_OUTPUT` changes the results directory (default `qa-output/`). See [Validation](VALIDATION.md) for the exact environment, results and limits. Browser tests load exact application bytes with `page.set_content`; HTTP delivery is tested separately. They do not prove a live deployment works.

The `window.smashLab` diagnostic seam exposes state, pause/reset, frame stepping, demos, view preferences and resource counters for tests and training. It is not a network API.

## History

Current behavior belongs in the player guide and engine metadata, not a growing release essay in the README. The [original audit](history/BASELINE-02.md) and [combat/animation iteration](history/ITERATION-03.md) are preserved as historical records, not current operating instructions.
