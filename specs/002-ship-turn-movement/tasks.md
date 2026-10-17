# Tasks: Ship Turn Movement

**Input**: Design documents in `specs/002-ship-turn-movement/`: [plan](plan.md), [specification](spec.md), [research](research.md), [data model](data-model.md), [UI contract](contracts/movement-ui.md), and [validation guide](quickstart.md).

**Tests**: Required by Constitution IV and the implementation plan. Before each new behavior or bug fix, write a demonstrating test, run it to observe the expected behavioral failure, implement the minimum change, then refactor with affected tests green. Missing modules, compiler errors, and dependency failures do not count as red evidence. Minimal typed contracts/stubs may make a behavioral test executable without implementing the behavior. Existing passing coverage is regression evidence; do not deliberately break correct behavior to manufacture a red state.

**Organization**: Setup → foundation → US1 (P1) → US2 (P2) → US3 (P3) → cross-cutting acceptance. All paths are repository-relative. This file schedules implementation; every task starts unchecked.

## Format: `[ID] [P?] [Story] Description`

- `[P]` identifies tasks on separate files that can run concurrently once their named prerequisites are complete; it does not override test-first gates.
- Story-phase tasks always carry `[US1]`, `[US2]`, or `[US3]`; setup, foundation and final-phase tasks do not.
- Update `specs/002-ship-turn-movement/development.md` with actual red/green commands, outcomes and review evidence throughout implementation. Do not claim browser/usability checks from mocks.
- Retain strict TypeScript, class-based composition and feature-local ownership. Only Phaser lifecycle adapters may extend Phaser.Scene, with compatibility justification documented alongside them.
- Browser fixtures are manually operated: a person chooses presets, performs interactions and evaluates visual/timing results. Automated tests run in Node with Vitest and typed doubles.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Enable feature-local verification using existing Node 24/npm 11, TypeScript, Phaser and Vitest; no new runtime dependencies.

- [x] T001 Establish current verification results with `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check`, and `npm run build`, recording actual results and a red-green-refactor evidence format in specs/002-ship-turn-movement/development.md.
- [x] T002 Expand discovery to `src/features/*/tests/**/*.test.ts` and set `passWithNoTests: false` in vitest.config.ts; verify existing setup tests are still selected and an unmatched filter fails rather than silently succeeding.
- [x] T003 [P] Add typed scripted randomness and controllable flight doubles with explicit draw/completion/cancellation observation in src/features/ship-movement/tests/fixtures/ScriptedRandomSource.ts and src/features/ship-movement/tests/fixtures/ControlledFlightAnimator.ts; avoid depending on setup-private test fixtures or introducing untyped gameplay contracts.

**Checkpoint**: Baseline results recorded, intended tests discoverable, reusable deterministic doubles available.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the single board capability and legal movement primitives consumed by every story.

