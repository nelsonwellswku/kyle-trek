# Data Model: Ship Turn Movement

**Date**: 2026-10-16

## Board capability

### BoardPosition

Existing immutable class moved to `src/features/board/domain/BoardPosition.ts`.

- `row`, `column`: integers 1–10, one-based, top-to-bottom and left-to-right.
- Equality compares both coordinates. Invalid coordinates throw at construction.
- One canonical class preserves instanceof checks across setup and movement.

### BoardSnapshot and ShipIdentity

- `rows: 10`, `columns: 10`.
- `ship1`, `ship2`: readonly placements with identities `ship-1` and `ship-2`, respectively, and BoardPosition.
- Exactly two distinct occupied positions. No starting-zone restriction in this shared representation.
- GameSetup retains its additional starting-zone checks; MovementGame supplies live placements.

## Movement domain

### AgilityStat

Immutable class constructed from `score: number`, validated as an integer from 8 through 20.

| Derived field | Rule |
| --- | --- |
| modifier | `Math.floor((score - 10) / 2)`, range −1 through +5 |
| movementAllowance | `Math.max(0, modifier)`, range 0–5 |

Scores are retained for the lifetime of one game. Display score and modifier separately, including signs for positive/negative modifiers. Random generation is a factory responsibility, not a side effect of reading a stat.

### MovementShip

- `identity: ShipIdentity`.
- `owner: 'player-1' | 'player-2'`, fixed mapping to corresponding identity.
- `position: BoardPosition`, authoritative occupied square.
- `agility: AgilityStat`.
- Immutable snapshot; moving creates a replacement placement rather than mutating setup history.

### MovementGame

Validated class containing exactly two MovementShip snapshots, 10 rows and 10 columns. Positions must be distinct but may be anywhere on the board. Initial creation derives placements from GameSetupFactory; movement does not reconstruct GameSetup.

### MovementGameFactory

Composes GameSetupFactory and RandomSource. Creation draws, in order, Ship 1 placement, Ship 2 placement, Ship 1 agility, Ship 2 agility. Separate finite `[0,1)` draws map to `8 + floor(u * 13)`. Scores and placements are selected independently, with repeats allowed and no rerolls. Failed creation produces no published partial game.

### ReachabilityResult and LegalRoute

- Result belongs to one game revision and turn token; holds origin, blockers, allowance, reachable destination/distance records and predecessors.
- Route includes origin and destination as ordered BoardPositions; `stepCount = positions.length - 1`.
- Adjacent route positions differ by exactly one in one axis; no repeats, no out-of-bounds positions, no other ship's square.
- Destination differs from origin; `1 <= stepCount <= allowance`.
- BFS up/right/down/left tie-breaking returns one shortest legal route. Animated physical distance does not change stepCount.
- Origin is occupied by the active ship and is the one permitted occupied route entry. All later route entries must be empty.

### TurnSession

Class owns current MovementGame, game revision, active player, turn token, move identity sequence, and phase. Readonly snapshots expose state; only commands change it. Identity counters are safe integers and must reject overflow rather than silently wrap.

| Phase | Required data | Allowed commands |
| --- | --- | --- |
| ready | active player, nonempty reachability result | select legal destination; new game; dispose |
| moving | active player, pending move, empty actionable highlights | matching completion; new game; dispose |
| awaiting-pass | active player, empty destinations, visible reason | acknowledge matching turn; new game; dispose |
| disposed | invalidated identity, no live subscriptions | no gameplay command |

The UI can additionally be preparing or showing a startup error; these are application/readiness states and must block gameplay without masquerading as a playable domain phase.

### PendingMove

- `gameRevision`, `turnToken`, `moveId`, active ship identity.
- `origin`, `destination`, immutable LegalRoute.
- All callback identity fields must match the current moving state before update/commit.
- Authoritative ship position stays at origin until successful completion.
- Selection updates phase before animation starts, preventing re-entrant selection.

## State transitions

1. **Start/replacement succeeds**: atomically publish complete game, increment game revision, set Player 1, issue fresh turn token, derive reachability; choose ready or awaiting-pass. Expose input only once that revision is rendered.
2. **Select valid destination in ready**: issue move identity, retain current game snapshot, enter moving, remove highlights, begin flight.
3. **Invalid selection/non-left input**: no change.
4. **Matching arrival in moving**: commit selected destination, switch player, issue fresh turn token, recompute reachability and choose ready/awaiting-pass. Duplicate arrival is a no-op.
5. **Acknowledge pass in awaiting-pass**: require matching displayed turn token; switch player once, issue fresh token, recompute state. Even two immobile ships wait for separate acknowledgments indefinitely until New Game.
6. **Replacement generation fails**: preserve current game, revision, turn and pending move; report retryable replacement error.
7. **Replacement commits during flight**: invalidate old identities before stopping old tween; no old callback may alter the replacement.
8. **Dispose/shutdown**: invalidate pending identities, cancel flight, detach listeners; all later callbacks are no-ops.
9. **Matching flight startup or mid-flight failure**: invalidate the failed move before cancellation, restore the visual to its authoritative origin, retain the active player, issue a fresh turn token and recompute ready/awaiting-pass state. Expose a retryable movement error without committing a destination or handing off. Old completion/failure callbacks are no-ops.

## Presentation-only data

- BoardGeometry: logical size 600, cell size 60; maps centers and rejects pointer points outside half-open `[0,600) × [0,600)` bounds. Phaser supplies scale-correct logical coordinates.
- FlightPath: immutable line/quadratic segment sequence, independent of grid-step cost; corner trim 15 px and reserved visual envelope radius 24 px at current geometry.
- FlightHandle: cancellation capability owned by PhaserFlightAnimator; stopping does not emit successful completion. A typed failure notification carries the pending move's game revision, turn token and move ID so the controller can reject stale failures and recover only the matching move.
- Turn HUD: active player/ship, scores/modifiers, moving or no-moves message, pass-button availability. Existing shell retains New Game/readiness/errors and current position summaries.

No serialization, persistence, network identity, or external service schema is required.
