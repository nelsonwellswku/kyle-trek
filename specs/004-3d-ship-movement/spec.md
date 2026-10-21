# Feature Specification: Three-Dimensional Ship Movement

**Feature Branch**: `004-3d-ship-movement`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "instead of the playing surface being a 10x10 board, i want it to be a 10x10x10 cube and the ship can move throughout it. it should be displayed from a 3/4 perspective and moved rotated along any axis"

## Clarifications

### Session 2026-10-20

- Q: How should players access and select cells hidden behind other cells in the three-quarter view? → A: Let players rotate the viewing angle to reveal cells, then select them directly; the view may move away from the default three-quarter angle.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See and Navigate the 3D Playing Space (Priority: P1)

As a player, I want to see the game as a three-dimensional cube and identify positions by their three coordinates so that I can understand where both ships are and reach every part of the playing space.

**Why this priority**: A legible, navigable cube is the foundation for movement and rotation in three dimensions.

**Independent Test**: Start a new game and verify that the playing space has 10 positions along each of three labeled axes, appears from a three-quarter viewpoint, shows both ships at distinct coordinates, and permits players to rotate the view to inspect and select cells at near, far, upper, lower, and interior depths.

**Acceptance Scenarios**:

1. **Given** a new game, **When** the board is displayed, **Then** players see a cube with 10 × 10 × 10 distinct cells, three distinguishable axes, and a three-quarter view that communicates depth.
2. **Given** a cell is within the cube, including an interior or visually occluded cell, **When** a player rotates the view to expose it and selects that position, **Then** its three coordinates and occupancy can be identified without mistaking it for another cell, and neither ship's position or orientation changes.
3. **Given** a new game is initialized, **When** either player inspects their ship, **Then** it occupies one cell, has a distinct position from the opposing ship, and its three coordinates are visible.
4. **Given** repeated new games are started, **When** initial positions are assigned, **Then** each ship is placed independently and with equal likelihood in any of the 200 cells in its own opposing starting region.
5. **Given** a new game is initialized, including after either ship was rotated in a previous game, **When** players inspect ship orientation, **Then** Ship 1 faces toward increasing Y and Ship 2 faces toward decreasing Y.

---

### User Story 2 - Move a Ship Along Any Cube Axis (Priority: P1)

As a player, I want to move my ship through the cube along any of its three axes so that all three dimensions affect positioning and routes.

**Why this priority**: Movement in all three dimensions is the main gameplay change from the flat board.

**Independent Test**: Start a turn with known ship positions and movement allowance. Verify legal destinations and move the active ship along each positive and negative axis direction, through multiple depth layers, and around an occupied cell when an affordable route exists.

**Acceptance Scenarios**:

1. **Given** an active player's turn, **When** legal destinations are shown, **Then** they include only unoccupied cells reachable within the ship's current movement allowance using face-adjacent cells along X, Y, or Z.
2. **Given** a legal destination that differs from the ship's position on X, Y, or Z, **When** the player selects it, **Then** the ship moves to that exact three-coordinate position and the turn proceeds according to the existing movement-then-combat sequence.
3. **Given** a route is blocked by the opposing ship, **When** another route through empty cube cells fits within the movement allowance, **Then** the destination remains legal; a destination with no such route is unavailable.
4. **Given** a ship is at a cube boundary, **When** its legal destinations are shown, **Then** no destination or route leaves the 1-to-10 range on any axis.
5. **Given** movement is in progress, **When** either player attempts another move or rotation, **Then** no additional action is accepted until the movement completes.
6. **Given** a new game begins, **When** the first movement turn becomes available, **Then** Player 1 acts first and the existing movement, optional attack, and turn handoff sequence remains in effect.
7. **Given** the active ship has no legal movement destination, **When** its player explicitly skips movement, **Then** the ship stays in place and the player proceeds to the attack-or-end-turn choice.
8. **Given** a selected cell is occupied, unreachable, outside the cube, or not available to the active player, **When** that cell is selected as a destination, **Then** neither ship moves and the movement action remains available.

---

### User Story 3 - Rotate a Ship Around Each Axis (Priority: P2)

As a player, I want to rotate my ship around any of the cube's three axes so that I can orient it freely in three dimensions.

**Why this priority**: All-axis rotation completes the requested three-dimensional ship control and makes ship orientation visible in the cube view.

**Independent Test**: During a turn, rotate the active ship in both directions around each axis. Confirm that the ship's orientation changes visibly while its cell, movement allowance, and opponent's state remain unchanged.

**Acceptance Scenarios**:

1. **Given** the active player's turn and no animation in progress, **When** the player requests a rotation around X, Y, or Z, **Then** the ship visibly turns 90 degrees in the requested direction around that axis.
2. **Given** a ship has been rotated, **When** its orientation is inspected later, **Then** that orientation remains until the ship is rotated again or a new game starts.
3. **Given** a ship is rotated, **When** its state is inspected, **Then** its occupied cell, movement allowance, and the opposing ship's position are unchanged, and rotation does not consume the move or attack opportunity.
4. **Given** it is the other player's turn, an attack is resolving, a move is animating, or the battle is over, **When** a player attempts to rotate a ship, **Then** the action is unavailable or ignored without changing the game state.
5. **Given** both ships are at valid three-dimensional positions, **When** a player attacks the opposing ship, **Then** the existing attack, damage, and victory rules resolve as before and the attack presentation identifies the ships at their current cube positions.

### Edge Cases

- A ship at coordinate 1 or 10 on an axis cannot move farther outward on that axis but may move inward if allowed.
- A destination can appear close in the three-quarter view while requiring too many face-adjacent steps or a route blocked by the opposing ship; visual proximity does not make it legal.
- A ship or another cell can occlude a position from the default view; the player can rotate the view to find and select the intended position without changing either ship's orientation or position.
- Rotating the view can change which cells overlap in the display; a player must be able to continue rotating until the intended cell can be identified before selecting it.
- A ship with zero or negative movement allowance has no movement destinations; the existing explicit skip behavior remains available so its turn can proceed.
- A ship may be rotated repeatedly around the same or different axes; rotations change orientation only and never move it to another cell.
- Invalid coordinates, cells outside the cube, occupied destinations, and diagonal-only one-step destinations cannot be selected as legal movement destinations.
- If a new game starts during movement, rotation, or combat presentation, the old pending actions cannot affect the new game's positions, orientation, turn, or outcome.
- Once a battle is over, further movement and rotation inputs cannot alter the final state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The playing space MUST contain exactly 10 × 10 × 10 distinct cells, totaling 1,000 cells.
- **FR-002**: The cube MUST use three labeled coordinates, X, Y, and Z, each numbered from 1 through 10. X MUST run left to right, Y MUST run from the top to the bottom of the former board, and Z MUST run from the near side to the far side of the cube.
- **FR-003**: The playing space MUST open from a three-quarter viewpoint that makes the cube's depth and all three axes understandable. The display MUST visibly distinguish cells and the two ships, and players MUST be able to rotate the viewing angle away from the default perspective.
- **FR-004**: Players MUST be able to inspect and target every cell in the cube, including interior or visually occluded cells, by rotating the view as needed. Players MUST be able to identify a cell's X, Y, and Z coordinates and whether it is occupied before selecting it. Both ships MUST remain identifiable and targetable at every valid depth. Changing the viewing angle MUST NOT change either ship's position, orientation, turn, or combat state.
- **FR-005**: Each ship MUST occupy exactly one valid cube cell at a time, and the two ships MUST occupy different cells. Each ship's current X, Y, and Z coordinates MUST be visible to both local players.
- **FR-006**: Each new game MUST place Ship 1 in one of the topmost two Y layers (Y=1 or Y=2) and Ship 2 in one of the bottommost two Y layers (Y=9 or Y=10). Each ship's initial cell MUST be independently and uniformly selected from the 200 cells in its assigned layers, with X and Z each ranging from 1 through 10.
- **FR-007**: The game MUST preserve the existing two-player turn order, ship ownership, agility scores and modifiers, movement allowance, and movement-then-attack-or-end-turn sequence. Player 1 MUST begin each new game.
- **FR-008**: A movement allowance MUST count face-adjacent cell steps along one axis at a time. A legal destination MUST be an unoccupied cell reachable from the active ship's current cell within its nonnegative agility-modifier allowance, using routes that stay inside the cube and do not pass through the opposing ship. A diagonal transition between cells MUST NOT count as one step.
- **FR-009**: At the start of the movement action, the game MUST identify all and only legal destinations for the active ship. Selecting a legal destination MUST use the turn's single movement action and move the ship to that cell; the player MUST NOT receive unused movement steps as a later bonus or make another move in the same turn. Invalid, occupied, unreachable, out-of-cube, or non-active-player selections MUST NOT change either ship's position or consume an action.
- **FR-010**: The game MUST show the move through the three-quarter view and finish with the ship at the selected cell. While movement is in progress, additional movement and rotation inputs MUST NOT be accepted. The movement action MUST resolve only once the move is complete, after which the active player can continue to the existing attack-or-end-turn choice.
- **FR-011**: If a ship has no legal movement destination, its player MUST be able to use the existing explicit movement-skip behavior and continue to the attack-or-end-turn choice. Skipping MUST NOT move the ship or end the turn by itself.
- **FR-012**: During the active player's turn, the player MUST be able to rotate their own ship 90 degrees in either direction around each of the X, Y, and Z axes, before launching an attack or ending the turn. Rotation MUST NOT change the ship's occupied cell, movement allowance, turn order, or either ship's combat values. The ship's orientation MUST persist until changed or a new game starts.
- **FR-013**: Rotation MUST be unavailable to the non-active player, during an animation or attack resolution, and after battle completion. Ship 1 MUST start facing toward increasing Y and Ship 2 toward decreasing Y. A new game MUST reset both ships' orientations to those default starting directions and discard pending actions from the previous game.
- **FR-014**: Existing torpedo combat rules, attack and damage calculations, victory conditions, and local two-player ownership MUST remain unchanged by the change from a flat board to a cube.

