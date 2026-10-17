---
description: 'Executable implementation tasks for Ship Torpedo Combat'
---

# Tasks: Ship Torpedo Combat

**Input**: Design documents from `specs/003-ship-torpedo-combat/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [UI contract](contracts/combat-ui.md), [quickstart.md](quickstart.md), and `.specify/memory/constitution.md`.

**Tests**: Included because the project constitution requires red-green-refactor for every feature and the approved plan requires deterministic and browser acceptance coverage. For each implementation task, run its preceding demonstrating test and observe the expected behavioral failure first. Minimal compilable contracts may be introduced to make tests executable; import/setup/compiler failures are not red evidence. Record red, green, and refactor commands/results in `specs/003-ship-torpedo-combat/development.md` throughout implementation.

**Organization**: All three stories are P1; preserve specification order. US1 is the setup/stats MVP. US2 is independently testable with injected attack outcomes and controlled animation ports; US3 supplies actual dice resolution and Phaser effects. Full playable combat requires all three stories.

## Format: `[ID] [P?] [Story] Description`

- `[P]` identifies disjoint-file work that can run alongside other marked tasks in its phase once the explicitly stated predecessors are complete. It does not waive test-first or phase gates.
- `[US1]`, `[US2]`, `[US3]` map to the corresponding specification stories. Setup, foundation, and polish tasks have no story label.
- All paths are repository-relative. Existing TypeScript, Phaser, Vite, Vitest, lint, and formatting infrastructure is retained; no package installation or new framework is required.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish verification evidence and deterministic support without changing gameplay.

- [x] T001 Record the Node 24/npm 11 environment, current `npm test`, `npm run typecheck`, and `npm run build` baseline and per-slice red-green-refactor evidence format in `specs/003-ship-torpedo-combat/development.md`; inspect `package.json` and `vitest.config.ts` to confirm feature-local discovery without changing working infrastructure.
- [x] T002 Create combat-local scripted randomness and DOM test support in `src/features/ship-combat/tests/fixtures/ScriptedRandomSource.ts` and `src/features/ship-combat/tests/fixtures/FakeDom.ts`, reusing existing fixture patterns and adding exact draw-count inspection and the stats/phase/result/button selectors required by `specs/003-ship-torpedo-combat/contracts/combat-ui.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provide shared score rules, dice primitives, and movement animation contracts before story implementation.

**Gate**: All foundation tasks must pass before US1. T003 and T004 may proceed together after T002; their implementations follow their own red tests.

- [x] T003 [P] Add and run behavioral tests in `src/features/ship-stats/tests/ability-stat.test.ts` and extend `src/features/ship-movement/tests/agility.test.ts` for the constraints “Integer 8–20 inclusive”, “Derived integer `floor((score - 10) / 2)`, range −1 to +5”, and `movementAllowance = max(0, modifier)`; exhaust all 13 scores, invalid/fractional values, immutability, and preserved `AgilityStat` compatibility.
- [x] T004 [P] Add and run dice boundary/invalid-input tests in `src/features/ship-combat/tests/dice-roller.test.ts` using scripted samples: finite [0,1) input, inclusive 8–20, 0–20, 1–20, and 1–8 outputs, exact bucket boundaries, and invalid bounds/samples rejected without publishing state.
- [x] T005 Implement immutable `AbilityStat` in `src/features/ship-stats/domain/AbilityStat.ts` and refactor `src/features/ship-movement/domain/AgilityStat.ts` to compose it while retaining public score/modifier/allowance and existing `instanceof AgilityStat` behavior; run T003 tests green and affected movement regressions.
- [x] T006 Implement `DiceRoller` in `src/features/ship-combat/domain/DiceRoller.ts` using injected `src/features/game-setup/domain/RandomSource.ts`, validated samples, and `min + floor(sample * (max - min + 1))`; run T004 tests green without adding a dependency or renderer randomness.
- [x] T007 Extract the existing `PendingMove` interface into `src/features/ship-movement/domain/PendingMove.ts`, re-export it from `src/features/ship-movement/domain/TurnSession.ts`, and update imports in `src/features/ship-movement/presentation/FlightAnimator.ts` and `src/features/ship-movement/presentation/PhaserFlightAnimator.ts`; preserve revision/token/move ID, ship identity, origin, destination, other ship position, and `LegalRoute` without changing movement-only session semantics.
- [x] T008 Run the targeted stats, dice, movement, board, and setup tests plus typecheck against `src/features/ship-stats/tests`, `src/features/ship-combat/tests/dice-roller.test.ts`, `src/features/ship-movement/tests`, `src/features/board/tests`, and `src/features/game-setup/tests`; record passing foundation evidence and shared-capability consumers in `specs/003-ship-torpedo-combat/development.md`.

