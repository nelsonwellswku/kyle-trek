# Development and Review Record: Spaceship Grid Setup

## Environment

- Runtime: Node.js 24.22.0, npm 11.19.1, selected from `.nvmrc` with nvm.
- Platform: Linux x86_64.
- Browser baseline: Playwright Chromium 156.0.8078.4, headless, 1280 × 900 CSS pixels, device scale factor 1, dark color scheme.
- Dependencies: exact direct versions in `package.json`, reproduced with `npm ci`.

## Initial tooling verification (T001–T007)

| Task / check            | Exact command                                                          | Observed result                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T001 runtime            | `nvm install && nvm use && node --version && npm --version`            | Selected Node v24.22.0 and npm 11.19.1.                                                                                                                         |
| T002 install            | `npm install --save-exact`                                             | Installed pinned dependencies; npm reported no peer conflicts and 0 vulnerabilities. `@eslint/js` is pinned to its latest ESLint 10-compatible release, 10.0.1. |
| T002 reproducibility    | `npm ci && npm ls --depth=0`                                           | Clean lockfile install succeeded; all declared direct dependencies resolved to their exact versions.                                                            |
| T003 type configuration | `npm run typecheck`                                                    | Passed with strict TypeScript and no emitted files.                                                                                                             |
| T004 lint               | `npm run lint`                                                         | Passed with zero warnings.                                                                                                                                      |
| T004 formatting         | `npx prettier --check "src/**/*.{ts,css,html}" "*.{js,json,css,html}"` | Passed; read-only formatting check.                                                                                                                             |
| T006 unit discovery     | `npm test`                                                             | Vitest launched and found no tests yet; infrastructure-only, not behavior validation.                                                                           |
| T006 browser setup      | `npx playwright install chromium`                                      | Chromium and its headless shell installed.                                                                                                                      |
| T006 browser discovery  | `npm run test:e2e`                                                     | Playwright launched but exited with “No tests found”; no browser behavior was tested yet.                                                                       |

No behavioral red was claimed during toolchain setup. An empty suite or missing behavior test is not acceptance evidence.

## Test-driven behavior evidence

For each behavior task, record the test name, exact command, expected behavioral failure, observed failure, green result, and post-refactor rerun here. Setup, compilation, dependency, server, and missing screenshot-baseline failures do not count as behavioral red.

### US1 domain and geometry

| Task / test                      | Exact command                                                  | Expected behavioral red                                                                                                            | Observed red and green/refactor result                                                                                                                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T011 BoardPosition and GameSetup | `npm test -- src/features/game-setup/tests/setup.test.ts`      | Missing coordinate validation/value equality/immutability and complete immutable setup should fail assertions.                     | Red: 14 tests failed against the deliberate unimplemented behavior scaffolds. Green: after T014 and T015, the same command passed all 14 tests. T014's focused run `npm test -- src/features/game-setup/tests/setup.test.ts -t BoardPosition` passed 11 tests (3 GameSetup tests skipped). |
| T012 BoardGeometry               | `npm test -- src/features/game-setup/tests/geometry.test.ts`   | Missing square-cell bounds, orientation, centers, and marker bounds should fail assertions.                                        | Red: all 4 tests failed when geometry methods were unimplemented. The first implementation rerun exposed a runtime import error; after correcting the runtime `BoardPosition` import, the same command passed all 4 tests.                                                                 |
| T017 BoardView rendering handoff | `npm test -- src/features/game-setup/tests/board-view.test.ts` | The composed view should draw 22 grid lines, 2 labeled ship markers, and publish revision 1 only after the game post-render event. | Red: the first assertion observed 0 grid-line calls against the no-op scaffold. Green: after Phaser Graphics/Text composition and post-render readiness wiring, the same command passed. `npm run typecheck` and `npm run lint` also passed after the scene adapter was added.             |

### US1 browser and presentation