### Key Entities *(include if feature involves data)*

- **Cube**: The playing space made up of 1,000 cells arranged across X, Y, and Z axes, each with coordinates from 1 through 10.
- **Cube Cell**: One uniquely identified X/Y/Z position that is empty or occupied by one ship.
- **Spaceship**: One of the two player-controlled ships, with an identity, current cell, and visible orientation.
- **Ship Orientation**: The direction the ship's model faces, changed by quarter-turns around the X, Y, and Z axes independently of its occupied cell.
- **Movement Route**: A sequence of face-adjacent, unoccupied cube cells connecting a ship's current cell to a destination; its number of steps determines whether the destination is within the movement allowance.
- **Turn**: The active player's existing movement, optional rotation, and attack-or-end-turn opportunities, with movement completed or explicitly skipped before combat or handoff.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100 new-game setups, every board displays exactly 1,000 cells and exactly two ships, each at a distinct valid X/Y/Z position.
- **SC-002**: In a coordinate coverage check of all 1,000 positions, players can rotate the view as needed to identify and select every cell, including interior and occluded cells, without selecting a different coordinate or changing either ship's game state.
- **SC-003**: Across at least 50 controlled movement cases covering all six movement directions, cube edges and corners, blocked routes, affordable detours, and unreachable cells, 100% of legal-destination indications and completed positions match the movement allowance and route rules.
- **SC-004**: Across 50 completed turns, movement resolves before any attack or end-turn action, rotation and movement inputs during animations cause zero duplicate actions, and each completed move or end-turn choice advances control exactly once.
- **SC-005**: All six quarter-turn directions (positive and negative around each of the three axes) visibly change orientation while leaving ship coordinates, movement allowance, opponent state, and combat values unchanged in 100% of checks.
- **SC-006**: At least 4 of 5 first-time players can identify the three axes and both ship positions, move their ship along each axis, and rotate it around each axis without assistance.
- **SC-007**: Legal movement choices become visible within 300 milliseconds of a playable turn beginning on the 1,000-cell cube, and every selected movement completes within 1.5 seconds.
- **SC-008**: Across 1,000 new-game initializations, both ships always start in their assigned two-layer region. Controlled checks can select all 200 eligible cells for each ship, and independence and equal likelihood are reviewed against FR-006 rather than inferred from sample frequency alone.
- **SC-009**: In checks of boundary movement, visually occluded cells, view rotation during active and inactive turns, no-move turns, ship rotation during the opponent's turn, new-game orientation reset, new game during animation, and post-victory input, 100% of cases preserve the specified legal state and reject prohibited changes.

## Assumptions

- This feature extends the existing local two-player game and retains the turn order, ship identities, agility-based movement allowance, explicit no-move skip, optional attack or end-turn choice, and combat rules described in `specs/001-spaceship-grid-setup/spec.md`, `specs/002-ship-turn-movement/spec.md`, and `specs/003-ship-torpedo-combat/spec.md`.
- The three axes are named X (left/right), Y (top/bottom, corresponding to existing rows), and Z (near/far depth). Ship 1's former top starting region and Ship 2's former bottom starting region are extended into the cube by allowing every X and Z coordinate in their respective two Y layers.
- Each ship continues to occupy one logical cell as in the existing game. Rotation changes the visible model's orientation but does not change logical occupancy or block neighboring cells.
- “Rotated along any axis” is interpreted as player-controlled 90-degree turns in either direction around each of the cube's X, Y, and Z axes. Rotation is available during the player's turn before attack launch or turn end and does not consume movement allowance or end the turn. At game start, ships face toward one another along the Y axis.
- The three-quarter view is the default board presentation, and players may rotate the viewing angle to reveal and select occluded cells. View rotation is separate from rotating a ship and is only a presentation control; it does not affect game state.
- This feature changes the play space and ship movement/presentation only; networking, additional ships, changes to combat formulas, and player-editable ship dimensions are outside scope.
