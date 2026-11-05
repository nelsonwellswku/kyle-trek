# Feature Specification: Three-Dimensional Ship Battle

**Feature Branch**: `something-crazier` (existing branch; no branch created)

**Created**: 2026-11-04

**Status**: Draft

**Input**: Two-player local ship battle in a 5 × 5 × 5 cube, with movement followed by optional combat, ship rotation, and safe new-game interruption. These requirements supersede earlier flat-board and movement-only specifications.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start and inspect a battle (Priority: P1)

As a local player, I want to see the cube, ships, coordinates, and stats so that I can understand the starting situation and inspect any cell.

**Why this priority**: A recognizable, inspectable playing space and fair setup are prerequisites for play.

**Independent Test**: Start games and inspect every coordinate, including interior cells, while checking ship locations and stats.

**Acceptance Scenarios**:

1. **Given** a new game, **When** the board appears, **Then** it shows 125 distinguishable cells in a three-quarter perspective, labeled axes, identifiable ships and their coordinates, and Player 1's movement phase.
2. **Given** any cell or ship is initially occluded, **When** a player adjusts the view and inspects it, **Then** its coordinates and occupancy are identifiable before selection, and it can be directly targeted at any depth.
3. **Given** repeated new games, **When** starting positions and stats are sampled, **Then** each ship's eligible starting cells and each eligible stat score are independently and uniformly selectable, with hit points and modifiers calculated as specified.
4. **Given** an existing game, **When** its view is revisited or rotated, **Then** positions, stats, orientation, turn, and hit points remain unchanged.

### User Story 2 - Move through the cube (Priority: P1)

As the active player, I want to see and select all legal destinations so that I can maneuver before deciding whether to attack.

**Why this priority**: Movement is the first mandatory part of every turn.

**Independent Test**: Set up positions and agility values with known reachable cells, select a destination, and observe movement and the subsequent phase.

**Acceptance Scenarios**:

1. **Given** a movement phase, **When** legal destinations are shown, **Then** they include exactly the unoccupied cells reachable by an unobstructed face-adjacent route within the nonnegative agility modifier, including routes around the opponent.
2. **Given** a legal destination and a working movement presentation, **When** the active player left-clicks it once, **Then** the ship flies to it within 1.5 seconds, consumes its entire movement action, and enters attack-or-end-turn only after arrival.
3. **Given** an invalid, occupied, unreachable, or out-of-cube target, or a non-left click, **When** it is selected, **Then** no movement or action is consumed.
4. **Given** no destination is legal, **When** the player reads the explanation and explicitly skips movement, **Then** the ship remains in place and the attack-or-end-turn phase begins without ending the turn.
5. **Given** a flight is underway, **When** players attempt another move or ship rotation, **Then** neither changes the game; the flight takes a direct clear route or a shortest feasible collision-free detour and remains within the cube.
6. **Given** a committed move whose presentation cannot start, fails during playback, or times out, **When** failure recovery runs, **Then** transient flight effects clear, the ship visibly appears at the committed destination without an unsafe intermediate flight, a readable error appears, and attack-or-end-turn becomes available exactly once within 1.5 seconds of accepted selection. Restart or disposal instead discards the pending move.

### User Story 3 - Attack or end the turn (Priority: P1)

As the active player, I want to attack the opposing ship or end my turn without attacking so that the battle proceeds until someone wins.

**Why this priority**: Combat and orderly turn handoff complete the core game.

**Independent Test**: From a resolved movement phase, exercise end turn, misses, nonlethal hits, and lethal hits with known rolls.

**Acceptance Scenarios**:

1. **Given** movement is resolved, **When** the active player chooses End turn, **Then** neither ship loses hit points and control passes once to the other player.
2. **Given** the attack phase, **When** a player clicks a target other than the opposing ship, **Then** the attack remains available and neither ship changes.
3. **Given** the opponent is clicked, **When** the attack total is at least armor class 12, **Then** it hits, shows the torpedo and explosion before damage, displays total, damage and remaining hit points, and applies the nonnegative damage once.
4. **Given** an attack total below 12, **When** the torpedo misses, **Then** it visibly clears the defender and exits the screen, the total and miss are displayed, and hit points do not change.
5. **Given** an attack resolves, **When** the defender has zero hit points, **Then** the attacker wins and further gameplay changes are rejected; otherwise the other player receives exactly one turn.
6. **Given** an attack presentation cannot start or fails while playing, **When** it is cleaned up, **Then** a readable presentation error and the already-rolled result appear, and damage and victory or handoff resolve once without rerolling, within 1.5 seconds of launch.
7. **Given** a hit or miss presentation is underway, **When** a player rotates the view, **Then** view rotation remains available and the effect adapts to the current projection without resampling the miss angle or side or changing the rolled outcome; if its visual constraints cannot be maintained, presentation failure resolves the stored outcome within the original deadline.