- [x] T004 Move the canonical coordinate class to src/features/board/domain/BoardPosition.ts and define src/features/board/domain/BoardSnapshot.ts, preserving the constraints “integers 1–10, one-based, top-to-bottom and left-to-right,” “`rows: 10`, `columns: 10`,” “Exactly two distinct occupied positions” and identities `ship-1`/`ship-2`; migrate imports in src/features/game-setup/domain/GameSetup.ts, src/features/game-setup/domain/GameSetupFactory.ts and affected src/features/game-setup/tests without duplicating the class or weakening starting-zone checks, then rerun setup regressions.
- [x] T005 Extract src/features/game-setup/presentation/BoardGeometry.ts to src/features/board/presentation/BoardGeometry.ts and migrate geometry tests to src/features/board/tests/geometry.test.ts, preserving center/marker calculations and updating imports in src/app/GameApplication.ts, src/features/game-setup/presentation/BoardView.ts and src/features/game-setup/presentation/GameSetupScene.ts; verify no duplicate geometry/position implementations remain.
- [x] T006 Write and run failing pointer-to-cell behavior tests in src/features/board/tests/geometry.test.ts for “half-open `[0,600) × [0,600)` bounds,” internal-line ownership to right/below, nonfinite points and outer boundaries; then implement validated logical-point conversion in src/features/board/presentation/BoardGeometry.ts and rerun geometry tests.
- [x] T007 Move and generalize src/features/game-setup/presentation/BoardView.ts to src/features/board/presentation/BoardView.ts with BoardSnapshot input, migrate src/features/game-setup/tests/board-view.test.ts to src/features/board/tests/board-view.test.ts, and update src/features/game-setup/presentation/GameSetupScene.ts; preserve postrender readiness, pending-listener cleanup and existing setup output under regression tests.
- [x] T008 [P] Write and run failing tests in src/features/ship-movement/tests/reachability.test.ts for exact 12-square center reachability, origin exclusion, zero/negative allowance, occupied-cell exclusion and the four-step enemy detour, with typed executable contracts for src/features/ship-movement/domain/Reachability.ts as needed; specify “Adjacent route positions differ by exactly one in one axis; no repeats, no out-of-bounds positions, no other ship's square” and “`1 <= stepCount <= allowance`.”
- [x] T009 Implement class-based bounded BFS and immutable result/route contracts in src/features/ship-movement/domain/Reachability.ts using up/right/down/left tie-breaking, distances and predecessors; preserve “Origin is occupied by the active ship and is the one permitted occupied route entry. All later route entries must be empty,” reconstruct shortest paths including both endpoints, and make T008 green.
- [x] T010 Run shared-board and setup regression suites plus type checking after the extraction and routing changes, documenting canonical class identity, acyclic board dependencies and actual passing commands in specs/002-ship-turn-movement/development.md.

**Checkpoint**: Foundation is green before story implementation. Board owns coordinates/render geometry; setup still owns initial-zone rules; movement owns reachability. BFS already handles blockers because US1 highlights must be legal from its first increment.

## Phase 3: User Story 1 — Take Alternating Agility-Limited Turns (Priority: P1) — MVP

**Goal**: Play local alternating movement turns with randomized stats, exact highlights, click-to-move, explicit passes and safe New Game behavior.

**Independent Test**: Initialize known scores, verify all modifiers and allowed squares, left-click a shorter legal move and complete its flight, then verify exactly one handoff. Invalid input changes nothing; no-moves turns wait for Pass, including when both ships are immobile. Confirm fresh randomized stats and Player 1 on New Game.

### Tests first

- [x] T011 [P] [US1] Write and run failing score and live-game validation tests in src/features/ship-movement/tests/agility.test.ts and src/features/ship-movement/tests/movement-game.test.ts for “an integer from 8 through 20,” “`owner: 'player-1' | 'player-2'`, fixed mapping to corresponding identity,” “Exactly two distinct occupied positions,” readonly snapshots, and live positions outside starting zones; verify all 13 modifiers using `Math.floor((score - 10) / 2)` and allowance using `Math.max(0, modifier)`.
- [x] T012 [P] [US1] Write and run failing full-game generation tests in src/features/ship-movement/tests/game-factory.test.ts for all 13 buckets, bucket boundaries, all 169 score pairs, separate placement/stat draws, repeated scores, invalid draws and deterministic 1,000-game coverage; enforce “Creation draws, in order, Ship 1 placement, Ship 2 placement, Ship 1 agility, Ship 2 agility,” “Separate finite `[0,1)` draws map to `8 + floor(u * 13)`,” and no rerolls or partial publication.
- [x] T013 [P] [US1] Write and run failing session tests in src/features/ship-movement/tests/turn-session.test.ts for Player 1 first, readonly phase snapshots, movement locking, shorter-move turn consumption, invalid commands, explicit passes, retained stats, 50 completed moves and 20 acknowledged passes; enforce “Identity counters are safe integers and must reject overflow rather than silently wrap” and matching game/turn/move identity on completion.
- [x] T014 [P] [US1] Write and run failing DOM/UI contract tests in src/features/ship-movement/tests/turn-controls.test.ts and src/features/ship-movement/tests/controller.test.ts for distinct agility/modifier display, active ship, native Pass turn button, captured displayed-turn token, non-left/invalid input and highlight removal during flight; add only necessary multiple-button behavior to src/features/game-setup/tests/fixtures/FakeDom.ts.

