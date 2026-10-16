---
description: "Executable tasks for Spaceship Grid Setup"
---

# Tasks: Spaceship Grid Setup

**Input**: Design documents in `specs/001-spaceship-grid-setup/`.
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [browser UI contract](contracts/browser-ui.md), [quickstart.md](quickstart.md).
**Tests**: Required by Constitution IV and the approved plan. Each behavior follows red–green–refactor; record exact commands and observed results in `specs/001-spaceship-grid-setup/development.md`. A missing module, compilation/setup error, or absent screenshot baseline is not a valid behavioral red.
**Organization**: Shared tooling first, then independently verifiable story increments in priority order. US1 delivers a supplied-layout board; US2 supplies production random initialization and New Game behavior. US1's temporary fixed composition is explicitly replaced in US2.

## Format: `[ID] [P?] [Story] Description`

- Every task is an unchecked checkbox with a sequential ID and exact file paths.
- `[P]` identifies independent work within a stated dependency wave; prerequisites still apply.
- `[US1]` and `[US2]` identify the corresponding stories from the specification.
- All paths are relative to the repository root. Implementation stays feature-cohesive under `src/features/game-setup/`; `src/app/` only mounts/composes/disposes it.
- After every implementation task, rerun its demonstrating test and relevant regression tests, refactor while green, and append evidence to the development record. Serialize record updates when work is parallel.
- Test tasks may establish minimal type-correct signatures or throwing scaffolds to reach an observable behavioral failure, but must not implement the behavior before recording red. Later tests target the new slice only, without deliberately breaking previously passing behavior.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the user-requested runtime, npm commands, bundler, and quality tools.

- [X] T001 Pin Node `24.22.0` in `.nvmrc`, select it with `nvm install` and `nvm use`, and initialize ESM `package.json` with Node 24.x/npm 11.x metadata and scripts matching `specs/001-spaceship-grid-setup/contracts/browser-ui.md`.
- [X] T002 Install exact direct versions into `package.json` and generate `package-lock.json`: Phaser 4.2.1, Vite 8.3.4, TypeScript 6.0.3, ESLint 10.12.0, matching `@eslint/js`, typescript-eslint 8.71.2, Prettier 3.9.10, eslint-config-prettier 10.1.8, Vitest 5.0.5, Playwright Test 1.64.1, and compatible Node 24 types; verify npm resolves without peer conflicts and `npm ci` reproduces the install.
- [X] T003 [P] Configure `tsconfig.json` and `src/vite-env.d.ts` for strict TypeScript, ESM/bundler module resolution, DOM APIs, isolated modules, readonly domain usage, no emit, and inclusion of application/tests/tool configuration in `npm run typecheck`.
- [X] T004 [P] Configure ESLint flat rules in `eslint.config.js`, Prettier in `.prettierrc.json`, and generated-output exclusions in `.prettierignore` and `.gitignore`; use typescript-eslint and place eslint-config-prettier last, with lint failing on warnings and format checks remaining read-only.
- [X] T005 [P] Create the minimal Vite shell in `index.html` and `vite.config.ts`, using loopback strict ports 5173 for development and 4173 for preview, a single normal production entry, and `dist/` output; defer gameplay entry content to US1.
- [X] T006 Configure disjoint discovery in `vitest.config.ts` and `playwright.config.ts`: Node `*.test.ts` for Vitest, feature-local `*.spec.ts` for Playwright Chromium, fixed screenshot environment, managed strict test-server port 5174, and no fixed-sleep assertions; install the matching Chromium binary.

**Checkpoint**: Toolchain resolves, quality/test commands launch, and test discovery separates runners. Empty suites are infrastructure only, not completed acceptance validation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish evidence, feature boundaries, and test injection contracts before implementing either story.

