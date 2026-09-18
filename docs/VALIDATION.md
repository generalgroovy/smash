# Validation record — 18 September 2026

## Results

- `npm run check`: passed JavaScript syntax checks for engine and browser shell.
- `npm test`: **61 passed, 0 failed** in Node v22.16.0.
- `python tests/browser_smoke.py`: **35 checks passed** with Python Playwright and `/usr/bin/chromium`.

No runtime package installation is required. Browser QA is optional tooling, not a dependency of the delivered game.

## Engine coverage

The suite covers fixed-clock equivalence at 30/60/120/144 render callbacks per second, bounded catch-up, same-seed CPU reproduction, rising-edge inputs, hitstun action restrictions, short/full hops, fast fall, platform drops, one-way and solid collisions, high-speed diagonal contacts, attack phases, one-hit-per-target rules, trades, charged smash strength and release, directional launch influence, shields/parries/grab counters, air-dodge landing slides, L-cancel timing, techs/rolls, ledges/occupancy/regrab limits, recovery resource limits, Turbo hit-only cancels, clean respawns, stocks/draws/timeouts, malformed options/inputs, and optional material reactions.

A seeded fuzz test advances **36,000 simulation frames** across Duel, Flow, and Alchemy, checking finite state and bounded objects. Seeded CPU reproduction additionally runs a 5,000-frame comparison. Passing these tests does not prove all possible inputs or interactions are bug-free.

## Browser and HTTP coverage

The localhost server is started by the test and the four application entry files are fetched via Python HTTP and compared byte-for-byte with source. Actual DOM/canvas/input execution then runs in Chromium at desktop 1366x900 and mobile 390x844 sizes.

Checks include menu/start, CPU progress, timer formatting, keyboard movement, stable pause, cleared input on blur, dirty-only paused redraws, training controls, single-frame advancement including queued attacks, dummy damage, short keyboard/touch taps, Flow/Alchemy/Duel transitions, seeded material demo, controls disclosure, local player 2, simultaneous-final-KO draw, full reset, overflow, uncaught errors, offline self-contained execution, and injected standard-gamepad axes/jump input.

### Managed-browser limitation

This execution environment's managed Chromium policy blocks top-level navigation to localhost and `file://` (`ERR_BLOCKED_BY_ADMINISTRATOR`). No browser policy was disabled. To test the actual runtime, the harness reads the exact local HTML/CSS/JavaScript, inlines the stylesheet and scripts, and uses Playwright `page.set_content`. HTTP delivery is tested separately as described above. The offline test disables browser networking and executes those same self-contained bytes.

Consequently, these are **real Chromium runtime and separate HTTP-byte checks**, not a claim that top-level localhost navigation, a direct file open, or live GitHub Pages deployment was verified in this environment. The standalone HTML artifact uses the same inlining strategy and contains no remote dependencies.

### Not validated

Physical GameCube adapters or any physical controller; Safari/Firefox; real Windows or mobile hardware; real display/audio/input latency; long human matches; competitive balance; accessibility with an actual screen reader; cross-JavaScript-engine bit-identical simulation; online or rollback behavior. The gamepad smoke check uses an injected standard mapping, not physical hardware.

## Reproduce

```sh
npm run check
npm test
# With Python Playwright and Chromium installed:
python tests/browser_smoke.py
# Optionally:
# CHROMIUM=/path/to/chromium QA_OUTPUT=/tmp/smash-qa python tests/browser_smoke.py
```

Generated QA files include `browser-results.json`, desktop menu/Alchemy screenshots, and mobile menu/training screenshots. They are not required to run the game.
