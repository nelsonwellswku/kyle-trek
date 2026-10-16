# Development and Review Record: Spaceship Grid Setup

## Environment

- Runtime: Node.js 24.22.0, npm 11.19.1, selected from `.nvmrc` with nvm.
- Platform: Linux x86_64.
- Browser checks: manual local walkthrough; no automated browser runner is configured.
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

No behavioral red was claimed during toolchain setup. An empty suite or missing behavior test is not acceptance evidence.

## Test-driven behavior evidence

For each behavior task, record the test name, exact command, expected behavioral failure, observed failure, green result, and post-refactor rerun here. Setup, compilation, dependency, and server failures do not count as behavioral red.

### US1 domain and geometry

| Task / test                      | Exact command                                                  | Expected behavioral red                                                                                                            | Observed red and green/refactor result                                                                                                                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T011 BoardPosition and GameSetup | `npm test -- src/features/game-setup/tests/setup.test.ts`      | Missing coordinate validation/value equality/immutability and complete immutable setup should fail assertions.                     | Red: 14 tests failed against the deliberate unimplemented behavior scaffolds. Green: after T014 and T015, the same command passed all 14 tests. T014's focused run `npm test -- src/features/game-setup/tests/setup.test.ts -t BoardPosition` passed 11 tests (3 GameSetup tests skipped). |
| T012 BoardGeometry               | `npm test -- src/features/game-setup/tests/geometry.test.ts`   | Missing square-cell bounds, orientation, centers, and marker bounds should fail assertions.                                        | Red: all 4 tests failed when geometry methods were unimplemented. The first implementation rerun exposed a runtime import error; after correcting the runtime `BoardPosition` import, the same command passed all 4 tests.                                                                 |
| T017 BoardView rendering handoff | `npm test -- src/features/game-setup/tests/board-view.test.ts` | The composed view should draw 22 grid lines, 2 labeled ship markers, and publish revision 1 only after the game post-render event. | Red: the first assertion observed 0 grid-line calls against the no-op scaffold. Green: after Phaser Graphics/Text composition and post-render readiness wiring, the same command passed. `npm run typecheck` and `npm run lint` also passed after the scene adapter was added.             |

### US1 presentation and manual browser checks

T013's manual checks cover initial entry, accessible summaries, ready state, stable positions, narrow layout, and the startup fallback. They have not yet been conducted.

The US1 application, controls, responsive styles, Phaser scene, and startup-error handling have been implemented. Static and HTTP checks completed:

| Check               | Exact command                                           | Observed result                                                                                                   |
| ------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Type check          | `npm run typecheck`                                     | Passed after application/presentation integration.                                                                |
| Lint                | `npm run lint`                                          | Passed with zero warnings.                                                                                        |
| Format              | `npm run format:check`                                  | Passed.                                                                                                           |
| Unit tests          | `npm test`                                              | 3 test files passed, 19 tests passed.                                                                             |
| Production build    | `npm run build`                                         | Passed; emitted `dist/index.html` and JS/CSS assets. Vite reported the Phaser-containing JS chunk exceeds 500 kB. |
| Development serving | `npm run dev` plus HTTP GETs for `/` and `/src/main.ts` | Both returned HTTP 200.                                                                                           |
| Production preview  | `npm run preview` plus HTTP GET `/`                     | Returned HTTP 200. `dist/` contains only `index.html` and bundled assets.                                         |

At this checkpoint, normal entry used the explicit fixed layout and New Game was disabled pending US2. US2 integration below replaces that composition. Manual checks of the mobile fit, accessibility association, initialization failure state, and rendered-revision readiness remain pending.

### US2 placement and session

| Task / test                                  | Exact command                                                 | Expected behavioral red                                                                                                                               | Observed red and green/refactor result                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T024 random placement and production adapter | `npm test -- src/features/game-setup/tests/placement.test.ts` | Bucket mappings, eligible pairs, invalid-output rejection, draw counts, and production-source range checks should fail against the throwing scaffold. | Red: 25 tests failed on the deliberate `GameSetupFactory`, `MathRandomSource` scaffolds. Green: the same command passed all 25 tests after the adapter/factory implementation. After adding the T033 structure/reachability cases, the post-refactor command passed all 27 tests. `npm run typecheck` and `npm run lint` passed.                                                       |
| T025 retained session and revision           | `npm test -- src/features/game-setup/tests/session.test.ts`   | Initial state, fresh replacement, repeat acceptance, stable reads, and atomic failure/recovery should fail against the throwing session scaffold.     | Red: all 3 tests failed against the scaffold. An initial green run exposed two incorrectly specified test vectors (not implementation defects); after correcting the expected bucket coordinates and failure sequence, the same command passed all 3 tests and passed again after formatting/refactor. `npm run typecheck` passed.                                                     |
| T026 manual New Game checks                  | Local browser walkthrough                                     | Verify pointer/keyboard activation, focus retention, ready state, failure/recovery, and resize stability.                                             | Pending; these interactions have not been manually verified.                                                                                                                                                                                                                                                                                                                           |
| T033 deterministic coverage                  | `npm test -- src/features/game-setup/tests/placement.test.ts` | 100 complete setups should satisfy structure invariants, and 1,000 scripted setups should cover all 20 positions for both ships.                      | Added the 100-setup structure and 1,000-setup zone/reachability checks. The final focused command passed all 27 placement and production-adapter tests. `floor(value × 20)` partitions the half-open source interval into 20 equal-width buckets; `MathRandomSource.next()` makes one independent `Math.random()` call. Reachability tests do not claim statistical proof of fairness. |