### Models and services

- [x] T015 [US1] Implement immutable validated AgilityStat and MovementGame classes in src/features/ship-movement/domain/AgilityStat.ts and src/features/ship-movement/domain/MovementGame.ts to satisfy T011; preserve “Scores are retained for the lifetime of one game” and “Immutable snapshot; moving creates a replacement placement rather than mutating setup history,” with no Phaser dependency.
- [x] T016 [US1] Implement composed full-game creation in src/features/ship-movement/domain/MovementGameFactory.ts using GameSetupFactory and injected RandomSource, and broaden src/features/game-setup/domain/RandomSource.ts documentation beyond placement; make T012 green without changing the setup factory's two-draw contract.
- [x] T017 [US1] Implement TurnSession and discriminated ready/moving/awaiting-pass/disposed snapshots in src/features/ship-movement/domain/TurnSession.ts; cache current reachability, validate current turn on selection/pass, keep “Authoritative ship position stays at origin until successful completion,” commit matching arrivals exactly once, switch player and refresh tokens/highlights, and make T013 green.

### Presentation and application integration

- [x] T018 [US1] Write and run failing shared-view tests in src/features/board/tests/board-view.test.ts for exact destination overlays and separately movable ship/label groups, then extend src/features/board/presentation/BoardView.ts with non-color-only highlights, independent visuals and typed ship-position updates while preserving setup readiness and cleanup.
- [x] T019 [US1] Extend src/features/game-setup/presentation/GameSetupControls.ts with a stable HUD host and BoardSnapshot-based live-position summary updates; implement src/features/ship-movement/presentation/TurnControls.ts with score/modifier labels, polite turn status, reason and Pass turn button, stable DOM identity/focus and listener disposal, making T014's controls tests green.
- [x] T020 [US1] Define typed cancellable animator and identity-carrying failure boundaries and implement src/features/ship-movement/presentation/MovementController.ts to connect TurnSession, logical board input, BoardView and TurnControls; lock synchronously before starting flight, use cached routes and current tokens, ignore invalid/stale input and make T014's controller tests green. Define recovery for matching startup/mid-flight failure: invalidate the move before cancellation, restore its authoritative origin visual, retain the player, issue a fresh turn token, recompute legal input and show a retryable movement error without a position commit or handoff; verify the recovery implementation against T021/T025 before completing those tasks.
- [x] T021 [US1] Write and run failing baseline animation and scene tests in src/features/ship-movement/tests/flight-animator.test.ts and src/features/ship-movement/tests/scene-lifecycle.test.ts for continuous route-following, one completion, cancelled-flight noncompletion, flight startup and mid-flight failures, logical left-click dispatch, readiness gating and shutdown/disposal cleanup; add failing controller recovery tests in src/features/ship-movement/tests/controller.test.ts before implementing that recovery behavior.
- [x] T022 [US1] Implement baseline route animation in src/features/ship-movement/presentation/PhaserFlightAnimator.ts using Phaser progress tweening, 250 ms per logical step, exact arrival and cancellation, with typed startup/mid-flight failure notification and at most one terminal success/failure notification per move; compose it in src/features/ship-movement/presentation/MovementScene.ts with the controller/shared view and document the Phaser.Scene inheritance justification. Implement the matching failure-recovery transition in src/features/ship-movement/presentation/MovementController.ts and src/features/ship-movement/domain/TurnSession.ts only after T021's behavioral red tests, then make T021 green. US3 replaces route-following visuals with shortest continuous flights; logical BFS legality remains unchanged.
- [x] T023 [US1] Write and run failing application integration tests in src/features/ship-movement/tests/game-application.test.ts for atomic placements/stats replacement, initial generation errors, New Game during flight, queued activations, stale postrender/completion rejection, and generation failure preserving the prior complete game/revision/animation; retain applicable assertions from src/features/game-setup/tests/game-application.test.ts.
- [x] T024 [US1] Recompose src/app/GameApplication.ts with MovementGameFactory, TurnSession, MovementScene and TurnControls, preserving the existing public random-source injection, startup errors, serialized New Game requests and revision-readiness guards; stage the entire replacement before invalidating old work, enable New Game during flight, and make T023 green.
- [x] T025 [US1] Extend lifecycle regressions in src/features/ship-movement/tests/controller.test.ts and src/features/ship-movement/tests/game-application.test.ts for duplicate arrival, delayed pass activation after a new turn, reset near completion, disposed callbacks and safe-integer identity overflow. Verify failed flights restore the origin, retain the player and permit retry, and that late success/failure callbacks cannot alter the recovered turn or a replacement game; capture a behavioral red test for each uncovered defect before correcting src/features/ship-movement/domain/TurnSession.ts, src/features/ship-movement/presentation/MovementController.ts or src/app/GameApplication.ts, then record green results.
- [x] T026 [US1] Update movement page copy and visual layout in src/features/game-setup/presentation/GameSetupControls.ts and src/app/styles.css, locating and preserving the existing stylesheet entry, so current positions, active player, stats, highlights and Pass remain readable at supported FIT scales; retain button focus and separate shell-readiness versus turn-status ownership.
- [x] T027 [US1] Add deterministic live-game presets and a test-only entry in src/features/ship-movement/tests/browser/fixture.html and src/features/ship-movement/tests/browser/fixture.ts for center, straight, one-immobile, both-immobile and reset-during-flight states using the production scene/controller rather than production stat editing; include preset reset and game/turn/move timing observation.
- [x] T028 [US1] Run the existing agility, factory and controls suites in src/features/ship-movement/tests/agility.test.ts, src/features/ship-movement/tests/game-factory.test.ts and src/features/ship-movement/tests/turn-controls.test.ts; confirm they collectively cover every FR-002 modifier, all 169 score pairs, deterministic 1,000-game initialization and separate displayed score/modifier values, adding only missing assertions and recording mapping/draw-order review in specs/002-ship-turn-movement/development.md.
- [x] T029 [US1] Execute the normal-play and US1 fixture checks from specs/002-ship-turn-movement/quickstart.md for explicit passes, invalid mouse buttons, shorter moves, 50-turn alternation, scaled targeting and mid-flight New Game; record actual browser evidence or clearly pending unavailable checks in specs/002-ship-turn-movement/development.md.
- [x] T030 [US1] Run `npm run typecheck`, feature/setup tests, lint and build for the MVP, refactor with all affected tests green, and record results and the outstanding US3 shortest-flight acceptance in specs/002-ship-turn-movement/development.md.