**Checkpoint**: Shared stats and deterministic dice are verified; existing board, placement, and movement behavior remains intact.

---

## Phase 3: User Story 1 — Prepare Ships for Battle (Priority: P1) — MVP

**Goal**: Initialize two complete combat ships and visibly distinguish their scores, modifiers, HP, and armor class.

**Independent Test**: Use known-roll battle setup and a browser preview to inspect both ships' board positions and visible stats, confirm HP formula/floor and AC 12, and reset to a fresh setup without requiring turn or attack logic.

### Tests for User Story 1

T009–T011 can be authored/run independently after Phase 2; all must demonstrate missing behavior before their corresponding implementation.

- [x] T009 [P] [US1] Add and run immutable ship/game tests in `src/features/ship-combat/tests/combat-game.test.ts` for the field constraints in `data-model.md`: identity “ship-1 or ship-2”, owner “player-1 or player-2, matching ship suffix”, position “Validated `BoardPosition`, rows/columns 1–10”, agility “`AgilityStat`”, strength/constitution “`AbilityStat`”, armorClass “Literal 12”, startingHitPoints “Integer 1–30; immutable for the battle”, and hitPoints “Integer 0–startingHitPoints”; cover distinct placements, frozen snapshots, and position/damage updates preserving all other fields.
- [x] T010 [P] [US1] Add and run factory tests in `src/features/ship-combat/tests/combat-game-factory.test.ts` for independent equal-width stat draws, opposing zones, ten-draw ordering, HP endpoints and `max(1, hpRoll + 2 * constitution.modifier)` without rerolls, AC 12, repeated valid setups, and invalid draws rejecting a replacement before publication.
- [x] T011 [P] [US1] Add and run stats-display contract tests in `src/features/ship-combat/tests/combat-stats-controls.test.ts` for `CombatControls.renderShips(game)`: both identities/owners, separately labeled scores/signed modifiers, current HP and AC, unchanged values on repeat render, and refreshed values on replacement.

### Implementation for User Story 1

- [x] T012 [US1] Implement frozen `CombatShip` records and immutable `CombatGame` in `src/features/ship-combat/domain/CombatGame.ts` with exactly the T009 constraints, literal 10 rows/columns and structural `BoardSnapshot` compatibility; implement `withPosition` and `withDamage`, require nonnegative integer damage, clamp HP at zero, and retain all combat fields instead of reconstructing through `MovementGame`; make T009 green.
- [x] T013 [US1] Implement `CombatGameFactory` in `src/features/ship-combat/domain/CombatGameFactory.ts` composing existing `GameSetupFactory` and `DiceRoller`; draw the two positions first, then agility/strength/constitution/HP for ship-1 and ship-2, set starting/current HP identically, and preserve existing opposing-zone rules; make T010 green after T012.
- [x] T014 [US1] Implement the independently usable stats-rendering portion of `CombatControls` in `src/features/ship-combat/presentation/CombatControls.ts` and combat stat layout in `src/app/styles.css`; preserve native DOM semantics, text labels, and idempotent disposal; make T011 green after T012 without depending on a battle session.
- [x] T015 [US1] Add the initial browser setup/stats preview in `src/features/ship-combat/tests/browser/fixture.html` and `src/features/ship-combat/tests/browser/fixture.ts` using `CombatGameFactory`, `BoardView`, and `CombatControls.renderShips`; provide deterministic presets/reset using production components; the fixture must never be imported by the production entry and must not add a production stat editor, with later tasks upgrading this same fixture to the production combat scene.
- [x] T016 [US1] Extend and run `src/features/ship-combat/tests/combat-game-factory.test.ts` for 100 known-roll setups and 1,000 deterministic setups covering every valid stat bucket, matching modifiers, HP bounds/floor, and independent draw scheduling; review equal-probability mapping rather than treating the sample as proof of fairness.
- [ ] T017 [US1] Validate the setup preview and targeted tests using `specs/003-ship-torpedo-combat/quickstart.md`, recording SC-001/SC-002/SC-008 evidence in `specs/003-ship-torpedo-combat/development.md`; confirm all starting stats remain stable until a fresh setup and both ships' displayed values match their actual state. (Automated tests and fixture HTTP transformation passed; visual browser validation is pending because no browser executable is available.)

