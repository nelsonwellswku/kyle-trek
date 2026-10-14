# Tasks: Grid Ship Spawn

**Input**: Design documents from `/specs/001-grid-ship-spawn/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — Constitution Principle III (Test-First Game Rules, NON-NEGOTIABLE) and the spec's Constitution Compliance section require automated rule tests written before implementation. Rendering/legibility is verified manually per the constitution's UI allowance (quickstart.md checks).

**Organization**: Tasks grouped by user story; each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths in every description

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project scaffolding per plan.md Technical Context and research R-01/R-06

- [X] T001 Scaffold Vite + TypeScript + Excalibur project at repo root (package.json with `dev`/`build`/`preview`/`test` scripts, index.html canvas host page, vite.config.ts, tsconfig.json strict; install `excalibur` ^0.32.0 and `vitest`)
- [X] T002 [P] Configure Vitest unit testing in vitest.config.ts (Node environment, `tests/unit/` include, `npm test` script wiring)
- [X] T003 [P] Create initial board tuning data in src/config/board.json per specs/001-grid-ship-spawn/contracts/board-config-schema.md (version "1.0.0", 10x10 grid, top/bottom zones, triangle/cyan ship-1 + pentagon/orange ship-2)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared sim types and config loading every story depends on. MUST complete before any user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create simulation domain types in src/sim/types.ts (Cell with 1-based `row`/`col` and `occupant: ShipId | null`; `ShipId` `'ship-1' | 'ship-2'`; Spaceship with single-cell `position`; SpawnZone with inclusive `rows`/`cols` ranges; GameSetup with `seed`, `grid`, `ships`, `configVersion` — all per specs/001-grid-ship-spawn/data-model.md)
- [X] T005 Write config loader tests FIRST in tests/unit/board-config.test.ts (valid config loads with version recorded; missing required field fails fast naming the field; schema rules 1–5 from specs/001-grid-ship-spawn/contracts/board-config-schema.md)
- [X] T006 Implement board config loader in src/sim/board-config.ts to pass T005 (parse and validate board.json; unknown fields ignored; invalid configs throw naming the field; no hard-coded tuning values)

**Checkpoint**: Foundation ready — `src/sim/types.ts`, `src/sim/board-config.ts`, `src/config/board.json`, and green loader tests. User story work can now begin.

---

## Phase 3: User Story 1 - View Battle Grid With Starting Ships (Priority: P1) 🎯 MVP

**Goal**: New game shows a graphical Excalibur 2D 10×10 board with Ship 1 placed in rows 1–2 and Ship 2 in rows 9–10, each on exactly one distinct square, ships distinguishable by shape and color.

**Independent Test**: `npm test` green for grid/spawn/validation suites AND `npm run dev` shows a full 10×10 tiled board with the cyan triangle in the top two rows and the orange pentagon in the bottom two rows on distinct squares (quickstart.md manual checks 1, 3, 4).

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (T010–T013)**

- [X] T007 [P] [US1] Grid unit tests in tests/unit/grid.test.ts (FR-001: exactly 10 rows × 10 cols, 100 cells with unique in-range 1-based `(row, col)` coordinates, all occupants initially null, edge rows/cols addressable)
- [X] T008 [P] [US1] Spawn placement tests in tests/unit/spawn.test.ts (FR-002: exactly 2 ships each on one square; FR-003: ship-1 cell within rows [1,2] cols [1,10]; FR-004: ship-2 cell within rows [9,10] cols [1,10]; FR-007: distinct squares with bidirectional cell↔ship consistency)
- [X] T009 [P] [US1] Setup validation tests in tests/unit/validation.test.ts (FR-008: accepts a valid GameSetup; rejects wrong dimensions, out-of-zone ship, shared square, and occupant mismatch — each rejection naming the failed rule per specs/001-grid-ship-spawn/data-model.md validation rules 1–5)

### Implementation for User Story 1

- [X] T010 [US1] Implement pure grid construction in src/sim/grid.ts to pass T007 (build Grid from config rows/cols which MUST equal 10; zero `excalibur` imports)
- [X] T011 [US1] Implement zone-constrained uniform spawn selection in src/sim/spawn.ts to pass T008 (uniform pick among the 20 eligible cells of each ship's zone via the injected seeded RNG; depends on T010)
- [X] T012 [US1] Implement setup validator in src/sim/validation.ts to pass T009 (enforce data-model.md rules 1–5 with explicit typed errors; never silently correct; depends on T010, T011)
- [X] T013 [US1] Implement pure setup composition in src/sim/setup.ts (pure `setup(config, seed)` returning a validated GameSetup per specs/001-grid-ship-spawn/data-model.md; depends on T010–T012)
- [X] T014 [US1] Implement presentation-only battle scene in src/scenes/battle-scene.ts (Excalibur TileMap with all 100 bounded tiles + two Actors centered on their sim cells; ship-1 cyan triangle vs ship-2 orange pentagon per scene-contract guarantees 1–4 in specs/001-grid-ship-spawn/contracts/scene-contract.md; scene MUST NOT mutate sim state or re-roll RNG)
- [X] T015 [US1] Implement engine boot in src/main.ts (load board.json via board-config.ts, run `setup()` with a generated seed, start Excalibur Engine with BattleScene; validator rejection surfaces as an explicit on-screen/console error naming the rule per scene-contract guarantee 5)
- [X] T016 [US1] Verify US1 in browser per specs/001-grid-ship-spawn/quickstart.md manual checks 1, 3, 4 (10×10 board, correct zones, distinct squares, 10-second legibility incl. shape-based distinction, failure-visibility check)

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently — this is the MVP. STOP and VALIDATE before continuing.

---

## Phase 4: User Story 2 - Randomized Starting Positions Per Game (Priority: P2)

**Goal**: Each new game draws independent random starting positions within the zones; a recorded seed deterministically reproduces its setup.

**Independent Test**: `npm test` green for the seeded-RNG suite AND browser reloads show varying positions while re-running a console-logged seed reproduces the identical setup (quickstart.md manual check 2; SC-003/SC-004).

### Tests for User Story 2 ⚠️

> **NOTE: Write this test FIRST, ensure it FAILS before implementation (T018)**

- [X] T017 [US2] Seeded-RNG spawn tests in tests/unit/spawn.test.ts (FR-006/SC-004: identical seed yields identical ship positions; SC-003: 100 seeded runs cover all 40 zone squares with approximately uniform distribution; edge case: consecutive unseeded setups draw independently with unique recorded seeds)

### Implementation for User Story 2

- [X] T018 [US2] Implement seed handling in src/sim/setup.ts and src/main.ts to pass T017 (setup accepts an optional seed; default path creates `new Random()` for a Date.now()-derived unique seed; the effective seed and configVersion are recorded on every GameSetup; main.ts logs the seed to the console for replay; seed selection stays a developer-only detail with no player-facing seed UI per clarification 2026-10-14)
- [X] T019 [US2] Verify US2 in browser per specs/001-grid-ship-spawn/quickstart.md manual check 2 (reload 3–5 times: positions vary; re-run with a logged seed: identical positions)

**Checkpoint**: At this point, User Stories 1 AND 2 are both independently functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Release-readiness for the local-only handoff (clone → play)

- [X] T020 [P] Document local run instructions in README.md (clone, `npm install`, `npm run dev` + localhost URL, `npm test`, `npm run build`/`preview`; local-only, offline-after-install note)
- [X] T021 Audit data/logic separation across src/sim/ and src/scenes/ (no hard-coded grid dims, zone ranges, or ship visuals in logic files — all tuning read from src/config/board.json per Constitution Principle IV; remove dead code)
- [X] T022 Run full validation per specs/001-grid-ship-spawn/quickstart.md (`npm test` green, `npm run build` + `preview` serve the working board with no console errors, manual checks 1–4 pass)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately. T002 and T003 are mutually independent ([P]).
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories. Sequential (T004 → T005 → T006: tests before implementation).
- **User Stories (Phase 3–4)**: Depend on Foundational. US2 extends US1's sim/scene files, so implement US1 first; US2's test (T017) is written before its implementation (T018).
- **Polish (Phase 5)**: Depends on US1 + US2 complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational — no dependencies on other stories. Delivers the MVP alone.
- **User Story 2 (P2)**: Builds on US1's `spawn.ts`/`setup.ts`/`main.ts` — extends seed handling; independently testable via its RNG suite + reload checks.

### Within Each User Story

- Tests written FIRST and verified to FAIL before implementation (T007–T009 → T010–T013; T017 → T018)
- Sim core (pure, no `excalibur` imports) before scene (`battle-scene.ts`) before boot (`main.ts`)
- Story verified in browser (T016/T019) before moving on

### Parallel Opportunities

- T002 + T003 can run in parallel (different files, no mutual dependencies)
- T007 + T008 + T009 can run in parallel (three independent test files)
- T020 can run in parallel with any implementation work (standalone docs file)
- US1 verification (T016) and US2 test-writing (T017) touch different files and can overlap once US1 implementation is done

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (independent files, TDD-first):
Task: "Grid unit tests in tests/unit/grid.test.ts"            # T007 [US1]
Task: "Spawn placement tests in tests/unit/spawn.test.ts"      # T008 [US1]
Task: "Setup validation tests in tests/unit/validation.test.ts" # T009 [US1]

# Setup-phase parallel batch:
Task: "Configure Vitest in vitest.config.ts"                   # T002
Task: "Create board tuning data in src/config/board.json"      # T003
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T006)
3. Complete Phase 3: User Story 1 (T007–T016)
4. **STOP and VALIDATE**: `npm test` green + browser shows the correct 10×10 board with zoned, distinct, shape-and-color-distinct ships
5. Demo-ready: `npm run dev` is the playable MVP

### Incremental Delivery

1. Setup + Foundational → test harness and data layer ready
2. + US1 → playable seeded board (MVP)
3. + US2 → replayable/varied setups with recorded seeds
4. + Polish → documented clone-and-play handoff

---

## Notes

- [P] tasks = different files, no dependencies — safe to parallelize
- [US1]/[US2] labels map each story-phase task to its user story for traceability
- `src/sim/` MUST NOT import `excalibur` (keeps rule tests in Node); `src/scenes/` MUST NOT mutate sim state
- Commit after each task or logical group; stop at any checkpoint to validate independently

## Format Validation

- All 22 tasks use `- [ ] T###` checkbox + ID format: confirmed
- [P] markers only on different-file, dependency-free tasks (T002, T003, T007–T009, T020): confirmed
- [US1]/[US2] labels on all Phase 3/4 tasks, absent from Setup/Foundational/Polish: confirmed
- Exact file paths in every task description: confirmed
