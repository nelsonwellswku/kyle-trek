# Tasks: Ship Combat System

**Input**: Design documents from `/specs/003-ship-combat-system/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Constitution Principle III is NON-NEGOTIABLE and spec Constitution Compliance requires automated fail-first tests for stat/modifier mapping (incl. −1/0 edges), HP formula and floors, attack ≥ AC rule, miss-no-damage, damage minimum, HP clamping, win-on-0, per-turn action limits, and seeded replay. Test tasks are included for every story. UI rendering/animation is verified manually via quickstart.md per constitution allowance.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline verification before combat work begins

- [ ] T001 Verify baseline builds and tests pass via `npm test` and `npm run build` in repository root
- [ ] T002 [P] Review combat design inputs in `specs/003-ship-combat-system/spec.md`, `specs/003-ship-combat-system/plan.md`, `specs/003-ship-combat-system/research.md`
- [ ] T003 [P] Review combat data contracts in `specs/003-ship-combat-system/contracts/combat-config-schema.md` and `specs/003-ship-combat-system/contracts/combat-scene-contract.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data-driven combat tuning + shared types that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Add `combat` section to `src/config/board.json` (strength.rollRange `[8, 20]`, constitution.rollRange `[8, 20]`, shared statTable `8–9 → -1; 10–11 → 0; 12–13 → 1; 14–15 → 2; 16–17 → 3; 18–19 → 4; 20 → 5`, armorClass `12`, hitPoints `{die: 20, perModifierBonus: 2, minStart: 1}`, attack `{die: 20}`, damage `{die: 8, minDamage: 1}`, torpedo `{blinkHz, speedTilesPerSec, nearMissOffsetTiles}`) keeping existing `agility` section untouched
- [ ] T005 Extend combat config types in `src/sim/types.ts` (CombatConfig, StatBand, CombatTuning, TorpedoTuning, extended Spaceship with `strength: number (integer 8–20)`, `strengthModifier: number (integer -1…5)`, `constitution: number (integer 8–20)`, `constitutionModifier: number (integer -1…5)`, `hitPoints: number (integer 0…maxHitPoints)`, `maxHitPoints: number (integer >= 1)`, `armorClass: number (integer, always 12)`, extended TurnState with `moveUsed: boolean`, `attackUsed: boolean`, `over: { winner: ShipId } | null`)
- [ ] T006 Implement combat config parsing and validation in `src/sim/board-config.ts` per `specs/003-ship-combat-system/contracts/combat-config-schema.md` rules 1–6 (integer ranges with `min ≤ max`; statTable sorted ascending, non-overlapping, gapless over 8–20; default table reproduces spec mapping exactly; positive-integer AC/dice/minima; torpedo visuals present and positive; any violation throws explicit typed error naming the failed rule, game never starts on fallbacks)

**Checkpoint**: Foundation ready — `npm test` still green, combat tuning loads from data, user story work can begin

---

## Phase 3: User Story 1 - Battle Stats Assigned At Start (Priority: P1) 🎯 MVP

**Goal**: Each ship receives strength 8–20 + modifier, constitution 8–20 + modifier, HP = d20 (1–20) + constitution modifier × 2 (minimum 1), AC 12, all visible before the first turn; same seed reproduces identical values.

**Independent Test**: Start several new battles with known seeds; verify each ship shows strength 8–20, constitution 8–20, correct modifiers per shared table, AC 12, HP equal to documented formula (e.g. base roll 10 + modifier +2 → 14).

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T007 [P] [US1] Write fail-first stat-mapping tests in `tests/unit/combat.test.ts` (every band incl. boundaries `8/9 → -1`, `10/11 → 0`, `12/13 → 1`, `14/15 → 2`, `16/17 → 3`, `18/19 → 4`, `20 → 5`; zero/multiple-band match throws; rolls stay within `8–20` inclusive)
- [ ] T008 [P] [US1] Write fail-first HP/AC tests in `tests/unit/combat.test.ts` (HP formula `d20 roll integer 1–20 inclusive + (constitution modifier × 2)` with worked example `base roll 10 + modifier +2 → 14`; HP floored at minimum `1` on negative constitution; `armorClass` exactly `12`)
- [ ] T009 [P] [US1] Write fail-first setup determinism tests in `tests/unit/combat.test.ts` (same `(configVersion, seed)` yields identical strength, constitution, and HP; draw order pinned: spawn ship-1, spawn ship-2, agility ship-1, agility ship-2, strength ship-1, strength ship-2, constitution ship-1, constitution ship-2, HP-base ship-1, HP-base ship-2; existing 001/002 seed→position/agility expectations preserved)
- [ ] T010 [P] [US1] Write fail-first combat validation tests in `tests/unit/validation.test.ts` (data-model rules 10–15: `strength` integer within `combat.strength.rollRange (8–20)`; `constitution` integer within `combat.constitution.rollRange (8–20)`; modifiers equal exactly-one band; `maxHitPoints ≥ 1` equals `baseRoll + constitutionModifier × 2` floored at 1 with base roll integer 1–20; `armorClass === 12` and `0 ≤ hitPoints ≤ maxHitPoints`; malformed combat config rejected with named errors)

