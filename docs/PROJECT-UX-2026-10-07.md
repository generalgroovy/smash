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
- `node --test tests/*.test.cjs`: 65 passing tests, including five new integration
  regressions for direct practice entry/stage preservation, match-state and
  native-focus transitions, both recovery sides and spent resources, and native
  keyboard controls during contextual hints, and persistent audio-failure feedback.
  The existing 60 tests cover combat,
  CPU, drills, input, pause, touch cancellation, sound, rendering and asset hashes.
- `node --check game.js` and `git diff --check` pass. Runtime asset revisions were
  refreshed with `node tools/update-asset-revisions.cjs`.
- Candidate runtime `f4dcd1f946e614ea4d25c062529ab57fd7c4bc25` passes
  [GitHub verification](https://github.com/generalgroovy/smash/actions/runs/37603296451):
  script syntax and all 64 behavior/asset checks on Node 22.
- Independent reviewer ux_arena found a P2: the new per-frame contextual hint
  replaced an unsupported-audio error immediately. Audio errors now have a small
  dedicated live status beside Sound, shown only on failure and retained until
  another sound attempt. A regression covers both absent Web Audio and a rejected
  asynchronous resume, with gameplay continuing and its hint changing. Reviewer
  reran six focused UX/asset checks and closed the finding at runtime
  `13c08e838c6c85963ca0dce9a95b6288eddbe609` with no open source blockers.
- [Follow-up CI](https://github.com/generalgroovy/smash/actions/runs/37604054680)
  passes syntax and all 65 tests for that corrected runtime. Root rendered
  browser checks remain a separate integration gate.
- Root CUA verified the source flows at 1366 px and 390 px: Crossroads stays
  selected when First steps launches; Left edge waits ready, starts, pauses and
  retries with arena focus; phone controls remain legible. Its 844 × 420 check
  found setup, Resume and touch controls below the arena viewport. A follow-up
  short-landscape grid puts the arena beside setup, status and the touch pad;
  Info stays reachable below. Reviewer ux_arena inspected this CSS/hash-only
  follow-up with no source blocker. Root accepted runtime
  `78588aa2c3813bb931b2278aac81838d05ba72e3` at 844 × 420: arena bottom 357 px,
  touch-pad bottom 358 px, and Pause/Resume bottom 186 px, all visible together.
  Native Mode Home/ArrowDown/End retained focus; play focuses the arena and the
  visible Pause/Resume control remains usable. [Landscape screenshot](evidence/ux-2026-10-07/fighter-after-landscape.png).
- [Final runtime CI](https://github.com/generalgroovy/smash/actions/runs/37605167218)
  passes all 65 tests at `78588aa2`. This documentation/evidence update does not
  change runtime. Source review and root rendered checks are complete; parent
  owns main promotion and public-byte verification.

## Limits

Software and rendered-browser checks do not establish competitive balance,
physical keyboard rollover/touch ergonomics, subjective fun, audio quality or
child usability. Matches remain in memory and refresh discards the current one.
Parent owns main promotion and public-byte verification.