**Checkpoint**: The US1 MVP is a demonstrable battle setup with complete visible stats. Actual combat is delivered by US2/US3, not implied by this checkpoint.

---

## Phase 4: User Story 2 — Move and Take a Combat Turn (Priority: P1)

**Goal**: Enforce movement followed by an optional single attack, including explicit immobility acknowledgement and End turn, with one turn authority.

**Independent Test**: With validated combat ships, injected scripted attack outcomes, and controlled flight/torpedo adapters, complete moves, movement skips, attacks, and End turn choices. Verify the same player reaches attack-ready and only an attack completion or explicit End turn hands off. Real dice and production torpedo visuals are not required for these coordinator tests.

### Contracts and tests for User Story 2

- [ ] T018 [US2] Define readonly `AttackOutcome` hit/miss records and an injectable `AttackResolution` interface in `src/features/ship-combat/domain/AttackResolver.ts`, plus the `TorpedoAnimator`/cancellable handle contract in `src/features/ship-combat/presentation/TorpedoAnimator.ts`; quote/enforce “Different `ShipIdentity` values”, attackDie “Integer 1–20”, strengthModifier “Attacker's modifier, −1 to +5”, armorClass “12”, hit damageDie “Integer 1–8” and damage “damageDie + strengthModifier, range 0–13”, miss damage fields “Absent”, and before/after HP as “Equal defender HP” on misses or “Before HP and max(0, before − damage)” on hits. Declare types/ports only here; production rolling belongs to T035.
- [ ] T019 [P] [US2] Add and run session behavior tests in `src/features/ship-combat/tests/battle-session.test.ts` after T018: Player 1 starts, legal movement/arrival retains player/token, immobility requires explicit skip, End turn only in attack-ready consumes no randomness/HP, invalid targets and repeated completion are ignored, 50 alternating turns work, and positive safe-integer revision/token and safe-integer action-counter overflow are rejected before publication. Include session-level tests using injected hit outcomes for exact lethal damage and overkill: HP remains unchanged while the attack is pending; matching completion clamps HP to zero, declares the attacker the winner, and enters finished without a playable opponent turn; further gameplay commands and duplicate completions leave the final state unchanged. Observe these failures before T022 implements the transitions.
- [ ] T020 [P] [US2] Add and run phase/button contract tests in `src/features/ship-combat/tests/combat-turn-controls.test.ts` after T018 for Skip movement only when immobile, End turn only attack-ready, correct active player/phase instructions, live textual status, native focus/activation, and obsolete handler/listener removal on render/dispose.
- [ ] T021 [P] [US2] Add and run controller tests in `src/features/ship-combat/tests/combat-controller.test.ts` after T018 using typed injected doubles for phase-aware left-click routing, movement-only highlights, ignored non-left/empty/self/out-of-board targets, no extra actions during animation, stale callback rejection, and no input before matching board readiness.

### Implementation for User Story 2

