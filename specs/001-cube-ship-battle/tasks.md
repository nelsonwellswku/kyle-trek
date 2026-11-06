---
description: "Implementation tasks for the three-dimensional ship battle"
---

# Tasks: Three-Dimensional Ship Battle

**Input**: `specs/001-cube-ship-battle/plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/game-ui.md`, and `quickstart.md`.

**TDD is mandatory**: For each behavioral increment, create any minimal callable interface needed for test collection, write and run the test before implementation, and record the command and expected behavioral failure in `specs/001-cube-ship-battle/development.md`. An import, dependency, or setup error is not a behavioral red. Implement the smallest change, run the test green, refactor, rerun affected tests, and record commands/results. Split broad tasks into smaller red-green-refactor cycles. Manual graphics checks supplement rather than replace automated tests.

**Format**: `[P]` means tasks within the same ready group can run concurrently on separate files; story labels map to `spec.md`. The dependency order below overrides any apparent cross-phase parallelism. Paths are repository-relative.

## Phase 1: Setup

- [X] T001 Create `pyproject.toml` for a Python 3.12 src-layout package with Ursina runtime dependency, pytest development dependency, and pytest importlib mode with colocated feature-test discovery.
- [X] T002 Generate `uv.lock` with uv and verify `uv sync --locked` installs the project and pytest without depending on a graphical display.
- [X] T003 Create package markers in `src/kyle_trek/__init__.py`, `src/kyle_trek/battle/__init__.py`, `src/kyle_trek/movement/__init__.py`, `src/kyle_trek/combat/__init__.py`, and `src/kyle_trek/inspection/__init__.py`.
- [X] T004 Create `specs/001-cube-ship-battle/development.md` with sections for per-increment red/green/refactor evidence, graphical acceptance, timing, statistical sampling, and architecture review. Record the proposed Linux performance reference environment (CPU, GPU, graphics driver, OS, display resolution, scaling and window dimensions), timing protocol and maintainer approval status; missing details or approval block performance acceptance, and actual values must not be invented.

## Phase 2: Foundational prerequisites

**Purpose**: Typed shared battle contracts and deterministic test seams used by all stories.

- [X] T005 [P] Write and run failing domain-value tests in `src/kyle_trek/battle/tests/test_types.py` for integer coordinates in 1..5, valid player IDs, discrete orientations and phase enums implemented by T007. Occupancy/state assertions belong to T010/T013 and derived movement eligibility to T019/T022, not this foundation checkpoint.
- [X] T006 [P] Write and run failing lifecycle and RNG-interface tests in `src/kyle_trek/battle/tests/test_contracts.py`: typed generation/action IDs, distinct gameplay and visual random sources, callback identity, and rejected invalid values.
- [X] T007 Implement validated class-based domain values and enums in `src/kyle_trek/battle/types.py`: “`x`, `y`, `z`; each 1..5”, “player ID (1 or 2)”, discrete orientation, and movement/animation/attack/finished phases; keep engine vectors out of domain types.
- [X] T008 Implement typed RNG, clock, action-token, and presentation interfaces in `src/kyle_trek/battle/contracts.py`; represent presentation “originating generation and action ID, kind, lifecycle (running, completed, failed, cancelled), timing and visual handles”.
- [X] T009 Run foundation tests and document behavioral red, green, and refactor results in `specs/001-cube-ship-battle/development.md`.

**Checkpoint**: Foundation available; story test suites can use deterministic collaborators and no engine window.

## Phase 3: User Story 1 — Start and inspect a battle (P1, MVP)

**Goal**: Create a fair new battle and make the complete cube and ship information inspectable.

**Independent test**: Start seeded games, check setup rules and displayed stats, then inspect and directly target all 125 cells and both ships across depth layers; camera motion leaves battle state unchanged.

### Tests first

