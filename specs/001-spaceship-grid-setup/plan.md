# Implementation Plan: Spaceship Grid Setup

**Branch**: `redo` | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-spaceship-grid-setup/spec.md` and the user's required TypeScript/Node/npm/Phaser 4+/Vite stack.

**Feature resolution**: Setup returned feature identifier `001-spaceship-grid-setup`; `git branch --show-current` reports `redo`. Feature paths resolve through `.specify/feature.json` independently of the branch.

## Summary

Build a browser-first game showing a 10 × 10 board and two single-square, distinguishable ships. Each new game independently selects Ship 1 from rows 1–2 and Ship 2 from rows 9–10. Keep the selected layout in memory, separate from Phaser rendering, so observation and resizing never reroll positions. Initialize on page entry and offer a native New Game button plus a visible ship-position summary.

Use strict TypeScript classes and composed collaborators within one game-setup feature. Vite supplies the development server and static production bundle; Node runs development tools, not browser gameplay. Deterministic Vitest tests protect placement and session behavior; Playwright checks browser wiring and actual canvas output.

## Technical Context

**Language/Version**: TypeScript 6.0.3, strict mode; ESM, bundler module resolution, DOM libraries, isolated modules, no emit. Use validated domain values, readonly state, and type-only imports.

**Runtime/Package Management**: Node.js 24.22.0 LTS pinned in `.nvmrc`, managed with nvm; bundled npm 11.19.1. Record Node 24.x and npm 11.x in package metadata; commit `package-lock.json` and use `npm ci` for repeat installs.

**Primary Dependencies**: Phaser 4.2.1; Vite 8.3.4; ESLint 10.12.0 with typescript-eslint 8.71.2, Prettier 3.9.10, eslint-config-prettier 10.1.8. Phaser ships its own types. Pin initial direct dependency versions; lock transitive versions.

**Storage**: One current setup in browser memory. Reload initializes a new game; no persistence or backend.

**Testing**: Vitest 5.0.5 in Node for domain/geometry tests; Playwright Test 1.64.1 in Chromium for browser integration and deterministic visual checks. Type-check application, tests, and configuration separately from Vite transpilation.

**Target Platform**: Current stable desktop Chrome, Firefox, and Safari with WebGL enabled. Chromium is the automated acceptance baseline; Firefox/Safari receive manual smoke checks. Responsive layout down to a 360 CSS-pixel-wide viewport.

**Project Type**: Single browser game, statically bundled, with a Node-powered development toolchain.

**Performance Goals**: Engineering targets: ready board within 2 seconds after navigation on local serving; New Game reflected within 100 ms on a warmed page. Record browser, viewport, and machine when measuring. No animation, load test, or multiplayer throughput requirement for this static 100-cell board.

**Constraints**: `npm run dev` must serve a visitable browser page. Use Phaser 4 WebGL rendering and FIT scaling of a fixed square logical board. Use generated graphics/text with no external assets. Identify ships by text or shape as well as color. Preserve native keyboard controls and accessible position text. Show an explanatory message if WebGL cannot initialize rather than leaving a blank page.

**Scale/Scope**: One page, one active session, one Phaser Game, one board scene, 100 squares, two ships. No movement, combat, networking, accounts, persistence, or configurable board dimensions.

## Constitution Check

*Gate evaluated before Phase 0 and re-evaluated after Phase 1. PASS denotes design compliance; implementation evidence is collected during development.*

| Principle / gate | Pre-research | Post-design evidence |
|------------------|--------------|----------------------|
| Gameplay feature cohesion | PASS — one owning game-setup boundary | PASS — domain, scene, DOM presentation, and tests live under `src/features/game-setup/`; app code only composes and mounts them. |
| Specific, strong types | PASS — strict TypeScript and validated positions | PASS — ship identity union, validated position class, fixed named placements, readonly snapshots, explicit RNG contract; Phaser types stay at its adapter boundary. |
| Class-based composition | PASS — classes own state and behavior | PASS — factory, session, view, controls, and random source collaborate by explicit contracts. Only the Phaser scene extends a third-party class, as required by scene integration. |
| Test-driven development | PASS — red–green–refactor required before implementation | PASS — validation design specifies behavior-first tests and exact command/failure/pass evidence. Setup/type errors and missing screenshot baselines do not count as behavioral red. |
| Explicit dependencies and exceptions | PASS — browser/tooling boundary identified | PASS — domain has no Phaser/DOM imports; application composes adapters. No dynamic typing or general-purpose shared containers planned. |

No constitutional violations or amendments are required. The scene inheritance justification must remain documented at its implementation boundary and in review evidence.

## Project Structure

### Documentation (this feature)

```text
specs/001-spaceship-grid-setup/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── browser-ui.md
└── checklists/
    └── requirements.md
