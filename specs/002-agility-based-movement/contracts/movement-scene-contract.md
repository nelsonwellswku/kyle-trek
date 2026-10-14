# Contract: Movement Scene Presentation (UI Contract)

**Feature**: `specs/002-agility-based-movement/spec.md` · **Date**: 2026-10-14

This project exposes no network API, library API, or CLI — its user-facing interface is the rendered game board. This contract pins what the presentation layer (`src/scenes/battle-scene.ts`) MUST guarantee during movement turns, given the sim state (see `data-model.md`). It prescribes observable behavior, never implementation code. The 001 `scene-contract.md` guarantees (complete grid, faithful occupancy, ship distinction, viewport, failure surfacing) remain in force and are not repeated here.

## Inputs (from simulation core)

- Current `GameSetup` state: `grid`, `ships` (positions + `agility` + derived `agilityModifier`), and the active `Turn` (`activeShipId`, `turnNumber`, `legalSet` from `movement.ts` / `turn.ts`).
- Highlight/marker styling and ship visuals from `board.json` (data).

Precondition: the setup passed `validation.ts`. The scene MUST NOT recompute legality by its own rules, re-roll RNG, or mutate sim state — one-way data flow: sim → scene, clicks flow back only as `resolveMove` dispatches.

## Rendering & interaction guarantees

1. **Turn ownership**: it is always visible whose turn it is and which ship is active (e.g. status line and/or active-ship emphasis); after every accepted move the display switches to the other player with no intermediate ownerless state (FR-003/FR-010/FR-011).
2. **Explainable range**: each ship's agility stat and derived modifier are shown before or during its turn, so the highlighted range is explainable (FR-011).
3. **Complete, truthful highlights**: every cell in the active turn's `legalSet` is marked, and NO cell outside it is marked; markers appear at turn start and are cleared/replaced on turn change (FR-007). Because markers render the same pure-function output that validates moves, a highlighted square MUST always accept a click and a non-highlighted square MUST never move a ship.
4. **Non-color-only markers**: highlight markers use shape/outline in addition to color (e.g. ring/outline + tint); the stay-in-place (origin) marker is visually distinct from relocation markers so "pass" reads differently from "move" (FR-007, accessibility baseline).
5. **Single-action click-to-move**: left-clicking a highlighted square moves the ship there (or holds position on the origin square) and ends the turn; left-clicking any non-highlighted square or the non-active ship does nothing — no movement, no turn change, no error modal (FR-008/FR-009).
6. **No silent divergence**: the board never shows a ship on a square the sim does not hold, and never advances the turn display without an accepted reducer result (Principle II).

## Acceptance mapping

- Guarantees 1 + 2 → User Story 1 scenario 4 (turn passes to the other player) + FR-011 + SC-002/SC-004.
- Guarantees 3 + 4 → User Story 2 (all scenarios) + FR-007 + SC-002.
- Guarantee 5 → User Story 3 (all scenarios) + FR-008/FR-009/FR-010 + SC-003/SC-005.
- SC-002 manual check (identify turn, range, and all legal destinations within 10 s) is performed against guarantees 1–4 — see `quickstart.md`.

## Out of scope for this contract

Animations, sound, hover previews, drag movement, keyboard movement, HUD menus, and any turn actions beyond movement. Those belong to future features with their own contracts.