### User Story 4 - Orient the active ship (Priority: P2)

As the active player, I want to rotate my ship independently of the camera so that its persistent orientation reflects my choices without spending an action.

**Why this priority**: Orientation provides meaningful visual control without disrupting the core turn.

**Independent Test**: Rotate the active ship around each axis in both directions, compare its state before and after, and attempt prohibited rotations.

**Acceptance Scenarios**:

1. **Given** the active player is in a turn and no movement or combat animation or attack resolution is underway, **When** they rotate their ship by 90 degrees in either direction around X, Y, or Z, **Then** the visible orientation changes persistently while position, allowance, phase, combat values, and turn order remain unchanged.
2. **Given** an opponent's ship, an animation or attack resolution, or a completed battle, **When** ship rotation is attempted, **Then** it is rejected. Rotating the view never changes game state.

### User Story 5 - Restart safely (Priority: P1)

As either player, I want to start a fresh game at any time without an interrupted action affecting it.

**Why this priority**: Reliable reset protects both fairness and game continuity.

**Independent Test**: Start a new game during each presentation and after a completed battle, then allow any old presentation to finish.

**Acceptance Scenarios**:

1. **Given** a game in any phase, **When** New game is selected, **Then** fresh independent setup rolls are made, Player 1 acts first, default orientations return, and prior outcomes, highlights and pending actions clear.
2. **Given** movement, rotation, or combat presentation is interrupted by a new game or disposal, **When** the old action would otherwise complete, **Then** it cannot change the new game or apply its pending outcome.

### Edge Cases