**Checkpoint**: US1 is a playable movement MVP with legal routes and basic continuous route-following animation. Direct/diagonal shortest flight and circular obstacle arcs remain US3 requirements, so this is not acceptance of the entire feature.

## Phase 4: User Story 2 — Navigate Around an Enemy (Priority: P2)

**Goal**: Verify that enemy blocking, affordable detours and board edges stay consistent across reachability, click acceptance, selected routes and refreshed turns.

**Independent Test**: Ship 1 at (5,4), enemy at (5,5), target (5,6): target absent at allowance 2 and present via an empty four-step route at allowance 4. Check alternate routes, edge/corner detours and current occupancy after arrival.

**Shared-core note**: Foundation already implements blocker-safe BFS for US1. These acceptance tests may pass immediately as new regression evidence. Any uncovered behavior change must first have its own observed red test; do not add a second routing algorithm or force failures in correct behavior.

- [x] T031 [P] [US2] Expand src/features/ship-movement/tests/reachability.test.ts to at least 20 independently specified center/edge/corner/blocked/direct/detour arrangements, alternate-path ties and five-step limits; validate exact destination sets and shortest route invariants with manual expectations or an independent bounded-step oracle, not production BFS.
- [x] T032 [P] [US2] Add enemy-detour controller/scene acceptance tests in src/features/ship-movement/tests/detour-integration.test.ts proving highlights and selected route agree, occupied destinations cannot be selected, off-board bypasses are rejected and occupancy/highlights refresh after each move; use distinct fixtures rather than editing US1 tests concurrently.
- [x] T033 [US2] Address only demonstrated routing or integration gaps from T031/T032 in src/features/ship-movement/domain/Reachability.ts and src/features/ship-movement/presentation/MovementController.ts, retain all regression cases and record actual red-green evidence or already-passing coverage in specs/002-ship-turn-movement/development.md.
- [x] T034 [US2] Add a positive-allowance fully-surrounded routing fixture in src/features/ship-movement/tests/reachability.test.ts and no-destination pass-boundary coverage in src/features/ship-movement/tests/detour-integration.test.ts; keep extra blockers test-only because the production game contains exactly two ships, and correct any demonstrated defect test-first.
- [x] T035 [US2] Extend src/features/ship-movement/tests/browser/fixture.ts with blocked-direct, affordable enemy-detour and board-edge presets from specs/002-ship-turn-movement/quickstart.md; confirm the target across an enemy requires four logical steps even when origin/destination share a row.
- [ ] T036 [US2] Run routing/integration regressions and browser detour checks, including all legal alternate routes and no off-board travel, recording exact arrangements, counts and actual outcomes in specs/002-ship-turn-movement/development.md.

