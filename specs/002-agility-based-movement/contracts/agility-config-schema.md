# Contract: Agility Config Schema (Data Contract)

**Feature**: `specs/002-agility-based-movement/spec.md` · **Date**: 2026-10-14

Additive to the 001 `board-config-schema.md` (grid dims, spawn zones, ship visuals — all unchanged). This contract pins the shape and rules of the new `agility` section of `src/config/board.json` so balance tuning stays data-only (Principle IV). `agility.ts` MUST read this data; it MUST NOT hard-code the range or any table row.

## Schema (`board.json` → `agility`)

| Field | Type | Rules |
|-------|------|-------|
| `agility.rollRange` | `{min: number, max: number}` | Inclusive integer bounds for the per-ship roll. Default `{min: 8, max: 20}` (FR-001). `min ≤ max`; both integers. |
| `agility.table` | `AgilityBand[]` | Ordered stat→modifier bands covering the roll range (FR-002). Default rows: `8–9 → -1`, `10–11 → 0`, `12–13 → 1`, `14–15 → 2`, `16–17 → 3`, `18–19 → 4`, `20 → 5` (single-value final band). |
| `AgilityBand.min` | `number` | Inclusive integer lower bound of the band. |
| `AgilityBand.max` | `number` | Inclusive integer upper bound of the band; `max ≥ min`. |
| `AgilityBand.modifier` | `number` | Integer movement range for the band (may be ≤ 0). |

## Config validation (enforced at load, before setup)

1. `rollRange` bounds are integers with `min ≤ max`.
2. Bands are sorted ascending, non-overlapping, and gaplessly cover every integer in `[rollRange.min, rollRange.max]`.
3. Every band has integer `min`/`max`/`modifier` with `max ≥ min`.
4. The default table MUST reproduce the spec mapping exactly (bands above).

Any violation → config load fails with an explicit typed error naming the failed rule; the game MUST NOT start with fallback values (consistent with 001 failure-surfacing behavior).

## Acceptance mapping

- Schema + rule 4 → FR-001/FR-002 (roll bounds, exact modifier mapping).
- Rules 1–3 → `data-model.md` Entity 2 validation + `validation.test.ts` config-shape cases.
- Draw order (spawn, then agility ship-1, then ship-2) is a sim behavior rule, not config — pinned in `research.md` R-02 and tested in `agility.test.ts`.
