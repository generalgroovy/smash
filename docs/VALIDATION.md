# Validation — v0.4 / 18 September 2026

[Back to README](../README.md)

## Executed results

| Command | Result |
| --- | --- |
| `npm run verify` | Syntax checks, 112 Node tests and standalone build passed. |
| `python tests/browser_smoke.py` | 37 browser/HTTP checks passed. |
| `python tests/browser_expansion.py` | 47 browser checks passed. |
| `python tests/browser_visual.py` | 42 browser checks passed. |

The original 100 Node tests remain, plus 12 visual/documentation regressions. The original combat and animation modules match their v0.3 Git blob hashes exactly. Package version is 0.4.0; engine serialization version remains 3 because combat state has not changed.

## What was checked

**Combat and packaging:** fixed-clock equivalence at 30/60/120/144 render rates, same-seed CPU reproduction, 36,000 fuzzed simulation frames, collisions, trades, recovery restrictions, material reactions, all 21 playable move demonstrations, freeze/phase timing, deterministic bundling and exact-source hashes.

**Presentation:** player silhouettes independent of color; six different material alpha silhouettes; distinct windup/active/recovery marks; read-only rendering; selected text/player contrast pairs; unchanged paused state after visual preferences; persisted settings and unavailable-storage fallback; runtime system-motion changes and explicit overrides; no impact particles in Reduced mode; preserved material hazards in Focus; backdrop cache reuse/invalidation; 1920×1080 backing-size cap; 16:9 geometry and no horizontal page overflow at widths 320, 390, 540, 800, 1024, 1366 and 1920; essential touch jumping and 44px touch-action targets.

**Documentation:** active relative links resolve and the entry README remains below 600 words. Move timing stays in engine metadata and the in-app workshop instead of a second manually maintained frame table.

## Environment and method

Node v22.16.0, Python Playwright and installed Chromium. Browser runtime checks execute the exact generated offline HTML via `page.set_content`. The smoke suite separately starts the localhost server, fetches the six runtime files and compares their bytes with source. Browser screenshots were inspected for desktop/menu/combat, mobile, Focus and Alchemy views.

This environment has previously blocked top-level localhost/file navigation. The tests deliberately keep exact-byte runtime execution and HTTP delivery separate; neither is represented as a verified live GitHub Pages deployment. No browser security policy was disabled.

## Not established

Physical GameCube adapters or other physical controllers; real Windows/mobile hardware; Firefox/Safari; end-to-end input latency; competitive balance; screen-reader playability; full accessibility compliance; cross-browser bit-identical networking; online/rollback behavior; live Pages deployment. Automated passes do not replace human game-feel testing. No percentage speed-up is claimed.

## Reproduce

Run the commands above from the repository root. Node tests need no install. Browser tooling needs Python Playwright and Chromium; `CHROMIUM` selects the executable and `QA_OUTPUT` selects the output directory. The default output is `qa-output/`, containing JSON results and screenshots. Build output and its SHA-256 manifest are in `dist/`.

Historical audits are linked from [Development](DEVELOPMENT.md); they are not the current validation record.
