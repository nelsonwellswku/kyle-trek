# Research: Spaceship Grid Setup

**Date**: 2026-10-15
**Status**: Complete; no unresolved technical clarifications.

## 1. Runtime and tooling baseline

**Decision**: Pin Node 24.22.0 LTS with `.nvmrc`; use its bundled npm 11.19.1. Use Vite 8.3.4, TypeScript 6.0.3, ESLint 10.12.0, typescript-eslint 8.71.2, Prettier 3.9.10, and eslint-config-prettier 10.1.8. Commit the npm lockfile during implementation.

**Rationale**: Node 24 is the current LTS; Vite supports Node `^20.19.0 || >=22.12.0`. typescript-eslint currently supports TypeScript `>=4.8.4 <6.1.0` and ESLint 10, so TypeScript 6.0.3 is a supported baseline. Vite transpiles but does not type-check: require `tsc --noEmit`. Separate ESLint quality rules from Prettier formatting rules. Use strict typing and ESM throughout.

**Alternatives considered**: Node Current adds no benefit for this board; TypeScript 7 is outside the published linter support window. Another package manager would contradict the requested npm workflow. A UI framework is unnecessary for one canvas and native controls.

**Sources**:
- [Node 24.22.0 LTS, including bundled npm](https://nodejs.org/en/blog/release/v24.22.0)
- [nvm project and `.nvmrc`](https://github.com/nvm-sh/nvm#nvmrc)
- [Vite 8.3.4 package/engines](https://registry.npmjs.org/vite/8.3.4)
- [Vite TypeScript guidance](https://vite.dev/guide/features#typescript)
- [typescript-eslint support matrix](https://typescript-eslint.io/users/dependency-versions/)
- [Prettier/linter integration](https://prettier.io/docs/integrating-with-linters)

The current shell reports Node 24.12.0 and npm 11.12.1; the implementation quickstart selects the planned version through nvm. Versions above were researched, not installed or build-tested during planning.

## 2. Phaser 4 browser rendering

**Decision**: Use the stable `phaser@4.2.1` package, its ESM entry and bundled TypeScript definitions. Render with WebGL using generated board graphics and labeled ship markers. Use one thin scene subclass with composed board geometry/view collaborators. Scale a fixed logical square board with FIT and centering.

**Rationale**: Phaser 4 is published and supports the requested browser stack. Its renderer uses Render Nodes rather than Phaser 3 pipelines. A static board needs no advanced effects or external assets. FIT keeps cells square without changing domain positions. The scene subclass exists solely to integrate Phaser lifecycle callbacks; the domain stays framework independent.

**Alternatives considered**: Phaser 3 violates the version constraint. Phaser 4 Canvas rendering is deprecated. Raw WebGL and custom render nodes add no value here. RESIZE requires layout recalculation that FIT avoids. The official Vite/TypeScript template is a useful structure reference but its dependency pins lag the verified baseline.

**Sources**:
- [Phaser 4.2.1 package, exports and types](https://registry.npmjs.org/phaser/4.2.1)
- [Phaser 4 migration guide](https://github.com/phaserjs/phaser/blob/v4.2.1/changelog/v4/4.0/MIGRATION-GUIDE.md)
- [Official Vite/TypeScript template](https://github.com/phaserjs/template-vite-ts)
- [Scale manager](https://docs.phaser.io/phaser/concepts/scale-manager)
- [Scene lifecycle](https://docs.phaser.io/phaser/concepts/scenes#scene-life-cycle)

## 3. State ownership and random placement

**Decision**: A `GameSession` retains one complete readonly setup. A `GameSetupFactory` consumes two separate random values, one per ship, from an injected `RandomSource`. Map each value in `[0, 1)` to one of 20 equal-width buckets, then to the corresponding row-major square in its zone. The production source wraps `Math.random`; tests inject a scripted class.

**Rationale**: Each bucket has probability 1/20 under the source's uniformity contract; independent draws allow all 400 ship pairs, including matching columns. Disjoint zones prevent overlap without retries. Session ownership prevents render, scene recreation, or resize from changing positions. Named Ship 1/Ship 2 fields prevent incomplete or duplicate-identity collections.

**Alternatives considered**: Separate row/column draws are valid but require four draws and more boundary cases. Collision retries are unnecessary and could bias the permitted layouts. Persistence, seeded player-facing configuration, and a generic state framework exceed this feature's needs.

**Source**: [Math.random range and approximate uniformity](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random). This game does not need cryptographic randomness. Finite pseudorandom samples cannot prove exact statistical fairness; validate mapping and adapter usage separately.

## 4. Interaction and accessible presentation

**Decision**: Start a game automatically on page entry; New Game explicitly replaces both placements. Use a native button, visible dimensions/coordinate explanation, and two visible DOM position summaries associated with the canvas. Distinguish ships through labels or shapes beyond color. Preserve focus and announce a monotonically increasing game revision even when layouts repeat.

**Rationale**: This is the smallest complete setup flow. Canvas alone has no semantic per-ship elements. A summary makes positions accessible and supplies meaningful browser assertions; visual verification separately proves canvas correctness. A narrow responsive page is useful without introducing a second mobile-specific interface.

**Alternatives considered**: A start screen adds a step without gameplay value. Canvas-only buttons add avoidable keyboard/accessibility work. An interactive 100-cell DOM grid would imply board interactions absent from the spec.

**Source**: [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing).

## 5. Test strategy and evidence

**Decision**: Vitest 5.0.5 in Node for domain and geometry; Playwright Test 1.64.1 for the real Vite-served application. Use scripted bucket midpoints, endpoints, representative internal boundaries, all 400 pairings, invalid source outputs, stable observation, fresh setup, and allowed repeated layouts. Use a small reviewed deterministic screenshot baseline for the actual board plus semantic browser assertions. Serve a test-only composition entry to inject the RNG before mounting; production uses only the normal entry.

**Rationale**: Vitest 5 supports Vite 8 and Node 24. Browser tests exercise actual WebGL, input, resize, and rendering; DOM emulation cannot establish canvas output. Deterministic tests protect behavior without depending on chance. A 1,000-setup controlled sequence can satisfy reachability/invariant acceptance checks without imposing a flaky random-frequency gate. Manual player checks retain SC-004's real user outcome.

**Alternatives considered**: Globally mocking `Math.random` lets Phaser consume scripted draws. Requiring consecutive games to differ contradicts the spec. Browser-only testing slows exhaustive domain coverage. Adding Vitest Browser Mode would duplicate the focused Playwright suite at this stage.

**Sources**:
- [Vitest 5.0.5 peer dependencies and engines](https://registry.npmjs.org/vitest/5.0.5)
- [Playwright Test 1.64.1](https://registry.npmjs.org/@playwright/test/1.64.1)
- [Vitest environments](https://vitest.dev/guide/environment)
- [Playwright server lifecycle](https://playwright.dev/docs/test-webserver)
- [Retrying assertions](https://playwright.dev/docs/test-assertions)
- [Visual comparisons](https://playwright.dev/docs/test-snapshots)

For each implementation slice, record the behavior test failing before implementation, then passing, then passing after refactoring. A compilation/setup failure or absent screenshot baseline is not valid behavioral red evidence.
