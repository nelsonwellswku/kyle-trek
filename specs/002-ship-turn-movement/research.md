# Research: Ship Turn Movement

**Date**: 2026-10-16
**Status**: Complete; all technical unknowns resolved for Phase 1.

## 1. Existing architecture and ownership

**Decision**: Separate live movement from initial setup; extract a cohesive board capability and compose existing setup creation.

**Rationale**: `src/features/game-setup/domain/GameSetup.ts` freezes placements and enforces rows 1–2/9–10. Reusing it as live state would prohibit most moves or weaken valid setup rules. BoardPosition and BoardGeometry are already reusable validated classes. BoardView currently draws both ships into one Graphics object; independent visual groups are needed for movement. Setup and movement are explicit consumers of the shared board capability.

**Alternatives considered**: Mutating GameSetup violates its invariant; duplicating position classes breaks existing instanceof validation; importing all presentation into movement leaves board responsibilities under the wrong gameplay owner; a generic shared directory lacks cohesion.

**Evidence**: `GameSetup.ts`, `BoardPosition.ts`, `presentation/BoardGeometry.ts`, `presentation/BoardView.ts`, and `src/app/GameApplication.ts`.

## 2. Reachability and route selection

**Decision**: A bounded FIFO BFS with fixed up/right/down/left order computes both destination highlights and shortest routes for each turn.

**Rationale**: Grid edges all cost one. At most 100 cells and five steps make full search inexpensive; predecessor reconstruction yields a shortest obstacle-free route. One turn result prevents highlight/selection inconsistency.

**Alternatives considered**: Manhattan distance ignores blocking ships; direct line interpolation crosses enemies; A* is unnecessary for 100 cells; enumerating every route is more complex and redundant.

**Validation**: At least 20 independent board arrangements, exact 12-square center case at allowance 2, enemy detour at allowance 4 but not 2, orthogonality and bounds of every route, stable tie-breaking, nonpositive allowance. Fully blocked positive movement cannot arise with just one enemy on this board; use a generic blocker fixture only for the route-finder boundary.

## 3. Random scores and atomic games

**Decision**: Compose GameSetupFactory with an agility selector using the existing injected RandomSource; validate draws and map each separate draw to `8 + floor(13*u)`. Create all placements and stats before committing a new game revision.

**Rationale**: Equal-width buckets give the requested uniform 13-score domain. Existing GameSession commits its setup before returning; adding stat generation afterward risks a half-updated game on failure. A full-game factory/session keeps replacement atomic. Preserve placement factory's existing two-draw contract; complete-game order is two placements then two stats.

**Alternatives considered**: Live random-only tests are flaky; independent deterministic bucket and 169-pair cases establish mapping and draw separation. Retrying low scores would bias the requested distribution. Default agility 12 and automatic passing were explicitly superseded by the user.

**Evidence**: `domain/RandomSource.ts`, `adapters/MathRandomSource.ts`, `domain/GameSetupFactory.ts`, `domain/GameSession.ts`, `tests/placement.test.ts`, `tests/fixtures/ScriptedRandomSource.ts` under game-setup; clarified FR-013/FR-015.

## 4. Shortest continuous safe flight

**Decision**: Keep BFS solely for logical route legality and movement cost. Animate a direct center-to-center line when it clears the other ship; otherwise choose the shortest feasible tangent-line/circular-arc/tangent-line route around the combined visual envelopes.

**Rationale**: The animation represents a ship in continuous space, so empty cells impose no trajectory restriction. For a circular obstacle of radius 48 px, a shortest path consists of tangent line segments and a circular arc. Enumerating tangent points from both endpoints, both arc directions, and rejecting candidates outside the `[24,576] × [24,576]` safe center rectangle yields the shortest in-bounds candidate. The 24 px per-ship visual radius matches BoardGeometry/BoardView bounds; center separation of 48 px prevents visual overlap. Logical BFS stepCount remains the authority for affordability and 250 ms-per-step duration.

