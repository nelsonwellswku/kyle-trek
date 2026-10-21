---
description: 'Task list for Three-Dimensional Ship Movement'
---

# Tasks: Three-Dimensional Ship Movement

**Input**: Design documents from `/specs/004-3d-ship-movement/`

**Prerequisites**: `plan.md`, `spec.md`, `data-model.md`, `contracts/cube-ui.md`, `research.md`, and `quickstart.md`

**Tests**: Test tasks are included because the project constitution requires red-green-refactor before every behavior change.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks because it edits different files and has no dependency on unfinished tasks.
- **[Story]**: User story served by the task; setup and foundational tasks have no story label.
- Every task names the implementation or test file it changes.

## Phase 1: Setup

**Purpose**: Add the 3D rendering dependency required by the feature.

- [x] T001 Pin Three.js 0.186.1 as a runtime dependency and update the lockfile in `package.json` and `package-lock.json`.

---

## Phase 2: Foundational

**Purpose**: Establish the renderer-independent cube value types required by setup, movement, combat, and presentation.

- [x] T002 [P] Add `CubePosition` tests for all 1,000 valid coordinates, rejected out-of-range/non-integer/non-finite inputs, equality, and stable bijective presentation indexes in `src/features/board/tests/cube-position.test.ts`.
- [x] T003 Implement immutable validated `CubePosition(x, y, z)` values with axes bounded inclusively from 1 through 10 and the documented stable index mapping in `src/features/board/domain/CubePosition.ts`.
- [x] T004 Add `CubeSnapshot` tests for fixed 10 × 10 × 10 dimensions, typed ship placements, derived occupancy, and rejection of duplicate positions in `src/features/board/tests/cube-snapshot.test.ts`.
- [x] T005 Implement immutable `CubeSnapshot` with exactly two distinct ship positions and derived occupancy in `src/features/board/domain/CubeSnapshot.ts`.
- [x] T006 [P] Add orientation tests that enumerate all 24 proper cube orientations, verify signed quarter-turns around X/Y/Z, and confirm inverse/composition behavior in `src/features/board/tests/cube-orientation.test.ts`.
- [x] T007 Implement renderer-independent `CubeOrientation` as a right-handed signed-axis basis with valid ±90-degree global-axis composition in `src/features/board/domain/CubeOrientation.ts`.

**Checkpoint**: The shared domain has validated 3D coordinates, cube occupancy, and ship orientation types without importing Three.js.

---

## Phase 3: User Story 1 - See and Navigate the 3D Playing Space (Priority: P1)

**Goal**: Show the 1,000-cell cube, two ships and their coordinates in an orbitable three-quarter view, with independently uniform starting placement and default ship orientations.

**Independent Test**: Start a new game and verify exactly 1,000 uniquely addressed cell markers, three labeled axes, two distinct ships in their assigned Y bands with visible X/Y/Z coordinates, and an orbit pose that allows each near, far, upper, lower, and interior marker to be identified and picked without changing game state.

### Tests for User Story 1

- [x] T008 [P] [US1] Extend setup tests with controlled coverage of all 200 eligible cells per ship, independent draws, correct Y bands, and distinct positions in `src/features/game-setup/tests/setup.test.ts`.
- [x] T009 [P] [US1] Add combat snapshot/factory tests for the two default facing directions and preservation of existing stats and hit points when 3D positions/orientations are created in `src/features/ship-combat/tests/combat-game.test.ts` and `src/features/ship-combat/tests/combat-game-factory.test.ts`.
- [x] T010 [P] [US1] Add typed renderer-double tests for 1,000 stable cell markers, open lattice/axis labels, two oriented ships, WebGL2 failure reporting, resize, and disposal in `src/features/board/tests/cube-view.test.ts`.
- [x] T011 [US1] Add orbit/picker tests for the three-quarter default, full azimuth and usable elevation, nearest visible marker selection, click-versus-drag arbitration at the 5 CSS-pixel threshold, and exact coordinate mapping in `src/features/board/tests/cube-view.test.ts`.
- [x] T012 [P] [US1] Extend setup/HUD tests to verify both ships' visible X/Y/Z coordinates, occupancy summaries, and accessible axis/rotation labels in `src/features/game-setup/tests/controls.test.ts`.
- [x] T013 [US1] Extend application/scene lifecycle tests and the real-browser fixture to verify one Three view/canvas, aligned Phaser/Three bounds, readable renderer startup failure, New Game reuse, disposal, an orbit pose for every one of the 1,000 coordinates, exact ray picks, and no game-state changes from orbit/inspection in `src/features/ship-combat/tests/game-application.test.ts`, `src/features/ship-combat/tests/combat-scene.test.ts`, `src/features/ship-combat/tests/browser/fixture.ts`, and `src/features/ship-combat/tests/browser/fixture.html`.

