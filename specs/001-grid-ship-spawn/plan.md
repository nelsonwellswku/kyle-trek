# Implementation Plan: Grid Ship Spawn

**Branch**: `001-grid-ship-spawn` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-grid-ship-spawn/spec.md` plus user direction: local-only web browser game (clone repo, `npm run dev`, play in browser), implemented with ExcaliburJS.

**Note**: This plan was produced by the `/speckit.plan` command; Phase 2 tasks (`tasks.md`) are NOT part of this output.

## Summary

Build a local-only browser game opening screen that creates a 10x10 grid and places two single-square spaceships at seedable-random starting positions (Ship 1: top two rows; Ship 2: bottom two rows), rendered as a graphical ExcaliburJS 2D board with shape- and color-distinct ships. Approach: Vite + TypeScript + Excalibur (official `template-ts-vite` toolchain), a pure engine-independent simulation core (grid/spawn/validation/RNG) covered by Vitest unit tests written first, a thin Excalibur presentation layer (`TileMap` + two `Actor`s with procedural graphics), and board tuning (dimensions, spawn zones, ship visuals) held in a data file separate from logic.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), ES modules, Node 20+ LTS toolchain for dev/build only (game runs in the browser)

**Primary Dependencies**: `excalibur` ^0.32.0 (2D engine: `Engine`, `Scene`, `TileMap`, `Actor`, `Random`, procedural `Graphics`); `vite` ^6 (dev server + static build, from official Excalibur Vite template)

**Storage**: N/A — no persistence in this feature; game state lives in memory; only seed reproducibility is required (stored seed re-creates setup)

**Testing**: Vitest (unit tests for pure sim logic: grid dimensions, zone membership, validation, seeded-RNG determinism/uniformity; Node environment, no browser needed). Rendering/legibility verified manually per constitution allowance (see quickstart.md).

**Target Platform**: Modern desktop web browser (local-only; Excalibur Canvas/WebGL rendering), served from localhost via `npm run dev`

**Project Type**: Browser game (single-page web game, one scene)

**Performance Goals**: Setup resolution effectively instant (<100 ms on modest hardware); stable 60 fps rendering of a 100-tile board; input acknowledged without perceptible lag (constitution sufficiency targets)

**Constraints**: Local-only — no backend, no runtime network calls; runnable offline after `npm install`; no image/audio asset pipeline (procedural vector graphics only); keyboard- and mouse-playable baseline; color never the sole signal for ship identity

**Scale/Scope**: 10x10 board (100 squares), 2 ships, single local session, one scene; no multiplayer, movement, combat, or save/load in this feature

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — see Verdict (post-design) below.*

- **I. Gameplay Correctness & Deterministic Rules** — PASS. Spawn selection uses Excalibur's seeded `Random` (Mersenne Twister MT19937-32); sim core is pure functions of (config + seed); same seed reproduces same positions (SC-004). Unseeded games use engine-provided `Date.now()`-derived unique seeds (independent draws).
- **II. Player Clarity & Feedback** — PASS. Graphical 2D board shows all 100 squares and both ships; ships differ by shape AND color; SC-005 legibility check is a manual quickstart step. No hidden modifiers.
- **III. Test-First Game Rules (NON-NEGOTIABLE)** — PASS. Plan isolates a browser-independent sim core so rule tests (dimensions, zone constraints, distinctness, validation, seeded determinism/uniformity) are written first and run in Node via Vitest. Rendering verified manually, as permitted.
- **IV. Data-Driven Content** — PASS. Grid dimensions, spawn zones, and ship visual descriptors live in `src/config/board.json` (data); sim and scene code read it; no hard-coded tuning in logic.
- **V. Pragmatic Simplicity & Sufficient Performance** — PASS. One scene, no asset pipeline, no backend, no speculative systems (movement/combat/multiplayer explicitly out of scope). New dependency (`excalibur`) is user-mandated and justified; Vite/Vitest are the engine's official template toolchain. No perf work without measured gaps.

*Verdict (post-design, after Phase 1)*: All gates still PASS. Design preserves determinism (seed flows config→sim, never render→sim), clarity (scene contract pins legibility guarantees), test-first (sim has zero Excalibur imports), data-driven (JSON config + schema contract), and simplicity (no new modules beyond sim/scene/config/tests). No violations — Complexity Tracking does not apply.

## Project Structure

### Documentation (this feature)

```text
specs/001-grid-ship-spawn/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── scene-contract.md
│   └── board-config-schema.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
index.html                  # Vite entry page hosting the game canvas
package.json                # scripts: dev, build, preview, test
vite.config.ts              # Vite config (Excalibur-friendly defaults)
tsconfig.json               # strict TypeScript

src/
├── main.ts                 # Engine boot: loads board.json, builds setup, starts BattleScene
├── config/
│   └── board.json          # DATA: grid dims, spawn zones, ship visuals (no logic)
├── sim/
│   ├── types.ts            # Cell, ShipId, GameSetup, validation error types
│   ├── grid.ts             # Grid construction + dimension rules (pure)
│   ├── spawn.ts            # Zone-constrained uniform spawn selection (pure, seeded)
│   └── validation.ts       # Setup validator: dims, occupancy, zones, distinctness (pure)
└── scenes/
    └── battle-scene.ts     # Presentation only: TileMap + 2 ship Actors from GameSetup

tests/
└── unit/
    ├── grid.test.ts        # 10x10 structure, addressing, boundaries
    ├── spawn.test.ts       # zone membership, uniformity, seeded determinism
    └── validation.test.ts  # accepts valid setups, rejects each invalid class
```

**Structure Decision**: Single-project web game following the official Excalibur Vite+TypeScript template layout. Deliberate split: `src/sim/` is a pure, Excalibur-free core (deterministic, Vitest in Node) while `src/scenes/` is a thin presentation adapter (Excalibur-only, manual verification). `src/config/board.json` holds all tuning data. This split directly serves Constitution Principles I, III, and IV.

## Complexity Tracking

> No constitution violations — this section does not apply. No entry required.

---

*Phase 0 output: [research.md](research.md) · Phase 1 outputs: [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)*
