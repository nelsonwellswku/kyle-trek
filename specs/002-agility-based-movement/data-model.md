# Data Model: Agility-Based Movement

**Feature**: `specs/002-agility-based-movement/spec.md` · **Date**: 2026-10-14

Extends the `001-grid-ship-spawn` model (Grid, Cell, Spaceship, SpawnZone, GameSetup). Grid/Cell/SpawnZone are unchanged. Field types are given in TypeScript notation (implementation language per plan). This model describes the pure simulation core (`src/sim/`); presentation mapping is pinned by `contracts/movement-scene-contract.md` and config shape by `contracts/agility-config-schema.md`.

## Entity 1: Spaceship (extended)

Adds agility attributes to the 001 entity. Identity, single-square occupancy, and bidirectional cell consistency are unchanged.

| Field | Type | Rules |
|-------|------|-------|
| `id` | `ShipId` (`'ship-1' \| 'ship-2'`) | Unchanged: exactly two ships, fixed unique ids |
| `position` | `{row, col}` | Unchanged: exactly one in-range square; now MUTABLE across turns via accepted moves (was setup-fixed in 001) |
| `agility` | `number` (integer) | 8–20 inclusive (FR-001); rolled per ship at setup via seeded RNG (draw order: ship-1 then ship-2, after spawn draws — R-02); FIXED for the game once rolled |
| `agilityModifier` | `number` (integer) | Derived via the data table (FR-002); range −1…5; recomputed from `agility`, never stored independently at rest (may be cached per turn) |

Lifecycle (this feature): `Unplaced → Placed (setup, agility rolled) → Ready (own turn starts, legal set computed) → Moved (move accepted) → Ready (opponent's turn interleaves) → …`. No removal, damage, or stacking transitions exist. The two ships' `position` cells MUST remain distinct after every accepted move (001 invariant preserved by FR-006 exclusion).

## Entity 2: Agility Stat & Modifier (new, data-backed)

The roll range and mapping table are config data (`board.json` `agility` section), not code.

| Field | Type | Rules |
|-------|------|-------|
| `rollRange` | `{min: 8, max: 20}` | Inclusive integer bounds for the per-ship roll (FR-001); from data |
| `table` | `AgilityBand[]` | Ordered, non-overlapping, gapless coverage of 8–20: `[{min:8,max:9,modifier:-1},{min:10,max:11,modifier:0},{min:12,max:13,modifier:1},{min:14,max:15,modifier:2},{min:16,max:17,modifier:3},{min:18,max:19,modifier:4},{min:20,max:20,modifier:5}]` (FR-002); from data |
| `modifier` | lookup(`agility`) | Exactly one band MUST contain the stat; otherwise setup/move computation raises an explicit error (never clamps or guesses) |

Validation: validator rejects configs whose bands overlap, leave gaps in 8–20, or map outside integers; rejects ships whose `agility` is non-integer or outside 8–20.

## Entity 3: Turn (new)

The unit of alternating play. Exactly one turn is active at a time.

| Field | Type | Rules |
|-------|------|-------|
| `activeShipId` | `ShipId` | The only ship that may move this turn (FR-003); first turn of a game is ALWAYS `'ship-1'` (clarified 2026-10-14) |
| `turnNumber` | `number` | Starts at `1`; increments by exactly 1 on every accepted move including stay-in-place (FR-010) |
| `legalSet` | `Cell[]` | Computed at turn start by `movement.ts` (see Entity 4); frozen for the turn — mid-turn state changes other than the resolving move do not exist |

State transitions (pure reducer `resolveMove`, R-04):

```
Active(ship-X, n) --accept destination in legalSet--> Active(ship-Y, n+1)   // Y is the other ship; includes stay-in-place
Active(ship-X, n) --click outside legalSet / wrong ship--> Active(ship-X, n) // Rejected(reason); no state change
```

Each accepted move produces exactly one successor turn owned by the other player (SC-004). There is no terminal turn in this feature (movement is unbounded; win/lose belong to later features).

## Entity 4: Legal Destination Set (new)

Squares the active ship may move to this turn (spec Key Entity, made computable).

| Field | Type | Rules |
|-------|------|-------|
| `origin` | `{row, col}` | Active ship's current square; ALWAYS a member (stay-in-place, FR-006) |
| `bound` | `number` | The active ship's `agilityModifier`; effective relocation requires `bound ≥ 1`, else the set is `{origin}` alone (FR-004) |
| `members` | `Cell[]` | `{origin}` ∪ every in-bounds cell with Manhattan distance `1..bound`, EXCLUDING the opponent-occupied cell, EXCLUDING cells with no orthogonal path of length ≤ bound avoiding the occupied cell (FR-005/FR-006, clarified go-around rule) |

Determinism rule: the set is a pure function of `(grid dims, origin, bound, occupiedCell)` — identical inputs MUST yield the identical set (FR-012). The same function output feeds BOTH highlight rendering and move acceptance, so the two can never disagree.

## Entity 5: GameSetup (extended)

001 fields (`seed`, `grid`, `ships`, `configVersion`) plus per-ship agility. Determinism rule strengthened: `setup(config, seed)` is pure — identical `(configVersion, seed)` inputs MUST yield identical ship positions AND identical agility values (FR-001 + clarification 1).

## Validation rules (added to `validation.ts`, extending 001 rules 1–5)

6. Each ship's `agility` is an integer within config `rollRange` (8–20).
7. Each ship's `agility` falls in exactly one table band; derived `agilityModifier` equals that band's modifier.
8. Agility config itself is well-formed: bands ordered, non-overlapping, gapless over the roll range, integer modifiers.
9. Post-move invariant: after every accepted move, ships occupy distinct in-bounds cells (re-checked, never silently corrected).

Any violation → explicit typed error naming the failed rule (never silently corrected), consistent with 001 behavior.

## State-transition summary

```
(empty) --setup(config, seed)--> GameSetup(Placed × 2, agility fixed)
GameSetup --turn 1 starts--> Active(ship-1, 1, legalSet)
Active(ship-X, n) --accept--> Active(ship-Y, n+1)   // ships' positions/agility persist; only position of mover changes
```

Full game state (grid + ships incl. agility + turn) MUST be serializable so future save/load round-trips exactly (constitution state standard; not implemented in this feature).
