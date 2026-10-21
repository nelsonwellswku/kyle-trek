# UI and Presentation Contract: Three-Dimensional Ship Movement

## Scope

The public interface is the local browser game. There is no HTTP API, network protocol, persistence or interprocess contract. This document records the observable cube interaction and typed seams used to validate the UI independently from Phaser/Three.js.

## Display contract

- Show an open 10 × 10 × 10 lattice in a three-quarter view, with all 1,000 uniquely addressable cell markers and three distinguishable labeled axes.
- Do not render filled opaque cell volumes that permanently hide the interior. Lattice lines are decorative, not click targets. Each cell-center marker has one stable X/Y/Z coordinate identity.
- Show exactly two distinguishable procedural ships at their current cell centers, oriented using their stored cube orientation. Each ship has a visible nose and top marker so rotation around the forward axis is distinguishable. Show both positions as X/Y/Z coordinates, each ship's existing stats and the current player/phase.
- Show current legal movement destinations and a visible hover/selected coordinate. Show the cell occupancy before selection. The hit target returned by picking must match the visible marker and its typed coordinate.
- Display a readable 3D view error if WebGL2/Three renderer creation fails; do not leave the battle in a silently unresponsive state.
- Retain native, keyboard-operable **New Game**, movement-skip and **End turn** controls and the existing readable result/winner status pattern. Rotation controls identify axis and direction; they never rely on color alone.

## View and pointer interaction

Orbiting is a presentation control and is independent of player turn or game state. The initial camera is three-quarter; orbit can reveal alternate sides and separate projected markers. The Three.js canvas is sized to the same board host as the Phaser canvas and passes pointer hit-testing through to the Phaser host.

| Pointer gesture                                                      | Result                                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Primary-button press/release with less than 5 CSS pixels of movement | Treat as one click; raycast at release using the current Three camera                     |
| Primary-button drag moving 5 CSS pixels or more                      | Orbit the view; do not select a cell or ship                                              |
| Pointer release after camera orbit                                   | Select using the updated camera and current canvas bounds                                 |
| Right/middle button or click on decorative lattice only              | No movement, attack or ship rotation                                                      |
| Orbit while any player/phase is active                               | Change the view only; preserve game snapshot, action identities and result                |
| Resize of board host                                                 | Resize both canvases/projections to identical CSS bounds; preserve logical game positions |

If projected cell markers overlap, identify only the nearest visible marker at that camera pose. The player orbits until the intended cell marker is visually distinct. A click must never be silently interpreted as a hidden deeper marker.

## Battle input matrix

Gameplay inputs require a current `BattleSession` revision/token and a ready render. Camera orbit is independent of these gates.

| Battle phase                             | Click on cell/ship marker                                   | Rotation controls              | Skip movement                 | End turn                    |
| ---------------------------------------- | ----------------------------------------------------------- | ------------------------------ | ----------------------------- | --------------------------- |
| movement-ready                           | Legal empty cell starts one move; all other targets ignored | Active ship, ±90° around X/Y/Z | Unavailable                   | Unavailable                 |
| awaiting-movement-skip                   | No move                                                     | Active ship, ±90° around X/Y/Z | Explicitly enter attack-ready | Unavailable                 |
| moving / rotating                        | Ignored                                                     | Unavailable                    | Unavailable                   | Unavailable                 |
| attack-ready                             | Opponent ship selects one attack; other targets ignored     | Active ship, ±90° around X/Y/Z | Unavailable                   | Handoff once without attack |
| attacking                                | Ignored                                                     | Unavailable                    | Unavailable                   | Unavailable                 |
| finished / disposed / renderer not ready | Ignored                                                     | Unavailable                    | Unavailable                   | Unavailable                 |

Rotation changes ship orientation only and returns to the same ready phase after its animation. View orbit never rotates the ship. Invalid input consumes no movement/attack opportunity and cannot change turn, position or combat state.

## Typed collaboration contracts

| Collaborator / operation             | Input                                                               | Output / guarantee                                                                      |
| ------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `CubePosition.create`                | Integer x/y/z                                                       | Valid immutable coordinate in 1–10 on every axis or rejected value                      |
| `Reachability.find`                  | Cube snapshot, active origin, movement allowance                    | Readonly exact destination set and shortest six-neighbor routes                         |
| `CubePicker.pick`                    | CSS pointer location, current camera, marker/ship instances         | Typed cell/ship target matching current visible ray hit, or no target                   |
| `ThreeCubeView.render`               | Cube/combat view snapshot, legal highlights, matching game revision | Updated cube, ship poses and effects; view state remains outside game domain            |
| `BattleSession.rotateShip`           | Revision, turn token, active ship, global axis, ± quarter-turn      | Pending rotation or rejected no-change result; no movement/handoff                      |
| `BattleSession.completeRotation`     | Revision, turn token, rotation ID                                   | Commit target orientation once and restore the prior ready phase, or reject stale event |
| `BattleSession.selectDestination`    | Revision, turn token, `CubePosition`                                | One accepted `PendingMove` or rejected no-change result                                 |
| `FlightAnimator` / `TorpedoAnimator` | Typed pending action and terminal callbacks                         | Cancellable 3D effects; callback identity only, no domain mutation                      |

Three.js types do not enter domain snapshots or session commands. `CombatController` maps picked targets to phase-appropriate domain operations. `GameApplication` remains the composition root and owns staged New Game replacement.

## Lifecycle and acceptance

- Start one Three.js canvas/view for the active application. Repeated New Game reuses that view and does not add canvases, listeners or render loops.
- On New Game/disposal, invalidate old battle identities before cancelling Three effects. Remove the overlay canvas and dispose controls, geometries, materials, renderer and resize observers exactly once on final disposal.
- The displayed cube includes all 1,000 unique marker identities. For every marker, the browser acceptance sweep finds a view where it is distinguishable, then confirms ray picking returns its exact coordinate.
- Movement, ship rotation, torpedo results, winner display and turn transitions continue to be governed by existing combat rules and their matching action identities.

## Acceptance references

Cube dimensions/coordinates and access cover FR-001–FR-006 and SC-001/SC-002; turns, reachability and movement cover FR-007–FR-011 and SC-003/SC-004/SC-007; ship rotation covers FR-012–FR-013 and SC-005/SC-009; existing combat continuity covers FR-014. See [quickstart.md](../quickstart.md) for deterministic tests and manual browser checks.