- [ ] T022 [US2] Implement `BattleSession` in `src/features/ship-combat/domain/BattleSession.ts` composing `Reachability` and `AttackResolution`; use the exact phase variants “movement-ready”, “awaiting-movement-skip”, “moving”, “attack-ready”, “attacking”, “finished”, and “disposed” and the `data-model.md` transition table. Carry game/revision/token/active identities and “last completed attack result or null”, retain `PendingMove`, and store `PendingAttack` revision/token/attack ID/positions/immutable outcome with HP unchanged while pending. Implement identity-gated commands, counter validation, replacement and disposal; make T019 green.
- [ ] T023 [US2] Extend `src/features/ship-combat/presentation/CombatControls.ts` to render battle-phase snapshots alongside `renderShips`, wire explicit Skip movement/End turn handlers capturing revision/token, and clear old handlers on each render/dispose; make T020 green after T022 while preserving US1 stats tests.
- [ ] T024 [US2] Implement `src/features/ship-combat/tests/fixtures/ControlledTorpedoAnimator.ts` for the T018 port and use the existing controlled-flight fixture from `src/features/ship-movement/tests/fixtures/ControlledFlightAnimator.ts`; expose explicit completion/failure/cancel and synchronous-callback modes for the controller tests without adding a fake animator to production.
- [ ] T025 [US2] Implement `CombatController` in `src/features/ship-combat/presentation/CombatController.ts` composing session, board view/geometry, flight and injected torpedo ports, and controls; map opponent-cell clicks, remove highlights outside movement-ready, commit exact movement arrival before opening attack-ready, and gate all callbacks/inputs by readiness/revision/token/action ID; make T021 green after T022–T024.
- [ ] T026 [US2] Add and run scene lifecycle tests in `src/features/ship-combat/tests/combat-scene.test.ts` for one pointer listener set, matching postrender readiness, resize/world-coordinate targeting, cancelled effects on update/dispose, idempotent disposal, and rejection of stale readiness callbacks.
- [ ] T027 [US2] Implement thin `CombatScene` in `src/features/ship-combat/presentation/CombatScene.ts`, composing existing `BoardGeometry`, `BoardView`, and `PhaserFlightAnimator` with the combat controller and injected torpedo adapter; justify `extends Phaser.Scene` as required framework integration, avoid a live `TurnSession` or scene restart, and make T026 green.
- [ ] T028 [US2] Extend and run lifecycle recovery tests in `src/features/ship-combat/tests/combat-controller.test.ts` and `src/features/ship-combat/tests/battle-session.test.ts` for synchronous start/completion, movement startup/runtime failure restoring origin without handoff, attack failure committing the same stored outcome once, and stale/duplicate callbacks after New Game, recovery, and disposal. Verify FR-019: startup/runtime attack failure removes effects, reports the error and retained result, and opens the next turn or shows the winner within 1,500 ms of launch without rerolling; replacement/disposal cancellation never commits the old outcome.
- [ ] T029 [US2] Complete recovery/cancellation handling in `src/features/ship-combat/presentation/CombatController.ts` and `src/features/ship-combat/domain/BattleSession.ts` so replacement invalidates identities before visual cancellation, movement failure reopens movement, current attack failure removes effects, reports an error, and commits/displays the retained outcome without reroll within the FR-019 deadline, and old cancellation never mutates a new battle; make T028 green.
- [ ] T030 [US2] Run the controlled end-to-end turn scenarios and all affected movement/board regressions for `src/features/ship-combat/tests/battle-session.test.ts`, `src/features/ship-combat/tests/combat-controller.test.ts`, and `src/features/ship-combat/tests/combat-scene.test.ts`; record SC-003 and optional-attack/immobility evidence in `specs/003-ship-torpedo-combat/development.md`.

**Checkpoint**: Turn sequencing is independently verified through controlled ports. US3 replaces scripted outcomes/effects with production resolution/animation and wires normal browser play.

---

## Phase 5: User Story 3 — Resolve and See a Torpedo Attack (Priority: P1)

**Goal**: Launch real deterministic-rule attacks, animate hit/miss outcomes, apply damage once, declare the winner, and integrate the playable battle.

**Independent Test**: Preset known d20/d8 rolls through the production scene and perform movement/skip then opponent selection. Check attack totals, contact/explosion or off-board near miss, resulting HP, victory, and the launch-to-result-and-next-turn/winner deadline.

### Tests for User Story 3

T031–T034 can proceed in parallel after US2 contracts are available; implement each corresponding behavior only after its expected red result.

- [ ] T031 [P] [US3] Add and run resolver tests in `src/features/ship-combat/tests/attack-resolver.test.ts` for at least 100 controlled attacks, total 11 miss/12 hit, all strength modifiers, d20/d8 endpoints, no special natural-1/20 rules, zero damage, exact lethal/overkill clamp, d8 consumption only on hit, and no battle mutation on an invalid sample.
- [ ] T032 [P] [US3] Add and run analytical path tests in `src/features/ship-combat/tests/torpedo-path.test.ts` for exact hit endpoints and near-miss segment clearance/closest approach/full exit across adjacent, row/column, diagonal, edge/corner, and maximum-separation positions; verify scaled geometry and allow off-board `BoardPoint` endpoints without creating invalid `BoardPosition` values.
- [ ] T033 [P] [US3] Add and run Phaser adapter tests in `src/features/ship-combat/tests/torpedo-animator.test.ts` for finite tween timing, star alpha blinking, contact-before-explosion, full off-board removal on misses, once-only completion, startup/runtime failures, resource destruction, idempotent cancel, and callback identities using the T018 contract.
- [ ] T034 [P] [US3] Add and run result/winner integration contract tests in `src/features/ship-combat/tests/combat-result-controls.test.ts` and `src/features/ship-combat/tests/combat-attack-integration.test.ts`: retain a hidden pending outcome until completion, then display total/hit/miss and hit damage/remaining HP; retain last result through the next turn; lethal hit enters finished with winner and zero actionable controls; New Game clears all prior results.

