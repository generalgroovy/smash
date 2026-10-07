# Platform Fighter — an optional route through practice

Baseline: `0cc25935b29407128ba375f71ff2eef604f4deac`, clean and matching upstream main on 7 October 2026. Candidate branch: `codex/ux-flow-2026-10-07`.

First steps previously ended in an unmarked free-practice prompt. The existing combo and edge-recovery drills were independent dropdown choices without an onward route after success. This change reuses the First steps button as an optional next-goal action after an earned achievement.

The route is First steps → Combos → Left edge → Right edge → Easy CPU. First steps completes when the existing engine reaches its sixth action, Combos when its best actual chain reaches two hits, and recovery when the engine records landing. Goal met appears without pausing or stealing focus. Existing combo damage/escape feedback, recovery explanations and offstage resource advice remain visible. Once earned, the next action remains available during free practice until Retry or a setup change.

Choosing the next goal clears held inputs, preserves the selected stage, prepares the new drill and focuses Start practice. The final transition prepares an Easy CPU match and focuses Play CPU. Neither transition starts movement automatically. Manual Focus selection, Retry, unlimited practice stocks, native setup controls, keyboard/touch input and all game mechanics remain available. `combat.js` and `cpu.js` are unchanged.

Owner validation: `node --test tests/*.test.cjs` passes **70 tests**, zero failed/skipped. Five new integration tests verify earned completion, no unsolicited focus/pause change, route thresholds, stage and input preservation, ready-state transitions, optional free practice, retry/setup reset and regular-match isolation. Existing deterministic tests separately verify real landed attacks, true combos and recovery completion on both stages. Script syntax and diff checks pass; runtime asset revisions are updated.

A CI-only composed-browser harness checks the route at 1366 × 900, 390 × 844, 320 × 740 and 844 × 420. It uses engine-result fixtures to reach each goal and real keyboard input for the final basics dodge; its checks are UI acceptance, not a claim that a novice completed all drills. It also checks focused ready-state transitions, complete landscape control visibility, errors/overflow and complete goal-state captures. CI, independent review and root rendering/publication remain separate gates at this initial handoff.

Intended URL: [Platform Fighter](https://generalgroovy.github.io/smash/). Candidate push is not publication. No new production dependency or saved data is introduced. Tests do not establish subjective fun, competitive balance, physical-device input ergonomics, audio quality or human learning outcomes.
