# Data Model: Three-Dimensional Ship Movement

## Cube position and identity

`CubePosition` is an immutable, validated value:

| Field | Type / validation                       |
| ----- | --------------------------------------- |
| x     | Integer 1–10 inclusive; left/right axis |
| y     | Integer 1–10 inclusive; top/bottom axis |
| z     | Integer 1–10 inclusive; near/far axis   |

Coordinates outside the cube, non-integers, NaN and infinite values are rejected before they enter game state. A stable presentation index maps positions bijectively to renderer instances using `index = ((x - 1) × 10 + (y - 1)) × 10 + (z - 1)`; the index is never used as a substitute for the typed domain value.

`CubeSnapshot` has fixed dimensions 10 × 10 × 10 and two distinct ship positions. Cell occupancy is derived from the two positions; the model does not retain 1,000 independently mutable empty/occupied flags. Setup, movement and combat all use this same position contract.

## Cube orientation

`CubeOrientation` is an immutable renderer-independent orientation represented by a right-handed basis of signed unit axes:

| Basis field | Meaning                          | Constraint                         |
| ----------- | -------------------------------- | ---------------------------------- |
| right       | Ship-local right in cube axes    | One of ±X, ±Y, ±Z                  |
| up          | Ship-local up in cube axes       | Perpendicular to right and forward |
| forward     | Ship nose direction in cube axes | One of ±X, ±Y, ±Z                  |

The basis is orthonormal and right-handed; these constraints admit exactly the 24 proper cube orientations. Ship 1 defaults to forward +Y and Ship 2 to forward −Y, with +Z as the shared default up axis and right derived to preserve handedness. `rotate(axis, direction)` composes one +90° or −90° turn around the selected global cube axis and returns another valid orientation. It does not modify position or occupancy. Only the Three.js adapter converts this value to a renderer quaternion.

## Ships and cube snapshots

### Setup ship

Setup retains the existing identities `ship-1` and `ship-2` and the two-player ownership mapping. Each new battle draws one uniform integer index in 0–199 for each ship and maps it bijectively to X, Z and one of the ship's two allowed Y layers:

| Ship   | Allowed Y | X    | Z    | Eligible positions |
| ------ | --------- | ---- | ---- | -----------------: |
| Ship 1 | 1 or 2    | 1–10 | 1–10 |                200 |
| Ship 2 | 9 or 10   | 1–10 | 1–10 |                200 |

The Y bands are disjoint, so the ships cannot be initialized into the same cell. Positions may match a prior game's positions. The factory builds and validates a complete replacement before it is published.

### Combat ship

`CombatShip` is an immutable, frozen record within `CombatGame`:

| Field                   | Type / constraint                             |
| ----------------------- | --------------------------------------------- |
| identity / owner        | Existing matching ship/player identities      |
| position                | Validated `CubePosition`                      |
| orientation             | Validated `CubeOrientation`                   |
| agility                 | Existing `AgilityStat` and movement allowance |
| strength / constitution | Existing validated ability stats              |
| armorClass              | Literal 12                                    |
| startingHitPoints       | Existing battle value, at least 1             |
| hitPoints               | Integer 0 through starting hit points         |

`CombatGame` requires exactly one ship of each identity, matching ownership, distinct positions, valid stats and hit points, and valid orientations. `withPosition`, `withOrientation` and `withDamage` return complete new game snapshots and preserve all unrelated fields. Existing attack and damage calculations do not use orientation.

## Movement and reachability

`Reachability` searches the graph of cube cells using exactly six face-adjacent transitions: ±X, ±Y and ±Z. A route cannot leave the cube or pass through/land on the opposing ship. Diagonal neighbors are not one move. The active ship's nonnegative agility modifier remains the step allowance and is capped by the existing maximum of five. Search results contain the legal destination set and a shortest `LegalRoute` for each destination; the same result drives highlights and selection.

At allowance five, the largest obstacle-free 3D Manhattan ball contains 231 positions. Bound the search by the current allowance rather than scanning the full cube. Routes carry typed positions and step count; visual flight geometry is presentation-only and cannot make an illegal destination legal.

## Battle state and turn transitions

`BattleSession` remains the sole turn/combat authority. It owns the immutable `CombatGame`, active player/ship, game revision, turn token, movement/attack/rotation action identifiers, last completed attack result, and one phase snapshot.