### Implementation for User Story 3

- [ ] T035 [US3] Implement the `AttackResolver` class against its existing interface in `src/features/ship-combat/domain/AttackResolver.ts`, composing `DiceRoller` and preserving all T018 hit/miss field constraints; use d20 + strength against AC 12, d8 + strength only on a hit, zero-minimum damage and HP clamp, and make T031 green with no renderer-owned randomness.
- [ ] T036 [US3] Implement pure `TorpedoPath` geometry in `src/features/ship-combat/presentation/TorpedoPath.ts`: direct hit segment or deterministic tangent ray to defender clearance radius 24 + 3 + 1 = 28 px at 60 px cells, scaled with geometry; require closest approach on-board before exit and extend the ray beyond the board expanded by projectile radius; make T032 green using continuous geometry checks.
- [ ] T037 [US3] Implement `PhaserTorpedoAnimator` in `src/features/ship-combat/presentation/PhaserTorpedoAnimator.ts` after T036 using one finite normalized tween, procedural 3 px-radius star, two-cycle-per-second alpha pulse, 850 ms hit travel + 300 ms explosion or 1,150 ms miss travel, and complete cleanup/cancel/error handling; make T033 green and reserve margin below the 1,500 ms full-outcome deadline.
- [ ] T038 [US3] Extend `src/features/ship-combat/presentation/CombatControls.ts` and `src/app/styles.css` for persistent completed result text, rolled damage versus remaining HP, zero-damage hits, and winner display with native/live status semantics; make the T034 controls tests green without showing the precomputed result at launch.
- [ ] T039 [US3] Integrate production resolver and torpedo animator dependencies with `src/features/ship-combat/domain/BattleSession.ts`, `src/features/ship-combat/presentation/CombatController.ts`, and `src/features/ship-combat/presentation/CombatScene.ts`; ensure one completion commits stored HP/result and opens one next turn or winner, and make T034 integration tests green after T035/T037/T038.
- [ ] T040 [US3] Add and run application composition tests in `src/features/ship-combat/tests/game-application.test.ts` and update affected mocks/expectations in `src/features/ship-movement/tests/game-application.test.ts` and `src/features/game-setup/tests/game-application.test.ts` for combat startup, ten initialization draws, generation failure retaining the old battle, serialized replacements, matching readiness, and one canvas/listener set; retain original movement-only domain tests.
- [ ] T041 [US3] Switch `src/app/GameApplication.ts` to compose `CombatGameFactory`, `BattleSession`, `CombatScene`, and `CombatControls` with shared runtime randomness and existing setup shell; preserve New Game queue/readiness/startup errors and use explicit Skip movement/End turn handlers; make T040 green after T039.
- [ ] T042 [US3] Upgrade `src/features/ship-combat/tests/browser/fixture.html` and `src/features/ship-combat/tests/browser/fixture.ts` to the production combat scene/controller/session/animators with preset threshold hit/miss, zero damage, lethal/overkill, adjacency, all corners, maximum separation, immobility, and reset interruptions; record revision/attack-keyed launch, contact/exit, completion, rendered result, actionable frame, and winner timestamps; the fixture imports production components but must never be imported by the production entry.
- [ ] T043 [US3] Extend `src/features/ship-combat/tests/combat-attack-integration.test.ts` and `src/features/ship-combat/tests/game-application.test.ts` with full replacement-during-projectile/explosion, disposed/synchronous/duplicate callbacks, no pre-impact HP mutation, terminal input lock, attack failure without reroll, and both-immobile explicit skip/End turn cases; run green and retain regressions.
- [ ] T044 [US3] Run targeted resolver/path/adapter/integration tests and perform deterministic browser hit/miss/lethal smoke checks using `src/features/ship-combat/tests/browser/fixture.html`; record SC-004/SC-006 correctness and pending broader visual/timing acceptance in `specs/003-ship-torpedo-combat/development.md`.
- [ ] T045 [US3] Validate normal playable turns, End turn, victory, and New Game on the production entry at `src/main.ts` using `specs/003-ship-torpedo-combat/quickstart.md`; record results in `specs/003-ship-torpedo-combat/development.md` and confirm the test-only fixture is not imported into the production application.