### Implementation for User Story 1

- [ ] T011 [US1] Implement pure combat stat module in `src/sim/combat.ts` (modifierForStat shared-table lookup throwing on zero/multiple matches; rollShipCombatStats per-ship strength/constitution via injected Rng; computeHitPoints `d20 (1–20) + modifier × 2` floored at `minStart 1`; no hard-coded numbers, all bounds from config)
- [ ] T012 [US1] Wire combat rolls into setup in `src/sim/setup.ts` in pinned RNG order (strength ship-1/ship-2, constitution ship-1/ship-2, HP-base ship-1/ship-2 appended after existing spawn+agility draws; stamp `armorClass 12`; fixed for the battle)
- [ ] T013 [US1] Extend setup validation rules 10–15 in `src/sim/validation.ts` (strength/constitution ranges, modifier-band agreement, HP formula + floor, AC 12, HP bounds, combat config well-formedness; explicit typed errors, never silently corrected)
- [ ] T014 [US1] Display combat stat block in `src/scenes/battle-scene.ts` (per-ship text `STR x (±m) · CON y (±m) · HP cur/max · AC 12` before/during turns per contract guarantee 1; text, never color-only)

**Checkpoint**: US1 independently testable — `npm test` green; new battle shows correct stat blocks; same seed replays identical stats/HP

---

## Phase 4: User Story 2 - Two Optional Actions In Any Order: Move And Attack (Priority: P1)

**Goal**: Each turn offers one optional move + one optional attack in either order, each usable at most once; Skip Movement / End Turn / Skip Attack controls; turn passes after both used/skipped or ended early.

**Independent Test**: With known agility values verify move-then-attack, attack-then-move, skip either via its control, skip both, no action usable twice; control passes after both used/skipped or early end.

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T015 [P] [US2] Write fail-first two-action turn tests in `tests/unit/turn.test.ts` (attack-before-move leaves move available; move-before-attack leaves attack available; second `resolveMove` rejected; second `dispatchAttack`/enemy-ship selection launches nothing and consumes no rolls; `skipMove`/`skipAttack`/`endTurnEarly` consume flags with no state change and no rolls; both-used or early-end flips `activeShipId` and increments `turnNumber` with fresh `legalSet`; empty-square/own-ship selection is a no-op consuming nothing; rapid double-selection launches exactly one torpedo)
- [ ] T016 [P] [US2] Write fail-first click-routing tests in `tests/unit/turn.test.ts` (enemy-ship cell with `attackUsed=false` and `over=null` dispatches attack at unlimited range; legalSet cell with `moveUsed=false` dispatches move; all other clicks ignored; every click when `over` is set ignored)

### Implementation for User Story 2

- [ ] T017 [US2] Extend turn reducer in `src/sim/turn.ts` to two-action turns (add `moveUsed: boolean` starting false, `attackUsed: boolean` starting false, `over: { winner: ShipId } | null` starting null; `resolveMove` marks `moveUsed` instead of ending turn; add `skipMove`, `skipAttack`/`endTurnEarly`; advance turn only on both-used or early-end; `over` terminal rejects everything; pure and immutable)
- [ ] T018 [US2] Route scene clicks per research R-05 in `src/scenes/battle-scene.ts` (enemy-ship cell → `dispatchAttack` regardless of grid distance; legalSet cell → `resolveMove`; else ignore with no roll consumed; post-`over` clicks ignored)
- [ ] T019 [US2] Add Skip Movement + End Turn / Skip Attack controls in `src/scenes/battle-scene.ts` (clickable and keyboard-accessible on-screen controls, active only while their action is unused, per contract guarantee 8; activating consumes the flag with no state change and no rolls)
- [ ] T020 [US2] Show remaining-action indicators in `src/scenes/battle-scene.ts` (persistent turn line `Turn n — Player X (ship-i) to act · Move: available/used · Attack: available/used` updated immediately after every dispatch, per contract guarantee 2)

**Checkpoint**: US1 + US2 independently functional — flexible turns work in either order with skips; `npm test` green

---

## Phase 5: User Story 3 - Attack Resolution And Victory (Priority: P2)

