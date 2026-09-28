# Platform Fighter

A small local two-player platform fighter for one keyboard. Build the opponent's damage, knock them beyond the arena and take all three stocks. There is no AI opponent or online multiplayer.

## Run

Serve this directory with Python 3:

```sh
python -m http.server 8080
```

Open `http://localhost:8080`. The game is plain HTML, CSS and JavaScript with no build or install step and no remote game service.

## Controls

| Action | Blue | Red |
| --- | --- | --- |
| Move | A / D | Left / right arrows |
| Jump, including second jump | W | Up arrow |
| Attack | F | / |

Jump requires a new press; keyboard repeat does not spend the second jump. **P** or the **Pause/Resume** button pauses both players. Switching away pauses automatically; returning does not resume until you choose to continue. **New match** starts fresh; after a win, **Rematch** receives focus. A completed match freezes until restarted.

Both players share the keyboard. Some keyboards cannot report every simultaneous chord; that is a hardware limitation. Touch/gamepad bindings are not implemented.

## Practice

Choose **Practice** for a stationary P2 target and unlimited respawns. The short guide advances when you actually move, jump and land a hit. P1/P2 labels distinguish fighters without relying on color; a brief outline and +11 cue mark a landed hit. Choose **Two players** to start a normal three-stock match. Full control reference is under **Controls & how to play**.

## Progress and timing

Matches are memory-only. Refresh, close or restart discards the current match; there are no accounts, saved scores or network sessions. Simulation advances in fixed 60 Hz steps, separately from display refresh. Pause/resume clears accumulated time so returning after a long absence does not fast-forward the match.

## Development

```sh
node --check game.js
node --test tests/*.test.cjs
```

Tests exercise 60/144 Hz timing equivalence, jump repeat, focus-loss pause, resume without catch-up, action-driven practice, unlimited respawns and frozen match-end/rematch. They use event/simulation harnesses, not rendered browser acceptance. Manual smoke check: move both players, double jump, hit an opponent, pause from keyboard and button, switch windows, resume and reset.

`game.js` contains input, physics, combat and rendering; `index.html` contains the controls and `style.css` the presentation. The prototype has one stage and one moveset; a passing timing test is not a balance or latency claim.
