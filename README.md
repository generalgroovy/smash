# Platform Fighter

[Play in your browser](https://generalgroovy.github.io/smash/).

Build damage, open a combo and launch your rival beyond the arena. Take three
stocks to win. Play against a CPU, share a keyboard with a friend, or learn in
Practice. Two stages and one shared moveset keep the contest about movement,
spacing and timing. No installation, account or online session is required.

## Engineering overview

- **Simulation:** a deterministic 60 Hz combat model separates game rules from rendering and audio.
- **Opponent behaviour:** CPU players produce ordinary inputs from delayed observations; difficulty changes decisions rather than damage or movement statistics.
- **Browser interaction:** a fixed-step loop coordinates input, rendering and audio, with focus-loss pausing and explicit practice-state transitions.

[Project overview](https://generalgroovy.web.app/apps/platform-fighter/) · [Combat design](docs/COMBAT-DESIGN.md) · [Tests](tests/)

## Start playing

Choose **First steps** to learn one move at a time with unlimited stocks, or
**Play CPU** for an Easy match. The Mode and Stage controls keep other options
close by. Practice's **Focus** offers combos and recovery from either edge.
P pauses; changing mode or stage prepares a fresh match. Losing focus pauses
automatically. **Resume** continues the current round; **Restart** begins again.
A completed match freezes and focuses **Rematch**. Local 2P shares one keyboard.
The status beside the arena distinguishes Ready, Playing, Practice, Paused and
Complete. Offstage, the hint points back toward the stage and suggests only
remaining jumps or recovery; landing restores the normal practice goal.

## Controls

| Action | P1 — Nova | P2 — Ember |
|---|---|---|
| Direction / aim | W A S D | Arrow keys |
| Jump / double jump | Space | Enter |
| Light attack | F | J |
| Strong attack | G | K |
| Special | H | L |
| Dodge / parry | R | Right Shift |

**Jump is now separate from aiming up.** This lets you launch an opponent upward
without jumping yourself. Phone controls operate P1 against the CPU or practice
dummy. Local two-player mode needs a keyboard; gamepads and online play are not
implemented. Some keyboards cannot register every simultaneous key combination.
The physical Slash, Period and Comma keys also retain the previous P2 attack
bindings; J/K/L avoid punctuation-layout differences.

## Find your flow

- **Open:** neutral light is a quick jab. Side light has reach; running side light
  becomes a dash strike. Down light sweeps; up light launches for a follow-up.
- **Follow:** jump after a low-damage up-light, then use up-light in the air for
  a juggle. Air attacks also include an orbit, forward slash, back kick and
  downward meteor. Airborne strong uses the same directional aerial attacks.
- **Finish:** hold and release Strong on the ground. Side launches outward,
  up launches vertically and down covers both sides. Charging is vulnerable;
  a miss leaves recovery time. Repeated use slightly weakens the same move.
- **Mix:** neutral Special fires a bolt; side bursts forward; up rises to recover;
  down repels nearby opponents. Specials have cooldowns. Air burst and up recovery
  each have one use until landing, so plan the return trip.
- **Defend:** neutral Dodge has a brief parry window and long recovery if mistimed.
  Direction + Dodge rolls on the ground or air-dodges once before landing.
  A downward diagonal air dodge can land into a slide. A timed dodge before a
  hard landing softens the impact. Holding a direction influences launch angle.

Release jump early for a short hop. Press down while descending to fast-fall;
down + jump drops through an upper platform. Attacks have startup, active and
recovery phases. Inputs buffered near recovery keep their chosen direction.
Hold jump for height; a new press is required for the second jump.

Practice has unlimited stocks and one **Focus** choice:

- **First steps:** prompts follow movement, jumping, landed attacks and defense.
- **Combos:** up + Light launches; Jump and follow with up + Light in the air.
  The target attempts a normal dodge at the first escape window. A counted combo
  connects before that window; damage and the best chain help compare attempts.
- **Left edge / Right edge:** start offstage with one jump. Steer toward the
  stage, Jump, then up + Special. Landing restores the aerial resources. A missed
  recovery returns to the same setup without losing a stock.

Changing Focus waits for **Start practice**, so you can read the goal before moving.
**Retry** restores the selected setup and starts immediately. Pause keeps the
practice goal visible; Retry also clears old held inputs and resets the attempt's
best chain. Full reference stays under **Info & moves**.

CPU difficulty changes observation delay and decision mistakes, never damage or
movement stats. It uses the same attacks and recovery limits. Sound is opt-in;
reduced motion disables screen shake and reduces visual effects.

## Run and develop

Serve the directory with `python -m http.server 8080`, then open
`http://localhost:8080`. No build or npm dependencies are needed.

```sh
node tools/update-asset-revisions.cjs
node --check combat.js
node --check cpu.js
node --check game.js
node --test tests/*.test.cjs
```

Refresh the content revisions after changing runtime scripts or styles so the
published page requests matching assets even when an older release is cached.

`combat.js` is the deterministic 60 Hz simulation, `cpu.js` produces ordinary
player inputs from delayed observations, and `game.js` owns browser input,
rendering, audio and the fixed-step loop. Move data is in `MOVES`; stage geometry
is in `STAGES`. Pause clears accumulated time and input, so returning cannot
fast-forward a match. State stays in memory; refresh discards the current match.

Regression coverage includes directional attacks and buffers, charge, trades,
parry/projectiles, combos, short hops, platform drops, aerial resources, recovery,
knockouts, true versus escapable combos, both recovery drills on both stages,
practice transitions, CPU matches, and input/pause integration. These are software
checks; they do not establish competitive balance, physical-device latency or
subjective fun. See [combat design](docs/COMBAT-DESIGN.md) for scope and influences.
The [October quality record](docs/PROJECT-QUALITY-2026-10-06.md) includes the
focused browser and regression evidence for practice.
The [interface refinement record](docs/PROJECT-UX-2026-10-07.md) covers direct
First steps entry, match states, resource-aware hints and focus behavior.
