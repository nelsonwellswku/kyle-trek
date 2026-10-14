# Implementation Plan: Agility-Based Movement

**Branch**: `002-agility-based-movement` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-agility-based-movement/spec.md` (3 clarification answers recorded 2026-10-14: seedable per-ship agility roll; no pass-through with go-around allowed; Player 1 always first), building on the `001-grid-ship-spawn` board/sim/scene foundation. Same local-only ExcaliburJS browser game (`npm run dev`).

**Note**: This plan was produced by the `/speckit.plan` command; Phase 2 tasks (`tasks.md`) are NOT part of this output.

## Summary

Add turn-based ship movement bounded by agility: at game start each ship rolls agility 8–20 from the seeded RNG (fixed for the game) and derives its move range from the spec's stat→modifier table; players alternate turns moving orthogonally up to their modifier, with all legal destinations highlighted (non-color-only markers) and confirmed by left-click, after which the turn passes. Approach: extend the pure engine-independent sim core with `agility.ts` (roll + table lookup as data), `movement.ts` (legal-set computation: Manhattan bound, in-bounds, opponent exclusion with go-around path check), and `turn.ts` (active-player state machine + move reducer), all covered by Vitest unit tests written first; extend `board.json` with the agility range/table as data; extend the Excalibur presentation layer to render highlights, resolve tile clicks, and display turn ownership plus stat/modifier.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), ES modules, Node 20+ LTS toolchain for dev/build only (game runs in the browser) — established by 001, unchanged

**Primary Dependencies**: `excalibur` ^0.32.0 (2D engine: `Engine`, `Scene`, `TileMap`, `Actor`, seeded `Random`, pointer input, procedural `Graphics`); `vite` ^6 (dev server + static build); no new dependencies

**Storage**: N/A — no persistence in this feature; game state lives in memory; seed reproducibility extended to agility rolls (stored seed re-creates spawn positions AND agility values)

**Testing**: Vitest (unit tests for pure sim logic: modifier table boundaries, legal-set correctness incl. edges/blocking/go-around/≤0 modifiers, turn alternation + illegal-click rejection, seeded determinism of agility + positions; Node environment, no browser needed). Highlight rendering, click feel, and turn legibility verified manually per constitution allowance (see quickstart.md).

**Target Platform**: Modern desktop web browser (local-only; Excalibur Canvas/WebGL rendering), served from localhost via `npm run dev`

**Project Type**: Browser game (single-page web game, one scene)

**Performance Goals**: Legal-set computation effectively instant (100-cell enumeration, no perceptible cost); stable 60 fps rendering of board + highlight markers; click-to-move acknowledged without perceptible lag (constitution sufficiency targets)

**Constraints**: Local-only — no backend, no runtime network calls; runnable offline after `npm install`; procedural vector graphics only (highlight markers included); mouse left-click is the confirm action (keyboard equivalents out of scope per spec); color never the sole signal for highlights or ship identity

**Scale/Scope**: 10×10 board (100 squares), 2 ships with agility 8–20 / modifier −1…5, single local hotseat session, movement as the only turn action; no combat, terrain, AI, or save/load in this feature

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — see Verdict (post-design) below.*

- **I. Gameplay Correctness & Deterministic Rules** — PASS. Agility rolls come from the same seeded `Random` stream as spawn (draw order pinned: spawn draws first, then agility ship-1, then ship-2, so 001 seed→position mappings are preserved for a given config version); modifier table is exact per spec; legal sets and turn transitions are pure functions of state (FR-012). Same seed reproduces same agility + positions.
- **II. Player Clarity & Feedback** — PASS. Turn owner, active ship, agility stat + modifier, and every legal destination are shown before the player commits (FR-007/FR-011); highlights use shape/outline in addition to color; illegal clicks are visibly ignored (no silent or partial moves). SC-002 legibility check is a manual quickstart step.
- **III. Test-First Game Rules (NON-NEGOTIABLE)** — PASS. Plan keeps all movement/turn logic in the browser-independent sim core (`agility.ts`, `movement.ts`, `turn.ts`, zero Excalibur imports) so rule tests are written first and run in Node via Vitest: table boundaries (−1/0/5 edges), legal-set cases (center/edge/corner, occupied, blocked vs. go-around, ≤0), turn reducer (alternation, stay-passes, rejection). Rendering/click feel verified manually, as permitted.
- **IV. Data-Driven Content** — PASS. Agility roll range (8–20) and the full stat→modifier table live in `src/config/board.json` (additive `agility` section, schema in `contracts/agility-config-schema.md`); sim reads them, never hard-codes them. Balance changes (e.g. table retuning) require no logic rewrites.
- **V. Pragmatic Simplicity & Sufficient Performance** — PASS. Three small pure sim modules + a scene extension; no new dependencies, no engine/framework changes, no speculative systems (combat, terrain, AI, multiplayer explicitly out of scope). Legal-set enumeration is trivially cheap — no perf work without measured gaps.

*Verdict (post-design, after Phase 1)*: All gates still PASS. Design preserves determinism (RNG draw order pinned in R-02; `setup(config, seed)` stays pure), clarity (movement scene contract pins highlight/click/turn-display guarantees), test-first (sim has zero Excalibur imports; contracts are behavioral, not code), data-driven (agility table in JSON + schema contract), and simplicity (no new modules beyond `agility`/`movement`/`turn` + scene extension + tests). No violations — Complexity Tracking does not apply.

## Project Structure

### Documentation (this feature)

```text
specs/002-agility-based-movement/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── movement-scene-contract.md
│   └── agility-config-schema.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
index.html                  # Vite entry page hosting the game canvas (unchanged)
package.json                # scripts: dev, build, preview, test (unchanged)
vite.config.ts              # Vite config (unchanged)
tsconfig.json               # strict TypeScript (unchanged)

