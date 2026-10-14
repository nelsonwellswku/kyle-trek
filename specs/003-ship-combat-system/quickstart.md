# Quickstart: Ship Combat System

**Feature**: `specs/003-ship-combat-system/spec.md` · **Date**: 2026-10-14

Runnable validation guide proving the feature works end-to-end. No implementation code here — commands and expected outcomes only. Details: [data-model.md](data-model.md), [contracts/](contracts/). Assumes the 002 board (10×10, two ships, agility movement, alternating turns) already works — see `specs/002-agility-based-movement/quickstart.md` if the base game does not run.

## Prerequisites

- Node.js 20+ LTS and npm 10+ (`node --version`, `npm --version`)
- A modern desktop browser (Chrome/Firefox/Edge/Safari current)
- No network access needed at runtime (only `npm install` fetches packages)

## Setup & run

```sh
git clone <repo-url> && cd kyle-trek
git checkout 003-ship-combat-system
npm install      # fetch excalibur, vite, vitest (only network step)
npm run dev      # serve the game with hot reload
```

Open the printed localhost URL (default `http://localhost:5173`) in your browser. Expected: the 10×10 board with two ships as in 002, PLUS per-ship combat block (`STR x (±m) · CON y (±m) · HP cur/max · AC 12`), a turn line naming the active player/ship with `Move: available/used · Attack: available/used`, highlighted legal destinations for Ship 1, and Skip Movement + End Turn / Skip Attack controls.

## Validate rules (automated)

```sh
npm test         # vitest unit suite: combat, extended turn (+ existing grid/spawn/agility/movement/validation)
```

Expected: all tests pass. Coverage and what each file proves:

| Suite | Proves (spec → test) |
|-------|----------------------|
| `tests/unit/combat.test.ts` (new) | FR-001/FR-002/FR-003: strength/constitution rolls in 8–20, every table band incl. boundaries (8/9 → −1, 10/11 → 0, …, 20 → 5); FR-004: HP = d20 (1–20) + con-mod×2, floor 1 (incl. base-10 + mod-2 → 14 example); FR-005: AC exactly 12; FR-010: ≥12 hits / <12 misses (incl. 10+2=12 hit, 9+1=10 miss); FR-011: miss changes no HP, consumes no damage roll; FR-012: d8 + mod damage floored at 1; FR-013: HP clamp at 0; FR-014: 0 HP ends game immediately, attacker wins, further actions rejected; FR-019: pinned draw order + same-seed replay equality |
| `tests/unit/turn.test.ts` (extended) | FR-006/FR-009/FR-020: attack-before-move allowed; second move/attack rejected; empty/own-ship selection consumes nothing; Skip Movement / Skip Attack consume without state change or rolls; both-used or early-end passes turn; rapid double-selection launches once |
| `tests/unit/board-config.test.ts` + `validation.test.ts` (extended) | Combat config shape per `contracts/combat-config-schema.md`: gappy/overlapping table, bad ranges, wrong AC/dice rejected with explicit named errors; ships with mismatched modifiers or HP outside `0…max` rejected |
| `tests/unit/spawn/agility/grid/movement.test.ts` | 001/002 regressions: same seed still places ships and rolls agility identically (draw order preserved) |

## Validate combat in browser (manual, per constitution UI allowance)

Play a full battle and confirm:

1. **P1 story (stats at start)**: both ships show STR 8–20 + correct modifier, CON 8–20 + correct modifier, HP per the formula, AC 12 — before the first turn. Restart with the same seed (dev hook / query param per implementation) → identical stats and HP.
2. **P2 story (two optional actions, any order)**: attack first by clicking the enemy ship → torpedo launches, outcome text shows, move stays available. Next turn: move first, then attack. Use Skip Movement → no relocation, attack stays available. Use End Turn / Skip Attack → turn passes with no rolls. Attempt a second move or second attack in one turn → ignored.
3. **P3 story (resolution + victory)**: on a declared hit, defender HP drops by the shown damage; on a miss, both HP unchanged. Reduce a ship to 0 → game ends immediately, attacker declared winner, further clicks do nothing.
4. **P4 story (animation)**: hit → blinking star attacker→defender + contact explosion. Miss → blinking star on a near-miss path past the defender, off the grid, no explosion on the ship. Underlying HP outcome always matches the declared verdict.
5. **Edge cases**: negative-modifier ships still deal ≥ 1 on a hit; boxed-in / ≤0-modifier ships skip via the Skip Movement control; empty/own-ship clicks consume nothing; double-clicking the enemy ship launches exactly one torpedo.
6. **SC-006 legibility**: at any attack outcome, within 10 seconds you can point to each ship's stats + HP, remaining actions, the attack roll + total, the hit/miss verdict, and damage dealt.
7. **Failure visibility**: temporarily corrupt the `combat` section in `src/config/board.json` (e.g. delete the `20` band or set `armorClass: "twelve"`) → reload shows an explicit error naming the failed rule instead of defaulted combat; then revert.

## Validate production bundle

```sh
npm run build      # static bundle builds with no errors
npm run preview    # serve the built bundle locally
```

Expected: the preview URL serves the same combat game as `dev`; no console errors.

## Done when

- `npm test` green; manual browser checks 1–7 pass; `npm run build` + `preview` serve a working combat game.