**Goal**: Each torpedo resolves d20 + strength modifier vs. AC 12; miss changes nothing and rolls no damage; hit deals d8 + strength modifier (min 1), reduces defender HP (clamp 0), and 0 HP ends the game immediately with attacker as winner.

**Independent Test**: Force known rolls/modifiers — total ≥ 12 hits and reduces HP by damage total; total < 12 misses with no HP change; 0 HP ends game with attacker declared winner and no further actions possible.

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T021 [P] [US3] Write fail-first attack-roll tests in `tests/unit/combat.test.ts` (exactly one d20 `integer 1–20` per attack; `total = attackRoll + strengthModifier`; `total ≥ defenderAC (12)` hits else misses; worked cases `10 + 2 = 12 → hit` and `9 + 1 = 10 → miss`; negative modifier `strength 8–9 → -1` reduces totals accordingly)
- [ ] T022 [P] [US3] Write fail-first damage/HP tests in `tests/unit/combat.test.ts` (miss → both HP unchanged and NO damage roll consumed; hit → exactly one d8 `integer 1–8`, `damage = damageRoll + strengthModifier` floored at minimum `1`; defender `hitPoints −= damage` clamped ≥ `0`; worked case `damage roll 5 + modifier +2 vs 10 HP → 3 HP`; negative strength modifier still deals ≥ 1)
- [ ] T023 [P] [US3] Write fail-first win-terminality tests in `tests/unit/turn.test.ts` (lethal hit `4 HP vs 6 damage → 0 HP` sets `over = { winner: attacker }` immediately with no successor turn; further moves/attacks/skips/turns rejected after `over`; data-model rule 16: HP never negative nor above max, `over` set iff some ship at 0 with winner = attacker)
- [ ] T024 [P] [US3] Write fail-first seeded-battle replay tests in `tests/unit/combat.test.ts` (in-battle order: one d20 per attack, then one d8 only on hit; same seed + action sequence reproduces identical rolls, HP totals, and winner per FR-019/SC-007)

### Implementation for User Story 3

- [ ] T025 [US3] Implement pure attack resolution in `src/sim/combat.ts` (resolveAttack returning `{ attackRoll, total, hit, damageRoll?, damage? }` with exactly-one-d20 / exactly-one-d8-on-hit semantics and `minDamage 1` floor; HP application `currentHP − damage` clamped ≥ 0 kept in caller)
- [ ] T026 [US3] Implement `dispatchAttack` with HP + win detection in `src/sim/turn.ts` (consume rolls via combat module, apply HP clamp, set `over` on kill immediately, mark `attackUsed`, advance turn only if not over and both actions used)
- [ ] T027 [US3] Disclose attack outcomes as text in `src/scenes/battle-scene.ts` (immediate outcome line `attack roll R + mod = total vs AC 12 → HIT/MISS` plus on hit `damage roll D + mod = dmg → defender HP a → b`, per contract guarantee 7; win line `Player X wins` disabling further input per guarantee 9)

**Checkpoint**: US1–US3 independently functional — full combat loop with correct math and immediate victory

---

## Phase 6: User Story 4 - Torpedo Hit And Miss Animation (Priority: P3)

**Goal**: Every torpedo visibly animated — hit: blinking star attacker→defender + contact explosion; miss: blinking star near-miss path past defender off-grid with no ship explosion; outcome shown with animation; turn continues/passes correctly afterward.

**Independent Test**: Trigger one forced hit + one forced miss; observe torpedo path + contact effect in each case; confirm underlying HP outcome matches declared verdict.

### Tests for User Story 4

Manual-only per constitution UI allowance (no automated animation tests). Verify via quickstart checks below during implementation of T028–T029.

### Implementation for User Story 4

- [ ] T028 [US4] Implement hit torpedo animation in `src/scenes/battle-scene.ts` (blinking-star Actor at data-driven `torpedo.blinkHz` traveling attacker-center → defender-center at `torpedo.speedTilesPerSec`, then contact explosion effect; HP reduction + outcome text shown in connection with animation; animation never alters pre-rolled outcome; input during flight ignored so no second dispatch; per contract guarantees 4–6)
- [ ] T029 [US4] Implement miss torpedo animation in `src/scenes/battle-scene.ts` (blinking star attacker-center → near-miss waypoint offset perpendicular by `torpedo.nearMissOffsetTiles` → continues same heading off-grid and despawns, no explosion on ship; outcome text shown; turn continues if either action remains unused else passes; per contract guarantees 5–6)

**Checkpoint**: All user stories independently functional — hits/misses legible by path + explosion + text

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story validation and hardening