**Checkpoint**: All three user stories are integrated; numerical and lifecycle tests pass, and production combat is available for final measured acceptance.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete reference-browser acceptance, regression checks, and delivery evidence across all stories.

- [ ] T046 Review/refactor changed code under `src/features/ship-stats`, `src/features/ship-combat`, `src/features/ship-movement`, and `src/app/GameApplication.ts` for feature cohesion, specific readonly/discriminated contracts, composition, complete state preservation, and Phaser-only inheritance; rerun affected tests and record the constitution review in `specs/003-ship-torpedo-combat/development.md`.
- [ ] T047 Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, and `npm run build` from `package.json`, fix any regressions through test-first behavior changes, and record exact commands/results in `specs/003-ship-torpedo-combat/development.md`.
- [ ] T048 Execute `specs/003-ship-torpedo-combat/quickstart.md` browser validation using `src/features/ship-combat/tests/browser/fixture.html`: record the reference environment and at least 20 individual attacks covering hit/miss, adjacency, maximum distance, corners, and lethal hits; verify every full effect/result/actionable-next-turn-or-winner frame is ≤1,500 ms, no contact on misses, no duplicate changes, preserved movement/highlight timing, resize targeting, restart interruption, and production `npm run preview` smoke results in `specs/003-ship-torpedo-combat/development.md`.
- [ ] T049 Run five first-time-player trials from `specs/003-ship-torpedo-combat/quickstart.md`, require at least four players to identify both HP values, move legally, launch an attack, and identify the outcome without assistance, and record SC-007 observations plus native button keyboard/live-status checks in `specs/003-ship-torpedo-combat/development.md`.
- [ ] T050 Update `README.md` for move/Skip movement, optional attack/End turn, combat stats, victory and New Game; reconcile runnable instructions in `specs/003-ship-torpedo-combat/quickstart.md` and finalize `specs/003-ship-torpedo-combat/development.md` with acceptance evidence or explicit outstanding browser/usability checks, without claiming unexecuted checks passed.

---

## Dependencies & Execution Order

### Phase and story dependency graph

```text
Phase 1: T001–T002
        |
Phase 2: T003–T008
        |
US1 / Phase 3: T009–T017  -> independently demonstrable setup/stats MVP
        |
US2 / Phase 4: T018–T030  -> independently verified sequencing via injected ports
        |
US3 / Phase 5: T031–T045  -> actual dice/effects + playable application
        |
Phase 6: T046–T050       -> final regression, browser and usability evidence
```

US2 depends on US1's complete ships and stats display. US3 depends on US2's phase/animator contracts and orchestration. These are explicit domain dependencies, not a claim that all stories can be implemented concurrently. Tests for each story isolate its behavior with deterministic dependencies.

### Detailed execution edges

- T001 → T002 → foundation. T003 → T005; T004 → T006. T007 may follow those refactors; T008 gates every story.
- US1: T009 → T012; T010 + T012 → T013; T011 + T012 → T014; T013 + T014 → T015; T013 → T016; T015 + T016 → T017.
- US2: T018 → T019/T020/T021. T019 → T022; T020 + T022 → T023; T018 → T024; T021 + T022/T023/T024 → T025; T025 → T026 → T027; T025/T027 → T028 → T029 → T030.
- US3: T031 → T035; T032 → T036; T033 + T036 → T037; T034 → T038. T035/T037/T038 → T039; T039 → T040 → T041; T041 → T042; T041 → T043; T042/T043 → T044 → T045.
- All story checkpoints → T046 → T047 → T048 → T049 → T050. Fixes after final verification require repeating affected checks.

### Parallel opportunities

There are **12 marked parallel tasks**: T003/T004, T009/T010/T011, T019/T020/T021, and T031/T032/T033/T034. Each group edits distinct test files and has its phase's prerequisites satisfied. Shared evidence-log updates must be serialized or merged by one owner. Paired implementation tasks remain gated by their own observed red results.