- [X] T010 [P] [US1] Write and run failing setup/state tests in `src/kyle_trek/battle/tests/test_setup.py` covering all score modifier boundaries, HP floor without reroll, starting zones, distinct ships, orientations, independent uniform draws, and Player 1's initial movement phase. Verify occupancy is derived from current ship positions, cannot be independently mutated, and never assigns both ships to one cell, including after position changes.
- [X] T011 [P] [US1] Write and run failing inspection contract tests in `src/kyle_trek/inspection/tests/test_inspection.py` for 125 unique cells, five selectable Z layers, hover coordinates/occupancy before selection, both ships at every depth, and state-preserving camera orbit.
- [X] T012 [P] [US1] Write and run failing app composition and display tests with a fake scene in `tests/integration/test_initial_view.py` for labeled axes, three-quarter view, player/phase, both ship coordinates, scores, modifiers, HP and AC.

### Implementation

- [X] T013 [US1] Implement `src/kyle_trek/battle/state.py` with Stats (“agility, strength, constitution each integer 8..20; modifier `(score - 10) // 2`”; “Fixed per ship per game”), Ship (“HP is between zero and starting HP”; “Exactly one per player; cells differ”; AC 12), and Battle (“unique generation ID, two ships, active player, phase, optional winner, last displayed outcome”); derive occupancy from current ship positions without independently mutable occupancy state.
- [X] T014 [US1] Implement independent setup sampling in `src/kyle_trek/battle/setup.py`: ship X/Z 1..5, ship 1 Y 1..2, ship 2 Y 4..5, each score 8..20, HP `max(1, uniform(0,20) + 2 * constitution_modifier)`, and respective +Y/−Y facing.
- [X] T015 [P] [US1] Implement state-free camera and selectable Z-layer inspection in `src/kyle_trek/inspection/inspection.py`; inspection state is “view orientation, selected depth layer, hovered cell and displayed occupancy” and “UI-only; never changes battle state”.
- [X] T016 [US1] Implement Ursina cube, axis labels, distinguishable ship visuals, layer picking and hover adapter in `src/kyle_trek/inspection/scene.py`; validate engine inputs at the domain boundary and expose targets even when occluded in the default view.
- [X] T017 [US1] Compose the initial desktop scene and HUD in `src/kyle_trek/__main__.py`, including ship stats and coordinates, player and phase, orbit and layer controls, and a callable `python -m kyle_trek` entry point.
- [ ] T018 [US1] Run `uv run pytest` and the full-board graphical inspection in `specs/001-cube-ship-battle/quickstart.md`; record results and TDD evidence in `specs/001-cube-ship-battle/development.md`.

## Phase 4: User Story 2 — Move through the cube (P1)

**Goal**: Show exactly the legal cells and perform a collision-safe movement or explicit skip.

**Independent test**: Inject board positions and agility, compare displayed cells with known face-adjacent routes, choose a legal move or skip, and check the resulting phase and flight.

### Tests first

- [X] T019 [P] [US2] Write and run failing reachability tests in `src/kyle_trek/movement/tests/test_reachability.py` for boundaries, opponent obstruction, alternate routes, zero/negative allowance and exhaustive reference BFS comparisons. Verify eligibility is derived from the current battle configuration and allowance rather than independently stored, including after position and turn changes.
- [X] T020 [P] [US2] Write and run failing geometry tests in `src/kyle_trek/movement/tests/test_flight.py` for direct clear paths, shortest feasible detours, full ship envelopes, in-cube bounds and timing independent of movement cost.
- [X] T021 [P] [US2] Write and run failing input/lifecycle tests in `tests/integration/test_movement.py` for valid left click, illegal/non-left clicks, one action per move, busy input, arrival-only transition, explicit skip and ≤300 ms highlight/≤1.5 s movement deadlines using the plan's measurement endpoints. Cover launch failure, mid-flight failure, timeout and duplicate/late callbacks: clean effects, visibly place the ship at its committed destination, show an error and enable attack-choice once within the original deadline (FR-024). Use generation/action guards; restart/disposal races are integrated in T037.

