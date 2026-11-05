# Research: Three-Dimensional Ship Movement

## Scope and evidence

Reviewed the active feature spec, project constitution, TypeScript/package/test configuration, the existing setup/movement/combat plans and contracts, and current source boundaries. Two research passes examined Phaser/Three rendering and picking capabilities, production battle integration, interior-cell visibility and orbit gesture conflicts. No application code or gameplay acceptance test was changed or run during planning.

The active implementation path is `GameApplication` → `CombatScene` → `CombatController`/`BattleSession`; the standalone movement scene/session is retained for its own tests but is not the production battle authority. All technical-context questions are resolved by the decisions below.

## 1. Production battle and shared board boundary

**Decision:** Extend the shared `board` capability to canonical 3D positions and cube presentation, and extend the live `ship-combat` state/session to store and operate on those positions and ship orientations. Generalize shared movement reachability rather than implementing 3D only in the standalone movement session.

**Rationale:** `src/app/GameApplication.ts` composes `CombatGameFactory`, `BattleSession` and `CombatScene`. Production `BattleSession` consumes `Reachability`, while `CombatGame` is the immutable battle snapshot and preserves strength, constitution, HP and AC. The current `board/domain/BoardPosition.ts` and `BoardSnapshot.ts` encode only row/column; `BoardGeometry` and `BoardView` are consumed by setup, movement and combat. A single canonical cube position prevents the three live features from disagreeing about location.

**Alternatives considered:** Implement cube movement only in `ship-movement` (does not change the production game); retain both `BoardPosition` and `CubePosition` as live alternatives (permits conflicting or lossy state); put combat turns in a new parallel session (creates competing authority).

## 2. Three-dimensional rendering and browser context

**Decision:** Add Three.js 0.186.1 as a runtime dependency and create one separate WebGL2 canvas for the cube, aligned over the existing Phaser board host. Keep Phaser 4.2.1 for its current scene/application lifecycle and input host; keep all Three.js objects and calls behind the board presentation adapter.

**Evidence:** `package.json` pins Phaser 4.2.1. Its v4.2.1 WebGL renderer creates a WebGL1 context by default, whereas current Three.js `WebGLRenderer` requires WebGL2. Phaser's `Extern` is a legitimate external-render hook, but using it would first require changing Phaser context creation and then coordinating mutable GL state/framebuffers. A separate canvas avoids the incompatible/shared-context boundary. Three.js `OrbitControls`, `Raycaster` and `InstancedMesh` supply the camera orbit, mesh picking and repeated-marker rendering needed by the feature. The registry reports 0.186.1 as the current Three.js release during planning.

**Rationale:** The user selected viewing-angle rotation and requires selection throughout the 3D volume. Phaser supplies only a 2D camera and planar picking; a separate 3D renderer directly models those interactions. The independent context increases GPU/canvas lifecycle work but has a smaller compatibility risk than a shared Phaser/Three context.

**Alternatives considered:** Custom 3D-to-2D projection in Phaser (avoids a dependency but makes orbit, depth ordering and precise cell picking application-owned); Three.js through Phaser `Extern` (one canvas and natural layer order, but current WebGL1 context is incompatible and shared-state handoff is fragile); replace all Phaser lifecycle/composition at once (unnecessary scope).

## 3. Orbit-only access to interior cells

**Decision:** Render an open wireframe lattice with one visible, independently selectable center marker for each of the 125 cells. The lattice is decorative and not pickable; ray picking targets only the cell-marker collection. Use orbit to separate projected markers that overlap at a particular view, and select only a marker that is the ray's unambiguous nearest target.

**Rationale:** Orbiting cannot expose the 27 strictly interior positions of a packed opaque 5 × 5 × 5 cube. Three.js raycasting through transparent or cutaway-looking meshes does not by itself change which geometric hit is nearest. A center-marker lattice has no opaque cell faces, lets interior positions remain visible, and makes the clarified orbit-only approach viable without adding a layer selector. Instanced markers can map stable `instanceId` values back to exact coordinates.

**Alternatives considered:** Solid cell boxes (hide the interior from every outside camera position); translucent boxes (transparency does not make ray picking pass through); full cutaway/slice or coordinate controls (could work but add a selection mode the user did not choose); make lattice lines selectable (crossings and line hit tolerances are ambiguous).

**Validation risk:** Some projected marker pairs may remain too close at a given view. The browser acceptance harness will test every coordinate over a reproducible azimuth/elevation sweep, require at least one clear view per marker, and verify the ray hit returns that coordinate. Exact overlaps are never silently assigned to a hidden marker; the player orbits until it is isolated.

## 4. Camera and input arbitration

**Decision:** Start from the requested three-quarter view. Use primary-button drag to orbit and a stationary primary-button release (less than a 5 CSS-pixel movement threshold) to select a cell/ship. Bind camera controls to the existing Phaser canvas underneath the Three canvas; make the overlay canvas input-transparent and use Three canvas bounds for ray coordinates.