- An agility modifier of −1 or 0 gives zero movement allowance; an enclosed ship also has no legal destination. Explain the applicable reason and offer only the explicit movement skip.
- A destination behind the opponent remains legal if an alternative face-adjacent route fits the allowance; a route through the occupied cell never counts.
- A starting hit-point roll plus twice a negative constitution modifier may be zero or negative; floor to 1 without rerolling.
- Attack totals equal to armor class hit; negative damage becomes zero, and hit points never fall below zero.
- Ships at cube edges, aligned in depth, or close together remain independently identifiable and targetable. Misses must clear the whole defender even near a screen edge.
- Repeated clicks, input during animation, or late presentation completion cannot cause a second move, attack, damage application, or turn handoff.
- A failed movement presentation visibly places the ship at its committed legal destination; a failed combat presentation resolves its pre-rolled outcome. New-game or disposal cancellation instead discards the pending move or attack, including any subsequently delivered failure callback.
- Camera changes during combat effects require current-projection validation, including depth-aligned ships and screen-edge defenders; an invalid presentation uses failure recovery rather than resampling or extending the deadline.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The playing space MUST consist of 125 distinct cells with X, Y, Z each from 1 through 5; X increases left to right, Y top to bottom, and Z near to far. Each ship occupies one distinct cell.
- **FR-002**: The initial view MUST be three-quarter perspective with distinguishable cells, labeled axes and identifiable ships. Independent view rotation MUST NOT alter game state.
- **FR-003**: Players MUST be able to inspect and directly target every cell, including interior and initially occluded cells, and identify coordinates and occupancy before selection. Both ships MUST remain identifiable and targetable at every depth; display each ship's current coordinates.
- **FR-004**: Each new game MUST independently and uniformly place Ship 1 among all 50 cells with Y=1 or 2 and Ship 2 among all 50 cells with Y=4 or 5; all X and Z values are eligible. Ship 1 initially faces increasing Y and Ship 2 decreasing Y.
- **FR-005**: For each ship and each new game, agility, strength and constitution scores MUST be independently and uniformly selected integers from 8 through 20, and remain fixed during the game. Display each score separately from its modifier.
- **FR-006**: Each score's modifier MUST be −1 for 8–9, 0 for 10–11, +1 for 12–13, +2 for 14–15, +3 for 16–17, +4 for 18–19, and +5 for 20.
- **FR-007**: Each ship's starting hit points MUST equal an independent uniform integer from 0 through 20 plus twice its constitution modifier, floored at 1 without rerolling. Each ship has armor class 12. Display current hit points and armor class for both ships.
- **FR-008**: Two local players control their corresponding ships; Player 1 acts first. Show active player, active ship and action phase. Each turn consists of movement followed by an attack opportunity or explicit End turn.
- **FR-009**: Movement allowance MUST equal the agility modifier floored at zero. A destination is legal exactly when it is a different, unoccupied cube cell reachable within the allowance by face-adjacent steps that stay inside the cube and do not pass through the opponent. Any qualifying route suffices.
- **FR-010**: Display all and only legal destinations within 300 milliseconds of a playable turn beginning. A single left click on one selects it; invalid, occupied, unreachable, out-of-cube and non-left-click selections MUST NOT move a ship or consume an action.
- **FR-011**: A selected move MUST consume the entire movement action, carry over no unused steps, visibly complete at the selected coordinate within 1.5 seconds of accepted selection, and resolve exactly once after arrival. Normal presentation uses animated flight; presentation failure uses FR-024 recovery within the same deadline. During flight or recovery, reject additional movement and ship rotation; only after visible arrival offer attack or End turn.
- **FR-012**: During normal movement presentation, show a direct smooth flight when the continuous path is clear; otherwise use a shortest feasible collision-free path. Keep both ship visual envelopes separated and within the playing space throughout, including FR-024 recovery, which replaces failed flight with visible placement at the destination rather than an unsafe intermediate flight. Animation distance MUST NOT change face-adjacent movement legality or cost.
- **FR-013**: If no legal destination exists, explain why and provide an explicit Skip movement action. Skipping leaves the ship in place and proceeds to attack-or-end-turn without handing off the turn.
- **FR-014**: During their turn before attacking or ending it, the active player MAY rotate their ship by 90 degrees in either direction about each of X, Y and Z. Rotation visibly and persistently changes orientation, without changing position, allowance, turn order, phase or combat values, or consuming an action.
- **FR-015**: Reject rotation of the non-active ship, and all ship rotation during movement or combat animation, attack resolution, and after battle completion. View rotation is separate from ship rotation.
- **FR-016**: After movement or a permitted skip, clicking the opposing ship launches at most one attack, regardless of range, line of sight or ammunition. Clicking any other target does not consume the attack or change either ship. Once launched, the attack cannot be skipped and gameplay input cannot trigger additional actions during its animation or resolution.
- **FR-017**: End turn is available only after movement resolves, outside animations and before battle completion. It causes no attack or hit-point change and hands control to the other player exactly once.
- **FR-018**: An attack MUST roll a uniform d20 and add the attacker's strength modifier; the attack hits when the total is at least the defender's armor class, otherwise it misses. On a hit, roll a uniform d8, add the same modifier, floor damage at zero, and reduce defender hit points by that amount, floored at zero. A miss causes no damage.
- **FR-019**: Display every attack total and hit-or-miss result; for a hit also display damage and defender remaining hit points. A hit MUST show a prominent blinking five-point-star photo torpedo traveling from attacker to defender, followed by an explosion on contact before damage is shown. At 60 logical pixels per cell its outer radius is at least 12 logical pixels; it scales with the board and has a bright contrasting fill and visible outline.
- **FR-020**: For each miss independently sample a uniform integer launch angle from 10° through 35° and a side of the direct attacker-to-defender line. The entire star MUST clear the defender, remain on-screen through closest approach, and then exit fully off-screen. A curved or offset path MAY be used as needed, preserving the selected launch angle and never exceeding 35°. View rotation remains available during effects; validate against the current projection and adapt the presentation without resampling the angle or side. If the visual constraints cannot be maintained, use FR-021 failure recovery within the original deadline. Miss-path randomness MUST NOT consume attack or damage dice or affect gameplay outcomes.
- **FR-021**: Within 1.5 seconds of attack launch, complete the hit explosion or off-screen miss, show the result, and make the next turn available or show the winner. On presentation failure at start or during playback, remove effects, display a readable presentation error and the already-rolled result, and apply damage and handoff or victory exactly once without rerolling within the same deadline. New-game or disposal cancellation instead discards the pending outcome.
- **FR-022**: A defender reaching zero hit points ends the battle, declares the attacking player the winner, and prevents further gameplay changes. Otherwise a resolved attack hands control to the other player exactly once.
- **FR-023**: New game MUST generate fresh independent positions, stats and hit-point rolls, restore Player 1's first turn and default ship orientations, and clear prior outcomes, highlights and pending actions. Interrupted movement, rotation or combat presentation MUST NOT affect the new game. Repeated views of the same game MUST NOT reroll or change state.
- **FR-024**: If movement presentation cannot start, fails during playback, or times out, remove transient flight effects, visibly place the ship at its committed legal destination, display a readable presentation error, and enter attack-or-end-turn exactly once within the original 1.5-second deadline from accepted selection. This recovery replaces normal animated travel and still consumes the entire movement action. New-game or disposal cancellation instead discards the pending move; stale completion, failure, or timeout callbacks MUST NOT apply it.

