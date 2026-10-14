# Quickstart: Grid Ship Spawn

**Feature**: `specs/001-grid-ship-spawn/spec.md` · **Date**: 2026-10-14

Runnable validation guide proving the feature works end-to-end. No implementation code here — commands and expected outcomes only. Details: [data-model.md](data-model.md), [contracts/](contracts/).

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

Open the printed localhost URL (default `http://localhost:5173`) in your browser. Expected: a 10×10 tiled board fills the view with two distinctly shaped/colored ship markers — one in the top two rows, one in the bottom two rows.

## Validate rules (automated)

```sh
npm test         # vitest unit suite: grid, spawn, validation
```

Expected: all tests pass. Coverage and what each file proves:

| Suite | Proves (spec → test) |
|-------|----------------------|
| `tests/unit/grid.test.ts` | FR-001: exactly 10×10, unique in-range cells; edge rows/cols valid |
| `tests/unit/spawn.test.ts` | FR-003/FR-004 zone membership; FR-005 uniformity over seeded runs; FR-006/FR-007 + SC-003/SC-004: same seed → same positions, different seeds → varied coverage |
| `tests/unit/validation.test.ts` | FR-008: accepts valid setups; rejects wrong dims, out-of-zone ships, shared squares, mismatched occupancy — each with an explicit named error |

## Validate board in browser (manual, per constitution UI allowance)

Reload the page 3–5 times and confirm each time:

1. **P1 story**: board shows exactly 10 rows × 10 columns; Ship 1 (cyan triangle) sits in rows 1–2; Ship 2 (orange pentagon) sits in rows 9–10; no shared square (acceptance scenarios 1–3, SC-001/SC-002).
2. **P2 story**: starting squares differ across reloads (unseeded games draw independent seeds).
3. **SC-005 legibility**: within 10 seconds of load you can point to the grid boundaries and both ships, and tell the ships apart without relying on color (shape differs too).
4. **Failure visibility**: temporarily break `src/config/board.json` (e.g. set a zone to rows `[5, 5]` for both ships) → reload shows an explicit error naming the failed rule instead of a silent/partial board; then revert.

## Validate production bundle

```sh
npm run build      # static bundle builds with no errors
npm run preview    # serve the built bundle locally
```

Expected: the preview URL serves the same board as `dev`; no console errors.

## Done when

- `npm test` green; manual browser checks 1–4 pass; `npm run build` + `preview` serve a working board.