| Phase                  | Additional state                                   | Accepted game actions                                   |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| movement-ready         | Nonempty `Reachability`                            | Select one legal destination; rotate active ship        |
| awaiting-movement-skip | Empty reachability and reason                      | Explicit movement skip; rotate active ship              |
| moving                 | `PendingMove` and matching action identity         | Matching completion/failure only                        |
| attack-ready           | Movement completed or explicitly skipped           | Select opponent to attack; End turn; rotate active ship |
| rotating               | Prior ready phase, target orientation, rotation ID | Matching completion/failure only                        |
| attacking              | Existing `PendingAttack` and attack identity       | Matching completion/failure only                        |
| finished               | Winner, defeated ship and final game               | None                                                    |
| disposed               | Invalidated revision and cleared work              | None                                                    |

New Game initializes fresh positions/stats/HP/orientations, clears pending work and result, resets Player 1 as first, and invalidates prior revision before cancelling effects. Camera orientation is not part of this state machine.

### Transition rules

| From                          | Event                        | To / effect                                                                  |
| ----------------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| New battle                    | Initialize                   | Player 1 movement-ready or awaiting-movement-skip                            |
| movement-ready                | Valid destination            | moving; authoritative position remains at origin until matching arrival      |
| moving                        | Matching arrival             | Commit position; attack-ready for the same player                            |
| moving                        | Matching failure             | Restore origin view; return to movement-ready; no handoff                    |
| movement-ready / attack-ready | Valid signed quarter-turn    | rotating; retain prior ready phase and active player                         |
| rotating                      | Matching completion          | Commit orientation; return to saved ready phase; no handoff or movement cost |
| rotating                      | Matching failure             | Preserve prior orientation; return to saved ready phase; no handoff          |
| awaiting-movement-skip        | Explicit skip                | attack-ready for same player; no position change                             |
| attack-ready                  | End turn                     | Other player's movement phase; increment turn token once                     |
| attack-ready                  | Opponent selected            | Existing attack resolution; roll only once                                   |
| attacking                     | Matching completion          | Existing damage/outcome commit and handoff or victory                        |
| Any live phase                | Successfully staged New Game | Increment revision; reset game and clear stale actions                       |
| Any phase                     | Dispose                      | Invalidate callbacks, stop renderers and clear pending work                  |

Invalid, out-of-phase, wrong-owner, duplicate and stale events are no-ops. Each mutating action validates revision, turn token and action identity as applicable. Presentation callbacks carry identity only and cannot choose a destination, orientation, damage or winner.

## View and picking state (presentation only)

The Three.js scene contains a decorative open wireframe lattice and a stable mapping from each cell-center marker instance to one `CubePosition`. The lattice is not selectable. Ship models map to `ShipIdentity`; ship orientation is converted at the rendering boundary. A raycast returns the nearest visible marker or ship target using the current camera pose. Ambiguous projected marker positions are resolved by orbiting until the intended marker is distinguishable.

`CameraPose`/`OrbitControls` state is renderer-owned and never stored in `CombatGame`, `CubeSnapshot` or `BattleSession`. A primary-button drag changes only the view. A stationary primary-button release selects using the current camera and CSS-aligned canvas bounds. Changing camera pose cannot mutate any game revision, turn/action token, position, orientation, stat or combat result.

## Animation and lifecycle data

- `PendingMove` carries game revision, turn token, move ID, ship identity, origin/destination, opposing position and a validated shortest `LegalRoute`.
- `PendingRotation` carries revision, turn token, rotation ID, ship identity, axis, direction, previous orientation, target orientation and the ready phase to resume.
- Existing `PendingAttack` retains the immutable rolled outcome and combat identities. Its 3D effect uses cube positions but does not own battle state.
- Three.js movement/rotation/torpedo animation handles are cancellable and owned by the matching scene/view. Completion, failure and cancellation are once-only; New Game or disposal invalidates identities before cleanup. Stale callbacks cannot mutate replacement state.
- Three.js renderer, camera, orbit controls, instanced markers, ship meshes, effect meshes, resize observers and canvas belong to `ThreeCubeView` and are disposed exactly once with its scene lifecycle.

## Persistence and volume

Exactly two ships, one 1,000-position cube, one active action and the current result are held in memory. No save format, network synchronization, backend, external data or unbounded movement history is introduced.
