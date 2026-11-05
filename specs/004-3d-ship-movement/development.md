# Development Record: Three-Dimensional Ship Movement

## User Story 2 — 3D ship movement

### Red-green-refactor evidence

- Added the independent cube route oracle, movement snapshot/session assertions, and cube-space flight tests before implementing the corresponding behavior.
- Red: `npm test -- src/features/ship-movement/tests/reachability.test.ts src/features/ship-movement/tests/movement-game.test.ts src/features/ship-movement/tests/turn-session.test.ts` reported 10 expected behavioral failures across 3 suites. The previous implementation collapsed Z coordinates, returned planar neighbors, omitted cube dimensions/occupancy, and did not retain 3D routes.
- Green: the same command passed all 18 tests after migrating reachability and movement snapshots to `CubePosition`/`CubeSnapshot`.
- Red: `npm test -- src/features/ship-movement/tests/cube-flight-path.test.ts src/features/ship-movement/tests/flight-animator.test.ts` reported 6 expected behavioral failures for missing 3D endpoints, detours, animation progress/completion, deadlines, and malformed paths.
- Green: the same command passed all 7 tests after adding `CubeFlightPath` and the cancellable `ThreeFlightAnimator`.
- Phaser compatibility regression: `npm test -- src/features/ship-movement/tests/phaser-flight-animator.test.ts src/features/ship-movement/tests/flight-animator.test.ts` passed 10 tests after preserving and cube-typing the legacy adapter coverage.
- Green: the same command passed all 7 tests after adding `CubeFlightPath` and the cancellable `ThreeFlightAnimator`.
- Production turn and UI regressions: `npm test -- src/features/board/tests src/features/game-setup/tests src/features/ship-movement/tests src/features/ship-combat/tests` passed 266 tests across 41 files.
- Final suite: `npm test` passed 284 tests across 42 files.
- Static and production checks passed: `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`.

### Production-path movement coverage

- `BattleSession` is the only production authority for 3D movement and retains revision, turn token, move ID, pending-origin, recovery, stale-completion, one-move-per-turn, and skip-only-when-immobile behavior.
- The combat scene dispatches typed cube targets on pointer release. Orbit drags remain selection-free through `CubeOrbitControls`' existing 5 CSS-pixel gesture arbitration.
- Legal destinations are highlighted on the 125-marker Three.js mesh. The flight animator uses direct paths when clear and follows the validated blocker-free route when a direct path intersects the other ship. Animation duration is 250 ms per logical step, with a five-step maximum.
- The production browser fixture now provides a deterministic six-axis movement check that exercises actual marker ray picks, highlighted destinations, pointer-release dispatch, arrival positions, turn handoffs, and elapsed movement time.

### Browser and usability observations

- The browser fixture source was typechecked. A cached Chromium executable was present, but it could not start: the runtime image is missing `libnspr4.so`, `libnss3.so`, `libnssutil3.so`, `libsmime3.so`, and `libasound.so.2`.
- Consequently, no visual, real-device movement-time, orbit/pick alignment, or first-time-player usability results are claimed here. Those checks remain part of the full feature acceptance pass.

### Constitution review

- **Gameplay feature cohesion:** movement legality and flight presentation remain under `ship-movement`; the live battle and action authority remain in `ship-combat`; the reusable cube renderer and typed coordinates remain in `board`.
- **Specific, strong types:** movement snapshots, destinations, routes, pending moves, and picks use validated `CubePosition`; render-space animation points are isolated in the presentation boundary.
- **Class-based composition:** reachability, session, controller, cube view, flight path, and animator remain focused collaborators. Phaser/Three-specific behavior stays in presentation adapters.
- **Test-driven development:** expected behavior failures and passing regressions are recorded above.

## User Story 3 — ship rotation and 3D torpedoes

### Red-green-refactor evidence

- Red: `npm test -- src/features/ship-combat/tests/battle-session.test.ts src/features/ship-combat/tests/combat-turn-controls.test.ts src/features/ship-combat/tests/combat-controller.test.ts src/features/ship-combat/tests/combat-scene.test.ts` produced 11 expected behavior failures: rotation commands/phases were absent, rotation controls were not rendered, and controller/scene rotation requests did not reach the battle/view.
- Green: the same four-suite command passed all 55 tests after adding rotation identity/state transitions, native signed-axis controls, controller locking/cancellation, and the scene-to-Three animation adapter.
- Renderer regression: `npm test -- src/features/board/tests/cube-view.test.ts` passed 6 tests, including quarter-turn interpolation, cancellation, and stale frame suppression.
- Torpedo regression: `npm test -- src/features/ship-combat/tests/three-torpedo-animator.test.ts src/features/ship-combat/tests/torpedo-path.test.ts` passed 20 tests for 3D cube endpoints, hit/miss timing and effects, cancellation, disposal, and terminal identities. The torpedo adapter test was run after the new adapter existed; its missing-module setup state was not treated as behavioral TDD evidence.