### US2 application integration

The production `MathRandomSource`, validated row-major `GameSetupFactory`, and atomic `GameSession` are implemented. The normal entry initializes through the production source; New Game uses the retained session, preserving positions on observation and advancing one revision per activation, including repeated layouts. The UI waits for the latest rendered revision before publishing matching summary/status text; failed replacements retain the previous setup and revision. Unit tests inject scripted values through the typed random-source contract.

`GameSetupScene` keeps the current revision across scene recreation. Manual checks of redraw/resize stability, New Game interaction, and application lifecycle remain pending; unit-level placement and session coverage is recorded above.

### US2 final validation snapshot

| Check             | Exact command / procedure                      | Observed result                                                                                          |
| ----------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Unit tests        | `npm test`                                     | Passed: 5 test files, 49 tests.                                                                          |
| Type check        | `npm run typecheck`                            | Passed.                                                                                                  |
| Lint              | `npm run lint`                                 | Passed with zero warnings.                                                                               |
| Format            | `npm run format:check`                         | Passed.                                                                                                  |
| Production build  | `npm run build`                                | Passed; Vite emitted the static page and bundled assets, with its existing >500 kB Phaser chunk warning. |
| Development smoke | `npm run dev`; HTTP GET `/` and `/src/main.ts` | Both returned HTTP 200.                                                                                  |
| Preview smoke     | `npm run preview`; HTTP GET `/`                | Returned HTTP 200. `dist/` contains the production index and assets.                                     |

Normal entry no longer calls `createSuppliedSetup`; `src/main.ts` mounts `GameApplication` with its default production `MathRandomSource`. Canvas output, keyboard/pointer behavior, WebGL failure recovery, browser lifecycle checks, and final acceptance walkthrough remain unverified pending manual review.

## Manual outcomes

- Five-player identification check (SC-004): pending; no participant results have been collected.
- Firefox and Safari smoke checks: pending.
- Keyboard and assistive-technology review: pending.
- Initial-ready and resize observations: pending.
- Manual browser walkthrough: pending.

## Architecture exceptions and review

- Planned exception: `GameSetupScene` extends `Phaser.Scene` solely to integrate Phaser's required scene lifecycle. Gameplay/domain behavior remains composed and framework independent. Confirm at T017 and T038.
- Constitution review: completed at T038; findings recorded below.

## Polish and final acceptance (2026-10-16)

### T037 — Developer README

Created root `README.md` with Node/npm prerequisites, `nvm install` / `nvm use`, `npm ci`, development and production URLs, build/preview commands, quality checks, WebGL requirement, browser execution, and the setup-only scope. Its commands match `package.json`.

### T038 — Constitution and architecture review

- **Feature cohesion and dependency direction: PASS.** Domain classes remain in `src/features/game-setup/domain/`, presentation and tests remain feature-local, and `src/app/GameApplication.ts` composes the feature. Domain modules have no Phaser, DOM, or app-layer imports; `GameApplication` is the browser/framework composition boundary.
- **Types and composition: PASS.** Validated `BoardPosition`, named immutable placements, `GameSetup`, `RandomSource`, factory, and session express the domain invariants. Application, controls, view, and session collaborate through focused collaborators.
- **Scene inheritance: PASS.** `GameSetupScene` documents that extending `Phaser.Scene` is required for Phaser lifecycle integration and delegates drawing to `BoardView`.
- **Application entry: PASS.** Vite serves only the normal application entry; deterministic random-source injection remains available to unit tests.
- **TDD evidence: PARTIAL.** Domain/value, geometry, view, placement, and session red/green results are recorded above. Manual browser and visual checks remain unverified. No code defect was evidenced in this review, so no implementation change was warranted.
- **Outcome:** No architecture correction identified. Manual browser verification remains pending, not a claimed pass.

### T039 — Five-player identification

No first-time participant group is available in this execution environment, so the five-player check was not conducted and no timing/correctness observations were collected. **SC-004 remains pending**; no usability pass is claimed.

### T040 — Browser, accessibility, and performance checks

| Check                           | Exact probe / environment               | Observed result                                                                           |
| ------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Keyboard / screen reader        | Browser and assistive-technology review | Not conducted; native-button keyboard behavior and screen-reader behavior remain pending. |
| Initial-ready / New Game timing | Drawn-revision browser timing           | Not measured. The ≤2 s initial-ready and ≤100 ms warmed New Game targets remain pending.  |

Firefox/Safari smoke checks, assistive-technology review, and performance measurements remain pending; no unavailable check is inferred to pass.

### T041 — Final automated validation

