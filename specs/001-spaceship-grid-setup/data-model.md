# Data Model: Spaceship Grid Setup

## Ownership and boundaries

The game-setup feature owns all entities below. Domain classes import neither Phaser nor DOM APIs. `GameApplication` composes the domain, production random source, Phaser scene/view, and native controls. Presentation consumes the session's current snapshot and never selects positions.

## Entities and contracts

| Concept | Representation and fields | Validation / relationships |
|---------|---------------------------|----------------------------|
| Board | Fixed domain dimensions: rows = 10, columns = 10 | Exactly 100 implied squares; no configurable size. |
| BoardPosition | Immutable value class: readonly `row`, `column`; validated integer values 1–10 | Reject fractional, non-finite, or out-of-range values. Equality compares row and column. Public and domain coordinates are one-based. |
| ShipIdentity | Literal union `ship-1` or `ship-2` | Display names are Ship 1 and Ship 2. |
| ShipPlacement | Readonly identified position | Each placement has exactly one BoardPosition; no footprint or movement state. |
| StartingZone | Fixed association of identity to first/last row: 1–2 or 9–10; columns always 1–10 | 20 valid squares per zone; zones never overlap. This may be immutable factory configuration rather than a separate mutable entity. |
| GameSetup | Immutable class containing named readonly `ship1` and `ship2` placements plus fixed board dimensions | Exactly one of each identity; correct zone for each; distinct positions. No exposed mutable collection. All nested placements are immutable. |
| GameSession | Class retaining the current GameSetup and readonly-observed positive integer `revision` | Owns a factory; initialize revision 1 once, increment on every New Game even when coordinates repeat. Publish a complete replacement only after validation. |
| RandomSource | Interface with `next(): number` | Each result must be finite and in `[0, 1)`; production promises independent approximately uniform draws. Factory validates results at this boundary. |

Squares are derived from row/column coordinates and occupancy of the two placements; 100 mutable cell records are unnecessary. A session revision is a local UI/testing identity, not an account, persistent ID, or network game ID.

## Placement rules

1. Request a separate source value for each ship: exactly two values per successful setup.
2. Calculate the eligible-square bucket as `floor(value × 20)`, yielding 0–19.
3. Map buckets 0–9 to the first zone row and columns 1–10, and 10–19 to the second zone row and columns 1–10.
4. Validate both placements and create a complete immutable GameSetup. Never exclude a column selected for the other ship.
5. Reject invalid source outputs rather than clamping or retrying. Construction failures must not expose a partial setup or advance the revision.

Examples: value 0 gives Ship 1 (1,1) or Ship 2 (9,1); value 0.5 gives (2,1) or (10,1); a value immediately below 1 gives (2,10) or (10,10). Every one of the 400 eligible position pairs is allowed. Repeating a pair on a later revision is allowed.

## Lifecycle and state transitions

| Trigger | Transition | Placement draws |
|---------|------------|-----------------|
| Application mount / page entry | No session → complete setup, revision 1 | Two |
| New Game click or keyboard activation | Current setup/revision → complete replacement, revision + 1 | Two |
| Repeated view, animation frame, resize, scene recreation | Current setup/revision → unchanged | Zero |
| Failed replacement construction | Current setup/revision → unchanged; presentation reports failure | No retry; consumed values are not reused implicitly |
| Page reload | Previous in-memory session ends; new mount initializes revision 1 | Two for new session |
| Application teardown / HMR disposal | Destroy scene/game and controls; release session ownership | Zero |

The domain session has no loading state or external dependency. Application-level presentation tracks booting, ready revision, or initialization error separately. A New Game request must not reroll again when the scene consumes the result.

## Presentation mapping

`BoardGeometry` converts one-based row/column values to logical cell bounds and centers. Rows increase downward; columns increase rightward. All cells are equal squares; ship markers stay inside their owning cell. FIT changes display scale only.

`BoardView` draws the grid and two labeled markers from a GameSetup. `GameSetupScene` delegates lifecycle/render work to that view. `GameSetupControls` renders summaries and routes New Game to the application/session. DOM summary and canvas always derive from the same revision; a drawn-revision notification establishes browser-test readiness without exposing mutable domain state globally.