**Alternatives considered**: Following orthogonal grid segments or rounding every axis change looks mechanical and needlessly lengthens clear flights. Quadratic corner splines are not circular and do not represent shortest obstacle avoidance. Unrestricted splines can cross ships or leave the board.

**Evidence**: Current 600 px board in `src/app/GameApplication.ts`; BoardGeometry and BoardView reserve a 24 px visual radius including the 2 px outline and digit label. The SVG test overlay uses the same line/arc segments as the production animator. Real rendered label bounds and edge visuals remain a browser acceptance check.

## 5. Installed Phaser integration

**Decision**: Retain Phaser 4.2.1; use `Phaser.Curves.Path.lineTo`, `ellipseTo(radius, radius, startAngle, endAngle, clockwise, 0)`, `path.getPoint(progress)`, and `scene.tweens.addCounter`. Group each ship's circle and label in a Container. Use one Sine ease-in/out tween, 250 ms per logical step, no repeat/yoyo/delay.

**Rationale**: Installed APIs support exact ellipse arcs and whole-flight animation. `Path.getPoint` traverses the assembled line/ellipse path by cumulative curve lengths. The maximum logical duration remains 1,250 ms, leaving normal-frame headroom below 1.5 seconds; the path length may vary with the direct or obstacle-avoiding route.

**Alternatives considered**: New animation libraries add no necessary capability; hand-managed requestAnimationFrame duplicates Phaser lifecycle; whole-scene redrawing every frame couples grid and ship visuals.

**Evidence**: `node_modules/phaser/src/curves/path/Path.js` (ellipseTo and getPoint); `node_modules/phaser/src/curves/EllipseCurve.js` (clockwise angle normalization); `src/tweens/TweenManager.js` (addCounter/remove); `src/tweens/tween/BaseTween.js` (stop/remove); `types/phaser.d.ts` (ellipseTo, container/setPosition and counter APIs). Runtime getPoint can return null despite its declaration; getValue is declared nullable. Handle these only in the adapter.

## 6. Turn, reset, and event identity

**Decision**: Distinguish ready/moving/awaiting-pass states, identify every turn and move within a game revision, and guard all asynchronous callbacks. A no-moves turn remains active until Pass is clicked.

**Rationale**: A game revision alone cannot reject a duplicate completion from an earlier move in the same game. Stopping a tween may trigger onStop and removal may be deferred during update. Invalidate identities before cancellation; never use onStop for completion. Native pass listeners capture the rendered turn token. Initial generation failures need visible error handling as well as renderer failures.

**Alternatives considered**: Timed auto-pass contradicts the clarification; committing the destination before arrival confuses cancellation and turn ownership; relying only on tween removal leaves stale callback races.

**Evidence**: GameApplication revision/readiness/queued replacement guards; game-setup application/session/lifecycle tests; installed Phaser tween stop/remove behavior.

## 7. Test and browser strategy

**Decision**: Keep Node Vitest, expand discovery to all feature-local tests, and use deterministic, manually operated actual-Phaser browser fixtures plus manual acceptance. Browser verification is performed by a person using the fixture and DevTools; no additional testing dependency is needed.

**Rationale**: Current `vitest.config.ts` only includes game-setup. Existing DOM/Phaser fakes support fast lifecycle testing but cannot establish real rendering, scale conversion, focus, or timing. Existing fake DOM assumptions about the first button need deliberate updates for Pass. Real random coverage cannot prove equal probability; use deterministic samples plus mapping review.

**Alternatives considered**: Node-only mocks miss runtime integration failures. A manually operated test-only fixture provides reproducible visual checks without adding production stat controls.

**Evidence**: `package.json`, `vitest.config.ts`, `src/features/game-setup/tests/fixtures/FakeDom.ts`, `scene-lifecycle.test.ts`, and `game-application.test.ts`.

## Research completion

Two research investigations covered installed animation APIs/geometry and existing test/random/lifecycle integration. Local source and installed dependency inspection supplied the evidence; no gameplay tests or browser acceptance were claimed or executed during planning. No unresolved technical decision requires a further user clarification.
