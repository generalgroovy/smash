# SMASH — Movement Lab

A local platform fighter about momentum, spacing and recovery. Melee is the main inspiration; extra movement and elemental reactions are optional. **Original prototype, not a frame-accurate recreation or a balanced competitive release.**

## Play

Open `index.html` with its sibling files intact. Or, with Node 18+:

```sh
npm run serve
# Open http://127.0.0.1:8080
```

No install, account, asset downloads or runtime dependencies. Choose **Play vs CPU**, **Two players**, or **Training lab**. Keyboard, touch and standard-mapped gamepads are supported; physical GameCube adapters are not verified.

**Blue:** A/D move · Space jump · F attack · G shield/dodge · T charge smash · R special · E grab. Add a direction to aim. Escape pauses; Backspace restarts. [Full controls and techniques →](docs/PLAY.md)

## Choose your rules

| Mode | What changes |
| --- | --- |
| **Duel** | Core combat. No material hazards or extra slide/wall-kick mechanics. |
| **Flow** | Adds slides, slide-jump momentum, wall slides and one wall kick per airtime. |
| **Alchemy** | Adds fire, oil, water and spark reactions to Flow. Hazards can hurt either fighter. |

Changing match rules restarts the round. **Visual settings** do not: choose a quieter Focus view, toggle attack-phase marks, or reduce nonessential motion. System motion preferences are respected by default.

## Learn by doing

**Move workshop → choose a move → Watch move in training** runs a real demonstration. Move or attack to take over. Inspect all 21 moves with hitboxes, slow motion, a phase meter, and single-frame stepping with **N** while paused.

The Kinetic Print visual style uses paper controls, an ink-dark arena, cut-stone platforms and shape-coded players. Hollow attack marks mean windup, solid marks mean active, and dotted marks mean recovery. Those marks describe timing, not range or invincibility. [Visual design and controls →](docs/VISUALS.md)

## Develop

```sh
npm run verify  # syntax, Node tests, standalone build
npm run build   # dist/smash-movement-lab.html + hash manifest
```

[Development guide](docs/DEVELOPMENT.md) · [Current validation and limitations](docs/VALIDATION.md)

Two mirror fighters, two stages and a simple CPU. No online play, rollback, replay interface or destructible terrain. The implementation is on PR #1's development branch; `main` and Pages have not been changed by this iteration.