### Implementation

- [X] T022 [US2] Implement BFS and explanation of empty destination sets in `src/kyle_trek/movement/reachability.py`; derive eligibility from current battle configuration and allowance rather than independently stored eligibility. Turn has “active player, allowance `max(0, agility modifier)`, phase” and “Movement resolves once before attack-or-end-turn”.
- [X] T023 [US2] Implement collision-aware continuous path selection and bounded nonblocking flight in `src/kyle_trek/movement/flight.py`, using direct smooth paths when clear and shortest feasible collision-free paths otherwise.
- [X] T024 [US2] Implement move/skip phase guards and single arrival resolution in `src/kyle_trek/movement/controller.py`, rejecting occupied/out-of-range/non-left targets and repeat input without spending an action. Implement FR-024 launch/playback/timeout recovery with effect cleanup, visible committed-destination placement and exactly-once attack-choice transition within the original deadline; reserve fallback time and guard all completion/failure/timeout callbacks by generation/action identity.
- [X] T025 [US2] Connect legal highlights, skip explanation, move selection, animation, failure-recovery placement/error text and attack-choice phase to the existing HUD and scene in `src/kyle_trek/__main__.py` and `src/kyle_trek/inspection/scene.py`.
- [ ] T026 [US2] Run movement tests and measure graphical highlights, clear/detour flight, envelopes and launch/playback/timeout recovery using `specs/001-cube-ship-battle/quickstart.md`. On the approved reference environment, measure monotonic wall-clock time through rendered/selectable highlights and visible arrival plus attack-choice availability, including recovery; record the environment, measurement method and individual durations in `specs/001-cube-ship-battle/development.md`.

## Phase 5: User Story 3 — Attack or end the turn (P1)

**Goal**: Resolve a single attack or end the turn, displaying outcomes and victory reliably even when presentation fails.

**Independent test**: Inject an attack-choice state and scripted rolls; exercise end turn, invalid targets, miss, nonlethal hit, lethal hit, and presentation failures without rerolls or duplicate resolutions.

### Tests first

- [X] T027 [P] [US3] Write and run failing combat rules tests in `src/kyle_trek/combat/tests/test_rules.py` for d20 threshold 12 including equality, d8 damage, negative damage floor, HP floor, hit/miss dice usage, victory and one handoff.
- [X] T028 [P] [US3] Write and run failing torpedo geometry/animation tests in `src/kyle_trek/combat/tests/test_effects.py` for star shape/scale/blink, explosion-before-damage, independent 10°–35° miss angle and side, full defender clearance and off-screen exit at cube edges. Change camera projection immediately after launch and before closest approach, including depth-aligned ships and screen-edge defenders; validate current-projection hit contact and miss constraints without resampling the angle/side.
- [X] T029 [P] [US3] Write and run failing orchestration tests in `tests/integration/test_combat.py` for invalid targets, End turn, locked gameplay input with camera orbit still available, duplicate callbacks, launch/playback failure, pre-rolled result, error cleanup, and ≤1.5 s deadlines using the plan's measurement endpoints. Verify infeasible camera-driven reprojection resolves the stored outcome once without rerolling, duplicate dice application or restarting the original deadline.

### Implementation

