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
- Legal destinations are highlighted on the 1,000-marker Three.js mesh. The flight animator uses direct paths when clear and follows the validated blocker-free route when a direct path intersects the other ship. Animation duration is 250 ms per logical step, with a five-step maximum.
- The production browser fixture now provides a deterministic six-axis movement check that exercises actual marker ray picks, highlighted destinations, pointer-release dispatch, arrival positions, turn handoffs, and elapsed movement time.

### Browser and usability observations

- The browser fixture source was typechecked, but its WebGL2/browser interaction check was not run in this environment because no Chromium, Chrome, or Firefox executable is available.
- Consequently, no visual, real-device movement-time, orbit/pick alignment, or first-time-player usability results are claimed here. Those checks remain part of the full feature acceptance pass.

### Constitution review

- **Gameplay feature cohesion:** movement legality and flight presentation remain under `ship-movement`; the live battle and action authority remain in `ship-combat`; the reusable cube renderer and typed coordinates remain in `board`.
- **Specific, strong types:** movement snapshots, destinations, routes, pending moves, and picks use validated `CubePosition`; render-space animation points are isolated in the presentation boundary.
- **Class-based composition:** reachability, session, controller, cube view, flight path, and animator remain focused collaborators. Phaser/Three-specific behavior stays in presentation adapters.
- **Test-driven development:** expected behavior failures and passing regressions are recorded above.