### Implementation for User Story 1

- [x] T014 [US1] Update `GameSetup` and `GameSetupFactory` to map one uniform draw in [0, 200) bijectively to X/Z and the ship's two allowed Y layers, using `CubePosition`, in `src/features/game-setup/domain/GameSetup.ts` and `src/features/game-setup/domain/GameSetupFactory.ts`.
- [x] T015 [US1] Migrate `CombatGame` and `CombatGameFactory` to `CubePosition`, store `CubeOrientation`, initialize Ship 1 toward +Y and Ship 2 toward −Y with +Z up, and preserve all existing stats and dice draw order in `src/features/ship-combat/domain/CombatGame.ts` and `src/features/ship-combat/domain/CombatGameFactory.ts`.
- [x] T016 [US1] Implement the independent WebGL2 cube renderer with a decorative open lattice, 1,000 stable selectable center markers, visible oriented procedural ship models, axes, resize handling, and explicit resource disposal in `src/features/board/presentation/ThreeCubeView.ts`.
- [x] T017 [US1] Implement orbit controls and typed ray picking so only visible cell-center markers and ships are targets, the overlay passes pointer events to the Phaser host, and camera state remains presentation-only in `src/features/board/presentation/CubeOrbitControls.ts` and `src/features/board/presentation/CubePicker.ts`.
- [x] T018 [US1] Update board/HUD controls to show both ship coordinate triples, occupancy, readable axis labels, and accessible cell/ship descriptions in `src/features/game-setup/presentation/GameSetupControls.ts`.
- [x] T019 [US1] Compose and own the Three view through `CombatScene` and `GameApplication`, show the hovered/selected cell's coordinate and occupancy without issuing a battle command, align the overlay canvas to the Phaser board host, keep the HUD outside the overlay, and surface renderer errors in `src/features/ship-combat/presentation/CombatScene.ts`, `src/app/GameApplication.ts`, `src/app/styles.css`, and `src/features/game-setup/presentation/GameSetupControls.ts`.

**Checkpoint**: A new game independently displays and permits inspection of all cube positions; orbiting and selecting cells cannot mutate ship or battle state.

---

## Phase 4: User Story 2 - Move a Ship Along Any Cube Axis (Priority: P1)

**Goal**: Preserve turn authority while calculating and animating legal face-adjacent routes through the 3D cube.

**Independent Test**: Use known positions and allowances to check all six directions, depth changes, boundaries, occupied-cell detours and unreachable targets; accept exactly the empty destinations within allowance, complete one move, and verify the same player reaches attack-or-end-turn only after arrival.

### Tests for User Story 2

