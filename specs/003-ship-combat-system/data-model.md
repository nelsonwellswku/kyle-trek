# Data Model: Ship Combat System

**Feature**: `specs/003-ship-combat-system/spec.md` · **Date**: 2026-10-14

Extends the `002-agility-based-movement` model (Grid, Cell, Spaceship + agility, Turn with `legalSet`, GameSetup). Grid/Cell/SpawnZone/movement `legalSet` computation are unchanged. Field types are in TypeScript notation (implementation language per plan). This model describes the pure simulation core (`src/sim/`); presentation mapping is pinned by `contracts/combat-scene-contract.md` and config shape by `contracts/combat-config-schema.md`.

## Entity 1: Spaceship (extended with combat stats)

Adds combat attributes to the 002 entity. Identity, single-square occupancy, bidirectional cell consistency, and agility behavior are unchanged.

| Field | Type | Rules |
|-------|------|-------|
| `id` | `ShipId` | Unchanged: exactly two ships, fixed unique ids |
| `position` | `{row, col}` | Unchanged: exactly one in-range square; mutable via accepted moves |
| `agility` / `agilityModifier` | `number` | Unchanged (002): 8–20, shared-table derived, fixed at setup |
| `strength` | `number` (integer) | 8–20 inclusive (FR-001); rolled per ship at setup via seeded RNG (draw order: ship-1 then ship-2, after agility draws — research R-02); FIXED for the battle once rolled |
| `strengthModifier` | `number` (integer) | Derived via the shared stat→modifier table (FR-003); range −1…5 |
| `constitution` | `number` (integer) | 8–20 inclusive (FR-002); same roll handling as strength |
| `constitutionModifier` | `number` (integer) | Derived via the shared table (FR-003); range −1…5 |
| `hitPoints` | `number` (integer) | Current HP; starts at `maxHitPoints`, decreases only via hits, floored at 0 (FR-013) |
| `maxHitPoints` | `number` (integer) | Starting HP = d20 roll (1–20) + `constitutionModifier × 2`, clamped to minimum 1 (FR-004) |
| `armorClass` | `number` (integer) | Always 12 for the whole battle (FR-005); from data, identical for both ships in this feature |

Lifecycle: `Unplaced → Placed (setup: agility + strength + constitution + HP rolled, AC stamped) → InBattle (turns interleave) → Destroyed (HP 0 → game over, attacker wins)`. Ships are never removed from the board visual on destruction in this feature — the game ends immediately instead.

## Entity 2: Shared Stat→Modifier Table (data-backed, extended use)

The roll ranges and mapping table are config data (`board.json` `combat` section + existing `agility` section), not code.

| Field | Type | Rules |
|-------|------|-------|
| `strength.rollRange` / `constitution.rollRange` | `{min: 8, max: 20}` | Inclusive integer bounds per stat (FR-001/FR-002); from data |
| `statTable` | `StatBand[]` | Ordered, non-overlapping, gapless coverage of 8–20: `[{8–9 → −1},{10–11 → 0},{12–13 → 1},{14–15 → 2},{16–17 → 3},{18–19 → 4},{20 → 5}]` (FR-003); single source shared by agility/strength/constitution lookups |
| `modifier` | lookup(`stat`) | Exactly one band MUST contain the stat; otherwise setup raises an explicit error (never clamps or guesses) |

Validation: config load rejects tables that overlap, leave gaps in 8–20, or map outside integers; setup validation rejects ships whose strength/constitution is non-integer, outside 8–20, or whose modifier mismatches the band.

## Entity 3: Hit Points & Armor Class (new)

| Field | Type | Rules |
|-------|------|-------|
| `baseRoll` | `number` (integer 1–20) | Per-ship d20 at setup from the seeded RNG (ship-1 then ship-2, after stat draws); supersedes the request's "0–20" wording per clarification (die roll 1–20) |
| `maxHitPoints` | `1 + (baseRoll + constitutionModifier × 2)`, floored at 1 | Worked example: base 10 + mod +2 → 14 (spec US1 scenario 3) |
| `hitPoints` | `0…maxHitPoints` | Decreases only by `resolveAttack` hits; clamped ≥ 0; reaching 0 ends the game immediately with the attacker declared winner (FR-014); no healing, no other HP changes exist |
| `armorClass` | `12` | Static defense target (FR-005); attack total ≥ 12 hits, < 12 misses (FR-010) |

## Entity 4: Turn — one optional move + one optional attack (extended)

The unit of play. Exactly one turn is active at a time; a terminal `over` state ends the game.

| Field | Type | Rules |
|-------|------|-------|
| `activeShipId` | `ShipId` | The only ship that may act this turn; first turn is ALWAYS `ship-1` (002 preserved) |
| `turnNumber` | `number` | Starts at 1; increments by exactly 1 when the turn passes (both actions used/skipped or early end) |
| `moveUsed` | `boolean` | False at turn start; true after one accepted `resolveMove`, one `skipMove`, or an early end. At most one relocation per turn (FR-006) |
| `attackUsed` | `boolean` | False at turn start; true after one `dispatchAttack`, one `skipAttack`, or an early end. At most one torpedo per turn (FR-009) |
| `legalSet` | `Cell[]` | Unchanged 002 computation, frozen at turn start; consumed only while `!moveUsed` |
| `over` | `{ winner: ShipId } \| null` | Null during play; set the instant any HP reaches 0. Terminal: no further moves, attacks, skips, or turns (FR-014) |

