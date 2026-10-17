# Implementation Plan: Ship Turn Movement

**Branch**: `redo` | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-ship-turn-movement/spec.md`

**Feature identifier**: `002-ship-turn-movement`. Setup output resolves this feature identifier as BRANCH, while `git branch --show-current` confirms the actual Git branch is `redo`; the feature directory is independent of branch naming.

## Summary

Extend the local two-ship board with independently randomized agility, stepped modifiers, alternating turns, exact reachable-square highlights, left-click destination selection, acknowledged passes, and shortest continuous obstacle-safe flight. Use breadth-first search (BFS) for logical legality and step cost; compute the visual flight path independently in continuous space. Fly directly (including diagonally) when clear, otherwise use tangent lines and a circular arc around the other ship. Stage whole new games atomically and guard animation/input callbacks with game and turn identities.

## Technical Context

**Language/Version**: TypeScript 6.0.3, strict mode, ES2022; Node 24 and npm 11 as required by package.json.

**Primary Dependencies**: Existing Phaser 4.2.1 and Vite 8.3.4; no new runtime dependency.

**Storage**: In-memory game snapshots only; no persistence or service.

**Testing**: Vitest 5.0.5 in Node; typed test doubles for renderer/DOM boundaries; manually operated browser fixture and manual validation for real Phaser, scaled pointer input, rendering, and timing. Existing ESLint, Prettier, and TypeScript checks remain required.

**Target Platform**: Existing desktop browser/WebGL application with mouse input and Phaser FIT scaling. Use the reference performance environment defined in spec.md for acceptance measurements, recording the exact browser and hardware configuration.

**Project Type**: Single-page browser game organized by gameplay capabilities.

**Performance Goals**: Highlights within 200 ms of a playable turn; animation 250 ms per counted step, at most 1,250 ms nominal and 1.5 seconds observed; next-turn highlights within 200 ms. Target display-refresh-paced animation on the existing 600 × 600 logical-pixel canvas. Evaluate SC-004 manually in the specification's reference environment, retain individual timings for each acceptance move, and report any threshold failure rather than averaging it away.

**Constraints**: 10 × 10 board, two ships, maximum five logical steps, orthogonal grid legality, no occupied logical route cells, and no visual ship overlap. Continuous animation may cross empty cells diagonally. Agility integers 8–20; nonpositive modifiers allow zero steps. No-moves turns require a pass-button click, including when both ships cannot move. Keep initial-zone validation separate from live positions. Preserve New Game and renderer-error recovery.

**Scale/Scope**: Two local players, one screen, at most 100 visited cells per reachability search. No network, combat, saves, player stat editor, or progression.

## Constitution Check

*Gate evaluated before research and re-evaluated after Phase 1 design.*

| Principle | Pre-research gate | Post-design evidence |
| --- | --- | --- |
| Gameplay feature cohesion | PASS: movement owns turns, reachability, flight, HUD, and tests | `ship-movement/` contains the new gameplay; `board/` is a cohesive shared capability consumed by setup and movement, not a generic shared directory |
| Specific, strong types | PASS: retain strict compiler options and explicit domain values | Validated `BoardPosition` and `AgilityStat`, ship/player identity unions, phase-discriminated snapshots, readonly route data and command results; Phaser null/type mismatches remain in its adapter |
| Classes and composition | PASS: compose factory, session, route finder, controller, and renderer | Domain classes contain state/behavior; interfaces express collaborator contracts. Only the scene extends Phaser.Scene, justified by Phaser lifecycle compatibility |
| Test-driven development | PASS: implementation must start with observed behavioral failures | Each behavior slice requires red → green → refactor evidence in `development.md`, including affected setup regression tests; this planning command adds no gameplay implementation |
| Explicit boundaries and review | PASS: dependencies can remain acyclic | Shared board has no dependency on setup/movement; movement consumes board and setup's creation/random contracts; application composes capabilities. No constitutional exceptions required |

## Project Structure

### Documentation (this feature)

```text
specs/002-ship-turn-movement/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── movement-ui.md
└── checklists/requirements.md
```

`tasks.md` belongs to the subsequent tasks phase. `development.md` will record actual implementation/test evidence, not assumed test results.

### Source Code (repository root)

```text
src/
├── app/
│   └── GameApplication.ts                    # composition, readiness, atomic replacement
├── features/
│   ├── board/                                # extracted shared board capability
│   │   ├── domain/{BoardPosition,BoardSnapshot}.ts
│   │   ├── presentation/{BoardGeometry,BoardView}.ts
│   │   └── tests/
│   ├── game-setup/                            # retain zone rules and placement factory
│   │   ├── domain/                            # imports canonical board values
│   │   ├── adapters/MathRandomSource.ts
│   │   ├── presentation/                      # existing shell/readiness integration
│   │   └── tests/
│   └── ship-movement/
│       ├── domain/
│       │   ├── AgilityStat.ts
│       │   ├── MovementGame.ts
│       │   ├── MovementGameFactory.ts
│       │   ├── Reachability.ts
│       │   └── TurnSession.ts
│       ├── presentation/
│       │   ├── MovementController.ts
│       │   ├── MovementScene.ts
│       │   ├── SpaceFlightPath.ts
│       │   ├── PhaserFlightAnimator.ts
│       │   └── TurnControls.ts
│       └── tests/
│           ├── fixtures/
│           └── browser/                       # deterministic actual-Phaser fixture
└── main.ts
vitest.config.ts                               # discover all feature-local tests
```

**Structure Decision**: Extract the existing canonical BoardPosition, BoardGeometry, and BoardView into `board/`, migrating imports and their tests without duplicate value classes. Define a readonly BoardSnapshot and ShipIdentity there, usable by setup snapshots and live movement snapshots. Generalize BoardView's input to BoardSnapshot and split static grid/highlights from independently movable ship circle/label groups. Preserve setup's public behavior and initial-zone invariants.

Retain GameSetupFactory and its two placement draws. MovementGameFactory composes it with two validated agility draws and creates a complete game before publication. TurnSession replaces setup-only GameSession in the application composition; the old setup session's independent contract remains covered. Share the existing RandomSource contract through its existing owner and broaden its documentation to cover independent gameplay draws; no reverse dependency from setup to movement.

GameSetupControls remains the application shell and New Game/readiness/error owner; expose a stable turn-HUD host and a board-summary update accepting BoardSnapshot. TurnControls owns stats, active-player status, and Pass inside that host. Do not recreate the root DOM on each turn or attach competing status writers. MovementScene replaces the application's setup-only scene and composes shared BoardView, controller, and animator. The legacy setup scene remains valid against the shared board view.

## Phase 0: Research Outcomes

See [research.md](research.md). Existing dependencies are sufficient; BFS supplies legal destinations and logical routes, continuous geometry supplies shortest visual flight, and generation/animation lifecycles use atomic replacement and identity checks. Phaser ellipse curves provide exact circular obstacle arcs. No unresolved clarification blocks design.

## Phase 1: Design

### Domain and reachability

- Agility score validates integer 8–20; modifier is `floor((score - 10) / 2)` and allowance is `max(0, modifier)`.
- Random mapping is `8 + floor(u * 13)` after checking finite `0 <= u < 1`. Draw order is placement 1, placement 2, agility 1, agility 2, with no rejection sampling.
- MovementGame accepts any two distinct valid board positions, not just starting zones. Immutable snapshots preserve the initial setup independently of later positions.
- Reachability uses FIFO BFS with up/right/down/left neighbor order, distance and predecessor records. Exclude blockers and origin from destinations; stop expansion at allowance. Cache one result for the current turn so highlights and selection cannot disagree.
- TurnSession exposes ready, moving, awaiting-pass, and disposed states. One move consumes the turn on completion; a pass consumes it only on explicit acknowledgment. Every turn gets a new token even if positions are unchanged. See [data-model.md](data-model.md).

### UI and lifecycle integration

- Use scene logical world coordinates, not raw browser client coordinates. Convert finite points in half-open board bounds to BoardPosition; ignore non-left input.
- A valid click transitions synchronously to moving, clears highlights, disables Pass, and starts flight. Invalid clicks have no domain effect. New Game stays available during flight.
- Keep authoritative occupancy at the origin during flight. Commit destination and switch player only on the matching completion. Capture game revision, turn token, and move token for callbacks; stale or duplicate callbacks are no-ops.
- If flight initialization fails or the animator reports failure before arrival, recover only when the game revision, turn token and move ID match the current pending move. Invalidate that move before cancelling its animation, restore the visual to its authoritative origin, retain the active player, issue a fresh turn token and recompute legal destinations. Show a retryable movement error. Recovery MUST NOT commit the destination or advance the turn; stale or cancelled moves' failure callbacks MUST have no effect.
- Pass callbacks capture the displayed turn token so a delayed click cannot acknowledge a later turn. A separate explicit click is required per no-moves turn.
- Stage the complete replacement before changing the current session. If generation fails, retain the prior game, stats, turn, and revision, and allow its animation to continue. On success, invalidate old callbacks before stopping animation and render the replacement before exposing input. Preserve serialized New Game requests and postrender revision readiness.
- On scene shutdown/disposal, invalidate identities, cancel animation, unsubscribe pointer and button listeners, and destroy visual groups. Initial generation errors must also reach a visible startup-error state; currently session construction occurs outside the application's renderer try block.
- Contract: [contracts/movement-ui.md](contracts/movement-ui.md).

### Flight geometry

At the current 600 × 600 logical board, reserve a 24 px visual radius for each ship, including its outline and label. The moving ship's center is constrained to `[24,576] × [24,576]`; the other ship creates a circular exclusion radius of 48 px (both visual envelopes). The path is the direct origin-to-destination segment whenever its minimum distance to the obstacle center is at least 48 px. If blocked, compute both tangents from each endpoint to the obstacle circle, join tangent pairs with clockwise/counterclockwise circular arcs, reject candidates outside the safe board rectangle, and choose the shortest remaining candidate. Each arc is exactly circular and tangent-matched to its straight segments. Empty cells and intermediate BFS route positions do not constrain visual flight; the BFS `stepCount` remains authoritative for allowance and duration.

Use `Phaser.Curves.Path.lineTo`, `ellipseTo(radius, radius, startDegrees, endDegrees, clockwise, 0)`, and one `scene.tweens.addCounter` progress tween sampled with `getPoint`. Validate arc containment using exact cardinal extrema, not frame sampling. Keep labels/effects within the 24 px radius. Direct paths and arcs stay inside the center bounds, so the full ship remains on-board without changing logical movement cost.

Use whole-flight Sine ease-in/out, 250 ms per step, no per-cell pause. Clamp progress, handle Phaser's actual nullable path results at the adapter boundary, snap exactly on completion, and issue at most one completion notification. Stopping is cancellation, never successful arrival.

### Verification strategy

Expand Vitest discovery to `src/features/*/tests/**/*.test.ts`, disable silent no-test success, and retain existing setup tests. Before each implementation slice, write and run a behavioral failing test, then implement/refactor with passing verification. Record commands and evidence. Unit tests cover stat boundaries and all 169 score pairs, route sets and shortest-path invariants, turn identity and acknowledgments, atomic replacement failures, and exact tangent/arc lengths and bounds. Use independent expected destinations, not the production BFS as its own oracle.

Application/adapter tests deliberately deliver old/duplicate callbacks and verify exactly one handoff, preserved queued New Game behavior, readiness gates, disposal, retained state on generation failure, and retryable recovery from flight startup/mid-flight failures. A manually operated test-only browser fixture supplies center/edge/detour and no-moves states through the same composed scene/controller without adding production stat editing. Manual browser checks validate actual Phaser APIs, scaling, footprint bounds, timing, and native-button focus. Positive-allowance total blockage is only a route-finder fixture with additional blockers, not a playable two-ship scenario.

See [quickstart.md](quickstart.md) for commands, expected results, fixture scenarios, and acceptance evidence. Browser timing and the 4-of-5 first-time-user outcome must be measured during implementation acceptance, not inferred from unit tests.

## Complexity Tracking

No constitutional violations or exception requests. New classes have separate domain, lifecycle, or rendering responsibilities; no backend, extra runtime library, generic shared service layer, or unbounded pathfinding is introduced.