**Checkpoint**: US2 is independently verifiable against its deterministic arrangement and the shared route contract. No new production obstacle type or route-selection UI is introduced.

## Phase 5: User Story 3 — Follow Smooth, Collision-Free Flight (Priority: P3)

**Goal**: Fly directly in continuous space when clear and take the shortest circular-arc detour around an enemy without visual overlap, leaving the board or prematurely handing off the turn.

**Independent Test**: Observe unobstructed diagonal flight and a same-row enemy detour. Require direct shortest flight when clear, a shortest tangent-and-circular-arc path when blocked, exact arrival, a single post-arrival handoff and cancellation-safe New Game behavior.

### Tests first

- [x] T037 [P] [US3] Write and run failing continuous-flight tests in src/features/ship-movement/tests/space-flight-path.test.ts for direct diagonal motion, obstacle tangent/arc/tangent shortest paths, exact circular clearance, tangent continuity, and analytic board-edge bounds.
- [x] T038 [P] [US3] Write and run failing Phaser adapter tests in src/features/ship-movement/tests/flight-animator.test.ts for direct diagonal versus blocked circular-arc paths, numeric ellipseTo arguments, one whole-flight easing, 250–1,250 ms logical durations, nullable point/progress handling, exact destination snap, and cancelled/duplicate callback rejection.

### Implementation and integration

- [x] T039 [US3] Implement immutable direct-line and circular-arc segments in src/features/ship-movement/presentation/SpaceFlightPath.ts; choose the shortest feasible tangent/arc route around the combined 48 px ship envelopes, constrain it to the board-safe center rectangle, and make T037 green independently of logical BFS turns.
- [x] T040 [US3] Upgrade src/features/ship-movement/presentation/PhaserFlightAnimator.ts to assemble direct lines and numeric Phaser `ellipseTo` arcs, sample with `getPoint` and one Sine ease-in/out counter tween, handle actual runtime nullability at this adapter only, and make T038 green while preserving cancellation tests.
- [x] T041 [US3] Write and run failing visual-envelope tests in src/features/board/tests/board-view.test.ts for independently positioned circle/stroke/label groups and bounded effects, then enforce the reserved 24 px visual radius in src/features/board/presentation/BoardView.ts and src/features/board/presentation/BoardGeometry.ts; do not enlarge markers or labels beyond the clearance proof.
- [x] T042 [US3] Add and run failing curved-flight lifecycle regressions in src/features/ship-movement/tests/scene-lifecycle.test.ts for resets before start, mid-flight and near completion plus shutdown and deferred old callbacks; correct any uncovered order/identity defects in src/features/ship-movement/presentation/MovementScene.ts, src/features/ship-movement/presentation/MovementController.ts and src/app/GameApplication.ts, invalidating identities before tween cancellation.
- [x] T043 [US3] Extend src/features/ship-movement/tests/browser/fixture.ts with actual-Phaser direct/arc flight observations, segment/end-point overlays and timestamps for turn start, actionable highlights, selection, arrival and next highlights, reusing named presets without changing production interaction behavior.
- [ ] T044 [US3] Execute at least ten actual-browser direct/diagonal/arc/edge animations using src/features/ship-movement/tests/browser/fixture.html, measure rendered label bounds and scaled visual envelopes, and record no overlap with the other ship, teleport or off-board flight in specs/002-ship-turn-movement/development.md; mark unavailable checks pending.
- [ ] T045 [US3] Manually measure highlight latency ≤200 ms, move completion ≤1.5 seconds and next playable highlights ≤200 ms using src/features/ship-movement/tests/browser/fixture.ts in the reference environment defined in specs/002-ship-turn-movement/spec.md; record the exact configuration before testing and retain individual timings for each acceptance move, reporting every threshold failure rather than averaging it away. Diagnose and fix only measured failures with demonstrating Node tests, recording observations in specs/002-ship-turn-movement/development.md.
- [x] T046 [US3] Run geometry, animator, controller, scene and setup regressions, refactor within class/feature boundaries with tests green, and document the final shortest-flight acceptance against FR-010–FR-012 and SC-004/SC-005 in specs/002-ship-turn-movement/development.md.

