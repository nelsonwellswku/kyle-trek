# Contract: Combat Config Schema (Data Contract)

**Feature**: `specs/003-ship-combat-system/spec.md` · **Date**: 2026-10-14

Additive to the 001 `board-config-schema.md` (grid dims, spawn zones, ship visuals — all unchanged) and the 002 `agility-config-schema.md` (agility section — unchanged). This contract pins the shape and rules of the new `combat` section of `src/config/board.json` so combat tuning stays data-only (Principle IV). `combat.ts` MUST read this data; it MUST NOT hard-code any range, table row, AC, die size, or torpedo visual.

## Schema (`board.json` → `combat`)

| Field | Type | Rules |
|-------|------|-------|
| `combat.strength.rollRange` | `[min, max]` integers | Inclusive bounds for the per-ship strength roll. Default `[8, 20]` (FR-001). `min ≤ max`. |
| `combat.constitution.rollRange` | `[min, max]` integers | Inclusive bounds for the per-ship constitution roll. Default `[8, 20]` (FR-002). `min ≤ max`. |
| `combat.statTable` | `StatBand[]` | Shared stat→modifier bands covering 8–20 (FR-003). Default rows: `8–9 → -1`, `10–11 → 0`, `12–13 → 1`, `14–15 → 2`, `16–17 → 3`, `18–19 → 4`, `20 → 5` (single-value final band). Single source for strength/constitution (and SHOULD match the agility table). |
| `StatBand.min` / `.max` / `.modifier` | integers | Inclusive bounds with `max ≥ min`; integer modifier (may be ≤ 0). |
| `combat.armorClass` | `number` | Static defense target. Default `12` (FR-005). Positive integer. |
| `combat.hitPoints.die` | `number` | Sides of the HP base die. Default `20` (roll 1–20, FR-004). Positive integer. |
| `combat.hitPoints.perModifierBonus` | `number` | Multiplier on constitution modifier. Default `2` (FR-004). Integer. |
| `combat.hitPoints.minStart` | `number` | Floor for starting HP. Default `1` (edge case). Positive integer. |
| `combat.attack.die` | `number` | Sides of the attack die. Default `20` (FR-010). Positive integer. |
| `combat.damage.die` | `number` | Sides of the damage die. Default `8` (FR-012). Positive integer. |
| `combat.damage.minDamage` | `number` | Floor for damage on a hit. Default `1` (edge case). Positive integer. |
| `combat.torpedo.blinkHz` | `number` | Blinking-star flash rate. Positive number. Visual only. |
| `combat.torpedo.speedTilesPerSec` | `number` | Torpedo travel speed in tiles/sec. Positive number. Visual only. |
| `combat.torpedo.nearMissOffsetTiles` | `number` | Perpendicular offset of the miss waypoint from the defender's center, in tiles (e.g. `0.75`). Positive number. Visual only. |

## Config validation (enforced at load, before setup)

1. Both `rollRange`s are integer pairs with `min ≤ max`.
2. `statTable` bands are sorted ascending, non-overlapping, and gaplessly cover every integer in `[8, 20]` (and MUST cover both roll ranges).
3. Every band has integer `min`/`max`/`modifier` with `max ≥ min`.
4. The default table MUST reproduce the spec mapping exactly (bands above, FR-003).
5. `armorClass`, `hitPoints.die`, `attack.die`, `damage.die`, `minStart`, `minDamage` are positive integers; `perModifierBonus` is an integer.
6. `torpedo` visuals are present with positive `blinkHz`, `speedTilesPerSec`, `nearMissOffsetTiles`.

Any violation → config load fails with an explicit typed error naming the failed rule; the game MUST NOT start with fallback values (consistent with 001/002 failure-surfacing behavior).

## Acceptance mapping

- Schema + rule 4 → FR-001/FR-002/FR-003 (roll bounds, exact shared modifier mapping).
- `armorClass` + rules 5–6 → FR-004/FR-005/FR-012/FR-015/FR-016 (HP formula constants, AC 12, dice, torpedo tuning).
- Draw order (spawn → agility → strength → constitution → HP base; attack d20 then damage d8 on hit) is a sim behavior rule, not config — pinned in `research.md` R-02 and tested in `combat.test.ts`.