**Rationale:** Existing combat input dispatches on pointer-down, which would turn a drag into both a camera orbit and a gameplay command. Deferring cell/ship selection until pointer release and suppressing a drag removes that conflict. The aligned overlay allows Three to render the cube while the existing board host continues to receive pointer events. Orbit state remains presentation-only and independent of `BattleSession` state.

**Alternatives considered:** OrbitControls' default left-drag together with immediate Phaser pointer-down (can move/attack while orbiting); right-drag orbit (conflicts with context-menu behavior); keyboard-only coordinates (not chosen by the user and not direct visual selection); a second selection canvas with competing input propagation (more event routing).

## 5. Coordinates, movement and initialization

**Decision (board-size update 2026-10-22):** Use validated integer `CubePosition(x,y,z)` values in [1,5] on every axis and generalize BFS to the six face-adjacent neighbors. Keep the current nonnegative agility allowance, one movement action and maximum five-step range. Map one validated uniform random draw to one of 50 eligible cells for each ship's opposing two-layer Y band (Y=1/2 for Ship 1; Y=4/5 for Ship 2).

**Rationale:** The current `Reachability` already owns route cost, blocker handling and shortest routes, and its existing five-step bound can reach at most the 125 positions in the smaller cube. Positions in the two home bands do not overlap, so initial ships remain distinct without rejection draws. A bijection from each draw to a cell preserves the project's injectable deterministic `RandomSource` and equal likelihood.

**Alternatives considered:** Straight-line or Euclidean movement (changes existing orthogonal movement allowance); scan the whole cube every turn (unneeded with five-step BFS); select x/y/z independently with separate draws (changes deterministic draw count); reroll duplicate positions (unnecessary because Y bands are disjoint).

## 6. Ship orientation and battle lifecycle

**Decision:** Represent ship orientation as a renderer-independent right-handed signed-axis basis, restricted to the 24 proper cube rotations. Compose signed 90-degree rotations around global X/Y/Z axes in that basis. Add rotation as a phase-aware `BattleSession` command; it updates the active ship's orientation but preserves movement, combat values, player and turn token.

**Rationale:** Three scalar Euler counters do not correctly capture the non-commuting composition of rotations without a defined order. A signed basis is finite, strongly typed and maps to a Three.js quaternion only at presentation. Existing session revision/token/action identities already reject stale callbacks from movement, attack, replacement and disposal; rotation and 3D animators should use the same protections.

**Alternatives considered:** Store an untyped Euler triple (ambiguous order/gimbal behavior); put Three.js `Quaternion` in domain state (renderer dependency leak); rotate a ship through camera controls (confuses ship and view state); create a competing rotation session (breaks single battle authority).

## 7. Renderer effects and acceptance

**Decision:** Render ship flight, ship rotation and torpedo effects in the Three scene so their positions remain attached to cube coordinates as the camera orbits. Keep existing combat rolls, state transitions, cancellation identities and completion deadlines; keep domain and path decisions behind renderer-independent contracts.

**Rationale:** A 2D effect rendered below an opaque Three canvas would be hidden, and a 2D screen-space effect would not remain at its 3D endpoint after an orbit. The existing `BattleSession`/animator identities support moving effects to Three without moving outcome authority into the renderer. Actual Phaser/Three layering, resize, context availability and wall-clock effects require a browser fixture.

**Alternatives considered:** Leave the current 2D torpedo below the 3D overlay (not visible); project fixed screen-space effects (misaligned after orbit); apply dice/HP updates inside Three callbacks (violates domain authority and stale-result guarantees).

## References

- Repository: `src/app/GameApplication.ts`; `src/features/board/domain/BoardPosition.ts`, `BoardSnapshot.ts`; `src/features/board/presentation/BoardGeometry.ts`, `BoardView.ts`; `src/features/ship-movement/domain/Reachability.ts`, `TurnSession.ts`; `src/features/ship-combat/domain/CombatGame.ts`, `BattleSession.ts`; `src/features/ship-combat/presentation/CombatScene.ts`, `CombatController.ts`; `package.json`; `vitest.config.ts`.
- Phaser 4.2.1 [WebGL renderer source](https://github.com/phaserjs/phaser/blob/v4.2.1/src/renderer/webgl/WebGLRenderer.js), [Extern API](https://docs.phaser.io/api-documentation/class/gameobjects-extern), and [Extern renderer](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/extern/ExternWebGLRenderer.js).
- Three.js [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [Raycaster](https://threejs.org/docs/pages/Raycaster.html), and [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).

No constitution exceptions or unresolved technical-context questions remain. Browser/GPU and usability measurements are implementation acceptance work, not research claims.