- [X] T020 [P] [US2] Extend reachability tests with an independent 3D route oracle for all six neighbors, boundaries, occupied blockers, affordable detours, diagonal rejection, zero allowance, and the maximum five-step bound in `src/features/ship-movement/tests/reachability.test.ts`.
- [X] T021 [P] [US2] Add cube-route and single-move lifecycle tests for `PendingMove`, `MovementGame`, and `TurnSession`, including blocker handling and explicit no-move skip, in `src/features/ship-movement/tests/movement-game.test.ts` and `src/features/ship-movement/tests/turn-session.test.ts`.
- [X] T022 [US2] Extend production battle tests to cover six-direction movement, blocked routes, invalid selections, pending position until completion, one move per turn, Player 1 first, movement-before-attack/end-turn, and no-move skip: accept skip only when there are no legal destinations, keep the position unchanged, enter attack-ready for the same player, and reject skip when movement is available in `src/features/ship-combat/tests/battle-session.test.ts`.
- [X] T023 [P] [US2] Add flight tests for 3D endpoints, direct and collision-safe paths, 250 ms per logical step, cancellation, once-only callbacks, and the 1.5-second maximum in `src/features/ship-movement/tests/cube-flight-path.test.ts` and `src/features/ship-movement/tests/flight-animator.test.ts`.
- [X] T024 [US2] Extend controller/scene tests for typed picked-cell dispatch, click-on-release behavior, drag-only orbit, ignored invalid/occupied/unreachable picks, and rejection of inputs while moving in `src/features/ship-combat/tests/combat-controller.test.ts` and `src/features/ship-combat/tests/combat-scene.test.ts`.
- [X] T025 [US2] Extend the real-browser fixture with deterministic cube positions and verify actual WebGL2 marker picking, six-axis movement, route highlights, arrival coordinates, orbit/pick alignment, and move timing in `src/features/ship-combat/tests/browser/fixture.ts` and `src/features/ship-combat/tests/browser/fixture.html`.

### Implementation for User Story 2

- [X] T026 [US2] Migrate `Reachability` to `CubePosition`/`CubeSnapshot` and breadth-first search over exactly ±X, ±Y, and ±Z while retaining shortest typed routes, blocker exclusion, and the five-step cap in `src/features/ship-movement/domain/Reachability.ts`.
- [X] T027 [US2] Migrate standalone movement snapshots, route identities, factories, sessions, controllers, scenes, and turn transitions from 2D board positions to `CubePosition` and cube presentation contracts without changing one-move-per-turn or explicit skip behavior in `src/features/ship-movement/domain/PendingMove.ts`, `src/features/ship-movement/domain/MovementGame.ts`, `src/features/ship-movement/domain/MovementGameFactory.ts`, `src/features/ship-movement/domain/TurnSession.ts`, `src/features/ship-movement/presentation/MovementScene.ts`, `src/features/ship-movement/presentation/MovementController.ts`, `src/features/ship-movement/presentation/FlightAnimator.ts`, `src/features/ship-movement/presentation/PhaserFlightAnimator.ts`, `src/features/ship-movement/presentation/SpaceFlightPath.ts`, and `src/features/ship-movement/presentation/TurnControls.ts`.
- [X] T028 [US2] Update production `BattleSession` movement commands and pending route snapshots to use cube coordinates while retaining revision, turn-token, move-ID, cancellation, and stale-completion checks in `src/features/ship-combat/domain/BattleSession.ts` and `src/features/ship-movement/domain/PendingMove.ts`.
- [X] T029 [US2] Implement collision-safe 3D flight paths and a cancellable Three.js flight animator that follows typed routes at 250 ms per step and reports terminal callbacks only once in `src/features/ship-movement/presentation/CubeFlightPath.ts` and `src/features/ship-movement/presentation/ThreeFlightAnimator.ts`.
- [X] T030 [US2] Connect the typed cube picker and legal-destination highlights to the production `CombatController`/`CombatScene`; accept selection on pointer release, suppress selection after an orbit drag, and route movement visuals through the Three view in `src/features/ship-combat/presentation/CombatController.ts` and `src/features/ship-combat/presentation/CombatScene.ts`.

**Checkpoint**: 3D reachability and movement work through the production `BattleSession`, with all existing turn, skip, combat, and stale-action protections preserved.

---

## Phase 5: User Story 3 - Rotate a Ship Around Each Axis (Priority: P2)

**Goal**: Let only the active player rotate their ship in signed quarter-turns around each cube axis, retaining orientation without moving the ship or consuming turn actions.

**Independent Test**: During a ready phase, issue each of the six signed axis turns and verify the model orientation changes while positions, stats, movement allowance, opponent state, and turn token remain unchanged; reject wrong-owner, animating, stale, attacking, finished, and disposed requests.

### Tests for User Story 3

