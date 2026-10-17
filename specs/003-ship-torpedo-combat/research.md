# Research: Ship Torpedo Combat

## Scope and evidence

Reviewed the current TypeScript/Phaser application, movement domain and animation ports, board geometry, application replacement lifecycle, test patterns, and project constitution. A research agent independently inspected integration boundaries. No application changes or gameplay acceptance tests are performed during planning.

All technical-context questions are resolved by the decisions below. No additional runtime dependencies are required.

## 1. Battle ownership and movement reuse

**Decision:** Introduce `ship-combat` with a `BattleSession` as the sole battle-turn authority. Compose existing `Reachability`, `BoardSnapshot`, `BoardView`, `BoardGeometry`, `FlightAnimator`, `PhaserFlightAnimator`, and `SpaceFlightPath`. Extract the existing `PendingMove` interface from `TurnSession.ts` into a movement-owned contract file and re-export it for compatibility.

**Rationale:** `TurnSession.completeMove()` and `acknowledgePass()` hand off immediately; combat must retain the player until attack completion or End turn. `MovementGame` copies only movement fields, so reconstructing combat ships through it would silently discard strength, constitution, and HP. A separate immutable `CombatGame` implements the same board shape and preserves all fields through updates. The existing `PendingMove` shape already contains exactly the flight data the animator needs.

**Alternatives considered:** Add combat branches to the movement-only session (couples independent mechanics and old mode semantics); compose two live turn sessions (competing authorities); rewrite reachability/ship flight (unnecessary regression risk).

## 2. Shared ability-score rules

**Decision:** Add a focused `ship-stats` capability with an immutable `AbilityStat` validating integer scores 8–20 and deriving `floor((score - 10) / 2)`. Preserve `AgilityStat`'s public score/modifier/movementAllowance interface using composition of `AbilityStat`. Combat strength and constitution use `AbilityStat` directly.

**Rationale:** Movement and combat are explicit consumers of the same scoring rule; this meets the constitution's shared-capability requirement without duplicating modifier tables or treating strength as a subtype of agility. Existing `instanceof AgilityStat` checks stay valid.

**Alternatives considered:** Three independent mappings (can drift); subclassing agility for combat stats (incorrect substitutability); moving unrelated game data into a generic shared directory (weak feature cohesion).

## 3. Initialization and randomness

**Decision:** Compose `GameSetupFactory` for positions and reuse `RandomSource`/`MathRandomSource`. Add combat-owned `DiceRoller` for validated inclusive integer rolls. Factory draw order: two existing position draws, then agility, strength, constitution, HP roll for Ship 1, then the same four draws for Ship 2. Attack draws are d20, followed by d8 only on a hit. No random draws on invalid input or End turn.

**Rationale:** Equal-width bucket mapping `min + floor(sample * (max - min + 1))` on validated finite samples in [0,1) preserves inclusive ranges, supports deterministic fixtures, and requires no service. Starting HP is `max(1, hpRoll + 2 * constitution.modifier)`; armor class is literal 12. Build a complete replacement before publishing it so failed generation cannot corrupt the current battle.

**Alternatives considered:** Randomizing in the renderer (untestable/domain coupling); rerolling low HP (contradicts clarification); new random-number package or server (unneeded).

## 4. Resolve once, present, then commit

**Decision:** Roll once when a valid attack begins and retain an immutable pending outcome. Commit damage, last-result display, and handoff/victory exactly once at animation completion. The pending identity combines game revision, turn token, and attack ID. Movement retains the existing equivalent move identity. Replacement invalidates identities before cancelling visuals.

**Rationale:** Outcome must be known to select the hit/miss path, but HP should change at the visible impact/outcome rather than launch. Session-owned outcomes prevent callbacks from choosing damage. Revision and action checks reject stale, duplicate, and synchronous callbacks safely. Lethal damage transitions directly to finished without a playable opponent turn.

**Alternatives considered:** Apply HP at launch (reveals result before visible contact); roll at contact (cannot select a predetermined miss path); allow cancelled attacks to reroll in the same battle (changes an already committed attack).

## 5. Projectile geometry and timing

**Decision:** Use procedural Phaser star and explosion shapes in a combat-owned animator driven by one normalized finite tween. Target nominal duration: 850 ms flight plus 300 ms explosion for hits; 1,150 ms total travel for misses, leaving margin under the 1,500 ms launch-to-result-and-ready deadline. Travel duration is independent of distance. Use a two-cycle-per-second alpha pulse for the blinking star and dispose all transient shapes/tweens on completion or cancellation.

Hit path is the direct center-to-center segment. Miss path is a straight near-miss ray from the attacker, tangent to a clearance circle around the defender, then extended beyond the board expanded by projectile radius. At the 600 px logical board size, defender envelope radius is 24 px; use a 3 px projectile radius and 1 px clearance, giving 28 px closest approach. Scale these distances with cell size. Choose deterministically between the two tangent rays; validate that closest approach is inside the board and occurs before the off-board exit. The 28 px clearance circle fits within the defender's square even at a corner (center inset 30 px). The entire star must exit, not merely its center.

**Rationale:** Existing ship flight deliberately avoids contact and stays on-board, so it is unsuitable for torpedoes. Tangent geometry guarantees a close miss without accidentally intersecting an adjacent or edge defender. Pure path geometry can be tested independently of Phaser. A fixed short duration avoids long shots violating the deadline.

**Alternatives considered:** Offset the target and draw an arbitrary segment (can still hit the defender); reuse `SpaceFlightPath` (wrong bounds/contact rules); distance-proportional timing (maximum separation exceeds deadline); assets/particle packages (not needed).

## 6. Failures, restart, and presentation readiness

**Decision:** Retain the application's staged New Game and matching postrender readiness protocol. Cancel both animators and clear effects on replacement/disposal. Movement failures roll back the visual origin and reopen movement. For an attack-animation startup/runtime failure, clean up visuals, publish a readable presentation error, and commit the same stored attack outcome once; do not offer a reroll. Deliberate replacement/disposal cancellation never commits the old outcome.

**Rationale:** Existing tests cover generation failures, queued replacement, stale callbacks, and synchronous animator callbacks. The new controller must retain those protections. Domain combat must not get stuck because a cosmetic effect failed.

**Alternatives considered:** Restart the Phaser scene (existing disposal semantics disallow restart); resume the old attack after New Game (stale mutation); reroll on effect failure (unfair); wait forever for a failed tween (turn lock).

## 7. UI and validation approach

**Decision:** Use the existing native DOM HUD pattern for stats, active phase, Skip movement, End turn, results, and winner. Keep canvas left-click selection, native keyboard-operable buttons, text outcome announcements, and a single scene input router. No new keyboard-grid navigation or localization system is introduced by this design.

**Rationale:** This preserves existing interaction conventions while making optional attacks explicit. Deterministic Vitest tests exercise domain/ports; a new development-only actual-Phaser fixture proves paths, effects, timing, and rendering. Record constitution-required red-green-refactor evidence during implementation.

**Alternatives considered:** Canvas-only controls (loses existing native control semantics); random gameplay as the sole verification method (cannot reliably prove boundaries); mocked tweens as timing acceptance (do not establish visible behavior).

## Constitution review

Pre-research gate: pass, using feature-local ownership, strict contracts, composition, and planned test-first implementation. Post-design gate: pass; the only inheritance is Phaser-required scene integration. No constitution exception or amendment is needed. Tests and visual/timing acceptance remain future implementation evidence, not claims made by this research.