- [X] T030 [US3] Implement immutable attack result in `src/kyle_trek/combat/outcome.py`: “attacker, defender, d20, total, hit; optional d8, damage and remaining HP on hit; applied flag”; result is “Rolled once at launch; immutable result applied at most once after presentation or failure”. Keep application tracking separate if needed for immutability.
- [X] T031 [US3] Implement injected d20/d8 resolution and hit-point calculations in `src/kyle_trek/combat/rules.py`, preserving independent visual RNG and using the spec's nonnegative damage and HP floors.
- [X] T032 [US3] Implement five-point blinking outlined torpedo, scaled minimum radius and contact explosion, plus bounded-deviation miss trajectory with independent uniform angle/side and full-screen exit in `src/kyle_trek/combat/effects.py`. Keep camera orbit available, validate current-projection contact/clearance on view changes, and reproject or reframe without resampling; report infeasible geometry to the existing presentation-failure path within the original deadline.
- [X] T033 [US3] Implement guarded targeting, End turn, deadline-aware presentation failure cleanup, exactly-once outcome application, next turn and victory in `src/kyle_trek/combat/controller.py`; failure resolves the pre-rolled outcome while cancellation discards it.
- [X] T034 [US3] Wire opponent selection, attack/end controls, result/error text and winner display into `src/kyle_trek/__main__.py` and `src/kyle_trek/inspection/scene.py`.
- [ ] T035 [US3] Run combat tests and real-display hit, edge-position miss, failure and camera-orbit checks from `specs/001-cube-ship-battle/quickstart.md`, including view changes just after launch and near closest approach. On the approved reference environment, measure monotonic wall-clock time from launch through displayed results and next-turn availability or victory, including failed reprojection; record the environment, measurement method, individual durations and TDD evidence in `specs/001-cube-ship-battle/development.md`.

## Phase 6: User Story 5 — Restart safely (P1)

**Goal**: Restart or dispose at any time without old actions affecting the current battle.

**Independent test**: Restart during movement and combat presentation and after victory, deliver stale callbacks, and assert fresh setup, Player 1's turn and no old effects or mutations; repeat for disposal.

### Tests first

- [ ] T036 [P] [US5] Write and run failing restart tests in `src/kyle_trek/battle/tests/test_restart.py` for independent fresh setup, default orientations, Player 1, cleared results/highlights/actions, and no rerolls when revisiting a view.
- [ ] T037 [P] [US5] Write and run failing cancellation tests in `tests/integration/test_cancellation.py` for restart/disposal during flight and attack, stale/duplicate completion, failure and timeout callbacks, and cancellation versus presentation-failure semantics. Restart or dispose before pending movement recovery runs and verify cancellation takes precedence: no old destination placement, error, phase transition or outcome reaches the new game.

### Implementation

- [ ] T038 [US5] Implement generation invalidation before cancellation, new-game setup, and disposal in `src/kyle_trek/battle/session.py`; reject callbacks not matching the current generation and action ID.
- [ ] T039 [US5] Connect cancellation and effect cleanup across `src/kyle_trek/movement/controller.py`, `src/kyle_trek/combat/controller.py`, and `src/kyle_trek/__main__.py`; expose New game in every phase, including animations and victory.
- [ ] T040 [US5] Run restart/disposal tests and graphical interruption checks in `specs/001-cube-ship-battle/quickstart.md`; record stale-callback and TDD results in `specs/001-cube-ship-battle/development.md`.

## Phase 7: User Story 4 — Orient the active ship (P2)

**Goal**: Rotate the active ship persistently and independently of the camera without consuming an action.

**Independent test**: Rotate ±90° around X/Y/Z during both idle playable phases; compare all non-orientation state and attempt opponent, animation, resolution, completed-battle and interrupted rotations.

### Tests first

- [ ] T041 [P] [US4] Write and run failing orientation tests in `src/kyle_trek/battle/tests/test_orientation.py` for all six rotations, persistence, active ownership, unchanged other state, and invalid phases.
- [ ] T042 [P] [US4] Write and run failing integration tests in `tests/integration/test_rotation.py` for rendered orientation, separate camera orbit, repeated busy input, and restart/disposal during any rotation presentation.

### Implementation

- [ ] T043 [US4] Implement discrete composed 90° rotations and phase/ownership guards in `src/kyle_trek/battle/orientation.py`; preserve position, allowance, phase, combat values and turn order.
- [ ] T044 [US4] Connect rotation controls and visual transforms to `src/kyle_trek/inspection/scene.py` and `src/kyle_trek/__main__.py`; route any asynchronous completion through the generation/action cancellation contract.
- [ ] T045 [US4] Run orientation tests and visual/cancellation checks from `specs/001-cube-ship-battle/quickstart.md`; record results and TDD evidence in `specs/001-cube-ship-battle/development.md`.

