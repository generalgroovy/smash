# Platform Fighter quality iteration — 6 October 2026

## Journey and evidence

Start a solo match immediately, learn one action at a time, then practise deliberate
follow-ups and returning to the stage. The existing game already has directional
attacks, parries, aerial resources and a fair CPU. Preserve those systems.

At baseline `9bd9365`, Practice has only the basics sequence and an idle target.
Its combo counter permits another hit for 18 frames after hitstun expires, so it
can label an escapable string as a combo. The first CPU selection is Normal while
the README recommends Easy; the quick reference groups three unlabeled attack
keys. Reset already restarts immediately and should keep doing so.

## Bounded implementation

- Add one Practice focus selector: basics, combos, recovery from either edge.
- A combo target tries an ordinary directional dodge as soon as hitstun ends.
  Count only hits connected before a legal escape window; report chain damage
  and best chain for the attempt. Keep regular combat timings and stats unchanged.
- Start recovery drills offstage with one jump and the ordinary recovery move.
  Report landing or failure; Retry restores the setup and clears held inputs.
- Default solo play to Easy and label the three attack keys individually.

## Acceptance

Practice uses the normal simulation and input buffers; versus mode ignores drill
options. No new combat button, hidden damage bonus or physics change. Invalid
focus falls back to basics. Test true and escapable strings, both recovery sides
and stages, reset/pause/cancellation, local 2P, touch, rematch, and 60 Hz stepping.
Refresh asset revisions, inspect the full diff and record exact validation here.

## Iteration findings

The first browser pass found long recovery labels clipped on a 390 px viewport,
and changing focus during play started an offstage fall before the player could
read the new goal. Labels are now Left edge / Right edge; changing focus always
waits for Play. Retry remains immediate. Pausing keeps the practice goal visible.
The combo starting distance was adjusted so the fighter bodies do not overlap,
while the taught launcher-to-up-air route still connects against the escape test.

## Local evidence

- Baseline: 53 passing Node tests. Candidate: 60 passing tests, including seven
  new behavior regressions for invalid focus, regular-mode isolation, a true
  two-hit route, normal dummy escape, false combo rejection, successful and failed
  recovery, and safe focus/Retry/pause transitions. Existing keyboard, touch,
  cancellation, audio, CPU, rematch and 60/144 Hz loop checks remain included.
- Browser checks used the supported CUA tool at 1280 × 720, 390 × 844 and
  320 × 800. No horizontal overflow. Narrow-screen visible match/touch controls
  were at least 44 px tall; direction buttons were 44 × 44 px, action buttons
  50 × 54 px. No browser console warning/error was observed.
- Live local interaction: CPU defaults Easy; Practice shows its focus selector;
  a light hit produces hit then escape feedback; recovery focus waits for Play;
  Escape pauses while retaining instructions; Retry resumes a fresh setup;
  Local 2P hides focus/touch controls and returns to a ready regular match.
- Screenshots: [desktop escape feedback](evidence/practice-desktop.png),
  [390 px recovery setup](evidence/practice-mobile.png),
  [320 px recovery setup](evidence/practice-narrow.png).

## Limits and release

Browser screenshots and simulated touch/input tests are not physical touch
ergonomics, competitive balance, subjective fun, listening or child-usability
acceptance. These need human play. The target's selected dodge response is a
training aid; it does not prove a sequence defeats every defensive choice.
No saves or migrations are involved: matches are in memory. There is no build
step; runtime asset revisions are refreshed. Parent owns main/public publication.
