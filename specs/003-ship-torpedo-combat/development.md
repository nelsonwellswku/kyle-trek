# Ship Torpedo Combat — Development Evidence

## Environment and baseline (T001)

- Runtime: Node `v24.12.0`; npm `11.12.1` (plan requires Node 24/npm 11).
- `npm test`: PASS — 21 files, 153 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS — Vite build succeeds; existing Phaser bundle-size advisory (>500 kB).
- `vitest.config.ts`: feature-local discovery is `src/features/*/tests/**/*.test.ts`; empty test selection fails (`passWithNoTests: false`). No infrastructure changes.
- Evidence format for each implementation slice: record the targeted test command and expected behavioral failure (red), the same command passing after the change (green), and relevant post-refactor/regression commands. Import, setup, and compiler errors alone are not behavioral red evidence.

## Slice evidence

Implementation evidence is appended by task as each red/green/refactor checkpoint is run. Real-browser and usability acceptance remain pending until executed; no simulated result is represented as browser evidence.

### Foundation (T001–T008)

- T003 red: `npm test -- src/features/ship-stats/tests src/features/ship-combat/tests/dice-roller.test.ts` — 35 behavioral failures against the initial compilable contracts (modifier/freeze/validation and rolling behavior).
- T003/T004/T005/T006 green and T007 compatibility refactor: `npm test -- src/features/ship-stats/tests src/features/ship-combat/tests/dice-roller.test.ts src/features/ship-movement/tests` — covered by the foundation regression run below; score mapping, invalid inputs, inclusive buckets, and existing `AgilityStat` interface pass.
- T010 red: `npm test -- src/features/ship-combat/tests/combat-game.test.ts src/features/ship-combat/tests/combat-game-factory.test.ts` — the factory contract had 9 behavioral failures before implementation; the 10-draw known-roll and invalid-sample checks then passed.
- T008 green/regression: `npm test -- src/features/ship-stats/tests src/features/ship-combat/tests src/features/ship-movement/tests src/features/board/tests src/features/game-setup/tests` — 25 files, 207 tests passed. `npm run typecheck` and `npm run lint` passed.
- Shared consumers: `AgilityStat` uses `AbilityStat`; movement animation ports import extracted `PendingMove`; combat initialization reuses setup positions and `RandomSource`.

### User Story 1 — setup and visible stats (T009–T017)

- T010 red: `npm test -- src/features/ship-combat/tests/combat-game.test.ts src/features/ship-combat/tests/combat-game-factory.test.ts` — all 9 factory tests failed against the compilable factory contract; after implementation, known-roll draw ordering, HP formula, invalid samples, repeated setups, and opposing zones passed.
- T011 red/green: `npm test -- src/features/ship-combat/tests/combat-stats-controls.test.ts` — 2 contract failures before rendering existed; both passed after `CombatControls.renderShips` and semantic definition-list markup were implemented.
- T012 behavior refinement red/green: `npm test -- src/features/ship-combat/tests/combat-game.test.ts` — the added nonnegative-integer overkill case exposed an overly strict safe-integer check; after changing the guard to the specified integer constraint, all model invariants and immutable update checks passed.
- T016: `npm test -- src/features/ship-combat/tests/combat-game-factory.test.ts` — includes 100 known-roll setups and 1,000 deterministic setups (10,000 draws) cycling each ability through all 13 buckets. Each score uses an independent draw and equal-width `floor(sample * 13)` buckets; this mapping review, not the repeated sample, is the fairness rationale. HP roll 0 with constitution modifier −1 clamps to 1; roll 20 with modifier +5 yields 30.
- US1 automated regressions: `npm test -- src/features/ship-stats/tests src/features/ship-combat/tests src/features/ship-movement/tests src/features/board/tests src/features/game-setup/tests` — 26 files, 213 tests passed after final updates. Final `npm test` also passed (26 files, 213 tests); `npm run typecheck`, `npm run lint`, and `npm run format:check` passed. `npm run build` passed; Vite reported the existing large Phaser bundle advisory.
- T015 fixture check: the Vite dev server returned the fixture HTML and transformed TypeScript module successfully at `/src/features/ship-combat/tests/browser/fixture.html` (served on port 5174 because 5173 was already occupied). Production `src/main.ts` does not import the fixture; the fixture is not included in production composition.
- SC-001/SC-002/SC-008 automated evidence: all 13 scores map to the defined modifiers; each setup consumes two position draws followed by four draws per ship, with AC 12 and current HP equal to bounded starting HP. Controls display the same immutable game values and rerender only when explicitly given a replacement game.
- **Pending visual acceptance:** no local Chromium/Chrome/Firefox executable was available, so the fixture was not visually exercised. T017 remains unchecked; real-browser confirmation of layout, reset, and rendered-stat correspondence is outstanding. No browser result is claimed.

### User Story 2 — movement and combat turn sequencing (T018–T030)

- T018 contract verification: `npm run typecheck` passed with readonly hit/miss outcomes, validated session-side outcome constraints, pending-attack identity/position data, and cancellable torpedo port types.
- T019 red: `npm test -- src/features/ship-combat/tests/battle-session.test.ts` — 9 behavior tests failed against the compiling session scaffold before T022. T019/T022 green: the same command passed all 9 tests; later malformed injected outcomes were also rejected without publishing an attacking snapshot.
- T020 red: `npm test -- src/features/ship-combat/tests/combat-turn-controls.test.ts` — all 3 tests exposed missing phase rendering/action handlers. T020/T023 green and US1 controls regression: `npm test -- src/features/ship-combat/tests/combat-turn-controls.test.ts src/features/ship-combat/tests/combat-stats-controls.test.ts` — 2 files, 5 tests passed.
- T021 red: `npm test -- src/features/ship-combat/tests/combat-controller.test.ts` — all 3 tests failed against the compiling no-op controller scaffold. T021/T025 green is included in the final controller/lifecycle run below; tests cover readiness gating, movement-to-attack routing, ignored input, legal highlights, and stale replacement identities.
- T026 red: `npm test -- src/features/ship-combat/tests/combat-scene.test.ts` — 3 lifecycle tests failed against the compiling scene scaffold before T027. T026/T027 green is included in the scene/controller regression run below; scene tests cover one pointer listener, postrender revision matching, world-coordinate targeting after FIT scaling, update/disposal cancellation, and stale callbacks.
- T028/T029 recovery evidence: controlled movement startup/runtime failures reopen the same player's movement phase at the origin; synchronous movement/torpedo completion and synchronous/startup/runtime torpedo failures are covered; failed attacks report the injected error and commit the exact stored hit/miss once without resolving again. Replacement and disposal invalidate controller readiness before cancellation, and stale success/failure callbacks do not alter the replacement/final state.
- T030 controlled end-to-end/regressions: `npm test -- src/features/ship-combat/tests src/features/ship-movement/tests src/features/board/tests` — 23 files, 176 tests passed. `npm test` — 30 files, 244 tests passed. The turn scenarios verify movement retains player/token until arrival, immobility requires explicit Skip movement, End turn and attack completion hand off once, and 50 alternating move/attack turns complete. Session tests cover pending HP stability, exact lethal and overkill clamping, terminal input lock, and counter overflow.
- Final automated checks: `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` all passed. Vite emitted the baseline Phaser bundle-size advisory. Controlled lifecycle tests verify same-result recovery synchronously; they do not claim real-browser FR-019 timing or visual acceptance, which remains planned for the later production animator/browser tasks.
