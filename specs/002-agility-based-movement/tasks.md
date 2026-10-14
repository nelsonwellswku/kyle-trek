# Tasks: Agility-Based Movement

**Input**: Design documents from `/specs/002-agility-based-movement/` (plan.md, spec.md with US1 P1 / US2 P2 / US3 P3, data-model.md, contracts/, research.md R-01…R-08, quickstart.md)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — Constitution Principle III (Test-First Game Rules) is NON-NEGOTIABLE and the spec success criteria (SC-001…SC-005) require automated rule verification. Per the template rule, test tasks are written FIRST and MUST FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline verification of the existing 001 foundation this feature extends

- [ ] T001 Verify 001 baseline in repo root: `npm install`, `npm test` green, `npm run build` succeeds before any 002 changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared agility data, types, setup wiring, and validation that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 [P] Add `agility` section to `src/config/board.json` with rollRange `{min: 8, max: 20}` and the 7 stat→modifier bands (`8–9 → -1`, `10–11 → 0`, `12–13 → 1`, `14–15 → 2`, `16–17 → 3`, `18–19 → 4`, `20 → 5`) per `contracts/agility-config-schema.md`
- [ ] T003 [P] Extend `src/sim/types.ts` with `AgilityBand`, agility config, `TurnState` (`activeShipId`, `turnNumber`, `legalSet`), and move accept/reject result types per `data-model.md` Entities 2–4
- [ ] T004 Wire agility rolls into setup in `src/sim/setup.ts` with pinned RNG draw order (spawn ship-1 → spawn ship-2 → agility ship-1 → agility ship-2); `GameSetup` carries per-ship agility fixed for the game; identical `(configVersion, seed)` reproduces identical positions AND agility values per `research.md` R-02
- [ ] T005 Extend `src/sim/validation.ts` with data-model rules 6–9: agility integer within 8–20, stat in exactly one band with matching modifier, table ordered/non-overlapping/gapless over the roll range, post-move distinct in-bounds cells — explicit typed errors, never silent correction

**Checkpoint**: Foundation ready — `board.json` carries agility data, setup produces seeded agility, validator enforces it; user story implementation can now begin

---

## Phase 3: User Story 1 - Alternate Turns Moving Up To Agility Range (Priority: P1) 🎯 MVP

**Goal**: Headless turn cycle — seeded agility rolls, modifier lookup, orthogonal legal-set computation, and a turn reducer that alternates players and rejects illegal moves

**Independent Test**: `npm test` suites `agility`/`movement`/`turn` green (SC-001, SC-004, SC-005 at sim level); a scripted reducer sequence with known agility values moves one ship per player orthogonally within range and passes control each time

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T006 [P] [US1] Write `tests/unit/agility.test.ts`: every table band plus boundaries (8/9 → -1, 10/11 → 0, 12/13 → 1, 14/15 → 2, 16/17 → 3, 18/19 → 4, 20 → 5), rolls confined to 8–20, same seed → same agility values, draw order ship-1 then ship-2, invalid classes (out-of-range stat, stat in no band, overlapping/gappy table) — verify FAIL
- [ ] T007 [P] [US1] Write `tests/unit/movement.test.ts`: modifier-1 center cross, edge/corner truncation with no off-board cells, opponent-occupied cell excluded, straight-corridor blocked vs. L-route go-around, modifier 0/-1 → origin only, identical state → identical set (FR-012) — verify FAIL
- [ ] T008 [P] [US1] Write `tests/unit/turn.test.ts`: first turn is always ship-1, strict alternation over N accepted moves, stay-in-place passes the turn, illegal destination and wrong-ship moves rejected with zero state change — verify FAIL

### Implementation for User Story 1

- [ ] T009 [P] [US1] Implement `src/sim/agility.ts` (pure, zero Excalibur imports): per-ship roll via injected `Rng` plus modifier lookup read from `board.json` table data with explicit errors for unmapped stats per `research.md` R-01
- [ ] T010 [P] [US1] Implement `src/sim/movement.ts` (pure, zero Excalibur imports): `legalDestinations` returning `{origin}` plus all in-bounds cells with Manhattan distance `1..modifier`, minus the occupied cell, minus cells with no orthogonal path of length ≤ modifier avoiding it, per `research.md` R-03
- [ ] T011 [US1] Implement `src/sim/turn.ts` (pure, zero Excalibur imports): immutable `TurnState` starting at ship-1/turn 1 plus `resolveMove` accept/reject reducer flipping `activeShipId` and incrementing `turnNumber` on every accept including stay-in-place, per `research.md` R-04 (depends on T009, T010)
- [ ] T012 [US1] Run `npm test` fully green: new agility/movement/turn suites pass and 001 suites still pass with unchanged seed→position mappings (draw-order preservation)

**Checkpoint**: At this point, User Story 1 is fully functional and testable headlessly — the complete movement ruleset works without any rendering

---

## Phase 4: User Story 2 - Preview Legal Destinations Via Highlighting (Priority: P2)

**Goal**: Active-turn highlight markers rendered from the sim legal set, legible without relying on color

**Independent Test**: Manual browser checks per `quickstart.md` items 2 + 6 — modifier-1 mid-board cross plus origin marker, corner truncation, outline/shape markers distinct from color, stay marker distinct from move markers, 10-second legibility

### Implementation for User Story 2