State transitions (pure reducer):

```
Active(X, n, move=F, atk=F) --resolveMove(dest ∈ legalSet)--> Active(X, n, move=T, atk=F)
Active(X, n, move=F, atk=F) --dispatchAttack(foe)--> Active(X, n, move=F, atk=T) [+ HP/over effects]
Active(X, n, ...) --skipMove / skipAttack--> same, flag flipped, no rolls, no state change
Active(X, n, move=T, atk=T) --auto--> Active(Y, n+1, move=F, atk=F)   // Y = other ship, fresh legalSet
Active(X, n, ...) --endTurnEarly--> Active(Y, n+1, ...)
Active(X, n, ...) --any attack dealing lethal damage--> Over(winner=X)  // immediate, no successor turn
Active/Over --click empty|own ship / repeat used action / any click when over--> no change, no rolls
```

Skipping both actions (or ending early) leaves all game state unchanged and passes the turn (FR-006/FR-020).

## Entity 5: Attack Resolution (new)

The per-torpedo outcome; pure function of `(strengthModifier, defenderAC, rng)` plus HP application.

| Field | Type | Rules |
|-------|------|-------|
| `attackRoll` | `number` (integer 1–20) | Exactly one d20 per attack, always consumed (FR-010) |
| `total` | `attackRoll + strengthModifier` | Hit iff `total ≥ defenderAC (12)` (FR-010); disclosed immediately (FR-018) |
| `hit` | `boolean` | Decided by the comparison; drives damage + animation branch |
| `damageRoll` | `number` (integer 1–8) \| absent | Exactly one d8 iff hit (FR-012); ABSENT on miss — no roll consumed (FR-011) |
| `damage` | `damageRoll + strengthModifier`, floored at 1 \| 0 on miss | Miss → both HP unchanged (FR-011); hit → defender `hitPoints −= damage`, clamped ≥ 0 (FR-012/FR-013) |
| `torpedoPath` | `hit \| nearMiss` | Hit → attacker→defender + contact explosion; miss → near-miss waypoint past defender, off-grid, no explosion (FR-015/FR-016). Visual only — never changes the pre-rolled outcome |

Determinism: rolls come from the injected seedable RNG in fixed order (attack d20, then damage d8 only on hit); same seed + action sequence reproduces the same battle (FR-019). No hidden modifiers.

## Entity 6: GameSetup (extended)

002 fields plus per-ship `strength`, `strengthModifier`, `constitution`, `constitutionModifier`, `hitPoints`/`maxHitPoints`, `armorClass`. Determinism strengthened: `setup(config, seed)` is pure — identical `(configVersion, seed)` inputs MUST yield identical positions, agility, strength, constitution, AND hit points (FR-001/FR-002/FR-004/FR-019).

## Validation rules (added to `validation.ts`, extending 001 rules 1–5 + 002 rules 6–9)

10. Each ship's `strength` is an integer within config `combat.strength.rollRange` (8–20).
11. Each ship's `constitution` is an integer within config `combat.constitution.rollRange` (8–20).
12. Each ship's `strengthModifier` / `constitutionModifier` equals its stat's exactly-one table band modifier.
13. Each ship's `maxHitPoints ≥ 1` and equals `baseRoll + constitutionModifier × 2` floored at 1 (validator re-checks the floor; base roll integer 1–20).
14. Each ship's `armorClass === 12` (config `combat.armorClass`) and current `0 ≤ hitPoints ≤ maxHitPoints`.
15. Combat config itself is well-formed: ranges integer with min ≤ max; table ordered, non-overlapping, gapless over 8–20; AC/dice/minima positive integers; torpedo visuals present with sane bounds.
16. Post-attack invariant: HP never negative, never above max; `over` set iff some ship is at 0, with winner = the attacker (re-checked, never silently corrected).

Any violation → explicit typed error naming the failed rule (never silently corrected), consistent with 001/002 behavior.

## State-transition summary

```
(empty) --setup(config, seed)--> GameSetup(Placed × 2, agility + combat stats + HP fixed, AC 12)
GameSetup --turn 1 starts--> Active(ship-1, 1, move=F, atk=F, legalSet)
Active(X, n, F, F) --move--> Active(X, n, T, F) --attack--> Active(Y, n+1, F, F)
Active(X, n, F, F) --attack--> Active(X, n, F, T) --move--> Active(Y, n+1, F, F)
Active(X, n, ...) --lethal hit--> Over(winner=X)   // terminal
```

Full game state (grid + ships incl. combat stats/HP + turn flags + RNG position) MUST be serializable so future save/load round-trips exactly (constitution state standard; save/load itself not implemented in this feature).
