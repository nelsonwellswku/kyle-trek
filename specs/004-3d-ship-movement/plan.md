# Implementation Plan: Three-Dimensional Ship Movement

**Branch**: `004-3d-ship-movement` | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

**Feature identifier**: `004-3d-ship-movement`. Setup resolves this identifier independently of the repository's current Git branch.

**Input**: Feature specification from `specs/004-3d-ship-movement/spec.md`

## Summary

Replace the live battle's flat 10 × 10 board with a selectable 10 × 10 × 10 cube, three-dimensional movement and ship orientation, and a user-orbitable three-quarter view. Keep `BattleSession` as the sole authority for movement, rotation, combat and turn transitions. Extend the shared board capability to validated cube coordinates, reachability, rendering and picking. Use a separate Three.js WebGL2 canvas for the orbitable cube, with a non-opaque cell-center marker at each of the 1,000 positions so interior cells remain visible and selectable by orbiting; retain Phaser for the existing game/scene lifecycle and DOM HUD. Adapt movement and torpedo effects to the shared 3D scene while preserving their current outcome, cancellation and timing contracts.

## Technical Context

**Language/Version**: TypeScript 6.0.3, strict mode, ES2022; Node 24 and npm 11.

**Primary Dependencies**: Phaser 4.2.1 and Vite 8.3.4; add Three.js 0.186.1 and its `OrbitControls` addon for the cube renderer, orbit camera and ray picking. No external services.

**Storage**: In-memory game snapshots and presentation state; no persistence, backend or schema migration.

**Testing**: Vitest 5.0.5 in Node for domain, geometry, interaction and lifecycle tests; typed renderer/animator doubles; a development-only actual-browser fixture for Three.js, Phaser input, orbit, picking, animation and timing. Existing ESLint, Prettier, TypeScript and Vite build checks remain required.

**Target Platform**: Existing desktop browser game with a mouse; WebGL2-capable browser for Three.js. The Three.js canvas overlays the existing Phaser board host and is independently resized to the same bounds. Phaser retains its own existing WebGL context.

**Project Type**: Single-page client-side web game organized by gameplay feature.

**Performance Goals**: Legal movement choices visible within 300 ms on the 1,000-cell cube; every selected move completes within 1.5 seconds. Reachability is bounded by the existing maximum allowance of five steps, which can reach at most 231 cells in an unobstructed 3D grid. Validate orbiting and marker picking in the reference desktop browser; do not treat mocked renderer timing as visual acceptance.

**Constraints**: Exactly two ships and two local players; 10 valid coordinates on each axis; six face-adjacent movement directions; existing agility allowance and one move per turn; opposing ships block routes; ship rotation is in 90-degree increments around the cube axes and does not change occupancy. Each ship has 200 eligible starting cells in its assigned two Y layers. Camera orientation is presentation-only. A separate Three.js WebGL2 context is required because the current Phaser renderer uses WebGL1 by default.

**Scale/Scope**: 1,000 cell markers, two ships and one active move or combat effect at a time. One bounded reachability search explores no more than 231 cells at the maximum existing allowance. No networking, save state, additional ships, or player-editable stats.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / gate                       | Pre-research gate                                                                                       | Post-design evidence                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gameplay feature cohesion              | PASS: the shared cube is a focused board capability; turn/gameplay state remains in its owning features | `board` owns cube positions, view and picking; setup owns starting placement; movement owns 3D reachability and flight; combat owns the live battle and rotation transitions. The application remains the composition root.                                  |
| Specific, strong types                 | PASS: use validated coordinates, orientation and action identities                                      | `CubePosition`, `CubeOrientation`, readonly cube/game snapshots, six-direction routes and discriminated battle phases keep invalid positions and stale actions out of gameplay state. Three.js objects remain behind presentation adapters.                  |
| Class-based design through composition | PASS: compose the renderer, camera controls, picker and animators through explicit boundaries           | Domain values and `BattleSession` remain independent of Phaser/Three. `CombatScene` continues to extend `Phaser.Scene` only for framework lifecycle compatibility; Three.js renderer and controls are composed collaborators.                                |
| Test-driven development                | PASS as a required implementation workflow                                                              | Each behavior begins with a focused failing test, followed by green/refactor and affected regressions; commands and outcomes belong in the future development record. This plan claims no implementation/test evidence.                                      |
| Explicit dependencies and review       | PASS: dependencies are bounded and acyclic                                                              | `board` exposes typed cube/render boundaries; setup, movement and combat consume them without depending on Three.js internals. `ship-combat` is the live movement/rotation authority. No generic shared service layer or competing turn owner is introduced. |

**Gate result**: PASS before research and after design. The Three.js dependency and second WebGL context are justified by the specified orbiting 3D view and isolate Three's WebGL2 renderer from Phaser's WebGL1 context. No constitution exception or amendment is required.

## Project Structure

### Documentation (this feature)

```text
specs/004-3d-ship-movement/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── cube-ui.md
```

`tasks.md` and `development.md` belong to later task-generation and implementation phases.

### Source Code (repository root)