```

`tasks.md` is produced later by `/speckit.tasks`. Implementation adds a feature-local development/review record for red–green–refactor evidence.

### Source Code (repository root; planned)

```text
.nvmrc
package.json
package-lock.json
index.html
tsconfig.json
eslint.config.js
.prettierrc.json
.prettierignore
vite.config.ts
vitest.config.ts
playwright.config.ts
src/
├── main.ts
├── vite-env.d.ts
├── app/
│   ├── GameApplication.ts
│   └── styles.css
└── features/
    └── game-setup/
        ├── domain/
        │   ├── BoardPosition.ts
        │   ├── GameSetup.ts
        │   ├── GameSetupFactory.ts
        │   ├── GameSession.ts
        │   └── RandomSource.ts
        ├── adapters/
        │   └── MathRandomSource.ts
        ├── presentation/
        │   ├── BoardGeometry.ts
        │   ├── BoardView.ts
        │   ├── GameSetupScene.ts
        │   └── GameSetupControls.ts
        └── tests/
            ├── placement.test.ts
            ├── session.test.ts
            ├── geometry.test.ts
            ├── game-setup.spec.ts
            ├── fixtures/
            │   ├── ScriptedRandomSource.ts
            │   └── browser-entry.ts
            └── __screenshots__/
```

**Structure Decision**: One Vite application. Feature-local technical subdivisions preserve gameplay cohesion; `src/app/` owns only application lifecycle, composition, and page layout. A development-only Vite fixture entry mounts the same application with a scripted RNG for browser tests; it is excluded from production output. Unit and browser test discovery patterns must be disjoint. No backend or shared feature abstraction is needed.

## Phase 0 — Research Outcomes

See [research.md](research.md) for verified package compatibility, source references, and alternatives. All technical unknowns are resolved: Phaser 4 is available, Node 24 LTS satisfies tool requirements, TypeScript 6.0 fits the lint support window, and separate unit/browser tests cover domain and WebGL behavior.

## Phase 1 — Design and Validation

- [data-model.md](data-model.md): validated one-based positions; complete immutable setup; session revision; independent uniform sampling and lifecycle rules.
- [contracts/browser-ui.md](contracts/browser-ui.md): page entry, New Game, readable positions, scaling, failures, readiness, and npm script contract.
- [quickstart.md](quickstart.md): intended setup/run commands, red–green–refactor evidence, deterministic acceptance coverage, browser checks, and usability validation.

Phaser renders state supplied by `GameSession`; it does not generate starting positions. `GameApplication` creates collaborators once, routes New Game through the session, and disposes owned resources on teardown/HMR. Rendering readiness is reported only after the current revision has been drawn. Resize scales the view without modifying the setup.

Validation covers all FR-001–FR-009 and SC-001–SC-005. Scripted sequences make placement checks repeatable; equal-width bucket mapping and source-contract review support the probability requirement. The 4-of-5 player identification outcome remains a real usability check. Final implementation checks include type-check, lint, format check, unit tests, production build, and browser tests.

## Complexity Tracking

No constitution violations identified. The only inheritance is `GameSetupScene extends Phaser.Scene`, justified by third-party lifecycle integration; all gameplay behavior uses composition.