- [X] T007 Create `specs/001-spaceship-grid-setup/development.md` with sections for task/test name, exact command, expected/observed behavioral red, green, post-refactor checks, environment, manual outcomes, and architecture exceptions; record initial tooling verification without claiming behavioral red.
- [X] T008 [P] Define feature-local typed contracts in `src/features/game-setup/domain/RandomSource.ts` and type-only placement/setup declarations in `src/features/game-setup/domain/GameSetup.ts`; quote and enforce in subsequent tests: ShipIdentity is the literal union "`ship-1` or `ship-2`", RandomSource has "`next(): number`", and "Each result must be finite and in `[0, 1)`"; defer RNG validation/selection behavior to US2.
- [X] T009 Create `src/features/game-setup/tests/fixtures/ScriptedRandomSource.ts` after T008 as a class that supplies explicit values, tracks consumed draws, and fails clearly on exhaustion; never mock global `Math.random` or allow Phaser to consume the domain fixture stream.
- [X] T010 [P] Establish the development-only fixture route in `vite.config.ts` and its HTML shell at `src/features/game-setup/tests/fixtures/browser.html`; reserve `browser-entry.ts` for mounting the same application with controlled inputs, ensure fixture routing is enabled only in test mode, and keep fixture HTML out of production inputs.

**Checkpoint**: T001–T010 complete before story implementation. Contracts and test scaffolding exist; no domain behavior is treated as implemented or tested yet.

---

## Phase 3: User Story 1 — View the Initial Board (Priority: P1) — MVP

**Goal**: A player sees a stable 10 × 10 grid with exactly two identifiable single-square ships. A supplied valid layout isolates presentation from the later random-placement story.

**Independent Test**: Mount a known layout, inspect actual canvas output and position summaries, and observe it 20 times including resize. There must be 100 square cells, exactly two distinct occupied cells, clear identities, and no position changes. This increment may use a fixed valid layout at normal entry; random setup/New Game is delivered by US2.

### Tests for User Story 1 — write and observe red first

- [X] T011 [P] [US1] Add behavioral tests in `src/features/game-setup/tests/setup.test.ts` for BoardPosition and GameSetup construction, identity completeness, fixed dimensions, distinct squares, and immutability; include invalid fractions/non-finite/out-of-range coordinates and swapped zone identities, then run `npm test -- src/features/game-setup/tests/setup.test.ts` and record behavioral red.
- [X] T012 [P] [US1] Add geometry tests in `src/features/game-setup/tests/geometry.test.ts` for all 100 equal square cells, top-left/bottom-right orientation, correct one-based centers, and both markers fitting within corner cells; run `npm test -- src/features/game-setup/tests/geometry.test.ts` and record behavioral red.
- [ ] T013 [P] [US1] Add initial-entry, accessible-summary, rendered-revision readiness, 20-view stability, resize-to-360px, and WebGL-startup-failure browser tests in `src/features/game-setup/tests/game-setup.spec.ts`; use explicitly known coordinates and semantic failures before screenshot baselines, run `npm run test:e2e -- --grep 'US1'`, and record behavioral red once minimal mount scaffolding runs.

### Implementation for User Story 1