The quickstart commands were reconciled with `package.json`. This environment did not provide `nvm`; final commands ran under Node.js v24.12.0 and npm 11.12.1 rather than the pinned Node.js v24.22.0 / npm 11.19.1.

| Exact command                                                                 | Observed result                                                                                                                              |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                                      | Passed; installed 136 packages and reported 0 vulnerabilities.                                                                               |
| `npm run typecheck`                                                           | Passed.                                                                                                                                      |
| `npm run lint`                                                                | Passed with zero warnings.                                                                                                                   |
| `npm run format:check`                                                        | Passed for the configured source/configuration/development-record targets.                                                                   |
| `npx prettier --check README.md specs/001-spaceship-grid-setup/quickstart.md` | Passed.                                                                                                                                      |
| `npm test`                                                                    | Passed: 5 files and 49 tests.                                                                                                                |
| `npm run build`                                                               | Passed. Vite emitted `dist/index.html` and bundled assets; the minified JavaScript chunk is 1,384.51 kB and triggers Vite's 500 kB advisory. |

T041 remains incomplete until the final verification commands are rerun and recorded after the tooling changes.

### T042 — Development and production walkthrough

HTTP smoke checks completed using the commands below; they verify serving, not interactive browser behavior.

| Command / request                                             | Observed result         |
| ------------------------------------------------------------- | ----------------------- |
| `npm run dev`; GET `/` and `/src/main.ts` on `127.0.0.1:5173` | Both returned HTTP 200. |
| `npm run preview`; GET `/` on `127.0.0.1:4173`                | Returned HTTP 200.      |

The final manual browser walkthrough has not been conducted; there is no visual, console, pointer/keyboard, resize, failure-state, or duplicate-canvas observation recorded. Acceptance evidence and remaining gaps:

- **FR-001–FR-003:** Geometry, setup, and deterministic structure unit tests pass, including 100-setup structure checks. Actual rendered canvas verification remains pending.
- **FR-004–FR-006:** Factory/adapter tests pass, including all allowed pairings and 1,000-setup zone/reachability checks. Equal-width mapping and separate source draws were reviewed; finite samples are not treated as proof of statistical fairness.
- **FR-007:** Session replacement/revision unit tests pass, including repeat layouts. Pointer/keyboard browser behavior remains unverified.
- **FR-008–FR-009:** Accessible summary/readiness and stable-state behavior are implemented and covered by authored tests; rendered accessibility, resize, and 20-view browser checks remain unverified.
- **SC-001–SC-003:** Deterministic unit coverage passes for 100 setup structures and 1,000 zone/reachability setups.
- **SC-004:** Pending participant study; no result collected.
- **SC-005:** Stable session observations pass at unit level; the required repeated rendered-view/browser observation remains pending.

T042 remains incomplete pending the manual browser walkthrough.

### T043 — Control/application and scene lifecycle regression coverage

Added `src/features/game-setup/tests/game-application.test.ts` for startup failure fallback, readiness gating, canvas description association, native New Game routing, failed replacement retention/recovery, stale readiness, and application disposal. Added `src/features/game-setup/tests/scene-lifecycle.test.ts` for setup/revision preservation across redraw and scene shutdown/recreation, including zero additional placement draws and cleanup of post-render listeners.

- Focused behavior tests: `npm test -- src/features/game-setup/tests/game-application.test.ts src/features/game-setup/tests/scene-lifecycle.test.ts` — passed: 2 files, 5 tests.
- Full unit suite: `npm test` — passed: 7 files, 54 tests.
- Type check: `npm run typecheck` — passed.
- Lint: `npm run lint` — passed with zero warnings.
- Format check: `npm run format:check` — passed.

The tests were added against the existing implementation, which already satisfied these behaviors; their first behavioral run was green. No behavioral red was observed, so no runtime code was changed and no failure was manufactured. Initial type/lint/format issues were limited to the new test harness and were corrected before the final checks; they were not counted as behavioral red. This coverage addition required no implementation/refactor cycle. Browser rendering, real keyboard/focus behavior, and visual failure handling remain subject to the manual checks in T044.

### T023, T036, T041 — Final automated and serving verification

Environment: Node.js v24.12.0 and npm 11.12.1 (within the package's supported Node 24/npm 11 ranges; different from the pinned quickstart versions).

- `npm ci` — passed; installed 133 packages, audited 134, and reported 0 vulnerabilities.
- `npm run typecheck` — passed.
- `npm run lint` — passed with zero warnings.
- `npm run format:check` — passed.
- `npm test` — passed: 7 files, 54 tests.
- `npm run build` — passed; emitted `dist/index.html` and bundled assets. Vite reported the existing advisory for the 1,384.51 kB JavaScript chunk.
- `npm run dev`; GET `/` and `/src/main.ts` — both returned HTTP 200.
- `npm run preview`; GET `/` — returned HTTP 200.

These commands verify build and serving, not interactive browser behavior. The visual walkthrough, narrow-screen/focus inspection, Firefox/Safari and assistive-technology checks, performance measurements, and five-player study remain pending under T013/T021/T022/T039/T040/T042/T044–T046.