### Production-path rotation coverage

- `BattleSession` retains the active player, turn token, ship cell, stats, hit points, and ready phase while a revision/token/rotation-ID-bound `PendingRotation` is in progress. Matching completion commits only orientation; matching failure restores the previous ready phase and orientation. Stale/wrong-owner/out-of-phase actions are ignored.
- The six native buttons expose signed X/Y/Z quarter turns by visible text and accessible labels. They are available to the active ship in movement-ready, no-move, and attack-ready phases, and become disabled while rotating.
- `ThreeCubeView` animates ship quaternions independently from the camera, cancels active rotation on replacement/disposal, and commits the target basis only after the matching controller completion.
- Production combat uses `ThreeTorpedoAnimator` and `CubeTorpedoPath`; hit/miss resolution remains in `BattleSession`, hit contact begins at 850 ms, and the effect/readiness terminal point remains 1,150 ms (under the existing 1,500 ms maximum).
- The browser fixture now exposes **Verify ship rotations and 3D torpedo** and `window.cubeFixture.verifyShipRotations()`. It checks both ships’ six signed turns, state preservation, orbit independence, current-cell torpedo endpoints, unchanged hit resolution, New Game orientation reset, and cancellation of an interrupted rotation.

### Browser and usability observations

- The fixture was served successfully by Vite (`HTTP 200` for `fixture.html`) and its TypeScript compiled. Headless Chromium could not load because the image lacks the shared libraries listed in the Story 2 observation above; the WebGL2 run and visual/timing/usability checks therefore remain unexecuted.
- No browser-visible orientation, WebGL2, input alignment, torpedo timing, or first-time-player usability outcome is claimed. The automated Node tests verify orchestration and state transitions only.

### Cross-cutting migration and constitution review

- Retired `BoardPosition`, `BoardSnapshot`, `BoardGeometry`, and `BoardView`; canonical coordinates, snapshots, combat positions, and movement selections now use independent `CubePosition`/`CubeSnapshot` values. The remaining Phaser fallback projection is explicitly presentation-only and accepts cube-typed identities.
- Removed the superseded flat geometry/view/snapshot test files; cube value, cube view, production movement, combat, and lifecycle coverage remain in the feature suites.
- Re-checked the project constitution: `board` owns renderer-independent cube values and the Three.js view; `BattleSession` remains sole production action authority; Three.js stays in presentation adapters; rotation is typed and stale-callback guarded; the Phaser compatibility projection is cube-typed and is not the production battle surface. No exception is needed.

## Final automated validation

- `npm test`: passed 290 tests across 40 files.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run format:check`: passed.
- `npm run build`: passed; Vite emitted its existing large-bundle advisory for the Three.js client chunk.
- Production fixture HTTP check: `curl -I --max-time 10 http://127.0.0.1:5173/src/features/ship-combat/tests/browser/fixture.html` returned HTTP 200.
- Actual WebGL2 fixture launch was attempted with the cached Chromium binary but failed before startup because `libnspr4.so` (and the related NSS/audio shared libraries) are unavailable. T042's real-browser checks remain unverified; no browser visual/timing/usability result is claimed.

## Board-size update — 5 × 5 × 5

- Changed the shared cube from 10 positions per axis to 5, updating coordinate validation and stable indexing, cube snapshots, reachability bounds, 3D/2D rendering projections, flight paths, torpedo paths, UI labels, and browser fixtures.
- Preserved the existing two-layer start-region layout: Ship 1 uses Y=1/2 and Ship 2 Y=4/5, with 50 eligible positions each. The five-step movement cap, actions, turns, combat behavior, ship orientation, and orbit interactions remain unchanged.
- Updated the coordinate and setup tests to exhaustively cover all 125 cells and all 50 eligible starts per ship; adjusted movement, combat, renderer, and animation fixtures to use valid smaller-cube coordinates.
- Validation passed: `npm test` (290 tests across 40 files), `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`. The build retains the existing Three.js bundle-size advisory.
- The real-browser/WebGL2 acceptance fixture was updated for 125 markers but was not launched for this size change; visual picking and timing remain covered by the existing browser acceptance process.