- [ ] T031 [P] [US3] Extend battle-session tests for valid signed rotations in movement-ready/attack-ready, prior-phase restoration, failure rollback, movement/attack value preservation, and rejection of wrong-owner, stale, animating, attacking, finished, or disposed actions in `src/features/ship-combat/tests/battle-session.test.ts`.
- [ ] T032 [P] [US3] Extend combat-control tests for six labeled axis/direction controls, keyboard operation, active-player/phase gating, and no color-only cues in `src/features/ship-combat/tests/combat-turn-controls.test.ts`.
- [ ] T033 [US3] Extend controller and scene tests for visible orientation updates, pending rotation identities, once-only completion/failure, input lock during animation, New Game cancellation, default orientation reset to Ship 1 +Y and Ship 2 −Y after prior rotations, and rejection of stale rotation callbacks in `src/features/ship-combat/tests/combat-controller.test.ts` and `src/features/ship-combat/tests/combat-scene.test.ts`.
- [ ] T034 [P] [US3] Add Three.js torpedo animator tests for endpoints at current cube positions, preserved hit/miss visuals and timing, cancellation, disposal, and identity-checked terminal callbacks in `src/features/ship-combat/tests/three-torpedo-animator.test.ts`.
- [ ] T035 [US3] Extend the browser fixture to verify all six visible ship rotations, orbit-independent orientation, current-position torpedo effects, unchanged outcomes, and that New Game after rotating both ships resets Ship 1 to +Y and Ship 2 to −Y while old rotation callbacks cannot affect the replacement, in `src/features/ship-combat/tests/browser/fixture.ts` and `src/features/ship-combat/tests/browser/fixture.html`.

### Implementation for User Story 3

- [ ] T036 [US3] Add immutable pending-rotation identity and `CombatGame.withOrientation`, then implement phase-aware `BattleSession` rotate/complete/fail transitions that preserve position, stats, turn token, and ready phase in `src/features/ship-combat/domain/PendingRotation.ts`, `src/features/ship-combat/domain/CombatGame.ts`, and `src/features/ship-combat/domain/BattleSession.ts`.
- [ ] T037 [US3] Add accessible signed X/Y/Z rotation controls and connect them to the active ship's revision/turn/action-gated rotation commands in `src/features/ship-combat/presentation/CombatControls.ts` and `src/features/ship-combat/presentation/CombatController.ts`.
- [ ] T038 [US3] Animate and commit ship orientation through the Three view while locking gameplay input during rotation and restoring the prior ready phase on completion/failure in `src/features/board/presentation/ThreeCubeView.ts` and `src/features/ship-combat/presentation/CombatScene.ts`.
- [ ] T039 [US3] Implement a cancellable 3D torpedo animator and adapt torpedo paths to current cube positions while leaving combat rolls, damage, victory, cancellation identities, and the 1,500 ms result/readiness deadline under existing combat rules in `src/features/ship-combat/presentation/ThreeTorpedoAnimator.ts` and `src/features/ship-combat/presentation/TorpedoPath.ts`.

**Checkpoint**: Active-player ship rotation and existing attacks both work in the 3D scene without changing occupancy, battle outcomes, or turn ownership.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Capture implementation evidence and validate the complete feature against the project workflow.