- [X] T014 [US1] Implement `src/features/game-setup/domain/BoardPosition.ts` as an "Immutable value class: readonly `row`, `column`; validated integer values 1–10"; "Reject fractional, non-finite, or out-of-range values. Equality compares row and column. Public and domain coordinates are one-based." Make T011 position tests pass.
- [X] T015 [US1] Implement GameSetup and readonly ShipPlacement in `src/features/game-setup/domain/GameSetup.ts` with "Fixed domain dimensions: rows = 10, columns = 10", "Each placement has exactly one BoardPosition; no footprint or movement state", and "Immutable class containing named readonly `ship1` and `ship2` placements plus fixed board dimensions"; enforce "Exactly one of each identity; correct zone for each; distinct positions. No exposed mutable collection. All nested placements are immutable." Use Ship 1 rows 1–2 and Ship 2 rows 9–10, columns 1–10, and make T011 pass.
- [X] T016 [US1] Implement `src/features/game-setup/presentation/BoardGeometry.ts` with validated one-based coordinate-to-cell-bounds/center mapping for a fixed logical square board; make T012 pass without importing Phaser into domain classes.
- [X] T017 [US1] Implement composed `BoardView` and the thin `GameSetupScene extends Phaser.Scene` adapter in `src/features/game-setup/presentation/BoardView.ts` and `src/features/game-setup/presentation/GameSetupScene.ts`; draw the 10 × 10 grid and two labeled, single-cell markers using Phaser 4 generated graphics/text, publish readiness only after the supplied revision is drawn, and document the third-party inheritance justification.
- [ ] T018 [US1] Implement `src/features/game-setup/presentation/GameSetupControls.ts` with the 10 × 10 description, top-to-bottom/left-to-right explanation, exact visible ship-coordinate summaries, canvas description association, native New Game button, Preparing game… state, and polite Game N ready status; support a typed New Game callback while leaving activation unavailable until US2 wiring exists.
- [ ] T019 [US1] Implement `src/app/GameApplication.ts` as the owner of one Phaser Game, scene, controls, and supplied immutable setup; use WebGL and centered FIT scaling, retain setup across redraw/scene reconstruction, display the startup error from `specs/001-spaceship-grid-setup/contracts/browser-ui.md` on initialization failure, and clean up owned resources on teardown/HMR.
- [ ] T020 [US1] Mount the application from `src/main.ts` and `src/features/game-setup/tests/fixtures/browser-entry.ts`; temporarily provide a valid fixed setup at normal entry, provide explicit known fixtures at the test entry, and ensure each mounted application has exactly one canvas and revision-1 ready state.
- [ ] T021 [US1] Implement responsive layout and keyboard-focus styling in `src/app/styles.css`, keeping the full board horizontally visible at 360px width with square cells, visible controls/summary, and ship identities communicated beyond color; rerun the US1 resize/accessibility browser checks.
- [ ] T022 [US1] Make all US1 browser assertions pass in `src/features/game-setup/tests/game-setup.spec.ts`, review the actual grid/ship output, and add deterministic canvas baselines under `src/features/game-setup/tests/__screenshots__/`; record separate behavioral red/green evidence and baseline review in `specs/001-spaceship-grid-setup/development.md`.
- [ ] T023 [US1] Validate the supplied-layout MVP with `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, and `npm run test:e2e -- --grep 'US1'`; inspect `dist/` for fixture exclusion, smoke-test `npm run dev`, and record results and the still-pending random/New Game capability in `specs/001-spaceship-grid-setup/development.md`.

**Checkpoint**: US1 is independently demonstrable and tested using supplied positions. The final feature is not complete until US2 replaces temporary fixed initialization and enables New Game.

---

## Phase 4: User Story 2 — Receive Randomized Opposing Starting Positions (Priority: P2)

**Goal**: Every page entry and New Game independently chooses each ship's position uniformly within its own 20-square zone, while retaining the chosen layout between explicit new-game actions.

**Independent Test**: Exercise every eligible square and all 400 pairings through a scripted source, then verify real browser initialization, pointer/keyboard New Game, repeated identical layouts, revision changes, and stable rendering. No test requires consecutive games to look different.

### Tests for User Story 2 — write and observe red first

- [ ] T024 [P] [US2] Add factory/adapter tests in `src/features/game-setup/tests/placement.test.ts` for all 20 bucket midpoints per zone, all 400 pairings including same-column placements, endpoints 0 and immediately below 1, values around 0.5 and representative bucket boundaries, exactly two draws per successful setup, and rejection of negative/1/NaN/infinite source outputs without retries; use independently listed expected positions and record red with `npm test -- src/features/game-setup/tests/placement.test.ts`.
- [ ] T025 [P] [US2] Add session tests in `src/features/game-setup/tests/session.test.ts` for initial revision 1, fresh pair consumption/revision + 1, identical consecutive layouts, 20 stable observations with no draws, and failed replacement retaining the old complete setup/revision; record red with `npm test -- src/features/game-setup/tests/session.test.ts`.
- [ ] T026 [P] [US2] Extend `src/features/game-setup/tests/game-setup.spec.ts` with US2 scenarios for auto-initialized controlled positions, pointer/Enter/Space New Game with one revision per activation, focus retention, identical-layout announcements, synchronized DOM/canvas, replacement failure/recovery, and unchanged coordinates across resize; run `npm run test:e2e -- --grep 'US2'` against the existing US1 app and record behavioral red.

### Implementation for User Story 2

- [ ] T027 [US2] Implement `src/features/game-setup/adapters/MathRandomSource.ts` as the production RandomSource class wrapping one `Math.random()` result per call; retain the contract "Each result must be finite and in `[0, 1)`; production promises independent approximately uniform draws", and make the T024 adapter checks pass without globally replacing Phaser randomness.
- [ ] T028 [US2] Implement `src/features/game-setup/domain/GameSetupFactory.ts` using "Fixed association of identity to first/last row: 1–2 or 9–10; columns always 1–10" and "20 valid squares per zone; zones never overlap"; consume "exactly two values per successful setup", apply `floor(value × 20)` row-major mapping, and "Reject invalid source outputs rather than clamping or retrying. Construction failures must not expose a partial setup or advance the revision." Make T024 pass with every one of 400 eligible pairs allowed.
- [ ] T029 [US2] Implement `src/features/game-setup/domain/GameSession.ts` with "Class retaining the current GameSetup and readonly-observed positive integer `revision`"; "Owns a factory; initialize revision 1 once, increment on every New Game even when coordinates repeat. Publish a complete replacement only after validation." Keep current state unchanged on failed replacement and make T025 pass.
- [ ] T030 [US2] Replace temporary fixed initialization in `src/main.ts` and adapt `src/app/GameApplication.ts` to compose the production random source/factory/session, initialize exactly once on entry, route each New Game through the session, and update the existing scene/view/controls from one complete revision without rerolling on render or resize.
- [ ] T031 [US2] Wire New Game and failure/recovery behavior in `src/features/game-setup/presentation/GameSetupControls.ts` and drawn-revision handling in `src/features/game-setup/presentation/GameSetupScene.ts`; enable after first draw, serialize activations, preserve button focus, announce identical layouts through revision changes, and retain the old layout/revision with the exact replacement-error text from `specs/001-spaceship-grid-setup/contracts/browser-ui.md` on failure.
- [ ] T032 [US2] Update `src/features/game-setup/tests/fixtures/browser-entry.ts` to inject scripted random-source sequences into the same application before session initialization, including known A/B layouts, identical pairs, corner pairs, and a failed replacement followed by recovery; keep the hook test-only and never expose a production seed/query-string API.
- [ ] T033 [US2] Extend `src/features/game-setup/tests/placement.test.ts` with deterministic 100-setup structure checks and 1,000-setup zone/reachability checks covering every eligible square for both ships; review equal-width mapping and independent production draws separately rather than claiming finite samples prove fairness, and run the suite successfully for SC-001–SC-003.
- [ ] T034 [US2] Make the US2 browser suite pass in `src/features/game-setup/tests/game-setup.spec.ts` and review/add only necessary deterministic layout baselines under `src/features/game-setup/tests/__screenshots__/`; verify rendered output rather than relying solely on matching DOM summaries.
- [ ] T035 [US2] Verify lifecycle invariants with regression cases in `src/features/game-setup/tests/session.test.ts` and `src/features/game-setup/tests/game-setup.spec.ts`: redraw/resize/scene recreation preserve setup and revision with zero placement draws, and application teardown/remount removes owned canvas/listeners before mounting a new single instance; refactor ownership in `src/app/GameApplication.ts` only after observing any new behavioral test fail.
- [ ] T036 [US2] Run the unit suite, all browser scenarios, type-check, lint, format check, production build, and normal-entry dev/preview smoke checks; record green results, scripted coverage, confirmed removal of fixed production initialization from `src/main.ts`, and current acceptance status in `specs/001-spaceship-grid-setup/development.md`.

**Checkpoint**: Both stories work together; normal page entry and New Game use production randomness, while all acceptance regressions remain reproducible through controlled injection.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify the complete feature and leave an accurate run/review record.

- [ ] T037 [P] Create root `README.md` with the actual `nvm install`, `nvm use`, `npm ci`, `npm run dev`, production build/preview, and quality/test commands; explain browser execution, expected local URLs, WebGL requirements, and the single-page setup-only scope without duplicating implementation code.
- [ ] T038 Review feature cohesion, strict domain typing, composition, scene inheritance justification, dependency direction, production fixture exclusion, and red–green–refactor evidence against `.specify/memory/constitution.md`; record findings and fix any evidenced issues with regression tests in `specs/001-spaceship-grid-setup/development.md`.
- [ ] T039 Run the five-player identification check from `specs/001-spaceship-grid-setup/quickstart.md` and record actual time/correctness results in `specs/001-spaceship-grid-setup/development.md`; require at least 4 of 5 first-time players to identify both ships and squares within 10 seconds, and keep SC-004 explicitly pending if participants are unavailable.
- [ ] T040 Smoke-test current Firefox and Safari plus keyboard/screen-reader-friendly summary behavior; measure local initial-ready ≤2 seconds and warmed New Game ≤100 ms using drawn-revision timing, recording environment and actual results in `specs/001-spaceship-grid-setup/development.md`; retain unavailable browser/device checks as pending rather than inferring a pass.
- [ ] T041 Reconcile the implemented commands and validation steps in `specs/001-spaceship-grid-setup/quickstart.md` with `package.json`, then run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, and `npm run test:e2e`; record exact final results and any outstanding manual checks in `specs/001-spaceship-grid-setup/development.md`.
- [ ] T042 Perform the final `npm run dev`/`npm run preview` browser walkthrough from `specs/001-spaceship-grid-setup/contracts/browser-ui.md`, confirm normal-entry random zones, stable positions, native New Game, clear failures, and no console exceptions/duplicate canvas, and record FR-001–FR-009 plus SC-001–SC-005 evidence or remaining blockers in `specs/001-spaceship-grid-setup/development.md`.

**Checkpoint**: Do not claim complete feature acceptance while required manual outcomes or constitution evidence remain pending. Quality checklist ticks describe specification quality, not implementation success.

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1: Setup (T001–T006)
            |
Phase 2: Foundation (T007–T010)
            |
Phase 3: US1 supplied-layout MVP (T011–T023)
            |
Phase 4: US2 randomized setup / New Game (T024–T036)
            |
Phase 5: Polish / final validation (T037–T042)
```

