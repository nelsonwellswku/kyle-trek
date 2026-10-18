# Quickstart Validation: Ship Turn Movement

**Status**: Implementation validation guide. The planning phase defines the fixtures and tests below; it does not implement them or claim their results.

## Prerequisites

- Node 24, npm 11, and installed project dependencies (`npm ci` if needed).
- A desktop browser with WebGL and a mouse; record browser/version, viewport and device used for acceptance.
- For timing acceptance, use current stable desktop Chromium in a foreground, visible tab with a 1280 × 800 viewport and hardware-accelerated WebGL on a reference desktop with at least four logical CPU cores and 8 GB RAM. Disable developer-tool CPU/network throttling and record browser version, OS, CPU, RAM, GPU and display refresh rate before measuring. This is a measurement baseline, not a minimum runtime requirement.
- Run commands from the repository root.
- Read [UI contract](contracts/movement-ui.md) for expected behavior and [data model](data-model.md) for legal routes and state identities.

## Automated verification

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

During implementation, each behavior slice must first run its new demonstrating test and fail for the expected behavioral reason. Then run it green, refactor and rerun affected tests. Record commands, failure reason and passing results in `specs/002-ship-turn-movement/development.md`. Compilation/setup errors are not the required red evidence.

After feature tests exist and discovery is widened to all feature-local tests, targeted runs are:

```bash
npm test -- src/features/ship-movement/tests
npm test -- src/features/board/tests
npm test -- src/features/game-setup/tests
```

Expected outcomes:

- All 13 agility values and bucket boundaries validate; mapping and all 169 score pairs are correct. Invalid random draws/stats fail without corrupting the current game.
- At least 20 arrangements produce exact expected destination sets; all returned routes have legal orthogonal steps and shortest affordable lengths. Use independently specified expectations/reference enumeration.
- Fifty completed moves alternate correctly; repeated/invalid clicks produce no extra move; twenty explicit passes each require a click and cause one handoff.
- Direct-path endpoints, tangent continuity, circular obstacle clearance and exact arc bounds pass; collision safety does not depend only on sampled frames.
- Old game/turn/move callbacks, generation failures, disposal, and duplicate completions cannot mutate the wrong game or double-advance a turn.
- Matching flight startup/mid-flight failures restore the visual origin and active player's legal input without a handoff; stale success/failure callbacks cannot affect the recovered turn or a replacement game.
- Existing setup tests continue to pass after canonical board extraction. Test discovery must fail rather than silently succeeding when no intended tests are selected.

Do not use uncontrolled Math.random samples as a CI fairness oracle. Use scripted bucket coverage and deterministic 1,000-game runs; review equal-width bucket mapping and separate draws in addition to sample coverage.

## Normal browser play

```bash
npm run dev
```

Open `http://127.0.0.1:5173/`.

1. Confirm one canvas, randomized opposing starts, visible agility/modifier values and Player 1's first turn.
2. If a ship has no movement, verify no destination highlights and no automatic turn advance; click **Pass turn** once and confirm the other player's turn.
3. For a movable ship, choose a highlighted square with a left click. Observe continuous flight and a single turn handoff after arrival; unused allowance is lost.
4. Try occupied/current/unreachable squares, right click, and repeated input during flight. Expect no extra move or handoff.
5. Use New Game during flight. Expect fresh positions/stats, Player 1's turn and no late effect from the interrupted move. Repeated new-game requests remain serialized and do not create extra canvases/listeners.
6. Resize the viewport and click the center of several visible cells. Confirm FIT scaling does not offset selection. Check native Pass/New Game buttons with keyboard focus and activation and inspect live turn messages.
7. Check the browser console for integration errors, especially path/tween null handling and disposed objects.

## Manual browser validation with reproducible actual-Phaser fixtures

Open the fixture, choose presets, click destinations and inspect results manually. Fixture timestamps and overlays assist the person performing these checks; browser actions and acceptance decisions are manual.

Implementation must provide a development/test-only entry at `src/features/ship-movement/tests/browser/fixture.html`, using the same MovementScene/controller/TurnSession and shared BoardView. The fixture creates validated live MovementGame states directly, rather than weakening starting-zone validation or adding production stat editing. It offers named preset selection and reset, plus recorded timing/identity observations. It must not be imported by the production entry.

With the Vite server running, open:

`http://127.0.0.1:5173/src/features/ship-movement/tests/browser/fixture.html`

The manually operated fixture is implemented at this URL; it uses the production scene/controller and provides preset resets, route overlays, and timeline observations.

| Preset              | Initial state / action                                | Expected result                                                                           |
| ------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Center              | Ship 1 (5,5), agility 14; enemy (10,10)               | Exactly 12 destinations; (6,6) costs two logical steps but flies directly on a diagonal   |
| Blocked direct      | Ship 1 (5,4), agility 14; enemy (5,5)                 | (5,6) unavailable; occupied square never highlighted                                      |
| Enemy detour        | Same positions, Ship 1 agility 18                     | (5,6) reachable in four logical steps; flight uses the shortest circular arc around enemy |
| Edge                | Ship 1 (1,1), agility 20; enemy (1,2)                 | Only affordable in-board detours; full ship stays within board and clears occupied square |
| Straight            | Ship 1 (5,2), agility 20; enemy (10,10), select (5,7) | Five-step continuous straight flight, nominal 1.25 seconds, exact arrival                 |
| One immobile        | Ship 1 agility 8, Ship 2 agility 16                   | Player 1 waits for Pass; Player 2 then gets movement highlights                           |
| Both immobile       | Agility 9 and 11                                      | No automatic advance; each player's turn requires its own Pass click                      |
| Reset during flight | Any movable preset, reset/New Game mid-flight         | Old callbacks cannot move the new game's ships or advance its first turn                  |

Use route-finder unit fixtures, rather than a playable preset, for fully surrounded positive-allowance ships: that situation requires more blockers than the two-ship game contains.

## Visual/performance acceptance

- Observe at least ten moves across direct diagonal, straight, blocked-detour, and board-edge cases. Confirm continuous shortest flight, circular arcs around blockers, no visual overlap or off-board travel, and exact destination centering.
- Measure digit-label bounds and ensure circle/stroke/text/effects fit within the reserved 24 px radius at 60 px cells. Validate at normal and resized display scales.
- Manually use fixture timestamps/DevTools Performance in the reference environment above to measure turn-to-highlight latency (≤200 ms), accepted move to arrival (≤1.5 s), and arrival to next playable highlights (≤200 ms). Retain individual timings for every acceptance move and report each threshold failure rather than averaging it away. A waiting-for-pass turn has no actionable highlights.
- Record environment and observations. Mocks cannot establish these outcomes. Note checks as pending when a real browser is unavailable.
- Run five first-time-player trials: each should identify the active ship, choose a legal destination and recognize handoff; at least four must succeed within 30 seconds without assistance.

For a production-build smoke test:

```bash
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/` and repeat normal-play, pass, scaling and New Game checks. The test-only fixture is not a required production route.

## Completion evidence

Record red-green-refactor evidence, final command results, deterministic-route/stat checks, browser/timing records and usability results in the feature development record. Review the constitution's feature boundaries, strict types, class composition, and lifecycle exception rationale. Planning documents and checked specification-quality boxes are not implementation acceptance evidence.