**Checkpoint**: All three stories meet their behavior contracts; browser evidence remains distinct from mocked tests and analytic route proofs.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete full-feature regression, usability and constitution evidence.

- [ ] T047 [P] Run the five first-time-player trials specified in specs/002-ship-turn-movement/quickstart.md, requiring at least four participants to identify the active ship, choose a legal destination and recognize handoff within 30 seconds, and record actual observations or pending recruitment in specs/002-ship-turn-movement/usability.md.
- [x] T048 Review src/features/board/, src/features/ship-movement/, src/features/game-setup/ and src/app/GameApplication.ts for acyclic capability dependencies, one canonical coordinate class, strict domain contracts, class composition, documented Phaser inheritance/type-boundary exceptions and listener/tween cleanup; record findings and any required test-first corrections in specs/002-ship-turn-movement/development.md.
- [x] T049 Run the full `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build` checks, resolve any introduced failures, and record final actual commands/results in specs/002-ship-turn-movement/development.md.
- [ ] T050 Execute `npm run preview` after the production build and repeat normal movement, acknowledged-pass, scaled-pointer and New Game-during-flight checks from specs/002-ship-turn-movement/quickstart.md, confirming the test fixture is not imported into the production entry; record browser/version and results in specs/002-ship-turn-movement/development.md.
- [x] T051 Update README.md with local turn controls, independent random agility, separate modifiers, explicit Pass turn behavior, New Game and the feature validation-guide link; reconcile specs/002-ship-turn-movement/quickstart.md with the actual implemented fixture and command paths.
- [x] T052 Reconcile every FR-001–FR-015 and SC-001–SC-008 with implementation/test/browser/usability evidence in specs/002-ship-turn-movement/development.md, identify any unverified outcomes explicitly, and mark only genuinely completed tasks in specs/002-ship-turn-movement/tasks.md without treating specification-quality checkboxes as implementation acceptance.

## Dependencies & Execution Order

### Phase dependencies

```text
Setup T001–T003
  └─ Foundation T004–T010
       └─ US1 T011–T030 (playable MVP)
            ├─ US2 T031–T036 (detour acceptance)
            └─ US3 tests/geometry T037–T039 (can overlap US2)
                 └─ US3 integrated flight T040–T046
                      └─ Final acceptance T047–T052
```

- T001 precedes T002/T003. T002 and T003 touch different files; T003 may run concurrently with discovery configuration once baseline review completes.
- T004 → T005 → T006 → T007 is the extraction/migration sequence; these share consumers and must not run concurrently. T008 may overlap extraction after test discovery and canonical board contracts are available; T009 follows its observed red result, and T010 gates all stories.
- Within US1: T011 → T015; T012 + T015 → T016; T013 + T015 + foundation → T017; T014 + T017 → T019/T020; T018 follows foundation; T020 defines the failure contract, T021 establishes behavioral red recovery tests, and T022 implements recovery and animation; controller/visual/animator integration precedes T023/T024; T025–T030 follow the integrated application. Separate tests can be written concurrently, but shared fixtures require coordination.
- US2 depends on US1's integrated movement and validates its existing BFS. T031 and T032 are separate-file acceptance expansions; T033/T034 follow their outcomes, then T035/T036 establish the browser checkpoint.
- US3 pure geometry/adapter tests can begin once US1 contracts stabilize. T037 → T039 and T038 → T040; T040 also needs T039. Integrated edge/detour acceptance uses US2's presets and routes, so finish T035 before T043–T046.
- Final checks depend on all stories. T047 uses a separate evidence file and may run alongside code review after browser-ready US3; T049 follows any code corrections, T050 follows the build, and T052 requires all available evidence.