### Task and story dependencies

- T001 → T002; after T002, T003/T004/T005 can run in parallel; T006 follows the Vite shell. All Phase 1 completes before Phase 2.
- T007 establishes the evidence record. T008 and T010 are independent foundation work; T009 follows T008's source contract. T010 follows the Vite shell and fixes the fixture route contract.
- US1 needs only foundation, not US2. T011/T012/T013 can be authored independently, but each behavior's observed red is required before implementing its matching slice. T014 → T015; T016 follows geometry red; T017 follows T015/T016; T018 follows T015; T019 follows T017/T018; T020 follows T019; T021 → T022 → T023 completes browser integration and validation. T013 browser red may use a bootable throwing/no-op shell; startup failures themselves are not the target behavioral failure.
- US2 placement/session tests can be developed independently of presentation using the domain contracts, but integrated story delivery follows US1. T024 → T027/T028; T028 and T025 → T029; T029 → T030 → T031 → T032 → T033/T034 → T035 → T036. T026 browser red is required before T030/T031. T033/T035 new regression cases must also demonstrate behavioral red before corresponding fixes, if any.
- US2 integration intentionally depends on US1's view. US2 domain verification runs independently in Node; do not schedule both stories' edits to `GameApplication.ts`, `main.ts`, or `game-setup.spec.ts` concurrently.
- T037 may run alongside final architecture/manual validation because it edits only `README.md`. T038–T042 share the development record and are recorded serially. T041 follows any corrective edits and T042 is the last acceptance walkthrough.

