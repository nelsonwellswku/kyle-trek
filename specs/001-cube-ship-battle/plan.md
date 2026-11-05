# Implementation Plan: Three-Dimensional Ship Battle

**Branch**: `something-crazier` (checked out; setup script reports `001-cube-ship-battle`) | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

## Summary

Build a local two-player 5 × 5 × 5 ship battle as a Python desktop application. Use uv for environments and dependencies, Ursina for 3D rendering and interaction, and pytest for automated verification. Keep rules and action lifecycles independent of rendering; provide a depth-layer inspection mode so every cell remains directly selectable. The README must describe the Python workflow and accurately distinguish planned commands from implemented functionality.

## Technical Context

**Language/Version**: Python 3.12

**Primary Dependencies**: Ursina 3D engine; uv for package and environment management

**Storage**: In-memory battle state only; no saves

**Testing**: pytest, with deterministic injected random sources and presentation fakes; interactive graphical acceptance on a supported display

**Target Platform**: Desktop Linux initially, with a working graphical display and compatible 3D graphics; other platforms are not acceptance targets

**Project Type**: Local desktop game

**Performance Goals**: Legal destinations within 300 ms; movement and attack resolution each within 1.5 s under normal supported display conditions

**Constraints**: Offline local play; 125 directly inspectable/selectable cells; collision-safe in-cube movement; nonblocking animation; failure and restart safety; TDD evidence required

**Scale/Scope**: One battle, two ships, 125 cells, two local players; no networking, persistence or AI

## Constitution Check

| Gate | Before research | After design |
|------|-----------------|--------------|
| Gameplay feature cohesion | PASS: battle, movement, combat and inspection own their rules, interfaces and tests. | PASS: boundaries and dependencies below preserve feature ownership. |
| Specific strong types | PASS: typed coordinates, phases, actions, results and random interfaces. | PASS: engine dynamic values are converted and validated at the presentation boundary. |
| Class-based composition | PASS: focused classes collaborate via contracts; no project inheritance planned. | PASS: engine integration uses composition; required engine inheritance, if any, must document third-party compatibility. |
| Test-driven development | PASS: behavioral red-green-refactor required for every increment. | PASS: quickstart requires recorded meaningful red and green results, plus graphical acceptance. |
| Explicit boundaries and review | PASS: dependencies listed below; no generic shared container. | PASS: review each boundary, type exception and inheritance justification before acceptance. |

No constitution exceptions are planned; an uncorrected violation blocks acceptance and requires the constitution's amendment process.

## Project Structure

### Documentation

```text
specs/001-cube-ship-battle/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
└── quickstart.md
```

### Proposed source layout

```text
pyproject.toml             # uv-managed project and pytest configuration
uv.lock                    # committed resolved dependencies
src/kyle_trek/
├── __main__.py            # application entry and composition root
├── battle/                # state, setup, turn lifecycle and feature tests
├── movement/              # reachability, flight planning and feature tests
├── combat/                # rolls, outcomes, effects and feature tests
└── inspection/            # cube, camera, depth selection and feature tests
tests/integration/         # cross-feature lifecycle and engine integration
```

Feature tests are colocated with their features and configured for pytest discovery. `battle` owns state and typed interfaces; movement and combat depend on those interfaces, not on the renderer. Inspection and presentation adapt domain state to Ursina; the composition root wires collaborators. Share only purpose-specific contracts with multiple consumers. The source layout is proposed, not yet implemented.

## Complexity Tracking

No exceptions or constitution violations are proposed.