- [ ] T030 Run full `npm test` suite in repository root and fix any 001/002 regressions (spawn/agility/movement/turn seed expectations must be preserved)
- [ ] T031 [P] Verify data-driven tuning isolation: change only `src/config/board.json` combat values (e.g. AC, dice) and confirm no logic rewrite needed, then revert
- [ ] T032 [P] Run `npm run build` and `npm run preview` in repository root and confirm the combat game serves with no console errors
- [ ] T033 Run `specs/003-ship-combat-system/quickstart.md` manual validation end-to-end (browser checks 1–7: stats, flexible turns, resolution/victory, animations, edge cases incl. damage floor 1 and HP floor 1, 10-second SC-006 legibility, failure visibility on corrupted `combat` config) and fix gaps
- [ ] T034 [P] Verify accessibility baseline in `src/scenes/battle-scene.ts` (hit/miss distinguishable by path + explosion + text, never color alone; controls keyboard-accessible; fonts/scales readable)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational completion
  - US1 then US2 then US3 then US4 in priority order (P1 → P1 → P2 → P3); US2 needs US1 stats, US3 needs US1+US2, US4 needs US3 outcomes
  - With extra capacity, test-writing ([P] tasks) across stories can start in parallel once Foundational lands
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational — no dependencies on other stories; delivers complete combat stat block
- **User Story 2 (P1)**: Starts after Foundational — integrates with US1 stats for display but turn-flag logic independently testable
- **User Story 3 (P2)**: Depends on US1 (stats/HP/AC) + US2 (turn flags/attack dispatch slot); math independently testable via stub RNG
- **User Story 4 (P3)**: Depends on US3 (decided hit/miss outcomes to animate); presentation-only, never changes outcomes

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Principle III)
- Config/types before logic; logic before scene wiring; scene wiring before disclosure/animation
- Story complete and checkpoint-validated before moving to next priority

### Parallel Opportunities

- Phase 1: T002 + T003 can run in parallel (different docs, no dependencies)
- US1 tests: T007 + T008 + T009 + T010 can run in parallel (same file different cases — coordinate edits, or split authorship by case)
- US2 tests: T015 + T016 can run in parallel
- US3 tests: T021 + T022 + T023 + T024 can run in parallel
- Polish: T031 + T032 + T034 can run in parallel (config check, bundle check, accessibility check touch different concerns)

---

## Parallel Example: User Story 1

```bash
# Launch all fail-first tests for User Story 1 together:
Task: "Write fail-first stat-mapping tests in tests/unit/combat.test.ts"
Task: "Write fail-first HP/AC tests in tests/unit/combat.test.ts"
Task: "Write fail-first setup determinism tests in tests/unit/combat.test.ts"
Task: "Write fail-first combat validation tests in tests/unit/validation.test.ts"
```

## Parallel Example: User Story 3

```bash
# Launch all fail-first tests for User Story 3 together:
Task: "Write fail-first attack-roll tests in tests/unit/combat.test.ts"
Task: "Write fail-first damage/HP tests in tests/unit/combat.test.ts"
Task: "Write fail-first win-terminality tests in tests/unit/turn.test.ts"
Task: "Write fail-first seeded-battle replay tests in tests/unit/combat.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T006)
3. Complete Phase 3: User Story 1 (T007–T014)
4. **STOP and VALIDATE**: Start battles with known seeds; verify STR/CON 8–20, correct modifiers, AC 12, HP formula (10 + 2×2 = 14); same seed replays identically
5. Deploy/demo if ready (stat-block MVP)

### Incremental Delivery

1. Setup + Foundational → tuning loads from data, `npm test` green
2. Add US1 → stat blocks visible, replayable → Deploy/Demo (MVP!)
3. Add US2 → flexible move+attack turns with skips → Deploy/Demo
4. Add US3 → real damage + immediate victory → Deploy/Demo (playable combat!)
5. Add US4 → hit/miss torpedo animation → Deploy/Demo (complete feature)
6. Polish → quickstart green, bundle clean

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001–T006)
2. Once Foundational is done:
   - Developer A: US1 tests + implementation (T007–T014)
   - Developer B: US2 tests (T015–T016) drafting against reducer interface, then implementation after US1 lands
   - Developer C: US3 test cases (T021–T024) drafting against combat interface
3. US4 (T028–T029) starts once US3 outcome shape is stable
4. Team converges on Polish (T030–T034)

---

## Notes

- [P] tasks = different files/cases, no dependencies
- [Story] label maps each story-phase task to its user story for traceability
- Constitution III (Test-First) is non-negotiable: every story's tests fail first, then implementation passes
- Quote data-model constraints verbatim in implementation (ranges, floors, table bands) — no implementation-time discretion
- Scene work is presentation-only: never recompute legality, never re-roll RNG, never mutate sim state except via reducer dispatches
- Stop at any checkpoint to validate the story independently before proceeding
