# Quickstart: Agility-Based Movement

**Feature**: `specs/002-agility-based-movement/spec.md` · **Date**: 2026-10-14

Runnable validation guide proving the feature works end-to-end. No implementation code here — commands and expected outcomes only. Details: [data-model.md](data-model.md), [contracts/](contracts/). Assumes the 001 board (10×10, two ships placed) already works — see `specs/001-grid-ship-spawn/quickstart.md` if the base board does not render.

## Prerequisites

- Node.js 20+ LTS and npm 10+ (`node --version`, `npm --version`)
- A modern desktop browser (Chrome/Firefox/Edge/Safari current)
- No network access needed at runtime (only `npm install` fetches packages)

## Setup & run

```sh
git clone <repo-url> && cd kyle-trek
npm install      # fetch excalibur, vite, vitest (only network step)
npm run dev      # serve the game with hot reload
```

Open the printed localhost URL (default `http://localhost:5173`) in your browser. Expected: the 10×10 board with two ships as in 001, PLUS a turn indicator naming the active player/ship, each ship's agility stat + modifier shown, and highlight markers on every legal destination for Ship 1 (Player 1 always moves first).

## Validate rules (automated)

```sh
npm test         # vitest unit suite: agility, movement, turn (+ existing grid/spawn/validation)
```

Expected: all tests pass. Coverage and what each file proves:

| Suite | Proves (spec → test) |
|-------|----------------------|
| `tests/unit/agility.test.ts` | FR-001/FR-002: every table band incl. boundaries (8/9 → −1, 10/11 → 0, …, 20 → 5); rolls stay in 8–20; same seed → same agility values; draw order ship-1 then ship-2 |
| `tests/unit/movement.test.ts` | FR-004/FR-005/FR-006: modifier-1 center cross; edge/corner truncation; opponent square excluded; straight-corridor blocked vs. L-route go-around; modifier 0/−1 → origin only; same state → same set (FR-012) |
| `tests/unit/turn.test.ts` | FR-003/FR-010: ship-1 starts; strict alternation over N moves; stay-in-place passes; illegal destination / wrong-ship moves rejected with no state change (FR-009) |
| `tests/unit/validation.test.ts` (additions) | Agility invalid classes: out-of-range stat, stat in no band, overlapping/gappy config table — each with an explicit named error |
| `tests/unit/spawn.test.ts`, `grid.test.ts` | 001 regressions: same seed still places ships identically (draw order preserved) |

## Validate movement in browser (manual, per constitution UI allowance)

Play a full turn cycle and confirm:

1. **P1 story (alternate + bounded moves)**: status shows Player 1 / Ship 1 with its stat + modifier. Count the modifier: every highlighted square is reachable within that many orthogonal steps; nothing farther is marked. Click a highlighted square → ship relocates, turn indicator flips to Player 2 / Ship 2 (acceptance scenarios 1, 2, 4; SC-001/SC-004).
2. **P2 story (highlights)**: with a mid-board ship of modifier 1, exactly the in-bounds orthogonal neighbors plus the origin marker show. Park a ship in a corner and confirm truncation (no off-board markers). Markers use outline/shape as well as color, and the stay-in-place marker differs from move markers.
3. **P3 story (click-to-move)**: click a highlighted square → move + turn passes. Click a non-highlighted square → nothing happens, same player's turn continues. Click the ship's own square → stays in place, turn passes (pass move).
4. **Low-agility edge (SC-005)**: force or await a ship with agility 8–11 (modifier ≤ 0) — only its own square is marked; clicking it passes the turn without deadlock.
5. **Blocking/go-around**: maneuver next to the opponent so it sits between you and a farther square — squares beyond are marked only if an orthogonal route goes around it; the opponent's own square is never marked.
6. **SC-002 legibility**: at any turn start, within 10 seconds you can point to whose turn it is, the movement range (stat + modifier), and every legal destination.
7. **Failure visibility**: temporarily corrupt the `agility` table in `src/config/board.json` (e.g. delete the `20` band) → reload shows an explicit error naming the failed rule instead of defaulted movement; then revert.

## Validate production bundle

```sh
npm run build      # static bundle builds with no errors
npm run preview    # serve the built bundle locally
```

Expected: the preview URL serves the same movement game as `dev`; no console errors.

## Done when

- `npm test` green; manual browser checks 1–7 pass; `npm run build` + `preview` serve a working movement game.
