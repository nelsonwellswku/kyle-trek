# Phase 0 Research: Agility-Based Movement

**Feature**: `specs/002-agility-based-movement/spec.md` · **Date**: 2026-10-14

No Technical Context unknowns remained (stack, toolchain, and sim/scene split are established by `001-grid-ship-spawn`). The entries below resolve this feature's new design decisions. Each records the decision, rationale, and alternatives considered. Clarification answers from 2026-10-14 (seedable agility roll; no pass-through with go-around; Player 1 first) are treated as decided inputs.

## R-01: Agility data lives in `board.json` (range + table)

- **Decision**: Add an additive `agility` section to `src/config/board.json`: roll range `{min: 8, max: 20}` plus the full stat→modifier table as explicit interval rows (`8–9 → -1`, `10–11 → 0`, `12–13 → 1`, `14–15 → 2`, `16–17 → 3`, `18–19 → 4`, `20 → 5`), validated against `contracts/agility-config-schema.md`. `agility.ts` reads both; neither the range nor any table row is hard-coded in logic.
- **Rationale**: Satisfies Principle IV — retuning movement (e.g. widening a band) is a data edit with no logic rewrite, and the table from the spec stays reviewable as data. Interval rows (not a formula) keep the spec's exact mapping, including the irregular single-value `20 → 5` row, without encoding arithmetic assumptions.
- **Alternatives considered**: Formula-based modifier (`floor((stat-10)/2)` — matches most rows but obscures the authored table and breaks silently if the table is ever retuned — rejected); constants in `agility.ts` (violates Principle IV — rejected); per-ship agility in separate files (needless fragmentation for two values drawn from one range — rejected).

## R-02: RNG draw order — spawn first, then agility ship-1, then ship-2

