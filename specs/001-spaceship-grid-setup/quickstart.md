# Quickstart and Validation: Spaceship Grid Setup

This guide describes the commands and outcomes required of the implementation. Application code, package metadata, scripts, and tests will be created during implementation.

## Prerequisites

- nvm installed and loaded in the shell.
- Node 24.22.0 LTS selected through the project's planned `.nvmrc`; bundled npm 11.19.1.
- A current WebGL-capable browser. Automated browser checks use Playwright's pinned Chromium.
- Run commands from the repository root. See [browser-ui.md](contracts/browser-ui.md) for UI and script contracts and [data-model.md](data-model.md) for placement/lifecycle rules.

## Install and run

After implementation scaffolding is present:

```bash
nvm install
nvm use
npm ci
npm run dev
```

For the initial implementation bootstrap only, use `npm install` to generate `package-lock.json`; commit it. Subsequent clones use `npm ci` as shown above.

Visit **http://localhost:5173/**. Vite must print the URL and remain running until interrupted. Expect an automatically initialized board, New Game button, readable ship identities, position summary, and Game 1 ready status. Node runs the tools; the game itself executes in the browser.

## Required development evidence

For each behavior slice, write the demonstrating test before its implementation and record the test name, exact command, expected behavioral failure, green result, and post-refactor result in a feature development/review record. Example focused commands once the relevant test files exist:

```bash
npm test -- src/features/game-setup/tests/placement.test.ts
npm test -- src/features/game-setup/tests/session.test.ts
npm test -- src/features/game-setup/tests/geometry.test.ts
```

Use the same focused command before and after implementing the behavior. Compilation errors, missing dependencies/browser binaries, and absent screenshot baselines do not count as the required behavioral red. Retain the tests as regression coverage.

## Automated validation

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Expected: all checks pass; `dist/` contains the static game without the browser fixture entry. Browser tests manage their own Vite server on an isolated port. Review deterministic screenshot baselines in a consistent Chromium environment; do not blindly accept changed images.

Validate the production entry separately:

```bash
npm run preview
```

Visit **http://localhost:4173/** and repeat the initial setup/New Game smoke checks. Confirm that normal production entry uses the production random source, with no console exceptions or failed game assets.

## Acceptance scenarios

| Scenario | Procedure and expected result | Coverage |
|----------|-------------------------------|----------|
| Board and occupancy | Inspect the canvas and run 100 controlled setups: exactly 10 rows, 10 columns, two distinguishable ships, one square each, no overlap. | FR-001–FR-003, FR-008; SC-001 |
| Zone bounds | Across 1,000 scripted setups, every Ship 1 row is 1 or 2, every Ship 2 row is 9 or 10, all columns are 1–10, and rows 3–8 are empty. | FR-004–FR-005; SC-002 |
| Reachability and independence | Supply all 20 bucket midpoints for each zone and all 400 midpoint pairs. Compare with an independently listed set of expected coordinates; same-column pairs must be valid. A 1,000-setup controlled sequence must include all eligible squares for both ships. | FR-006; SC-003 |
| Probability mapping | Check endpoints 0 and immediately below 1, the row boundary at 0.5 and either side, and representative bucket boundaries. Review equal-width buckets and separate production draws. Do not treat finite frequency counts as proof of fairness. | FR-006 |
| Invalid boundaries | Test invalid positions and source outputs: negatives, 1 as an RNG result, non-finite values, fractional/out-of-board coordinates. Reject without publishing incomplete state. | Data-model invariants |
| New Game | Script layouts A then B; activate New Game by pointer and keyboard. Both coordinates/graphics and ready revision update once, and focus remains on the button. | FR-007–FR-008 |
| Identical repeated layout | Script the same pair twice. New Game still advances revision without retries; identical positions are accepted. | FR-007 |
| Stable observation | Observe the same session 20 times and resize from desktop to 360px width. No extra placement draws, position changes, revision changes, clipping, or duplicate canvas. | FR-009; SC-005 |
| Real rendering | Compare reviewed deterministic canvas output with expected grid, single-cell ship geometry, corner coverage, and visible labels; verify DOM summary matches. | FR-001–FR-005, FR-008 |
| Startup failure | Simulate unavailable WebGL in a controlled browser check. The explanatory error replaces boot state and readiness is not announced. | Browser UI contract |

Controlled-input coverage is intentionally deterministic. Exploratory runs with production randomness may be inspected, but random frequency thresholds are not a flaky merge gate.

## Manual user and browser checks

1. Show an initialized board to five first-time players. At least four must correctly identify both ships and their occupied squares within 10 seconds without assistance (SC-004). Record actual outcomes.
2. Navigate using the keyboard, activate New Game with Enter/Space, and confirm focus remains visible and stable. Check that the visible coordinate summary and polite status provide meaningful non-color information.
3. Smoke-test current Firefox and Safari with WebGL, recording browser versions. Check the entire board at desktop and narrow widths; resizing must not reroll it.
4. Measure engineering targets on a recorded local machine/browser: initial board ready within 2 seconds and warmed New Game visible within 100 ms. Use rendering-ready revision timing, not arbitrary sleeps.

## Completion evidence

Retain red–green–refactor records, final check results, reviewed canvas baselines, manual usability results, and browser/performance observations. Planning itself does not execute these future application tests or establish that the success criteria have been achieved.
