# Validation record — v0.3, 18 September 2026

## Commands actually run

| Command | Result |
| --- | --- |
| `npm run verify` | Syntax checks, Node tests, and standalone build passed. |
| `npm test` | **100 passed, 0 failed** in Node v22.16.0. |
| `python tests/browser_smoke.py` | **36 checks passed** in Chromium plus separate HTTP delivery checks. |
| `python tests/browser_expansion.py` | **47 checks passed** against the exact built standalone HTML. |

That is **100 Node tests and 83 browser/HTTP checks**. Counts are separate test groups, not a count of hardware devices or real users. Python Playwright and `/usr/bin/chromium` were used for browser QA; they are optional developer tooling, not runtime dependencies.

## Engine and animation coverage

The original 61 engine regressions still pass. They cover fixed-clock equivalence at 30/60/120/144 render callbacks per second, bounded catch-up, same-seed CPU behavior, input edges and buffers, jumps, collisions, attack phases, trades, shields, DI, L-cancel, techs, ledges, recovery, respawns, stock/draw/timeout outcomes, and bounded material effects. The original seeded fuzz test executes **36,000 simulation frames** across Duel, Flow, and Alchemy.

The follow-up suite adds 38 tests for jab branching, running/slide attacks, clean/late knee profiles, burst startup and resource commitment, reflector timing and ricochet caps, vulnerability to melee, one-airtime Flux braking, retained Alchemy coating, projectile attribution, offensive spawn protection, same-tick shield breaks, hit-freeze clocks, steam/ignition limits, true-hit-only rebound, analog ledge release, independent attack aiming, and articulated animation. It includes a **6,000-frame paired deterministic replay** of expanded inputs.

Every move's sampled poses are checked across all of its frames at three fractional offsets for finite values. Additional assertions verify non-mutating animation samples, distinct strike silhouettes, phase correctness, freeze consistency, and fixed limb lengths even for unreachable targets. Those mathematical checks do not replace visual or human play review.

One packaging test builds twice and compares bytes, verifies SHA-256 hashes against every input file, checks absence of external script/stylesheet dependencies, and syntax-parses the three bundled JavaScript blocks.

## Browser coverage

The retained smoke suite covers startup, CPU play, keyboard/touch, stable pause, focus-loss clearing, frame stepping, short-tap latching, training controls, rule changes, Alchemy demonstrations, local player 2, match results, reset, offline execution, injected standard-gamepad input, and desktop/mobile overflow. The fifth HTTP entry check now includes `animation.js`.

The extension suite runs the **exact generated standalone HTML** with networking disabled. It checks all **21 playable move demonstrations** through the normal application/engine path, including the complete three-hit jab string, a projectile returned by reflection, and a hit-earned meteor rebound. It verifies the live phase meter, frozen strike poses/effects while paused, keyboard/gamepad takeover from demos, the question-mark controls shortcut, and layouts at 1366, 800, 390, and 360 pixels wide.

Injected standard-pad tests cover quick right-stick smashes, back aerials with opposing left-stick drift, disconnect pausing, stable player/controller ownership, and takeover from a demonstration. These tests emulate API values; **they do not validate a physical controller or adapter**.

Desktop strike and mobile reflection screenshots were generated for visual inspection. Runtime errors were collected during the checks and none were observed in the passing runs.

## Managed-browser limitation, rechecked

Top-level navigation to both localhost and `file://` returned `ERR_BLOCKED_BY_ADMINISTRATOR` in this environment. No browser policy was disabled. The browser harness uses Playwright `page.set_content` with the application's exact bytes or the exact built standalone file. The localhost server's actual HTTP responses are separately fetched and byte-compared using Python.

Consequently, these are **real Chromium runtime and separate HTTP-byte checks**, not verified top-level file-opening or a live GitHub Pages deployment. The bundled file contains no remote runtime dependencies, but actual browser/file-origin behavior on the user's device remains unverified here.

## Not validated or not implemented

Physical GameCube adapters or physical controllers; Safari/Firefox; real mobile/Windows hardware; measured display/audio/input latency; long human play sessions; competitive balance; a real screen reader; bit-identical simulation across JavaScript engines. Online play, rollback, and a persistent replay UI are not delivered features.

Passing tests establishes these specific checks, not absence of all bugs or a claim that every new move is competitively balanced. No numerical hardware speed-up is claimed.

## Reproduce

```sh
npm run verify
python tests/browser_smoke.py
python tests/browser_expansion.py
# Optional environment variables:
# CHROMIUM=/path/to/chromium QA_OUTPUT=/tmp/smash-qa python tests/browser_expansion.py
```

`npm run build` emits `dist/smash-movement-lab.html` and its `.sha256.json` manifest. `qa-output/` contains the browser result JSON files and screenshots and is ignored by Git.