src/
├── main.ts                 # Engine boot: loads board.json, builds setup (now incl. agility), starts BattleScene
├── config/
│   └── board.json          # DATA += agility section: roll range 8-20 + stat->modifier table (no logic)
├── sim/
│   ├── types.ts            # += AgilityStat, AgilityTable, TurnState, MoveResult types
│   ├── grid.ts             # (unchanged) grid construction + dimension rules
│   ├── spawn.ts            # (unchanged logic) spawn selection; draw order precedes agility rolls
│   ├── agility.ts          # NEW (pure): per-ship agility roll + modifier lookup from data table
│   ├── movement.ts         # NEW (pure): legal-destination-set computation
│   ├── turn.ts             # NEW (pure): turn state machine + move reducer
│   └── validation.ts       # += agility range/table-membership checks (pure)
└── scenes/
    └── battle-scene.ts     # += highlight markers, tile click -> move dispatch, turn/stat display

tests/
└── unit/
    ├── grid.test.ts        # (existing, unchanged)
    ├── spawn.test.ts       # (existing; extended only if draw-order assertions needed)
    ├── validation.test.ts  # += agility invalid classes (out-of-range, unmapped)
    ├── agility.test.ts     # NEW: table boundaries (-1/0/5 edges), roll range, seeded determinism
    ├── movement.test.ts    # NEW: center/edge/corner sets, occupied exclusion, blocked vs go-around, <=0 stay-only
    └── turn.test.ts        # NEW: Player 1 first, alternation, stay-passes, illegal-move rejection
```

**Structure Decision**: Single-project web game, extending the 001 layout in place. Deliberate split preserved: `src/sim/` stays pure and Excalibur-free (deterministic, Vitest in Node) while `src/scenes/` remains the thin presentation adapter (Excalibur-only, manual verification). `src/config/board.json` gains an additive `agility` data section. This split directly serves Constitution Principles I, III, and IV.

## Complexity Tracking

> No constitution violations — this section does not apply. No entry required.

---

*Phase 0 output: [research.md](research.md) · Phase 1 outputs: [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)*
