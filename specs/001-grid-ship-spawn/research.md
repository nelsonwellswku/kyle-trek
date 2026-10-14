# Phase 0 Research: Grid Ship Spawn

**Feature**: `specs/001-grid-ship-spawn/spec.md` · **Date**: 2026-10-14

All Technical Context unknowns are resolved below. Each entry records the decision, rationale, and alternatives considered. Sources: ExcaliburJS official docs/API (`excaliburjs.com`), npm registry (`excalibur@0.32.0`), official `excaliburjs/template-ts-vite` template.

## R-01: Application stack (language, bundler, engine version)

- **Decision**: TypeScript 5.x (strict) + Vite 6 + `excalibur` ^0.32.0, laid out per the official Excalibur TypeScript+Vite template (`npm create excalibur`; `npm install` → `npm run dev`).
- **Rationale**: User mandates ExcaliburJS and a clone-and-`npm run dev` local web game. The official Vite+TS template is the engine team's recommended toolchain, gives instant HMR dev serving and a static production bundle, and matches the engine's own dev stack (Vite + Vitest), minimizing integration risk.
- **Alternatives considered**: Parcel/Rollup/Webpack templates (same engine, less common tooling and smaller community examples — rejected); plain `<script>` ESM/CDN (no local type-checking or test runner — rejected); Godot/Godot-web or raw Canvas2D (violates the user's explicit ExcaliburJS requirement — rejected).

## R-02: Seeded randomness for spawn selection

- **Decision**: Use Excalibur's built-in `Random` class (`new Random(seed?)`) as the sole RNG source for setup.
- **Rationale**: `Random` implements Mersenne Twister MT19937-32: a given seed reproduces the exact number sequence (satisfies FR-006/SC-004 and Principle I); `integer(min, max)` is inclusive on both ends, matching "uniform pick among 20 zone squares"; constructed without a seed it derives unique `Date.now()`-based seeds per instance, giving independent draws across games (edge-case requirement). No extra dependency needed.
- **Alternatives considered**: `Math.random` (not seedable — fails FR-006 — rejected); `seedrandom` library (duplicates engine capability, extra dep — rejected); custom LCG/MT implementation (reinvents tested engine code — rejected).

## R-03: Board and ship rendering approach

- **Decision**: Render with Excalibur `TileMap` (10×10 cells) for the grid plus two `Actor`s for the ships, using procedural vector graphics only — distinct shapes (e.g. triangle vs. pentagon/`Polygon`) in distinct colors (e.g. cyan vs. orange `Rectangle`/`Circle`/`Polygon` graphics). No image or audio assets.
- **Rationale**: `TileMap` is the engine-native grid construct (one tile per square, trivial cell→screen mapping); `Actor`+procedural graphics satisfy FR-009's graphical-2D-board and shape+color distinction requirements with zero asset pipeline, keeping the game fully local-only and offline-capable after install. No asset formats to govern.
- **Alternatives considered**: Raw Canvas 2D custom renderer (more code, bypasses the mandated engine — rejected); PNG/SVG sprite assets (weight and pipeline for two single-square markers; speculative art needs — rejected per Principle V); `IsometricMap` (wrong projection for a square grid — rejected).

## R-04: Simulation / presentation separation (testability)

- **Decision**: Pure, Excalibur-free simulation core in `src/sim/` (`grid.ts`, `spawn.ts`, `validation.ts`, `types.ts`); `src/scenes/battle-scene.ts` is a presentation-only adapter mapping `GameSetup` state onto `TileMap`+`Actor`s. Data flows one way: `board.json` + seed → sim → scene. Sim never imports `excalibur`.
- **Rationale**: Directly enables Constitution Principle III — rule tests (dimensions, zone membership, distinctness, validation, seeded determinism/uniformity) run in plain Node via Vitest with no browser, canvas, or engine harness. Rendering stays manually verifiable, which the constitution explicitly permits for UI.
- **Alternatives considered**: Game logic inside `Scene`/`Actor` classes (requires browser/DOM or engine test harness for every rule test — rejected); logic in Svelte/React-style components (framework overhead for a one-scene game — rejected).

## R-05: Test runner and what is (not) automated

- **Decision**: Vitest for all automated tests (`tests/unit/`, Node environment); manual browser checklist in `quickstart.md` covers rendering and the SC-005 10-second legibility check.
- **Rationale**: Vitest is the engine ecosystem's standard (Excalibur itself tests with Vitest) and runs the pure-sim suite in milliseconds. Visual/regression testing (`@vitest/browser`, Playwright screenshots) is disproportionate for a setup-only feature with two procedural shapes; constitution allows manual UI verification.
- **Alternatives considered**: Jasmine/Karma browser suite (heavy harness for logic that needs no DOM — rejected); Playwright visual snapshots (flaky, premature at this scope — deferred to a later gameplay feature if ever needed); no automated tests (violates non-negotiable Principle III — rejected).

## R-06: Local run / validation UX

- **Decision**: `npm install` once; `npm run dev` serves the game on localhost for browser play; `npm test` runs rule tests; `npm run build` + `npm run preview` validate the static bundle. Documented as the runnable quickstart (see quickstart.md).
- **Rationale**: Matches the user's requested experience exactly and mirrors the official template's script conventions, so any Excalibur developer's muscle memory applies.
- **Alternatives considered**: Custom server or Electron/Capacitor wrappers (deployment-shaped complexity for a local-only deliverable — rejected); Docker (unnecessary for a static browser game — rejected).

## R-07: Data-driven board configuration

- **Decision**: All tuning lives in `src/config/board.json` (grid rows/cols, named spawn zones as row ranges, ship visual descriptors: shape + color), validated against the schema in `contracts/board-config-schema.md`. Sim and scene both read it; neither hard-codes tuning values.
- **Rationale**: Satisfies Principle IV (balance/layout changes without logic rewrites) and makes zone/grid requirements (FR-001/FR-003/FR-004) reviewable as data. JSON import via Vite needs no loader config.
- **Alternatives considered**: Constants in `spawn.ts`/scene code (violates Principle IV — rejected); external CMS/remote config (network dependency contradicts local-only — rejected).

## Open items

None. All NEEDS CLARIFICATION resolved — no TBDs carry into Phase 1.