- [ ] T040 Retire the obsolete 2D `BoardPosition`, `BoardSnapshot`, `BoardGeometry`, and `BoardView` contracts after all board, setup, movement, combat, and presentation consumers use cube types; replace or remove their superseded tests in `src/features/board/domain/BoardPosition.ts`, `src/features/board/domain/BoardSnapshot.ts`, `src/features/board/presentation/BoardGeometry.ts`, `src/features/board/presentation/BoardView.ts`, `src/features/board/tests/geometry.test.ts`, and `src/features/board/tests/board-view.test.ts`.
- [ ] T041 Record red-green-refactor commands and results, browser orbit/picking coverage, visual/timing/usability observations, and constitution review in `specs/004-3d-ship-movement/development.md`.
- [ ] T042 Run feature tests, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, and the production-path browser checks from `specs/004-3d-ship-movement/quickstart.md`; record each result in `specs/004-3d-ship-movement/development.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Add the pinned Three.js runtime dependency.
- **Foundational (Phase 2)**: Depends on Setup; validated cube coordinates/snapshots and orientations block all story implementation.
- **User Stories (Phases 3–5)**: Depend on the foundational domain types. Complete each story's tests before its corresponding implementation tasks.
- **Polish (Phase 6)**: Depends on the desired stories being implemented and independently validated.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 and establishes the production cube state and view. It is the MVP and prerequisite for production-path US2/US3 integration.
- **US2 (P1)**: Starts after Phase 2 for independent reachability work; production controller integration follows US1's cube view and typed game model. It can be developed alongside US1's presentation work once the shared domain is ready.
- **US3 (P2)**: Starts after Phase 2 for orientation-domain coverage; its live rotation and torpedo integration follows US1's production cube model and US2's movement-enabled `BattleSession`/controller.

### Within Each User Story

- Add and run behavior tests before implementing the behavior; verify the expected behavioral failure rather than a setup or compilation failure.
- Implement shared types before consumers; implement domain state transitions before presentation adapters.
- Keep `BattleSession` as the sole authority for production movement, rotation, combat, and turn transitions.
- Complete each story's independent test criteria before proceeding to dependent integration work.

### Parallel Opportunities

- After Phase 2, US1 setup/factory tests and cube-view tests edit separate files and can be prepared in parallel.
- US2 reachability tests and movement-session tests can be prepared independently; Three flight-path work can proceed separately from domain reachability after the shared coordinate contract is stable.
- US3 battle-session tests, accessible control tests, and torpedo animator tests target separate files and can be prepared in parallel after the shared orientation type exists.
- After the foundation, independent US1 presentation work and US2 reachability work may proceed in parallel; production controller integration follows the cube view and game model.

### Parallel Example: User Story 1

```text
T008 setup placement tests in src/features/game-setup/tests/setup.test.ts
T010 cube rendering tests in src/features/board/tests/cube-view.test.ts
T009 combat model/factory tests in src/features/ship-combat/tests/combat-game.test.ts and src/features/ship-combat/tests/combat-game-factory.test.ts
```

### Parallel Example: User Story 2

```text
T020 3D route oracle tests in src/features/ship-movement/tests/reachability.test.ts
T021 movement-session tests in src/features/ship-movement/tests/movement-game.test.ts and src/features/ship-movement/tests/turn-session.test.ts
T023 3D flight behavior tests in src/features/ship-movement/tests/cube-flight-path.test.ts and src/features/ship-movement/tests/flight-animator.test.ts
```

### Parallel Example: User Story 3

```text
T031 battle rotation tests in src/features/ship-combat/tests/battle-session.test.ts
T032 accessible rotation control tests in src/features/ship-combat/tests/combat-turn-controls.test.ts
T034 torpedo animator tests in src/features/ship-combat/tests/three-torpedo-animator.test.ts
```

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational cube types.
3. Complete Phase 3: User Story 1, including production new-game placement, readable coordinates, cube orbit/picking, and resource lifecycle.
4. Validate all 1,000 markers and cell identity through the real-browser fixture; record visual evidence.
5. Stop for a demonstrable cube-view MVP before adding 3D movement and ship rotation.

### Incremental Delivery

1. Setup + Foundation → canonical 3D domain.
2. US1 → playable, inspectable 10 × 10 × 10 board MVP.
3. US2 → six-direction legal movement and flight.
4. US3 → all-axis ship rotation and 3D combat presentation.
5. Polish → full automated, browser, timing, usability, and constitution evidence.

## Notes

- `[P]` tasks work in different files and do not depend on unfinished tasks.
- Story labels map to the three scenarios in `specs/004-3d-ship-movement/spec.md`.
- Movement legality comes from the shared six-neighbor BFS; visual proximity never authorizes a move.
- Camera pose remains presentation state; it must not enter `CombatGame` or `BattleSession`.
- Preserve exact data-model constraints in the relevant tasks: `CubePosition` integer coordinates 1–10, starting bands Y=1/2 and Y=9/10 with 200 eligible cells each, and a maximum five-step movement allowance.
