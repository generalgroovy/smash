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

Jump requires a new press; keyboard repeat does not spend the second jump. **P** or the **Pause/Resume** button pauses both players. Switching away pauses automatically; returning does not resume until you choose to continue. **Reset** starts a fresh match and resumes it.

Both players share the keyboard. Some keyboards cannot report every simultaneous chord; that is a hardware limitation. Touch/gamepad bindings are not implemented.

## Progress and timing

Matches are memory-only. Refresh, close or Reset discards the current match; there are no accounts, saved scores or network sessions. Simulation advances in fixed 60 Hz steps, separately from display refresh. Pause/resume clears accumulated time so returning after a long absence does not fast-forward the match.

## Development

```sh
node --check game.js
node --test tests/*.test.cjs
```

Tests exercise 60/144 Hz timing equivalence, jump repeat, focus-loss pause and resume without catch-up. They use event/simulation harnesses, not rendered browser acceptance. Manual smoke check: move both players, double jump, hit an opponent, pause from keyboard and button, switch windows, resume and reset.

`game.js` contains input, physics, combat and rendering; `index.html` contains the controls and `style.css` the presentation. The prototype has one stage and one moveset; a passing timing test is not a balance or latency claim.
