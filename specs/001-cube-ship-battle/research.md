# Phase 0 Research

## Engine, language and dependencies

**Decision**: Use Python 3.12 and the `ursina` package (the requested "ursine" refers to [Ursina](https://www.ursinaengine.org/)), managed as a packaged project by uv, with pytest as a development dependency. Record exact resolved dependencies in `uv.lock` rather than asserting an unverified installed version.

**Rationale**: [Ursina's package metadata](https://pypi.org/pypi/ursina/json) and [installation guide](https://www.ursinaengine.org/installation.html) require Python 3.12 or newer; it provides a Python scene graph, input, collision and animation facilities. [uv](https://docs.astral.sh/uv/concepts/projects/dependencies/) manages the environment, dependencies and lock. pytest supports isolated rule tests without starting an engine window.

**Alternatives considered**: Browser/Node implementation conflicts with the requested Python stack; direct Panda3D adds lower-level integration work; other Python versions do not satisfy the current engine's minimum.

## Structure and verification

**Decision**: Use a Python `src` layout with cohesive class-based gameplay features, colocated pytest tests, separate integration tests, and pytest `--import-mode=importlib`. Install the project with `uv sync`; run with `uv run python -m kyle_trek` and test with `uv run pytest` after implementation.

**Rationale**: [pytest's integration guidance](https://docs.pytest.org/en/stable/explanation/goodpractices.html) recommends src layout and importlib mode for new projects. Independent domain and presentation collaborators enable meaningful TDD and headless tests while interactive tests check actual visuals.

**Alternatives considered**: A technical-layer-first layout violates feature cohesion; testing exclusively through the 3D window is slower and cannot reliably cover boundary states or failures.

## Inspection and movement

**Decision**: Model bounded cells with validated integer coordinates and compute legal movement using breadth-first search avoiding the occupied cell. Present an orbitable cube plus an explicit selectable depth layer to reveal and target interior cells; map engine picking to domain coordinates at the adapter. Use direct continuous flight if visual envelopes remain clear; otherwise plan a shortest feasible collision-free in-bounds visual path independently of movement cost.

**Failure policy**: A committed legal move survives presentation launch failure, playback failure or timeout: remove transient flight effects, visibly place the ship at the committed destination without an unsafe intermediate flight, show an error and enter attack-choice once within the original 1.5-second deadline (FR-024). Restart or disposal instead invalidates and discards the pending move. Completion, failure and timeout use the same generation/action guard.

**Rationale**: Breadth-first search exactly matches unweighted face-adjacent reachability on 125 cells. Layer selection removes occlusion ambiguity. Ursina supports [colliders, mouse picking and raycasts](https://www.ursinaengine.org/collision.html). Collision geometry must include full ship envelopes, not merely centers; engine vectors stay at the adapter boundary.

**Alternatives considered**: Pure ray picking through a dense cube cannot guarantee direct access to hidden cells; Manhattan distance alone ignores obstacles; forcing rendered flight along face-adjacent routes when a direct path is clear conflicts with the spec.

## Combat, timing and interruptions

**Decision**: Roll once at launch using an injected gameplay random source, reserve a separately injected visual random source for miss geometry, and apply the stored outcome once on successful presentation or failure. Use a monotonic deadline and generation/action tokens for completion, failure, restart and disposal; keep presentations nonblocking. Construct miss paths in screen space using the sampled initial angle and side, accounting for the full star and defender projection; adapt camera/framing or path as necessary while preserving the maximum deviation and screen-clearance requirements. Validate boundary cases on the real display.

Camera orbit remains available during effects. Revalidate hit contact and miss geometry against the current projection on view changes, without resampling the miss angle/side. Reproject or reframe when feasible; otherwise report presentation failure and resolve the stored outcome within the original deadline. Reserve cleanup and fallback time rather than waiting until the deadline has elapsed. Headless tests and graphical checks must include camera changes just after launch and before closest approach, depth-aligned ships and screen-edge defenders.

Performance acceptance requires a documented, maintainer-approved Linux reference environment and individual monotonic wall-clock measurements through rendered/selectable highlights, visible movement arrival plus attack-choice availability, and displayed attack results plus next-turn availability or victory. Record actual environment values and the measurement method in `development.md`; averages and fake-clock tests alone are insufficient. See [plan.md](plan.md#presentation-recovery-and-performance-acceptance) for the protocol.

**Rationale**: Separating streams prevents effects from perturbing game rolls, tokens prevent stale or duplicate callbacks from mutating a new game, and fallback resolves failures without rerolling. Precomputing and validating geometry plus a deadline-aware fallback gives a testable path to the specified edge, timing and failure requirements; graphical acceptance is still required, not assumed.

**Alternatives considered**: Applying damage immediately violates explosion-before-damage; rerolling on presentation failure breaks fairness; trusting animation callback cancellation alone permits stale or duplicate resolutions.

## Platform

**Decision**: Target a local Linux desktop with a graphical display first; keep rules independently testable without one. No persistence, networking or AI.

**Rationale**: The feature is a local interactive 3D game, and this environment is Linux; broad cross-platform support is not specified and would expand acceptance scope.

**Alternatives considered**: Headless-only operation cannot verify real rendering and picking; promising untested platforms exceeds the feature scope.