- **Decision**: Setup consumes the seeded `Random` stream in a pinned order: (1) Ship 1 spawn square, (2) Ship 2 spawn square (existing 001 behavior, unchanged), then (3) Ship 1 agility roll `integer(8, 20)`, (4) Ship 2 agility roll. Same `(configVersion, seed)` MUST reproduce identical positions AND agility values.
- **Rationale**: Satisfies Principle I and protects the 001 investment — spawn draws keep their positions in the stream, so a seed that placed ships in 001 places them identically now; agility draws are appended, not interleaved. Fixed per-ship order (ship-1 before ship-2) removes the last source of nondeterminism in setup.
- **Alternatives considered**: Agility before spawn (shifts the whole stream, invalidating every 001 seed→position expectation — rejected); separate RNG streams/seeds for spawn vs. agility (two seeds to record/replay instead of one; complicates save/replay for zero benefit — rejected); `Math.random` for agility (not seedable, breaks FR-001's reproducibility — rejected).

## R-03: Legal-set computation as a pure function

- **Decision**: `movement.ts` exposes a pure `legalDestinations(grid, origin, modifier, occupiedCell)` returning the exact set: `{origin}` always included (stay-in-place); plus every in-bounds cell with Manhattan distance `1..modifier` from origin, minus the opponent-occupied cell, minus any cell for which NO orthogonal path of length ≤ modifier avoids the occupied cell. Because any shortest orthogonal path has length exactly equal to Manhattan distance, the path check reduces to: a shortest path avoiding the occupied cell exists. Modifier ≤ 0 yields `{origin}` only. No diagonal steps are ever generated (enumeration is row/col offsets, so diagonal-only squares can only enter via an orthogonal route, which is correct per spec).
- **Rationale**: A pure set-returning function is exhaustively unit-testable (center/edge/corner, occupied, blocked-corridor vs. go-around, ≤0) with no engine involvement (Principle III), and its output IS the highlight set, so highlights and validation can never disagree — one function feeds both scene rendering and move acceptance (Principle II).
- **Alternatives considered**: BFS pathfinding over the grid (correct but heavier than needed for a 2-ship open board where the only obstacle is one cell; shortest-path equivalence makes enumeration exact — rejected as over-engineering per Principle V); straight-line-only reachability (would wrongly forbid L-shaped routes the spec's example `1 up + 1 right` explicitly allows — rejected); separate highlight vs. validation logic (risks highlight/accept drift — rejected).

## R-04: Turn state as a pure reducer; scene holds no rules

- **Decision**: `turn.ts` models the turn as immutable state `{activeShipId ('ship-1' | 'ship-2'), turnNumber}` starting at ship-1 / turn 1 (Player 1 first, per clarification). `resolveMove(state, gameState, destination)` returns either `Accepted(nextState, movedShip)` or `Rejected(reason)` — rejected for non-highlighted/occupied/out-of-range destinations and for moves addressed to the non-active ship. Accepting (including stay-in-place) flips `activeShipId` and increments `turnNumber`. The scene maps clicks to reducer calls and renders the result; it never duplicates legality logic.
- **Rationale**: Turn alternation, first-player rule, stay-passes-turn, and illegal-click rejection all become Node-runnable unit tests (Principle III); the scene stays a thin adapter, so rapid double-clicks are naturally safe — the first accepted click advances the turn token and any stale second click resolves against the NEW active ship's set (rejected unless coincidentally legal for the other ship, which is the specified behavior).
- **Alternatives considered**: Turn logic inside `battle-scene.ts` (requires browser/engine harness for every alternation test — rejected); mutable turn singleton (harder to test sequences and replays deterministically — rejected); auto-skip of ≤0-modifier turns (spec requires the player to confirm staying in place — rejected).

## R-05: Highlight rendering (non-color-only, stay affordance)

- **Decision**: Render one marker per legal destination cell via the scene layer (TileMap overlay or lightweight Actors with procedural graphics): destination markers share a common shape treatment (e.g. outline/ring + tint) while the origin (stay-in-place) marker uses a visually distinct treatment (e.g. filled/under-ship marker) so "pass" is distinguishable from "move". Markers are rebuilt from `legalDestinations(...)` at every turn start and cleared on turn change. No color-only signaling anywhere.
- **Rationale**: Directly implements FR-007 and the constitution accessibility baseline (shape/outline in addition to color); deriving markers from the same pure function as validation guarantees the player only ever sees clickable-truth (Principle II). Manual quickstart verification covers legibility including the SC-002 10-second check.
- **Alternatives considered**: Tint-only highlights (violates non-color-only baseline — rejected); persistent markers across turns (stale highlights would invite wrong-ship clicks — rejected); text/coordinates HUD instead of board markers (weaker spatial legibility; spec demands highlighted squares — rejected).

## R-06: Click handling (tile pick → reducer → render)

- **Decision**: Scene pointer input maps a left-click to a board cell (screen→tile pick), looks the cell up in the current turn's legal set, and dispatches `resolveMove`; hits move the ship Actor and advance the turn, misses are ignored with no state change (FR-009). Clicks are only meaningful during the active turn — there is no cross-turn queue or selection memory. Exact engine input wiring is an implementation detail owned by `tasks.md`/implementation, but the behavioral contract is pinned in `contracts/movement-scene-contract.md`.
- **Rationale**: Keeps all acceptance-relevant behavior (accept highlighted, ignore the rest, turn passes exactly once) in the tested reducer; the scene contributes only picking and rendering, which are manually verifiable (constitution UI allowance). No drag, hover-commit, or right-click paths exist, matching the spec's single input action.
- **Alternatives considered**: Click-to-select then click-to-confirm (two-step; spec says the player selects by clicking the square — single action — rejected); hover preview + click (hover is untestable affordance creep for this scope — rejected).

## R-07: Test strategy (what is automated vs. manual)

- **Decision**: Vitest unit suites in `tests/unit/`: `agility.test.ts` (every table band + boundaries 8/9/10/11/12/20, out-of-range rejection, roll range over seeded runs, same-seed determinism of agility values); `movement.test.ts` (modifier-1 center cross, edge/corner truncation, occupied exclusion, straight-corridor blocking vs. L-route go-around, modifier 0/−1 stay-only, determinism from state); `turn.test.ts` (ship-1 starts, strict alternation over N moves, stay passes, illegal destination/side rejection, turn token advance). Manual browser checklist in `quickstart.md` covers highlights, clicks, turn display, and timed legibility.
- **Rationale**: Every rule, transition, and seeded edge case gets a fail-first automated test (non-negotiable Principle III); rendering/feel items that need eyes stay manual, as the constitution permits. Suite-per-module keeps failures local to the rule that broke.
- **Alternatives considered**: Browser-driven tests (Playwright/`@vitest/browser` screenshots for highlights — flaky and disproportionate; deferred unless a later feature needs visual regression — rejected); single combined test file (obscures which rule regressed — rejected).

## R-08: Turn/stat display (explainable range)

- **Decision**: The scene displays, persistently during play: whose turn it is + which ship is active, and each ship's agility stat with derived modifier (e.g. near the ship or in a minimal status line). No odds/costs beyond movement range exist in this feature, so range explainability is fully covered by stat + modifier + highlights together.
- **Rationale**: Implements FR-011 and Principle II — a player can answer "how far can I go and why" without asking. Minimal presentation (status line, no menus/HUD framework) per Principle V.
- **Alternatives considered**: Highlights alone without numbers (leaves "why this range" unexplained — rejected); full HUD/menus (speculative chrome for a movement-only feature — rejected).

## Open items

None. All NEEDS CLARIFICATION resolved — no TBDs carry into Phase 1.