### Key Entities *(include if feature involves data)*

- **Battle**: The current cube, two ships, active player, phase, battle status and winner, if any.
- **Cell**: One unique X, Y, Z coordinate, with occupancy and current movement eligibility.
- **Ship**: Player ownership, position, orientation, three scores and modifiers, current hit points and armor class.
- **Turn**: Active player, movement allowance and progress, followed by the attack-or-end-turn opportunity.
- **Attack outcome**: Attacker, defender, rolled total, hit or miss, and, for a hit, damage and remaining defender hit points; it is applied at most once.
- **Presentation**: A temporary movement, rotation or combat visualization tied to its originating game, including cancellation or failure status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a full-board inspection test, players can identify coordinates and occupancy and directly target all 125 cells and both ships, including interior and occluded positions.
- **SC-002**: For every tested starting configuration and allowance, the destinations presented match the complete set of legal face-adjacent routes; choices appear within 300 milliseconds of every playable turn beginning.
- **SC-003**: Every selected legal movement, including presentation failures recovered under FR-024, visibly reaches its destination and enables attack-or-end-turn within 1.5 seconds of accepted selection, without visual ship overlap or leaving the playing space.
- **SC-004**: Every attack, including presentation failures and camera changes during playback, displays its outcome and produces the next turn or winner within 1.5 seconds of launch. Successful presentations show hit explosions before damage and misses fully exiting after clearing the defender; failed presentations follow FR-021 recovery.
- **SC-005**: In boundary and scripted-roll tests, 100% of modifier, starting hit-point, hit threshold, damage floor, hit-point floor, and winner results match the stated rules.
- **SC-006**: Across tests of repeated input and new-game interruption at every action phase, no old or duplicate action changes the new game or causes more than one resolution or handoff.
- **SC-007**: In a usability test, at least 90% of participants can identify the active player and phase, inspect a hidden cell, move or skip when appropriate, and choose attack or End turn without assistance.
- **SC-008**: Repeated setup and miss-path samples show no statistically significant departure from the specified uniform distributions and independence at a 5% significance level under a predefined sampling plan.

## Assumptions

- Players share one local game display and input device; online multiplayer, accounts, saved games, and AI opponents are outside this feature's scope.
- View controls may provide additional ways to reveal depth; rotating the view remains available and presentation-only.
- A miss side is sampled uniformly between the two sides independently of its angle and all game rolls. The angle limit describes the trajectory's deviation from the direct line throughout its travel.
- A playable turn begins when initial setup or the preceding action has fully resolved and gameplay input becomes available. Performance acceptance uses a documented, maintainer-approved Linux reference environment recording CPU, GPU, graphics driver, OS, display resolution, scaling and application window dimensions. The application remains visible and unpaused during measurement. Deadlines use monotonic elapsed wall-clock time for each measured action, not averages; fake-clock tests supplement rather than replace real-display timing.
- The existing project constitution governs subsequent planning and development, including test-driven verification; this specification does not prescribe implementation structure.