```text
src/
├── app/
│   ├── GameApplication.ts                    # compose production battle and shared cube view
│   └── styles.css                            # align the Three.js canvas with the Phaser host
└── features/
    ├── board/
    │   ├── domain/
    │   │   ├── CubePosition.ts               # validated x/y/z coordinates
    │   │   ├── CubeOrientation.ts             # renderer-independent cube rotation value
    │   │   └── CubeSnapshot.ts                # canonical board occupancy/dimensions
    │   ├── presentation/
    │   │   ├── ThreeCubeView.ts               # separate WebGL2 canvas, lattice and 1,000 markers
    │   │   ├── CubeOrbitControls.ts            # camera gestures and default perspective
    │   │   └── CubePicker.ts                   # marker/ship raycast to typed targets
    │   └── tests/
    │       ├── cube-position.test.ts
    │       ├── cube-orientation.test.ts
    │       ├── cube-snapshot.test.ts
    │       └── cube-view.test.ts
    ├── game-setup/
    │   ├── domain/GameSetupFactory.ts          # opposing Y-layer placements
    │   └── presentation/GameSetupControls.ts  # 3D coordinate summaries/accessible labels
    ├── ship-movement/
    │   ├── domain/
    │   │   ├── Reachability.ts                # six-neighbor bounded search
    │   │   └── PendingMove.ts                 # typed origin/destination/route identity
    │   ├── presentation/
    │   │   ├── MovementScene.ts                # standalone compatibility scene; not production battle path
    │   │   ├── MovementController.ts            # standalone compatibility controller; cube-typed
    │   │   ├── FlightAnimator.ts                 # standalone compatibility animation contract
    │   │   ├── PhaserFlightAnimator.ts           # standalone compatibility adapter; not production battle path
    │   │   ├── SpaceFlightPath.ts                # standalone compatibility path; cube-typed
    │   │   ├── TurnControls.ts                   # standalone compatibility controls
    │   │   ├── CubeFlightPath.ts               # 3D collision-safe presentation path
    │   │   └── ThreeFlightAnimator.ts          # cancellable Three.js ship flight
    │   └── tests/                              # independent 3D route and flight tests
    └── ship-combat/
        ├── domain/
        │   ├── CombatGame.ts                   # complete battle ships with cube positions/orientations
        │   ├── BattleSession.ts                # sole turn, movement, rotation and combat authority
        │   ├── PendingRotation.ts               # revision/turn/action-bound rotation identity
        │   └── PendingAttack.ts                 # unchanged combat outcome identity
        ├── presentation/
        │   ├── CombatScene.ts                  # Phaser lifecycle adapter and Three view ownership
        │   ├── CombatController.ts              # phase-aware cell/ship/rotation commands
        │   ├── CombatControls.ts                # existing native HUD plus rotation controls
        │   └── ThreeTorpedoAnimator.ts           # camera-aware 3D effects
        └── tests/
            ├── *.test.ts                        # production domain/controller/lifecycle regressions
            └── browser/                         # deterministic real-Three/Phaser fixture
```

**Structure Decision**: Generalize the canonical shared board from 2D `BoardPosition`/`BoardSnapshot` to a single typed 3D position/snapshot contract and migrate setup, standalone movement tests and production combat together; do not keep parallel 2D and 3D gameplay coordinates. `board` owns the renderer-independent coordinate/orientation values and the shared Three.js cube view. `ship-movement` owns 3D reachability and flight presentation. The listed Phaser movement scene/controller/animator files remain cube-typed standalone compatibility components and are not composed into the production battle path; production movement and ship rotation remain commands of `ship-combat`'s `BattleSession`, because `GameApplication` launches `CombatScene`/`BattleSession`, not the standalone movement session. `CombatGame` remains immutable and retains all existing combat values when positions or orientation change. `CombatScene` owns the Three view lifecycle; `GameApplication` stages complete games, resets battle state and coordinates disposal. Keep Three.js types out of domain and public session contracts.

## Phase 0: Research Outcomes

See [research.md](research.md). Repository investigation established that `CombatScene`/`BattleSession` is the live gameplay path and that current shared board geometry and movement are strictly 2D. Phaser 4.2.1 has no 3D camera/raycaster and creates WebGL1 by default; Three.js 0.186.1 requires WebGL2. Use a second, separately owned Three.js canvas rather than sharing Phaser's context. The user's orbit choice is implemented with an open lattice and 1,000 selectable cell-center markers, not solid cell volumes: camera rotation can disambiguate markers without introducing an unrequested layer selector. No unresolved technical-context questions remain.

## Phase 1: Design and Contracts

### Domain, initialization and reachability

