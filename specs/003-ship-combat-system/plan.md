# Implementation Plan: Ship Combat System

**Branch**: `003-ship-combat-system` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-ship-combat-system/spec.md`

## Summary

Add D&D-style ship combat on the existing 10×10 Excalibur board: each ship rolls strength 8–20 and constitution 8–20 at setup (shared stat→modifier table, same shape as agility), hit points = d20 (1–20) + constitution modifier × 2 (floor 1), fixed armor class 12. Each turn offers one optional move (existing agility rules) + one optional attack (unlimited range, click enemy ship to launch a photon torpedo) in either order, each usable at most once, with explicit Skip Movement / End Turn / Skip Attack controls. Attack resolves d20 + strength modifier vs. AC 12; hits deal d8 + strength modifier (min 1) damage, HP clamps at 0, and 0 HP ends the game immediately with the attacker winning. Hit shows a blinking-star torpedo attacker→defender + contact explosion; miss shows a near-miss path off-grid. Approach: extend `board.json` with data-driven `combat` tuning, add pure sim modules (`combat.ts` for stats/rolls, turn reducer extended to two-action turns), wire scene for skip controls + torpedo animation + roll disclosure, all rolls from the injected seedable RNG in pinned order.

## Technical Context

**Language/Version**: TypeScript ~5.6 (ESM, `es2022` build target)

**Primary Dependencies**: ExcaliburJS ^0.32.0 (rendering/input/Random), Vite ^6.0.0 (dev/build), no other runtime deps

**Storage**: N/A — in-memory sim state only; tuning lives in `src/config/board.json`; full game state (grid + ships incl. combat stats/HP + turn + RNG position) must stay serializable for future save/load

**Testing**: Vitest ^3.0.0, suites in `tests/unit/**/*.test.ts` (node environment); UI rendering/animation verified manually via quickstart (constitution allowance)

**Target Platform**: Modern desktop browsers, local-only; 800×600 Excalibur canvas served by Vite (`npm run dev`, default `http://localhost:5173`)

**Project Type**: Browser 2D turn-based game (sim core `src/sim/` pure + engine-free; presentation `src/scenes/battle-scene.ts`)

**Performance Goals**: Sufficiency per constitution — UI input acknowledged without perceptible lag; turn/attack resolution completes promptly; torpedo animation holds stable 2D frame rate; no per-frame allocations causing visible stutter

**Constraints**: Deterministic rules — all rolls (stats, HP base, attack, damage) from the injected seedable `Rng` in pinned order, same seed + actions reproduce the same battle; data-driven tuning (stats, AC, dice, torpedo visuals in `board.json`, no hard-coded combat numbers in logic); accessibility baseline — hit/miss never color-only (path + explosion + text disclosure); hotseat two-player, no AI/network

**Scale/Scope**: 2 ships on a 10×10 grid; one battle at a time; this feature adds ~4 sim concepts (strength, constitution, HP/AC, attack resolution) + two-action turn + one projectile animation — no range/line-of-sight, AI, or multiplayer

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Gameplay Correctness & Deterministic Rules**: PASS — plan uses the injected `Rng.integer` exclusively, pins RNG draw order (spawn → strength → constitution → HP base → attack → damage-on-hit), fixes the modifier table and AC/dice as data, and requires seeded-replay tests. No hidden modifiers; animation never changes outcomes.
- **II. Player Clarity & Feedback**: PASS — plan requires persistent stat/HP/AC display, remaining-action indicators, immediate disclosure of attack roll + total + verdict + damage + remaining HP as text/log alongside animation, and non-color-only hit/miss (path + explosion + text).
- **III. Test-First Game Rules (NON-NEGOTIABLE)**: PASS — plan requires fail-first Vitest suites for stat/modifier mapping (incl. −1/0 edges), HP formula + floors, attack ≥ AC rule, miss-no-damage, damage minimum, HP clamp, win-on-0, per-turn action limits (at most once each, any order, skips), and seeded replay before implementation. Rendering/animation stays manual per allowance.
- **IV. Data-Driven Content**: PASS — strength/constitution ranges + shared table, AC 12, HP constants, d20/d8 sizes, and torpedo visual parameters all live in `board.json` under a new `combat` section; sim code reads data, never hard-codes.
- **V. Pragmatic Simplicity & Sufficient Performance**: PASS — scope is stats + one move + one attack per turn on the existing grid; no range/LOS, AI, multiplayer, or extra actions; torpedo is a single blinking-star projectile + explosion using existing Excalibur primitives; perf work only on measured gaps.

No violations; Complexity Tracking empty.

*Post-design re-check (Phase 1, 2026-10-14): design keeps all five gates green — research.md R-01…R-08 implement the data-driven, deterministic, tested approach; data-model.md adds no hidden state; contracts pin disclosure and non-color-only feedback. No new violations.*

## Project Structure

### Documentation (this feature)

```text
specs/003-ship-combat-system/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── config/board.json        # + combat section (stat ranges, shared table, AC, dice, torpedo visuals)
├── sim/
│   ├── types.ts             # + strength/constitution/HP/AC, two-action TurnState, attack types
│   ├── agility.ts           # existing (shared table pattern reused; combat lookup generalized)
│   ├── combat.ts            # NEW: stat rolls, HP formula, attack/damage resolution (pure)
│   ├── board-config.ts      # + combat section parsing/validation
│   ├── setup.ts             # + combat rolls in pinned RNG order
│   ├── validation.ts        # + combat stat/HP/AC rules
│   ├── turn.ts              # extended: one move + one attack per turn, any order, skips
│   ├── movement.ts          # unchanged (move action reuses legalDestinations)
│   ├── grid.ts / spawn.ts   # unchanged
│   └── board-config.ts
├── scenes/
│   └── battle-scene.ts      # + stat/HP/action HUD, skip controls, torpedo hit/miss animation
└── main.ts                  # unchanged wiring (ex.Random adapter already seedable)

tests/
└── unit/
    ├── combat.test.ts       # NEW: mapping, HP formula/floors, attack/damage, win-on-0, seeded replay
    ├── turn.test.ts         # extended: two-action turns, order, double-use rejection, skips
    ├── setup/validation/agility.test.ts  # extended: combat stat edge cases, draw-order preservation
    ├── movement/grid/spawn/board-config.test.ts  # regression: 001/002 seeds unaffected
    ├── contract/            # N/A (no network/library API; UI + data contracts in specs/)
    └── integration/         # N/A (covered by unit + manual quickstart per constitution)
```

**Structure Decision**: Single-project layout (DEFAULT option). The sim stays engine-free and pure under `src/sim/` with Thin-scene separation; the only new sim module is `combat.ts`. No backend/frontend split, no mobile/API split — this is one local browser game. Contracts are UI + data contracts under `specs/003-ship-combat-system/contracts/`, not network schemas.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
