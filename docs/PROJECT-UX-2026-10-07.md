# Platform Fighter interface refinement — 7 October 2026

## Journey

From the ready screen, choose **First steps** for guided practice or **Play CPU**
for an Easy match. First steps uses the real practice system and preserves the
selected stage. Experienced players retain the mode, stage, difficulty and
practice focus choices. Combat physics, attacks, the CPU and drill rules are
unchanged.

The previous interface hid its teaching route in the Mode dropdown. It also
used Play and Reset without naming their destination or distinguishing readiness
from an in-progress round. The revised two-action entry and compact state label
make those choices explicit without adding another instructions panel.

## Changes

- Direct First steps entry beside Play CPU. It launches basics practice and
  transfers focus to the arena. Starting, resuming and retrying intentionally
  focus play; changing setup keeps focus on the user's native control.
- Ready, Playing, Practice, Paused and Complete states. Restart/Retry appears
  after starting; Resume continues the same round and Rematch keeps its existing
  finished-game focus. Local 2P's ready text explicitly names the shared keyboard.
- The existing hint line gives inward direction and recovery advice when the
  player's body is offstage. It checks actual jumps and recovery use, never
  suggests a spent up-special, and restores the practice goal onstage. During
  hitstun it tells the player to hold inward for the moment movement returns.
- Setup choices, sound opt-in, reduced motion, touch controls, charged and
  directional attacks, combo escape logic and unlimited-stock drills remain.

## Validation

- Base: `7bdc88fc10e1ff8825f097b7a6f80b824f1340b4` (latest main, including the
  engineering overview and portfolio navigation documentation).
- `node --test tests/*.test.cjs`: 64 passing tests, including four new integration
  regressions for direct practice entry/stage preservation, match-state and
  native-focus transitions, both recovery sides and spent resources, and native
  keyboard controls during contextual hints. The existing 60 tests cover combat,
  CPU, drills, input, pause, touch cancellation, sound, rendering and asset hashes.
- `node --check game.js` and `git diff --check` pass. Runtime asset revisions were
  refreshed with `node tools/update-asset-revisions.cjs`.
- Root browser checks and independent review: pending integration; this record
  will be updated with actual results before publication.

## Limits

Software and rendered-browser checks do not establish competitive balance,
physical keyboard rollover/touch ergonomics, subjective fun, audio quality or
child usability. Matches remain in memory and refresh discards the current one.
Parent owns main promotion and public-byte verification.
