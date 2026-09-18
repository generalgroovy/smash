# Audit and design direction

Inspected baseline: `generalgroovy/smash`, `main` at `697d3208983eec203e0570bc531c461fa75ac752` (26 April 2026). Audit and implementation: 18 September 2026. The baseline consisted of `index.html`, `style.css`, and a 5,974-byte `game.js`; no test suite or README was present.

## What needed fixing before adding more mechanics

| Priority | Baseline finding | Implemented response |
| --- | --- | --- |
| P0 | Physics advanced once per animation callback, with no elapsed-time accounting. | 60-Hz fixed simulation, render-independent clock, bounded catch-up, 30/60/120/144-Hz regression. |
| P0 | Jump ran directly from keydown, ignoring hitstun/life state and accepting OS repeat. | Tick-based normalized inputs, action gates, rising-edge detection, short-tap latching, configurable buffer. |
| P0 | Each fighter completed input/physics before the next; attacking resolved immediately. | Snapshot simultaneous active contacts before applying outcomes, explicit startup/active/recovery, trade tests. |
| P0 | Winner overlay did not stop simulation; simultaneous final KOs had no explicit draw outcome. | Stock losses collected together, all four blast boundaries, stable win/draw/timeout state. |
| P1 | Multiplicative movement friction also immediately erased launch velocity. | Separate controlled movement and hitstun launch handling, hit freeze, bounded DI sampled at launch. |
| P1 | Platforms lacked solid sides/undersides and crossing logic had tunneling risks. | Swept top/side/underside contacts, nearest crossing, one-way drops, tests for fast diagonal contacts. |
| P1 | Respawn used hitstun rather than spawn protection and incompletely reset transient state. | Clean respawn state, finite invulnerability, stock/reset tests. |
| P1 | One immediate horizontal attack could not support spacing, commitment, or meaningful defense. | Directional grounded/aerial moves, charged smashes, shields, parries, rolls, techs, grab-throws, recovery, ledges. |
| P1 | No focus-loss/input cleanup, training tools, CPU, or controller handling. | Pause and clear on focus loss, deterministic heuristic CPU, training lab, keyboard/touch/standard-pad input. |
| P2 | UI exposed little feedback and used broad empty space. | Responsive arena-first layout, compact settings, state/velocity/frame readouts, optional hitboxes and effects. |

These were observed in the source, not inferred from a live production play session. The original GitHub Pages deployment was not successfully accessed in the audit environment.

## Inspiration hierarchy

**Melee is the governing idea:** expressive movement with commitment; percent-based launches; a contest over space, stage control, recovery routes, and punish windows. This implementation uses original tuning values rather than claiming matching Melee frame data. Wavedash-like motion comes from air-dodge vectors and landing friction rather than a macro.

**Project M / Project+ is a design reference, not a mandate to copy every option.** Preserve technical depth while making it easier to practise. Manual versus assisted L-cancel, a selectable input buffer, explicit hitbox/frame tools, and optional hit-confirmed Turbo are isolated choices. Project+ publicly documents related mechanics and training/options: https://projectplusgame.com/features and https://projectplusgame.com/faq. Project+ is a separate project and must not be presented as the original Project M team's official continuation.

**Apex Legends / Titanfall supplies the desired feeling of momentum and route choice.** Flow extends the common fighter with slides, slide-jumps, wall slides, and one wall kick. These are this prototype's interpretations, not claims of matching those games' physics. Recovery resources remain scarce so movement variety does not remove edgeguarding. Grapples, Titans, guns, armor loot, and battle-royale infrastructure are intentionally outside this slice.

**Noita supplies systemic cause and effect.** Its official description emphasizes material simulation and interacting substances (https://noitagame.com/). Alchemy deliberately reduces that idea to legible, temporary platform coatings: ignition, steam lift, and water conduction. Fixed stage collision remains authoritative; every extra surface hazard is optional, bounded, and able to punish its creator. This is not Noita's per-pixel simulation.

## Useful original combinations to practise

1. Use a normal air dodge to waveland onto a platform, then vary dash-back spacing and the next aerial. No environmental systems are needed.
2. In Flow, slide off a platform, carry velocity into a jump, then use the single wall kick to vary a recovery route. The wall kick does not restore spent recovery resources.
3. In Alchemy, oil preserves momentum but makes a fire burst possible. Water can turn fire into a lift rather than simply blocking an attack. Spark can make that same water route dangerous. These are risk/reward interactions, not unconditional upgrades.
4. Enable Turbo separately to explore hit-confirmed strings. Leave it off when measuring baseline move commitment or punishability.

## Technical limits and budgets

Simulation: 60 ticks/second, maximum eight catch-up ticks per rendered callback, elapsed delta capped at 0.25 seconds. Over-budget time is dropped and counted, not processed indefinitely. This trades perfect wall-clock catch-up under severe stalls for responsiveness and bounded CPU work.

Material state is limited to 24-pixel cells on a fixed finite platform list; effects have lifetimes. Projectiles cap at 32, transient simulation events at 64 per tick, rendered particles at 160, rings at 24, sound voices at eight, and canvas device-pixel ratio at two. There is no environment-sized pixel buffer. Rendering and optional sound cannot consume gameplay RNG.

The CPU is deterministic but intentionally simple. It is a sparring tool, not evidence of competitive balance. The game presently uses axis-aligned hurt/hit boxes and two mirror fighters. Serializability is groundwork for replay/debugging, not a delivered rollback implementation. No baseline hardware benchmark was run, so there is no numerical speed-up claim.

## Next implementation slice, in order

1. **Game feel on actual hardware.** Playtest a standard controller and the intended GameCube adapter; measure end-to-end latency; tune initial dash, traction, aerial drift, jumpsquat, landing lag, launch curves, shield pushback, and ledge geometry. Record observations with seeds and training frames. Keep Duel the acceptance gate.
2. **Regression-grade replay tooling.** Add versioned input recordings and state save/restore, checksum checkpoints, mid-match restoration tests, and a browser replay inspector. Verify cross-runtime behavior before any online claims.
3. **Three genuinely different fighters.** Build different movement and attack commitments before cosmetic roster expansion. Separate recovery weaknesses and disjoint ranges, introduce full grab states only with escape/counterplay tests, and profile the actual hitbox/animation workflow.
4. **Controlled sandbox depth.** Improve material preview/readability and one deliberately designed reactive stage. Consider a grappling experiment only after its landing, shield, ledge, and infinite-stall cases are specified. Keep experimental rules separate from Duel.

Release gate: all regression tests pass, no focus/input traps, no infinite recovery or invincibility loop, and human playtest confirms that the plain duel is fun. Automated tests cannot decide that final condition.
