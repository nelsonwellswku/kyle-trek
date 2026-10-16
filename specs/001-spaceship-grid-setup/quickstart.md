# Quickstart and Validation: Spaceship Grid Setup

This guide describes the implemented commands and the expected outcomes for the Spaceship Grid Setup feature.

## Prerequisites

- nvm installed and loaded in the shell.
- Node 24.22.0 LTS selected through `.nvmrc`; bundled npm 11.19.1.
- A current WebGL-capable browser for the manual walkthrough.
- Run commands from the repository root. See [browser-ui.md](contracts/browser-ui.md) for UI and script contracts and [data-model.md](data-model.md) for placement/lifecycle rules.

## Install and run

```bash
nvm install
nvm use
npm ci
npm run dev
```

Visit **http://127.0.0.1:5173/**. Vite prints the URL and remains running until interrupted. Expect an automatically initialized board, New Game button, readable ship identities, position summary, and Game 1 ready status. Node runs the tools; the game itself executes in the browser.

## Required development evidence

For each behavior slice, write the demonstrating test before its implementation and record the test name, exact command, expected behavioral failure, green result, and post-refactor result in a feature development/review record. Focused commands for placement and session behavior:

```bash
npm test -- src/features/game-setup/tests/placement.test.ts
npm test -- src/features/game-setup/tests/session.test.ts
npm test -- src/features/game-setup/tests/geometry.test.ts
```

Use the same focused command before and after implementing the behavior. Compilation errors and missing dependencies do not count as the required behavioral red. Retain the tests as regression coverage.

## Automated validation

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Expected: type-check, lint, formatting, unit tests, and build pass; `dist/` contains the static game.

## Manual browser walkthrough

Run `npm run dev`, open **http://127.0.0.1:5173/** in a WebGL-capable browser, and verify the acceptance scenarios below. Compare the visible coordinate summaries with the actual canvas.

Validate the production entry separately:

```bash
npm run preview
```

Run `npm run build` first, then run `npm run preview`. Visit **http://127.0.0.1:4173/** and repeat the initial setup/New Game smoke checks. Confirm that normal production entry uses the production random source, with no console exceptions or failed game assets.

## Acceptance scenarios

| Scenario                      | Procedure and expected result                                                                                                                                                                                                                                   | Coverage                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Board and occupancy           | Inspect the canvas; unit tests exercise 100 controlled setups. Confirm 10 rows, 10 columns, two distinguishable ships, one square each, and no overlap.                                                                                                         | FR-001–FR-003, FR-008; SC-001 |
| Zone bounds                   | Across 1,000 scripted setups, every Ship 1 row is 1 or 2, every Ship 2 row is 9 or 10, all columns are 1–10, and rows 3–8 are empty.                                                                                                                            | FR-004–FR-005; SC-002         |
| Reachability and independence | Supply all 20 bucket midpoints for each zone and all 400 midpoint pairs. Compare with an independently listed set of expected coordinates; same-column pairs must be valid. A 1,000-setup controlled sequence must include all eligible squares for both ships. | FR-006; SC-003                |
| Probability mapping           | Check endpoints 0 and immediately below 1, the row boundary at 0.5 and either side, and representative bucket boundaries. Review equal-width buckets and separate production draws. Do not treat finite frequency counts as proof of fairness.                  | FR-006                        |
| Invalid boundaries            | Test invalid positions and source outputs: negatives, 1 as an RNG result, non-finite values, fractional/out-of-board coordinates. Reject without publishing incomplete state.                                                                                   | Data-model invariants         |
| New Game                      | Script layouts A then B; activate New Game by pointer and keyboard. Both coordinates/graphics and ready revision update once, and focus remains on the button.                                                                                                  | FR-007–FR-008                 |
| Identical repeated layout     | Script the same pair twice. New Game still advances revision without retries; identical positions are accepted.                                                                                                                                                 | FR-007                        |
| Stable observation            | Observe the same session 20 times and resize from desktop to 360px width. No extra placement draws, position changes, revision changes, clipping, or duplicate canvas.                                                                                          | FR-009; SC-005                |
| Real rendering                | Inspect the canvas for the expected grid, single-cell ship geometry, corner coverage, and visible labels; verify the position summary matches.                                                                                                                  | FR-001–FR-005, FR-008         |
| Startup failure               | Confirm the documented fallback is shown if WebGL or game initialization is unavailable; readiness must not be announced.                                                                                                                                       | Browser UI contract           |

Controlled-input unit coverage is intentionally deterministic. Exploratory runs with production randomness may be inspected, but random frequency thresholds are not a flaky merge gate.

## Manual user and browser checks

1. Show an initialized board to five first-time players. At least four must correctly identify both ships and their occupied squares within 10 seconds without assistance (SC-004). Record actual outcomes.
2. Navigate using the keyboard, activate New Game with Enter/Space, and confirm focus remains visible and stable. Check that the visible coordinate summary and polite status provide meaningful non-color information.
3. Smoke-test current Firefox and Safari with WebGL, recording browser versions. Check the entire board at desktop and narrow widths; resizing must not reroll it.
4. Measure engineering targets on a recorded local machine/browser: initial board ready within 2 seconds and warmed New Game visible within 100 ms. Use rendering-ready revision timing, not arbitrary sleeps.

## Completion evidence

Retain red–green–refactor records, final check results, manual usability results, and browser/performance observations. Planning itself does not execute these future application checks or establish that the success criteria have been achieved.