T013 tests are authored with explicit corner positions, accessible semantics, readiness, 20 observations, resize, and WebGL failure behavior. Exact attempted command: `npm run test:e2e -- --grep 'US1'`. Playwright failed before any test reached a page because Chromium could not load `libnspr4.so`; `ldd` also reports missing `libnss3.so`, `libnssutil3.so`, and `libasound.so.2`. This is an environment/setup failure, **not behavioral red evidence**. Install the host Chromium runtime dependencies before claiming browser tests run. No screenshot baseline has been created or treated as evidence.

The US1 application, fixture composition, controls, responsive styles, Phaser scene, and startup-error handling have been implemented. Static and HTTP checks completed:

| Check                | Exact command                                                                              | Observed result                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Type check           | `npm run typecheck`                                                                        | Passed after application/presentation integration.                                                                                  |
| Lint                 | `npm run lint`                                                                             | Passed with zero warnings.                                                                                                          |
| Format               | `npm run format:check`                                                                     | Passed.                                                                                                                             |
| Unit tests           | `npm test`                                                                                 | 3 test files passed, 19 tests passed.                                                                                               |
| Production build     | `npm run build`                                                                            | Passed; emitted `dist/index.html` and JS/CSS assets. Vite reported the Phaser-containing JS chunk exceeds 500 kB.                   |
| Development serving  | `npm run dev` plus HTTP GETs for `/` and `/src/main.ts`                                    | Both returned HTTP 200.                                                                                                             |
| Test fixture routing | `npm run test:server` plus HTTP GETs for `/__fixtures__/game-setup/` and its browser entry | Both returned HTTP 200; fixture route is only enabled in `--mode test`.                                                             |
| Production preview   | `npm run preview` plus HTTP GET `/`                                                        | Returned HTTP 200. `dist/` contains only `index.html` and bundled assets; fixture HTML/entry is excluded.                           |
| Browser acceptance   | `npm run test:e2e -- --grep 'US1'`                                                         | Blocked before browser startup by missing host shared libraries listed above. No visual output or screenshot baseline was reviewed. |

At this checkpoint, normal entry used the explicit fixed layout and New Game was disabled pending US2. US2 integration below replaces that composition. T013's behavioral red, T022's actual browser rendering/screenshot review, and T023's browser validation remain pending the Chromium host dependencies. The mobile fit, accessibility association, initialization failure state, and rendered-revision readiness are implemented but not claimed as browser-verified.

### US2 placement and session

| Task / test                                  | Exact command                                                 | Expected behavioral red                                                                                                                                         | Observed red and green/refactor result                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T024 random placement and production adapter | `npm test -- src/features/game-setup/tests/placement.test.ts` | Bucket mappings, eligible pairs, invalid-output rejection, draw counts, and production-source range checks should fail against the throwing scaffold.           | Red: 25 tests failed on the deliberate `GameSetupFactory`, `MathRandomSource` scaffolds. Green: the same command passed all 25 tests after the adapter/factory implementation. After adding the T033 structure/reachability cases, the post-refactor command passed all 27 tests. `npm run typecheck` and `npm run lint` passed.                                                       |
| T025 retained session and revision           | `npm test -- src/features/game-setup/tests/session.test.ts`   | Initial state, fresh replacement, repeat acceptance, stable reads, and atomic failure/recovery should fail against the throwing session scaffold.               | Red: all 3 tests failed against the scaffold. An initial green run exposed two incorrectly specified test vectors (not implementation defects); after correcting the expected bucket coordinates and failure sequence, the same command passed all 3 tests and passed again after formatting/refactor. `npm run typecheck` passed.                                                     |
| T026 browser initialization and New Game     | `npm run test:e2e -- --grep 'US2'`                            | Controlled entry, click/keyboard activation, repeat announcements, failure/recovery, and resize stability should fail against the US1-only fixture/application. | The initial five US2 browser scenarios and a scripted corner-pair scenario are present. The run could not launch Chromium because `libnspr4.so` is missing; this is an environment/setup failure, not behavioral red. The same missing-library block also prevents the prerequisite US1 browser checkpoint and visual review.                                                          |
| T033 deterministic coverage                  | `npm test -- src/features/game-setup/tests/placement.test.ts` | 100 complete setups should satisfy structure invariants, and 1,000 scripted setups should cover all 20 positions for both ships.                                | Added the 100-setup structure and 1,000-setup zone/reachability checks. The final focused command passed all 27 placement and production-adapter tests. `floor(value × 20)` partitions the half-open source interval into 20 equal-width buckets; `MathRandomSource.next()` makes one independent `Math.random()` call. Reachability tests do not claim statistical proof of fairness. |