### Within each story

1. Establish the new behavior's failing test with a runnable harness.
2. Implement domain constraints before application integration.
3. Make the demonstrating tests pass; refactor and rerun affected tests.
4. Review actual canvas output and separate screenshot baseline review from behavioral red.
5. Finish the story checkpoint before treating the next integrated increment as delivered.

## Parallel Example: User Story 1

After T001–T010, independent test-authoring lanes are:

| Lane | Task | Files |
|------|------|-------|
| Domain | T011 | `src/features/game-setup/tests/setup.test.ts` |
| Geometry | T012 | `src/features/game-setup/tests/geometry.test.ts` |
| Browser contract | T013 | `src/features/game-setup/tests/game-setup.spec.ts` |

Each lane observes its relevant behavioral red before implementation. Aggregate evidence serially in `specs/001-spaceship-grid-setup/development.md`. Rendering and application wiring then follow the explicit dependencies above.

## Parallel Example: User Story 2

After the US1 checkpoint, independent test-authoring lanes are:

| Lane | Task | Files |
|------|------|-------|
| Random selection | T024 | `src/features/game-setup/tests/placement.test.ts` |
| Retained session | T025 | `src/features/game-setup/tests/session.test.ts` |
| Browser New Game | T026 | `src/features/game-setup/tests/game-setup.spec.ts` |

