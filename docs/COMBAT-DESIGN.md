# Combat design

The September 2026 update replaces the instant repeated punch with a small,
coherent platform-fighter ruleset. Nova and Ember share their moves and physics;
there are no character-specific stats to learn before playing.

## Decisions and counterplay

| Role | Options | Tradeoff |
|---|---|---|
| Start pressure | Jab, side slash, sweep, dash strike | Quick moves do less knockback; a running strike commits farther. |
| Convert upward | Rising palm, jump, Sky arc | A verified low-percent route rewards spacing and a deliberate follow-up. |
| Air spacing | Orbit, forward slash, back kick | Facing remains stable in the air so backward attacks are intentional. |
| Edge guard | Meteor heel | Downward launch, slower startup and larger landing recovery. |
| Close a stock | Three charged ground strongs | More damage and launch for more exposed charge time and recovery. |
| Change pace | Bolt, burst, recovery, repulse | Cooldowns, startup and one-use aerial resources limit repetition. |
| Escape or counter | Parry, roll, air dodge, landing tech | Brief protection is followed by vulnerable recovery. |

Movement offers short hops, double jumps, directional influence, platform drops,
fast falls and an air-dodge landing slide. Side burst follows the requested
direction even when facing away; light aerials retain facing for back kicks.
Attack selection and jump/drop intent survive a short input buffer. A buffered
tap jump remains a short hop rather than becoming an accidental full jump.

Hit contacts are collected before resolution so simultaneous attacks can trade.
Each swing can hit a fighter only once. A projectile also disappears after its
hit. Damage increases knockback; brief hitstop and impact feedback make contact
readable. The last three landed moves apply a small repeated-move penalty.
Stocks include top, side and lower blast zones. Respawn protection ends on attack.

The October practice pass distinguishes a continuous combo from renewed pressure:
another hit counts only while the defender is still in hitstun. The short HUD
display grace period never extends that connection window. Damage, knockback,
attack timings, buffers, stages and CPU tuning are otherwise unchanged.

Practice exposes one focus at a time. Combos starts at zero damage, with a target
that buffers the existing directional dodge near the end of hitstun. It has the
same startup and one-use aerial dodge as a player; it can be hit again during
dodge recovery. This is an escape test, not a claim of universal combo coverage:
directional influence, other defensive choices and different starting percentages
still matter in a match. The two edge drills start symmetrically with one jump;
normal landing restores jump, recovery and dodge. A failed return restores that
edge setup. No drill option can change a regular match into Practice.

The CPU uses delayed visible observations, deterministic decisions, ordinary
input and the same physics. Easy/normal/hard changes reactions and mistakes;
there are no damage bonuses. Automated bouts cover both stages, all difficulties,
recoveries from both edges and active CPU-versus-CPU matches. They establish that
the opponent functions and matches can finish, not that difficulty is perfectly
calibrated for every player.

## Inspiration and sources

These are original implementations and artwork. Melee and Rivals inform the
design vocabulary; no character, stage, animation or code was copied.

- [Rivals official attack names](https://rivalsofaether.com/attack-names/): the
  distinction between grounded attacks, directional aerials, strongs and specials.
- [Rivals player variables](https://rivalsofaether.com/player-variables/): explicit
  hitpause, attack states, landing/air resources and short-hop movement concepts.
- [Rivals balance patch 2.1.2.0](https://rivalsofaether.com/rivals-of-aether-balance-patch-2-1-2-0/):
  designer notes about attack commitment, recovery counterplay and readable hits.
- [Nintendo's official attack guide](https://www.smashbros.com/wiiu-3ds/sp/en-au/howto/entry3.html):
  directional inputs and the different roles of normal and special attacks.

The references support broad mechanics and tradeoffs. Our timings, hitboxes,
charge scale, CPU behavior and stage dimensions are independently tuned for this
small browser game; this is not a reproduction of either game's engine or balance.

## Boundaries

Local keyboard play, P1 touch controls, two stages, a shared moveset and CPU are
supported. There is no netcode, gamepad binding, roster or persistent progression.
Physical touch/keyboard ergonomics and human-versus-human balance need real play.
Keep useful combat choices and visible counterplay ahead of adding more moves.
