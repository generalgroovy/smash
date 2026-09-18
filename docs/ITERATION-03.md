# Iteration 03 — audit, combat refinement, and articulated animation

18 September 2026. Starting point: `88d05551d4f77fa4214787c878815fca7e9b04a2`, the open Movement Lab PR branch. `main` was verified at `697d3208983eec203e0570bc531c461fa75ac752`. This iteration updates the same implementation branch; it does not merge or change Pages settings.

## Audit findings and repairs

| Finding | Repair and regression coverage |
| --- | --- |
| A fighter could attack throughout its remaining respawn invulnerability. | Explicit spawn-grace state ends on a normal, charge, or special action. Movement alone preserves protection. |
| Projectile damage was assigned no attacker, so ownership and hit statistics were wrong. | Credit the current owner without freezing a remote shooter or granting a remote Turbo cancel. Reflections update ownership. |
| A hit that emptied shield waited for a later shield update to break it. | Resolve the shield break during the contact tick, with no lingering shield stun. |
| Ledge release compared outward analog input with exactly -1 or 1. | A directional threshold accepts partial stick input. |
| Invulnerability and some clocks kept advancing while the fighter was in hit freeze. | Freeze the relevant resource/animation clocks with the body; directional launch influence is still read at the end of freeze. |
| Neighboring steam cells independently stacked lift, allowing unintended acceleration. | Sample one bounded lift influence per fighter and cap upward steam velocity. |
| Multiple nearby ignition operations could repeatedly overwrite an in-progress launch. | Apply the existing hazard lockout to ignition bursts too. |
| Filtering disconnected gamepads compacted the array and could assign Red's pad to Blue. | Maintain slots by observed device index/identity and explicitly pause on disconnect. |
| Every attack shared nearly the same limb treatment. | Dedicated move poses, fixed-length articulated limbs, phase-aligned interpolation, per-move trajectories, and frame-meter feedback. |
| Packaging depended on ad hoc inlining. | A deterministic build script emits a self-contained HTML and SHA-256 manifest, tested for reproducibility and syntax. |

The original 61 regression tests were kept and rerun. New tests target both the observed defects and extension-specific failure modes, rather than merely increasing a feature count.

## Expanded moves without removing commitment

The move catalog now contains 20 collision-based moves plus Pulse. Six additions extend the previous kit:

| Addition | Input | Role and cost |
| --- | --- | --- |
| Cross → Heel Turn | Deliberate attack presses during the jab branch windows | A three-beat string. The heel steps forward; each press still has a timing requirement and the finisher commits recovery. Holding attack does not chain. |
| Shoulder Drive | Run, then attack | Moving approach with stronger early contact and a weaker late hit. Stopping first still permits a planted tilt. |
| Slipstream Sweep | Flow/Alchemy slide, then attack | A momentum-fed low launcher. Ordinary Duel wavelands do not silently acquire this Flow move. |
| Vector Burst | Side + special | Eight startup frames, seven active frames, then committed recovery. One use per airtime; air use ends helpless. Turbo cannot cancel it. |
| Flux Field | Down + special | Seven active reflector frames after startup. It is vulnerable to melee and has long recovery. Its air brake is limited to once per airtime. |

Two existing moves gain timing-sensitive outcomes. **Comet Knee** has two clean-hit frames before a weaker late hit. **Meteor Heel** can rebound after a real hit while jump is held; misses, blocks, and losing a trade do not grant an escape. The rebound does not refill the air jump or recovery and is available only once per airborne sequence.

Flux Field reflects projectiles through swept segment/field collision. Reflected projectiles change owners, preserve their material, receive bounded speed, and have a three-reflection lifetime limit. In Alchemy, down special also emits the existing downward coating projectile. That preserves floor-painting and creates opportunities to redirect material shots without introducing another action button.

## Animation and readability

The rig is original procedural art, not a sprite sheet or a third-party asset adaptation. Every attack has a distinct set of anticipation, extension, follow-through, and recovery poses. The renderer samples those poses from the engine's move age and phase; it does not create another combat clock. Fractional limb sampling is bounded to the current phase so visual activation does not precede authoritative activation.

An analytic two-link solver keeps arms and legs consistent, including unreachable or coincident targets. Locomotion uses distance-linked strides; jumps stretch; landings compress; fast movement pulls a short scarf behind the fighter. Orbit Kick spins, Sky Scissor changes the leg silhouette, Meteor Heel extends downward, and different strikes receive different arcs. Flux uses a clearly delimited active field. These are visual systems only: they do not move hurtboxes, grant invulnerability, or consume gameplay RNG.

The renderer intentionally keeps the newest simulation root rather than displaying a one-frame-old fighter position. This prioritizes combat responsiveness and hitbox alignment over interpolated root motion. The camera and limbs can smooth independently. This is a design tradeoff, not proof of measured end-to-end latency.

## Learn and verify in the app

The **Move workshop** is populated from engine metadata. Each entry lists its input, startup/active/recovery timing, and intended tradeoff. **Watch move in training** establishes a suitable scene, then drives the normal input/engine path. All 21 demos are integration-tested for an actual hit, including the reflected projectile and meteor rebound. A demo ends paused; physical inputs take over rather than fighting an invisible script.

The training frame meter reports the current move and actual phase, including hit freeze. Existing hitboxes, slow motion, and frame stepping remain usable. The right stick adds independent directional aerial/quick-smash inputs for standard-mapped gamepads; moving one way while attacking behind is explicitly tested. Physical GameCube adapters remain unvalidated.

## Boundaries retained

Duel is still the default. Flow and Alchemy remain opt-in; their additional systems do not replace the core. Two mirror fighters, original procedural visuals, fixed stages, a simple CPU, and local play remain the scope. There is no online play, rollback, replay UI, full grab-hold/pummel system, exact Melee frame-data emulation, or pixel-fluid/destructible-terrain engine.

The next meaningful work is controller-led game-feel tuning, animation-to-hurtbox review in real play, and replay/state-restoration tooling. More effects or more moves are not evidence that balance or human game feel has been solved.

## Technical references checked for this iteration

The browser API references inform the engineering choices, not the gameplay tuning:
- MDN, `requestAnimationFrame`: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- MDN, gamepad axes: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/axes
- MDN, gamepad index: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/index
- MDN, disconnection events: https://developer.mozilla.org/en-US/docs/Web/API/Window/gamepaddisconnected_event
