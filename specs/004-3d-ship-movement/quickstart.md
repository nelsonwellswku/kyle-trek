# Quickstart Validation: Three-Dimensional Ship Movement

**Status**: Implementation validation guide. Planning defines future tests and browser scenarios; it does not implement the feature or claim test results.

## Prerequisites

- Node 24, npm 11, and locked dependencies (`npm ci` if needed), including Three.js 0.186.1.
- A desktop browser with WebGL2 and a mouse; run commands from the repository root.
- For timed acceptance use stable desktop Chromium in a foreground visible tab at 1280 × 800 with hardware acceleration, at least four logical CPU cores and 8 GB RAM. Disable CPU/network throttling and record browser, OS, CPU, RAM, GPU and display refresh rate. This is a measurement baseline, not a minimum runtime profile.
- Read [data-model.md](data-model.md) for valid coordinates, routes and turn transitions and [cube-ui.md](contracts/cube-ui.md) for pointer, camera and action behavior.

## Test-first implementation and automated checks

For every behavior slice, first add a meaningful test, run it and observe failure for the expected missing behavior. Implement only after that red state, then verify green, refactor and rerun affected regressions. Record the command, expected failure and passing result in the feature's future `development.md`; a missing-module/build/setup failure is not TDD evidence.

After planned tests are present, run:

```bash
npm test -- src/features/board/tests
npm test -- src/features/game-setup/tests
npm test -- src/features/ship-movement/tests
npm test -- src/features/ship-combat/tests
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Vitest already discovers `src/features/*/tests/**/*.test.ts` and fails when no tests are selected. Keep the deterministic real-browser fixture out of production imports.

### Deterministic acceptance cases

| Coverage                    | Required checks                                                                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coordinates / SC-001        | All 1,000 valid X/Y/Z combinations map bijectively; each boundary accepted; zero, 11, fractional and non-finite values rejected                                                                                 |
| Setup / SC-008              | Script 200 controlled indices for each ship; every index maps once into the assigned Y band; two draws remain independent; New Game creates fresh state and Player 1 starts                                     |
| Reachability / SC-003       | Independent route oracle for all six neighbors, center/edge/corner, blocked route, affordable detour, occupied destination, zero and maximum allowance; exact set and shortest cost                             |
| Turns / SC-004              | One movement per turn, movement before attack/end-turn, acknowledged no-move skip, optional End turn, exactly one handoff, invalid/non-active clicks ignored                                                    |
| Orientation / SC-005        | Enumerate all 24 valid orientations; six signed quarter-turns; inverse pairs restore orientation; order-dependent rotations compose correctly; positions/stats/HP unchanged                                     |
| Orbit and picker / SC-002   | Exactly 1,000 unique marker identities; decoration cannot be picked; deterministic azimuth/elevation sweep finds a distinct camera pose for every marker; each test ray returns the expected coordinate         |
| Click/drag arbitration      | Stationary click selects at pointer-up; drag at or above 5 CSS px only orbits; repeated clicks during a gameplay animation cause no extra action; first click after orbit uses the updated camera               |
| Battle state                | Movement and rotation preserve all unrelated combat fields; rotation is rejected for non-active ship, attacking/finished/disposed phases; reset rejects stale move/rotation/torpedo callbacks                   |
| Renderer lifecycle          | WebGL2 creation failure reports an error; resize keeps canvas bounds aligned; New Game reuses one view; disposal removes canvas/listeners/observers and stops rendering                                         |
| Effects and timing / SC-007 | 3D flight and torpedo effects remain attached to correct positions across orbit; hit/miss/damage outcomes unchanged; each move completes within 1.5 seconds and each reachability display appears within 300 ms |

Use scripted randomness and independent expected routes. Uncontrolled random trials are not a fairness oracle. Renderer mocks verify orchestration but cannot establish marker visibility, hit target size, frame timing or visual correctness.

## Normal browser play

Start Vite:

```bash
npm run dev
```

Open `http://127.0.0.1:5173/`.