## Phase 8: Polish and cross-cutting acceptance

- [ ] T046 [P] Define a reproducible seeded sampling plan in `specs/001-cube-ship-battle/sampling-plan.md` with sample sizes, independence/uniformity tests, 5% significance threshold and multiple-comparison treatment before sampling.
- [ ] T047 Implement statistical acceptance tests in `tests/integration/test_randomness.py` against the predefined plan for eligible setup cells, scores, HP draws, miss angles/sides and independence from gameplay dice; record the seed and results in `specs/001-cube-ship-battle/development.md`.
- [ ] T048 Update `README.md` with verified Python/uv installation, actual run/test commands, graphics prerequisites, controls, game rules, and links to the validation guide; remove planning-only claims only after implementation works.
- [ ] T049 Execute `uv sync --locked`, `uv run pytest`, and all scenarios in `specs/001-cube-ship-battle/quickstart.md`; record platform, commands, results, full-board coverage and any unverified graphical checks in `specs/001-cube-ship-battle/development.md`. Require the documented, maintainer-approved reference environment and the plan's timing protocol; record individual monotonic wall-clock durations through rendered/selectable highlights, visible movement arrival plus attack-choice availability, and displayed attack outcome plus next-turn availability or victory. Include movement recovery and camera-driven presentation failure; averages or fake-clock tests alone cannot establish performance acceptance.
- [ ] T050 Conduct and document the first-time-player usability test in `specs/001-cube-ship-battle/development.md`: participant count and ≥90% unaided completion of the spec's active-player, hidden-cell, movement/skip and attack/end tasks.
- [ ] T051 Review feature ownership, typed contracts and localized engine exceptions, composition/inheritance justifications, and complete per-change red-green-refactor evidence in `specs/001-cube-ship-battle/development.md`; block acceptance on any constitution violation.

## Dependencies & Execution Order

```text
Setup T001–T004 → Foundation T005–T009 → US1 T010–T018 → US2 T019–T026
                                                            ↓
                                                     US3 T027–T035
                                                            ↓
                                                     US5 T036–T040
                                                            ↓
                                                     US4 T041–T045 → Polish T046–T051
```

US2 needs US1's initial battle and interaction; US3 needs US2's attack-choice phase; US5 integrates active movement and combat cancellation. US4 is P2 and follows P1 stories so its own interrupted presentation is tested against the completed restart contract. Story tests may use seeded or fake state to isolate each story at its checkpoint. Within a story, write tests and observe behavioral red before the related implementation, then green/refactor; tests and implementation on the same behavior are not parallel tasks.

## Parallel Examples

- **US1**: After foundation, T010, T011, and T012 can be written in separate test files concurrently; T015 can proceed alongside T013/T014 once its test is red and the required typed interfaces exist. Integrate scene work after its prerequisites.
- **US2**: After US1, T019, T020, and T021 can be written concurrently; reachability and flight implementation can proceed separately once their own tests are red, before controller integration.
- **US3**: After US2, T027, T028, and T029 can be written concurrently; rules and effects can proceed separately after their own red tests, before combat orchestration.
- **US5**: After US3, T036 and T037 can be written concurrently; session and cross-feature cancellation integration follow the relevant failures.
- **US4**: After US5, T041 and T042 can be written concurrently; orientation logic precedes integrated controls.

## Implementation Strategy

1. **MVP**: Complete setup, foundation and US1, then demonstrate fair setup and inspection of all 125 cells; this is an inspectable prototype, not a complete playable battle.
2. Add US2 and US3 for the core playable turn, then US5 for safe interruption; validate each increment independently and repeat earlier regression tests.
3. Add US4 and finish cross-cutting statistical, timing, usability, documentation and constitution acceptance. Record incomplete manual checks honestly rather than treating automated success as graphical acceptance.
