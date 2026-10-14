# Contract: Battle Scene Presentation (UI Contract)

**Feature**: `specs/001-grid-ship-spawn/spec.md` · **Date**: 2026-10-14

This project exposes no network API, library API, or CLI — its user-facing interface is the rendered game board. This contract pins what the presentation layer (`src/scenes/battle-scene.ts`) MUST guarantee given a validated `GameSetup` (see `data-model.md`), so acceptance scenarios and the manual legibility check stay testable without prescribing implementation code.

## Inputs (from simulation core)

- A validated `GameSetup`: `grid` (10×10 cells), `ships` (ship-1 + ship-2 placed), `seed`, `configVersion`.
- Board config visuals from `board.json`: per-ship `shape` + `color` descriptors.

Precondition: `validation.ts` has accepted the setup. The scene MUST NOT re-place ships, re-roll RNG, or mutate sim state (one-way data flow: sim → scene).

## Rendering guarantees

1. **Complete grid**: all 100 squares are drawn as visible, bounded tiles with no gaps or overlaps; grid edges (row 1 top, row 10 bottom, col 1 left, col 10 right) are identifiable at a glance.
2. **Faithful occupancy**: exactly two ship markers are drawn; each sits centered in the tile matching its sim `(row, col)`; every other tile is visibly empty.
3. **Ship distinction**: ship-1 and ship-2 markers differ by BOTH shape and color per config (e.g. cyan triangle vs. orange pentagon); color is never the sole difference.
4. **Viewport**: the full board is visible without scrolling or panning at the default window size; the canvas scales the board to fit while preserving square tiles.
5. **Failure surfacing**: a rejected setup (validator error) MUST surface as an explicit on-screen/console error naming the failed rule — never a silently empty or partially drawn board.

## Acceptance mapping

- Guarantee 1 + 2 → User Story 1 scenarios 1–3 (10×10 board, correct zones, distinct visible squares).
- Guarantee 3 → Clarification Q4 + FR-009 distinction clause.
- Guarantee 5 → FR-008 ("reject with an explicit error").
- SC-005 manual check (identify boundaries + both ships within 10 s) is performed against guarantees 1–3 — see `quickstart.md`.

## Out of scope for this contract

Movement, selection, hover states, animations, sound, HUD, menus, and any input handling beyond the engine's default window/keyboard-mouse baseline. Those belong to future features with their own contracts.