1. Confirm one visible cube in a three-quarter view, all three axis labels, exactly two distinct ships, ship coordinate summaries, active player and existing combat stats.
2. Drag with the primary mouse button. Confirm the view orbits and neither ship, turn, stats nor combat state changes. Release after a drag and confirm no cell is selected.
3. Rotate to alternate sides and angles. Inspect the open lattice and directly select known boundary and interior cell markers. Confirm the hover/readout coordinate matches the marker and that all cells can be isolated from some view.
4. On a movement-ready turn, click a legal cell without dragging. Confirm the 3D ship animation arrives at the exact X/Y/Z cell, then the same player receives the existing attack-or-end-turn choice. Test legal movement in all six directions over controlled turns.
5. Attempt an occupied, unreachable, ambiguous, off-cube or non-active selection. Confirm no position, turn or combat value changes. For overlapping markers, orbit until the target is distinguishable before selecting.
6. Use each of the six rotation controls on an active ship before its attack/end-turn choice. Confirm visible ship orientation change, stable cell and battle state, and no rotation by the non-active player. Repeat with Tab/Enter and Tab/Space to confirm native keyboard operation.
7. Complete hit/miss attacks and a lethal hit. Confirm the displayed effects originate/target the current 3D ship positions, combat calculations are unchanged, one handoff occurs, and the winner/final state is locked.
8. Start New Game during movement or an effect. Confirm old effects/callbacks cannot alter the replacement battle, Player 1 begins, ship orientation resets, and no additional canvas/listener is created. Resize the board host and verify orbit/picking alignment.

## Reproducible actual-browser fixture

Update the production-path combat fixture at:

`http://127.0.0.1:5173/src/features/ship-combat/tests/browser/fixture.html`

It must compose the real `CombatScene`, `BattleSession`, `CombatController` and Three.js view, with deterministic setup, stats and attacks. Fixture-only controls may set validated positions, orientation, active phase and outcomes; they must not be imported into production or weaken production initialization validation.

| Preset                | Setup / action                                        | Expected result                                                                            |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Default three-quarter | New game                                              | Cube axes, 1,000 cell markers, two opponents and initial positions legible                 |
| Interior marker       | Known interior coordinate; orbit around cube          | Target marker can be separated and ray-picked to exact X/Y/Z                               |
| Projection overlap    | Known aligned markers from axis view                  | Nearest visible marker readout is stable; orbit reveals deeper marker; no hidden selection |
| Six directions        | Center ship, positive movement allowance              | Each of ±X, ±Y, ±Z is reachable when unblocked; position commits exactly                   |
| Blocked path          | Opponent blocks one shortest route                    | Destination only offered when another legal six-neighbor route fits the allowance          |
| Rotation composition  | Ship facing +Y, apply two different signed axis turns | Visible resulting orientation matches basis composition; position/turn/stats unchanged     |
| Orbit during turn     | Drag while movement-ready and attack-ready            | Camera changes only; no movement, attack, roll or handoff                                  |
| Movement/torpedo      | Controlled destination and hit/miss outcomes          | Effects follow 3D ship positions; results and handoff/winner are once-only                 |
| Reset interruption    | New Game during flight/rotation/torpedo               | Old effect is disposed; fresh battle and orientation cannot receive old callback           |
| Resize/disposal       | Change host size/device-pixel ratio, then dispose     | Both canvases align; exact picks persist; resources/listeners are removed once             |

The fixture's **Verify ship rotations and 3D torpedo** control runs the signed-axis rotation, camera-independence, current-position attack, outcome-preservation, reset, and stale-rotation checks through the production combat path.

## Visual, timing and usability acceptance

- Test at least 20 coordinates across faces, edges, corners and interior. Sweep orbit poses over the supported full azimuth/elevation range; for each coordinate record a view where its marker is distinguishable and a raycast returns the same coordinate. Include views where several markers overlap and confirm the nearest marker is not confused with a hidden target.
- Observe all six movement directions, blocked routes, detours and edge movement. Confirm the legal destination set uses six-neighbor route cost and no route leaves the cube or crosses the opposing ship.
- Observe ship rotation around each signed axis; confirm orientation persists until changed/New Game and never changes occupancy or combat values.
- Measure every selected movement from accepted click to exact arrival; each must complete within 1.5 seconds. Measure movement-choice visibility from playable turn start; each must be within 300 ms. Report each failed sample, not only an average.
- Verify Three.js orbit drag never also selects or attacks, the next click uses the current camera, and view rotation is inert with respect to all game state.
- Run five first-time-player trials. At least four identify the axes and both ships, complete a legal move along each axis and rotate the ship around each axis without assistance (SC-006).
- Record browser/hardware, per-coordinate orbit poses, timings, usability results and screenshots/observations in the implementation record. Do not substitute Node mocks for actual WebGL2/browser acceptance.

## Production-build smoke check

```bash
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/` and repeat default view, orbit, cell selection, movement, ship rotation, attack, New Game and resize checks. The deterministic fixture is not a production route.

## Completion evidence

Retain red-green-refactor commands/results, deterministic cube/route/orientation coverage, final static/test/build checks, WebGL2/browser acceptance, per-cell orbit/picking coverage, timings and usability outcomes in the implementation development record. Review feature cohesion, strict types, class composition, the Phaser scene compatibility boundary and Three.js lifecycle against the constitution before acceptance. This planning guide does not assert that any implementation or acceptance evidence exists.