The scripted source is already available, and these tasks edit different files. Production wiring, scene changes, fixture updates, and evidence aggregation remain ordered. `[P]` does not authorize concurrent edits to shared contracts or records.

## Implementation Strategy

### MVP first

Complete Setup + Foundation, then US1 through T023. Demonstrate a readable, stable supplied-layout board independently of random selection. This is a presentation MVP; explicitly identify its fixed initial composition and unavailable New Game behavior.

### Incremental delivery

Add US2 through T036, replacing temporary normal-entry positions with the production source/factory/session. Enable New Game and validate all allowed placements, repeated layouts, and stable observation. Complete cross-cutting review and real user checks afterward.

### Requirement traceability

| Requirement / outcome | Primary tasks |
|-----------------------|---------------|
| FR-001 grid dimensions | T012, T015–T017, T022 |
| FR-002 identities/count | T011, T015, T018, T022 |
| FR-003 single-square distinct occupancy | T011–T017, T022 |
| FR-004/FR-005 starting zones | T015, T024, T028, T033–T034 |
| FR-006 uniform independent selection | T024, T027–T028, T033 |
| FR-007 fresh New Game with repetition allowed | T025–T032, T034 |
| FR-008 readable identities/occupancy | T017–T018, T021–T022, T034 |
| FR-009 stable observation | T013, T019, T025, T035 |
| SC-001 100 setup structure checks | T033, T036 |
| SC-002/SC-003 1,000 setups and reachability | T024, T028, T033 |
| SC-004 4-of-5 user identification | T039 |
| SC-005 20 stable views | T013, T025, T035 |
| Browser failures, lifecycle, accessibility | T013, T018–T022, T026, T031, T035, T040 |
| Runtime/scripts, production entry and fixture isolation | T001–T006, T010, T023, T036, T041–T042 |

## Notes

- Tasks are implementation work items, not evidence that implementation exists. All begin unchecked.
- Do not add movement, combat, persistence, multiplayer, player-configurable RNG, or configurable board dimensions.
- A random sample cannot establish exact fairness; review equal-width mapping and the source contract alongside deterministic reachability tests.
- Mark tasks complete only when their work and required verification are actually complete. Keep participant/browser/environment blockers visible.