Other independently ready implementation files may be handled concurrently after their precise prerequisites, but this list does not mark shared-file controller/HUD/session/app work as parallel. Do not run overlapping changes to `CombatControls.ts`, `BattleSession.ts`, browser fixtures, or the development record concurrently.

## Parallel Example: User Story 1

After T008, execute the distinct red-test tasks together:

```text
T009: combat-game.test.ts — validated complete ship/game invariants
T010: combat-game-factory.test.ts — random setup and HP formula
T011: combat-stats-controls.test.ts — independently visible stats contract
```

Then implement T012 before dependent factory/control work. After T012 and their own red tests, T013 and T014 touch different production files and can be coordinated independently; T015 waits for both.

## Parallel Example: User Story 2

After T018, author/run the distinct test streams together:

```text
T019: battle-session.test.ts — state transitions and identity validation
T020: combat-turn-controls.test.ts — phase/button contract
T021: combat-controller.test.ts — pointer and animator orchestration
```

Implement session first, then controls/test adapter/controller in dependency order. Scene/lifecycle tasks reuse those contracts; do not modify session/controller files concurrently.

## Parallel Example: User Story 3

After T030, author/run the independent test streams together:

```text
T031: attack-resolver.test.ts — dice and damage rules
T032: torpedo-path.test.ts — contact/miss geometry
T033: torpedo-animator.test.ts — Phaser effect lifecycle
T034: combat-result-controls.test.ts + combat-attack-integration.test.ts — visible results/winner
```

After their red gates, resolver T035 and path T036 can be implemented in separate files; animator T037 waits for path. Result controls T038 are separate from resolver/path. Integration T039 waits for all three production collaborators.

## Implementation Strategy

### MVP first

Complete T001–T017 and demonstrate US1 using the setup fixture. This is a focused, independently testable stats/setup increment, not a full battle. Retain existing application behavior until combat wiring at T041.

### Incremental delivery

1. Establish shared values/contracts and preserve old regressions.
2. Deliver visible initialized combat ships (US1).
3. Verify movement and optional-attack sequencing with injected collaborators (US2).
4. Supply actual rolls/effects and wire normal application play (US3).
5. Finish static/full-suite checks, real-browser timing/visual acceptance, and usability evidence.

### Execution safeguards

- Read the linked model/contract before each slice; verbatim field constraints in tasks are binding.
- Keep a single battle-turn authority. Do not implement combat by running a second `TurnSession` alongside `BattleSession`.
- Use compile-time readonly types plus runtime validation/freeze where designed. Do not weaken types to simplify mocks or accept presentation-supplied HP/damage.
- New Game invalidates old work before cancellation; once-only completion gates apply to success, failure, and synchronous callback paths.
- Mark a task complete only after its behavior and required verification are actually done. Browser/usability tasks remain unchecked when their acceptance cannot be performed.
- No automatic commits, branch changes, extra packages, networking, storage, or player stat-editing are part of this task list.

## Requirement Coverage

| Requirements / outcomes                   | Main task coverage                                 |
| ----------------------------------------- | -------------------------------------------------- |
| FR-001–FR-006; SC-001/SC-002/SC-008       | T003–T006, T009–T017                               |
| FR-007–FR-010; SC-003                     | T019–T030, T043                                    |
| FR-011; invalid input/no RNG consumption  | T021/T022/T025, T031/T039/T043                     |
| FR-012–FR-014; SC-004                     | T018/T031/T035/T039/T044                           |
| FR-015; result visibility                 | T034/T038/T039/T044                                |
| FR-016; SC-005/SC-009                     | T032/T033/T036/T037/T042/T048                      |
| FR-017; SC-006                            | T019/T022/T034/T039/T043/T044                      |
| FR-018; fresh replacement/lifecycle       | T010/T013/T028/T029/T040–T043/T048                 |
| FR-019; attack-animation failure recovery | T028/T029/T033/T037/T043                           |
| SC-007; usable controls                   | T020/T023/T038/T049                                |
| Constitution / full acceptance evidence   | T001/T008, per-slice red-green-refactor, T046–T050 |

## Notes

- Task counts: Setup 2; Foundational 6; US1 9; US2 13; US3 15; Polish 5; **50 total**.
- All tasks start unchecked because task generation does not implement or verify gameplay.
- Tasks are immediately executable with the design documents above; tests/fixtures mentioned as additions are not claimed to exist already.
