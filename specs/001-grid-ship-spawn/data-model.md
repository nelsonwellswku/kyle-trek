# Data Model: Grid Ship Spawn

**Feature**: `specs/001-grid-ship-spawn/spec.md` · **Date**: 2026-10-14

Derived from spec Key Entities (Grid, Spaceship, Spawn Zone, Game Setup / Seed) and FR-001–FR-009. This model describes the pure simulation core (`src/sim/`); presentation mapping is pinned by `contracts/scene-contract.md`. Field types are given in TypeScript notation (implementation language per plan).

## Entity 1: Grid

The 10×10 arrangement of uniquely addressable squares.

| Field | Type | Rules |
|-------|------|-------|
| `rows` | `number` | MUST equal config value `10` (FR-001); positive integer |
| `cols` | `number` | MUST equal config value `10` (FR-001); positive integer |
| `cells` | `Cell[100]` | Exactly `rows × cols` entries, one per square |

**Cell**

| Field | Type | Rules |
|-------|------|-------|
| `row` | `number` | 1-based, `1..rows`; row 1 is the top edge (spec coordinate convention) |
| `col` | `number` | 1-based, `1..cols`; col 1 is the left edge |
| `occupant` | `ShipId \| null` | At most one ship per cell (FR-002/FR-007); `null` when empty |

Identity: a cell is uniquely identified by `(row, col)`. No two cells share coordinates.

## Entity 2: Spaceship

An entity occupying exactly one grid square.

| Field | Type | Rules |
|-------|------|-------|
| `id` | `ShipId` (`'ship-1' \| 'ship-2'`) | Exactly two ships exist per setup (FR-002); ids are fixed and unique |
| `position` | `Cell` reference (`{row, col}`) | MUST be exactly one square (FR-002); MUST lie inside the ship's spawn zone (FR-003/FR-004) |

Lifecycle (setup-only feature): `Unplanned → Placed`. No movement, damage, or removal transitions exist in this feature. Re-running setup produces a new `Placed` state from a new seed.

Relationships: each ship's `position` MUST reference an existing cell; each occupied cell's `occupant` MUST reference the occupying ship (bidirectional consistency enforced by `validation.ts`).

## Entity 3: Spawn Zone

A named, constrained set of eligible starting squares (data, from `board.json`).

| Field | Type | Rules |
|-------|------|-------|
| `name` | `string` | e.g. `"top"`, `"bottom"`; unique per config |
| `shipId` | `ShipId` | The single ship this zone serves; 1:1 zone↔ship mapping |
| `rows` | `[number, number]` | Inclusive 1-based row range: top `[1, 2]`, bottom `[9, 10]` (FR-003/FR-004) |
| `cols` | `[number, number]` | Inclusive 1-based col range: `[1, 10]` for both zones |

Eligible squares per zone: 2 × 10 = 20 cells. Zones MUST be disjoint (top vs. bottom); validator rejects overlapping zones so FR-007 holds even if config changes.

## Entity 4: GameSetup (result of setup incl. seed)

The complete initial configuration: inputs plus outcome.

| Field | Type | Rules |
|-------|------|-------|
| `seed` | `number` | Seed consumed by RNG (FR-006). Unseeded games receive an engine-generated unique seed, recorded here for replay. |
| `grid` | `Grid` | 10×10 per config |
| `ships` | `[Spaceship, Spaceship]` | Ship 1 + Ship 2, both `Placed` |
| `configVersion` | `string` | Identifies the `board.json` revision that produced this setup (keeps seed-meaningful across tuning changes) |

Determinism rule: `setup(config, seed)` is a pure function — identical `(configVersion, seed)` inputs MUST yield identical ship positions (SC-004).

## Validation rules (enforced by `validation.ts`, FR-008)

1. Grid has exactly `rows × cols` cells with unique `(row, col)` coordinates in range.
2. Exactly 2 ships; ids are `ship-1` and `ship-2`; each references an in-range cell.
3. Each ship's cell lies within its own spawn zone (ship-1 → top, ship-2 → bottom).
4. No two ships share a cell; `cell.occupant` agrees with ship positions both directions.
5. Spawn zones are disjoint and each contains ≥ 1 cell.

Any violation → setup is rejected with an explicit typed error naming the failed rule (never silently corrected).

## State transitions

```
(empty) --setup(config, seed)--> GameSetup(validated, Placed × 2)
```

No other transitions in this feature. Invalid setups do not produce a `GameSetup` (constructor/validator throws).
