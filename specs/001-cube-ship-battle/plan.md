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

**Performance Goals**: Rendered/selectable legal destinations within 300 ms; movement arrival and attack-choice availability within 1.5 s of accepted selection; attack result and next-turn availability or victory within 1.5 s of launch, on the documented Linux reference environment

**Constraints**: Offline local play; 125 directly inspectable/selectable cells; collision-safe in-cube movement; nonblocking animation; failure and restart safety; TDD evidence required

**Scale/Scope**: One battle, two ships, 125 cells, two local players; no networking, persistence or AI

## Presentation Recovery and Performance Acceptance

Movement commits one legal destination before starting presentation. On launch failure, playback failure or timeout, the movement controller removes transient flight effects, visibly places the ship at that destination without an unsafe intermediate flight, shows a readable error and enters attack-or-end-turn once within the original 1.5-second deadline (FR-024). This recovery consumes the movement action. Completion, failure and timeout share the same generation/action guard; restart or disposal invalidates the action before cleanup and discards the pending move instead.

Camera orbit remains available during combat effects. The combat presenter validates hit contact and miss geometry against the current projection and may reproject or reframe the presentation while preserving the sampled miss angle/side, deviation limit and clearance requirements. It must not resample visual randomness or gameplay rolls. If the constraints cannot be maintained, use the existing presentation-failure path and resolve the stored outcome once within the original deadline.

In T004, record the proposed Linux reference environment in `development.md`: CPU, GPU, graphics driver, OS, display resolution, scaling and application window dimensions. Obtain maintainer approval before performance acceptance; missing environment details or approval block that acceptance. Do not invent hardware values or claim unmeasured support. Keep the application visible and unpaused and record the measurement method and each observed duration, not only averages.

Measure monotonic elapsed wall-clock intervals as follows:

- **Highlights**: initial setup or prior-action resolution with gameplay input available through the rendered, selectable complete legal-destination set (≤300 ms).
- **Movement**: accepted legal selection through rendered arrival at the committed coordinate and attack-choice availability, including failure recovery (≤1.5 s).
- **Attack**: launch through displayed outcome and next-turn availability or winner, including presentation failure and camera-driven reprojection (≤1.5 s).

Nonblocking deadline monitors must reserve enough time for cleanup, fallback rendering and state transition within the original deadline; retries, reprojection and failure recovery never restart the clock. Fake-clock tests verify orchestration, while real-display checks establish end-to-end timing.

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