### Story dependencies and independent testing

US1 is independently playable after foundation. US2 and US3 each have focused deterministic verification but share the US1 session/controller rather than duplicating them. Neither requires a second game loop. US3's geometry can be tested independently of Phaser; its end-to-end acceptance uses the integrated UI and US2 detour fixture. Priority order is the default, with only explicit nonconflicting work parallelized.

## Parallel Execution Examples

### User Story 1

After foundation, write/run T011 (agility/live-game tests), T012 (factory tests), T013 (session tests), and T014 (UI tests) on their distinct files. Gate each corresponding implementation on its own behavioral red result and collaborator contracts. Integrate shared controller/app/DOM files serially; do not run T019 and T026 simultaneously against GameSetupControls.ts.

### User Story 2

After US1, T031 (route acceptance sets) and T032 (detour integration) can run concurrently. Coordinate any shared fixtures first. T033 production fixes wait for both results; T035's browser preset changes are serialized with any other fixture.ts editing.

### User Story 3

T037 (pure geometry tests) and T038 (Phaser adapter tests) can run concurrently after US1. Once each red result is captured, T039's geometry implementation and unrelated envelope-test preparation may overlap, but T040 waits for the finished path contract and T038. Do not overlap T043 fixture edits with T035.

## Implementation Strategy

### MVP first

Complete setup, foundation and US1. Demonstrate correct random stats, legal highlighted destinations, continuous basic route flight, alternating turns, explicit passes and safe reset. Validate independently before deep detour acceptance and continuous shortest-flight updates. The MVP is a deliberate intermediate checkpoint, not a waiver of US3 for full delivery.

### Incremental delivery

1. Protect existing setup while extracting shared board capabilities.
2. Deliver US1 with TDD evidence and a playable local movement loop.
3. Verify US2 with exhaustive practical route arrangements and integrated detour fixtures, correcting only demonstrated gaps.
4. Deliver US3's direct/diagonal and circular-arc flights, cancellation-safe integration and actual-browser geometry/timing evidence.
5. Complete cross-cutting checks and user observation, preserving pending status for genuinely unavailable validation.

### Coverage and entity ownership

| Requirement / entity                                                           | Primary tasks                     |
| ------------------------------------------------------------------------------ | --------------------------------- |
| BoardPosition, BoardSnapshot, ShipIdentity; preserved setup                    | T004–T010                         |
| AgilityStat, MovementShip, MovementGame; FR-001–FR-004/FR-015; SC-001/SC-008   | T011–T017, T019, T024, T028       |
| ReachabilityResult, LegalRoute; FR-005–FR-009; SC-002                          | T008–T009, T018, T020, T031–T036  |
| TurnSession, PendingMove, pass identities; FR-005/FR-012/FR-013; SC-003/SC-007 | T013–T025, T029                   |
| FlightPath, FlightHandle; FR-010–FR-012; SC-004/SC-005                         | T021–T022, T037–T046              |
| Atomic resets and failure lifecycle; FR-014; SC-007                            | T023–T025, T027, T029, T042, T050 |
| Understandability; SC-006                                                      | T019, T026, T047                  |
| Constitution, full regression and evidence                                     | T001, T010, T030, T046, T048–T052 |

## Notes

- There are 52 tasks: setup 3, foundation 7, US1 20, US2 6, US3 10, final acceptance 6.
- Parallel markers denote eligible work, not automatic permission to delegate or change task order.
- Preserve user clarification: independent random integer agility 8–20 and a button-acknowledged pass; never replace low-score rolls or automatically pass turns.
- Do not commit, amend or push unless explicitly requested.
