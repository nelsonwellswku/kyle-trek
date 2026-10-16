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

## 4. Safe smooth flight

**Decision**: Trim 15 px at each corner on the 60 px grid, then use a quadratic curve with the original cell center as control. Use one progress tween across the assembled path.

**Rationale**: For trim d, the curve stays within d/4 of the original legal center segments. With d=15 and a reserved 24 px visual radius, occupied-square clearance remains 2.25 px and visual ship separation 8.25 px. Curve/control convexity keeps the center within the board's center bounds; the full ship retains 6 px edge clearance. Consecutive corners retain at least 30 px of straight joining segment. Tangents match at joins, removing abrupt direction changes without requiring acceleration continuity.

**Alternatives considered**: Unrestricted global splines can cut blocked corners or overshoot the board; straight origin-to-destination tweens cross ships; per-cell stopping lacks smooth turns. Circular fillets are viable but require more angle bookkeeping.

**Evidence**: Current 600 px board in `src/app/GameApplication.ts`; 70%-cell marker diameter in BoardGeometry; 2 px stroke and 16.8 px digit label in BoardView. The label must be checked against the reserved envelope in a real browser. Cosmetic effects must fit the same bound.

## 5. Installed Phaser integration

**Decision**: Retain Phaser 4.2.1; use `Phaser.Curves.Path.lineTo`, numeric `quadraticBezierTo(endX, endY, controlX, controlY)`, `path.getPoint(progress)`, and `scene.tweens.addCounter`. Group each ship's circle and label in a Container. Use one Sine ease-in/out tween, 250 ms per step, no repeat/yoyo/delay.

**Rationale**: Installed APIs already support the required path and animation. `Path.getPoint` uses cumulative curve lengths and `getPointAt` mapping for approximately distance-based traversal. The numerical mapping remains on the mathematically safe curves. The nominal 1,250 ms maximum leaves normal-frame headroom below 1.5 seconds.

**Alternatives considered**: New animation libraries add no necessary capability; hand-managed requestAnimationFrame duplicates Phaser lifecycle; whole-scene redrawing every frame couples grid and ship visuals.

**Evidence**: `node_modules/phaser/src/curves/path/Path.js` (numeric quadratic argument order and getPoint); `src/curves/Curve.js` (getPointAt); `src/tweens/TweenManager.js` (addCounter/remove); `src/tweens/tween/BaseTween.js` (stop/remove); `types/phaser.d.ts` (container/setPosition and counter APIs). Runtime getPoint can return null despite its declaration; getValue is declared nullable. Handle these only in the adapter. Avoid the misleading vector quadratic overload.

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