- [ ] T013 [US2] Render highlight markers in `src/scenes/battle-scene.ts` directly from the turn's `legalSet`: every member marked and nothing outside it, rebuilt at each turn start and cleared/replaced on turn change, origin (stay) marker visually distinct from relocation markers, shape/outline in addition to color, per `contracts/movement-scene-contract.md` guarantees 3–4 (depends on Phase 3 legalSet)
- [ ] T014 [US2] Manually verify `quickstart.md` checks 2 + 6 in the browser via `npm run dev` (depends on T013)

**Checkpoint**: At this point, User Stories 1 AND 2 work — rules resolve headlessly and the board truthfully previews every legal destination

---

## Phase 5: User Story 3 - Click A Highlighted Square To Move (Priority: P3)

**Goal**: Single-action left-click move confirmation with turn display, completing the interactive turn loop

**Independent Test**: Manual browser checks per `quickstart.md` items 1, 3, 4, 5 — highlighted click moves + passes, non-highlighted click ignored, own-square click passes, ≤0-modifier stay-only turn, blocked vs. go-around behavior

### Implementation for User Story 3

- [ ] T015 [US3] Implement tile click → `resolveMove` dispatch in `src/scenes/battle-scene.ts`: left-click on a highlighted square moves the ship (origin click holds position) and ends the turn; clicks on non-highlighted squares or the non-active ship change nothing, per `contracts/movement-scene-contract.md` guarantee 5 (depends on Phase 3 reducer, Phase 4 markers)
- [ ] T016 [US3] Implement turn ownership plus stat/modifier display in `src/scenes/battle-scene.ts`: active player/ship always visible with no ownerless intermediate state, each ship's agility stat and derived modifier shown so range is explainable, per contract guarantees 1–2
- [ ] T017 [US3] Manually verify `quickstart.md` checks 1, 3, 4, 5 in the browser via `npm run dev` (depends on T015, T016)

**Checkpoint**: All user stories are now functional — the full move → highlight → click → handoff loop plays end to end

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full validation, bundle check, and constitution compliance review

- [ ] T018 Run complete `specs/002-agility-based-movement/quickstart.md` validation including check 7: temporarily corrupt the `agility` table in `src/config/board.json` (e.g. delete the `20` band) → reload shows an explicit error naming the failed rule, then revert
- [ ] T019 [P] Verify production bundle: `npm run build` with no errors then `npm run preview` serves the same working movement game with no console errors
- [ ] T020 Final `npm test` regression green plus constitution review of the change set (determinism from seed, no silent state changes, sim free of Excalibur imports, tuning confined to `board.json`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational completion
  - US1 (P1) first — MVP; US2 and US3 build on its sim output and scene
  - US2 and US3 are scene work on the same file (`battle-scene.ts`) — implement sequentially to avoid same-file conflicts
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational — no dependencies on other stories; independently testable headlessly via `npm test`
- **User Story 2 (P2)**: Depends on US1 `legalSet` output for markers; independently verifiable via highlight checks once US1 is done
- **User Story 3 (P3)**: Depends on US1 reducer + US2 markers; independently verifiable via click/turn checks once both are done

### Within Each User Story

- Tests (US1) MUST be written and FAIL before implementation
- Data/config before logic (Foundational before US1 sim modules)
- Sim modules (`agility.ts`, `movement.ts`) before reducer (`turn.ts`)
- Scene rendering (US2 markers) before scene input (US3 clicks)
- Story checkpoint validated before moving to next priority

### Parallel Opportunities

- T002 + T003 in parallel (different files: `board.json` vs. `types.ts`, no interdependency)
- T006 + T007 + T008 in parallel (three independent test files; all must FAIL before T009–T011)
- T009 + T010 in parallel (different files: `agility.ts` vs. `movement.ts`, no interdependency)
- T019 in parallel with T018 (bundle check vs. manual validation pass, no shared files)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (all must FAIL before implementation):
Task: "Write tests/unit/agility.test.ts — table bands/boundaries, roll range, seeded determinism, invalid classes"
Task: "Write tests/unit/movement.test.ts — center/edge/corner sets, occupied exclusion, blocked vs go-around, <=0 stay-only"
Task: "Write tests/unit/turn.test.ts — ship-1 starts, alternation, stay passes, illegal/wrong-ship rejection"

# Launch sim modules together after tests fail:
Task: "Implement src/sim/agility.ts — roll + table lookup from board.json data"
Task: "Implement src/sim/movement.ts — legalDestinations pure function"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001 baseline green)
2. Complete Phase 2: Foundational (T002–T005 agility data, types, setup wiring, validation)
3. Complete Phase 3: User Story 1 (T006–T008 tests FAIL-first, T009–T011 sim, T012 green)
4. **STOP and VALIDATE**: `npm test` green; scripted reducer sequence moves alternately within range
5. Deploy/demo the headless ruleset if ready

### Incremental Delivery

1. Setup + Foundational → agility data and seeded setup ready
2. Add US1 → headless movement rules independently tested (MVP!)
3. Add US2 → highlight preview, manually verified without changing sim
4. Add US3 → click-to-move + turn display, full loop playable
5. Polish → quickstart validation, bundle, compliance review

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable (US1 headless via vitest; US2/US3 via browser checklist)
- US1 tests T006–T008 must FAIL before T009–T011 implementation (TDD, Constitution III)
- Sim files (`src/sim/`) MUST NOT import Excalibur — scene (`src/scenes/battle-scene.ts`) is presentation only
- Commit after each task or logical group; stop at any checkpoint to validate
- Avoid: vague tasks, same-file parallel edits (`battle-scene.ts` tasks run sequentially), cross-story dependencies that break independence