- `CubePosition` validates integer X/Y/Z coordinates from 1 through 10 and is the only board coordinate in gameplay snapshots, commands and routes. `CubeSnapshot` defines the fixed 10 × 10 × 10 space and two distinct occupied positions; unoccupied state is derived rather than stored as 1,000 mutable cell flags.
- `CubeOrientation` is a renderer-independent right-handed signed-axis basis, admitting only the 24 proper orientations of a cube. A rotation command composes a positive or negative quarter-turn around a global X, Y or Z axis. `CombatGame` stores the current orientation; Three.js converts it to a quaternion only at the rendering boundary. Ship 1 defaults to forward +Y, Ship 2 to forward −Y, both with +Z as the up axis.
- The setup factory makes one validated uniform draw in `[0, 200)` for each ship, maps it bijectively to X/Z and one of its two Y layers, and stages the complete battle before publication. Existing agility, strength, constitution, hit points, armor class, die draw order and Player 1 first-turn behavior remain intact.
- Generalize `Reachability` to six face-adjacent neighbors and a 3D visited key. BFS returns all and only empty destinations and a shortest route for each; highlights and selection consume that same result. Preserve a maximum 5-step movement allowance and one move per turn. A full unconstrained radius-5 search visits at most 231 positions, not the full 1,000.
- `BattleSession` remains the only authoritative battle state machine. A successful movement stays with the current player for attack-or-end-turn; explicit skip remains available only when immobile. Rotation is accepted for the active ship in movement-ready or attack-ready, never during another action or after the battle ends. A pending rotation has a revision/turn/action identity; completion commits orientation and returns to the prior ready phase without spending movement or ending the turn. Matching failure restores the prior orientation/phase; stale completion, failure, New Game and disposal cannot affect the replacement.

### Cube view, orbit and input

- `ThreeCubeView` creates one independent WebGL2 renderer/canvas, sized to the existing board host. Its open lattice is decorative; an `InstancedMesh` (or equivalent single indexed collection) maps each of 1,000 visible cell-center markers to one stable `CubePosition`. The marker collection, not cell-volume faces or lattice lines, is the cell-picking target. Two distinguishable procedural ship models have an asymmetric nose and visible top marker so all stored orientation changes can be seen.
- Start with a three-quarter perspective camera. Orbit controls cover the cube's full azimuth and usable elevations; marker coverage tests must find at least one view for every coordinate where its marker is separately ray-pickable. For coincident/ambiguous projected markers, show the nearest marker as the hover target and let the player orbit until the intended cell is isolated. This satisfies the clarified orbit-only selection behavior without a slice/coordinate selector.
- Put the Three canvas over the Phaser board canvas with pointer hit-testing passed through to the Phaser host. Attach orbit controls to the matching Phaser canvas bounds. Use primary-button drag to orbit and a primary-button release with less than a 5 CSS-pixel displacement to select; a drag never also selects a cell. The picker maps client coordinates through the Three canvas bounds and camera, then returns a typed cell or ship target. Resize both canvases from the same host bounds and keep the HUD outside the 3D canvas.
- Camera pose is presentation state and never enters `CombatGame` or `BattleSession`; orbiting is available regardless of which player owns the turn. A view change cannot consume a command, movement, random sample or turn token. New Game cancels old visual effects and updates the same view without accumulating canvases/listeners.
- Three renders the movement and torpedo visuals in the same 3D space so their endpoints continue to match ships after orbit. Movement legality remains based on the BFS route; the view animator uses a direct 3D path when clear and an in-volume collision-safe detour when blocked, at 250 ms per logical step (maximum nominal 1,250 ms). Torpedo rolls, hit/miss/damage results, cancellation identities and the 1,500 ms result/readiness deadline remain owned by existing combat rules; the Three animator adapts the visual path and cleans all effects on terminal callbacks.

### Integration, lifecycle and test boundaries

- The shared board contract remains renderer-independent. Only `ThreeCubeView`, its raycaster, orbit controls and 3D animators import Three.js. `GameApplication` composes the current production combat path with the cube view; do not implement the feature only in `MovementScene`/`TurnSession`.
- Keep the Phaser scene for existing application lifecycle and input host. The Three canvas is a second WebGL context because Phaser's current WebGL1 context cannot be passed to the current Three renderer. Scene shutdown, game replacement and app disposal must stop orbit/animation loops, dispose controls/materials/geometries/renderer, remove the overlay canvas, and invalidate stale callbacks before cancelling work.
- Domain tests use independent expected 3D route sets and controlled random sources. Orientation tests exhaust 24 valid states and all six signed quarter-turns. Controller tests cover drag/click arbitration, action-phase/owner checks, stale identifiers, and orientation/position/stat preservation. The real-browser fixture verifies actual Three rendering, WebGL2, all-marker orbit/picking coverage, aligned canvas scaling, movement/torpedo effects, resize, New Game and resource disposal.
- Follow the red-green-refactor loop before each implementation behavior slice and record the expected failing behavior, green command and affected regressions in `development.md`. Automated tests cannot claim real-browser orbit, all-cell visibility, usability or wall-clock performance acceptance.

See [data-model.md](data-model.md), [contracts/cube-ui.md](contracts/cube-ui.md), and [quickstart.md](quickstart.md) for the typed state, interaction boundary and validation cases.

## Complexity Tracking

No constitution violations or exception requests. The additional Three.js dependency and WebGL2 canvas are the smallest direct rendering boundary that supplies real camera orbit and ray picking without coupling domain/game state to a renderer or sharing incompatible GL contexts. They introduce explicit context, canvas-alignment and disposal tests; no separate backend, service layer or persistence is added.