### US2 application integration

The production `MathRandomSource`, validated row-major `GameSetupFactory`, and atomic `GameSession` are implemented. The normal entry initializes through the production source; New Game uses the retained session, preserving positions on observation and advancing one revision per activation, including repeated layouts. The UI waits for the latest rendered revision before publishing matching summary/status text; failed replacements retain the previous setup and revision. The test-only fixture accepts scripted values before initialization and provides lifecycle hooks only on the fixture route.

T035 browser regressions cover redraw/resize/scene restart with zero additional draws and teardown/remount with one canvas and one active button handler. `GameSetupScene` now keeps the current revision across scene recreation. Corner-pair browser coverage also exercises both zone extremes and a shared column. These browser cases, the eight US2 browser cases, and the three US1 browser cases remain unexecuted because Chromium exits before page startup with `libnspr4.so` missing; no browser behavioral red or screenshot review is claimed.

### US2 final validation snapshot

| Check              | Exact command / procedure                                           | Observed result                                                                                                                             |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests         | `npm test`                                                          | Passed: 5 test files, 49 tests.                                                                                                             |
| Type check         | `npm run typecheck`                                                 | Passed.                                                                                                                                     |
| Lint               | `npm run lint`                                                      | Passed with zero warnings.                                                                                                                  |
| Format             | `npm run format:check`                                              | Passed.                                                                                                                                     |
| Production build   | `npm run build`                                                     | Passed; Vite emitted the static page and bundled assets, with its existing >500 kB Phaser chunk warning.                                    |
| Full browser suite | `npm run test:e2e`                                                  | Blocked before all 11 tests could launch because Playwright Chromium cannot load `libnspr4.so`. This does not establish behavior pass/fail. |
| Development smoke  | `npm run dev`; HTTP GET `/` and `/src/main.ts`                      | Both returned HTTP 200.                                                                                                                     |
| Fixture smoke      | `npm run test:server`; HTTP GET fixture HTML and `browser-entry.ts` | Both returned HTTP 200 in test mode.                                                                                                        |
| Preview smoke      | `npm run preview`; HTTP GET `/`                                     | Returned HTTP 200. `dist/index.html` references only the production bundle; no fixture entry/reference was found in production assets.      |

Normal entry no longer calls `createSuppliedSetup`; `src/main.ts` mounts `GameApplication` with its default production `MathRandomSource`. Canvas output, keyboard/pointer behavior, WebGL failure recovery, browser lifecycle checks, and final acceptance walkthrough remain unverified until the Chromium runtime dependencies are available.

## Manual outcomes

- Five-player identification check (SC-004): pending; no participant results have been collected.
- Firefox and Safari smoke checks: pending.
- Keyboard and assistive-technology review: pending.
- Initial-ready and resize observations: pending.
- Chromium runtime dependencies: pending; installed browser binary cannot launch due missing system shared libraries.

## Architecture exceptions and review

- Planned exception: `GameSetupScene` extends `Phaser.Scene` solely to integrate Phaser's required scene lifecycle. Gameplay/domain behavior remains composed and framework independent. Confirm at T017 and T038.
- Constitution review: pending implementation and T038.
