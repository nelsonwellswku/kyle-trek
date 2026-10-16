# Feature Specification: Ship Turn Movement

**Feature Branch**: `redo`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "Ships have agility from 8 to 20 and a separate stepped modifier, increasing by 1 every 2 points with 10–11 giving 0. Local players alternate turns, moving up to their agility modifier in orthogonal grid steps. Highlight reachable squares and select a destination with a left mouse click. Completing a move ends the turn. Ships cannot move through occupied squares but may route around enemies within their movement allowance. Animate movement with smooth arcs for changes of direction and to avoid passing through another ship."

## Clarifications

### Session 2026-10-16

- Q: How should each ship’s agility be assigned when a new game starts? → A: Each ship receives a random integer agility from 8–20. A player with no legal moves must acknowledge the pass with a button click instead of passing automatically.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Take Alternating Agility-Limited Turns (Priority: P1)

As a local player, I want to see whose turn it is and choose a highlighted destination for my ship so that both players can take fair, understandable movement turns.

**Why this priority**: Alternating turns and enforceable movement limits are the core playable interaction.

**Independent Test**: Start a two-player game with known agility values, compare highlighted squares with allowed distances, then left-click a legal destination and confirm the other player receives the next turn.

**Acceptance Scenarios**:

1. **Given** a new game, **When** movement play begins, **Then** Player 1 controls Ship 1, Player 2 controls Ship 2, Player 1 goes first, and the active player, both ships' agility scores, and their separate modifiers are visible.
2. **Given** any integer agility score from 8 through 20, **When** its modifier is shown, **Then** it matches the modifier table in FR-002.
3. **Given** an unobstructed ship at row 5, column 5 with agility 14 and modifier +2, **When** its turn begins, **Then** exactly the 12 other squares within one or two orthogonal steps are highlighted, including row 6, column 6 because it takes two steps rather than one diagonal step.
4. **Given** the active ship has modifier +3, **When** its player left-clicks a highlighted square one step away, **Then** the ship moves there and its turn ends without retaining the other two steps.
5. **Given** a completed move, **When** the next turn becomes available, **Then** only the other player's ship can move and highlights reflect that ship's current location and allowance.
6. **Given** an active turn, **When** a player clicks the current square, an occupied square, an unreachable square, or outside the board, or uses a non-left mouse button, **Then** neither ship moves and the turn is not consumed.
7. **Given** a ship with agility 8 through 11, **When** its turn is reached, **Then** it has no legal movement destinations, a visible reason and pass button appear, and its turn remains active until the player clicks that button; no negative movement is permitted.
8. **Given** a new game, **When** ships are initialized, **Then** each ship receives an independent, equally likely random integer agility from 8 through 20, with its matching modifier, retained for that game.
9. **Given** a turn with no legal destinations, **When** the player clicks the pass button, **Then** the turn ends exactly once and the other player receives the next turn; if that player also has no legal destinations, they must acknowledge their own pass.

---

### User Story 2 - Navigate Around an Enemy (Priority: P2)

As a player, I want highlights to account for ships blocking my route so that I can move around an enemy only when my agility allows the full detour.

**Why this priority**: Correct routing makes positioning meaningful and prevents illegal shortcuts.

**Independent Test**: Place a ship at row 5, column 4 and an enemy at row 5, column 5. Compare the availability of row 5, column 6 with allowances of two and four steps.

**Acceptance Scenarios**:

1. **Given** the above arrangement and an allowance of two steps, **When** destinations are highlighted, **Then** row 5, column 6 is not highlighted because the direct route crosses the enemy.
2. **Given** the same arrangement and an allowance of four steps, **When** destinations are highlighted, **Then** row 5, column 6 is highlighted because an empty four-step route exists through row 4 or row 6, and clicking it moves around the enemy.
3. **Given** a destination with multiple possible routes, **When** at least one empty orthogonal route fits the allowance, **Then** the destination is available even if another route is blocked or too long.
4. **Given** a ship on an edge or corner, **When** destinations are highlighted, **Then** all routes remain on the board and exclude every occupied square.

---

### User Story 3 - Follow Smooth, Collision-Free Flight (Priority: P3)

As a player, I want to watch my ship fly smoothly to the selected destination, curving when it changes direction or passes around an enemy, so that the move is clear and visually believable.

**Why this priority**: Readable animation communicates the route and reinforces the movement rules.

**Independent Test**: Observe a straight move, a move changing both row and column, and a same-row detour around an enemy. Confirm smooth flight, clear separation from the other ship, and correct arrival before control passes.

**Acceptance Scenarios**:

1. **Given** a legal straight move, **When** its destination is selected, **Then** the ship visibly travels continuously from its original square to the center of its destination rather than teleporting.
2. **Given** a legal route that changes direction between rows and columns, **When** the move plays, **Then** direction changes follow smooth arcs rather than abrupt right-angle turns; a straight unobstructed same-row or same-column move may remain straight.
3. **Given** an enemy between the origin and a reachable destination, **When** the move plays, **Then** the flight curves around the enemy without visually intersecting it or cutting through its occupied square, even if origin and destination share a row or column.
4. **Given** a move in progress, **When** either player clicks repeatedly, **Then** no second move begins, no destination changes, and the turn changes exactly once after arrival.

### Edge Cases

- Agility 8–9 gives −1 and 10–11 gives 0: both permit zero movement, not backward movement or an extra square.
- Agility 20 gives +5; routes requiring six steps are unavailable even if the destination appears close across an enemy.
- A diagonally adjacent destination requires two empty orthogonal steps. Curved visuals never authorize a one-step diagonal shortcut.
- The active ship's original square is not a destination; selecting it does not end a turn.
- A destination's allowance is based on the shortest available legal route, not straight-line distance or animated curve length.
- A detour cannot leave the board to bypass an enemy near an edge; smooth flight also stays within the board.
- Occupancy and highlights are refreshed after every completed move, before another move can be accepted.
- A ship with no reachable destination shows a visible explanation and pass button, with no highlights. Its turn remains active until the button is clicked.
- If neither ship can move, each turn waits for its player's pass-button click; turns never cycle automatically, and movement clicks do not acknowledge a pass.
- Consecutive games may assign the same agility values, and both ships may receive the same score. Starting positions do not constrain agility selection.
- A new game started during flight discards that move, restores the existing new-game setup, and begins again with Player 1; the interrupted move cannot alter the new game.
- An agility value outside the integer range 8–20 is invalid and cannot become a playable ship stat.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each ship MUST have an integer agility score from 8 through 20 inclusive and a separate derived modifier. Values outside that range MUST NOT become playable ship stats.
- **FR-002**: The agility modifier MUST increase by one for every two score points, with the following exact mapping:

  | Agility score | Modifier |
  | --- | --- |
  | 8–9 | −1 |
  | 10–11 | 0 |
  | 12–13 | +1 |
  | 14–15 | +2 |
  | 16–17 | +3 |
  | 18–19 | +4 |
  | 20 | +5 |

- **FR-003**: Players MUST be able to see each ship's agility score and modifier as distinct values and identify the currently active player and ship.
- **FR-004**: Two local players MUST alternate turns, each controlling only their assigned ship, with Player 1 taking the first turn of each new game.
- **FR-005**: A turn MUST permit one move to a different square using at most the active ship's agility modifier in grid steps, treating modifiers of zero or less as zero movement. Choosing a shorter move MUST end the turn without carrying unused steps forward.
- **FR-006**: Each counted grid step MUST connect horizontally or vertically adjacent squares. Diagonal steps, leaving the board, passing through other ships' occupied squares, and ending on an occupied square MUST be prohibited.
- **FR-007**: A destination MUST be legal if and only if at least one route of empty orthogonally adjacent squares reaches it within the allowance. The presence of a blocked direct route MUST NOT invalidate an affordable detour.
- **FR-008**: Before accepting a destination, the board MUST highlight all and only legal destination squares for the active ship, excluding its origin, and refresh those highlights for each new turn and completed move.
- **FR-009**: A single left mouse click on a highlighted square MUST select that destination and begin the move without a separate confirmation. Invalid targets and other mouse buttons MUST leave the positions and turn unchanged.
- **FR-010**: The selected move MUST visibly animate from the ship's origin to the destination center, following a legal route within its movement allowance. Unobstructed straight routes may be straight; routes changing direction MUST use smooth arcs at direction changes.
- **FR-011**: Animated flight MUST remain within the board and avoid crossing any other ship's occupied square or visually overlapping that ship. Routes around a blocking ship MUST curve around it, including when the destination shares the origin's row or column. Curves MUST NOT create a shortcut through blocked space or change the counted movement allowance.
- **FR-012**: During flight, destination selection MUST be disabled and actionable destination highlights MUST be removed. On arrival, the ship MUST occupy exactly the selected square and control MUST pass exactly once to the other player, with updated highlights.
- **FR-013**: A player with no legal destinations MUST see an explanation and a pass button. The turn MUST remain active until that button is clicked, then pass exactly once to the other player. The pass button MUST be unavailable when legal movement exists and during flight. If neither ship has legal destinations, each successive turn MUST wait for its player's explicit pass-button click rather than cycling automatically.
- **FR-014**: Starting a new game MUST preserve the established 10 × 10 board and randomized opposing starting zones, restore Player 1's first turn, and discard any in-progress move and previous highlights.
- **FR-015**: Each new game MUST independently assign each ship a random integer agility from 8 through 20 inclusive, with all 13 scores equally likely, and derive its modifier using FR-002. Scores MUST remain unchanged during that game. A new game MUST make fresh selections, which may match previous values; ship positions MUST NOT constrain agility selection. Player-driven stat editing is outside this feature.

### Key Entities *(include if feature involves data)*

- **Spaceship**: One of the two existing ships, with an identity, owning player, occupied square, agility score, and derived modifier.
- **Agility Stat**: A score from 8 through 20 paired with its separate stepped modifier; the modifier determines the movement allowance.
- **Local Player**: Player 1 or Player 2, each owning one ship and sharing the local board and mouse interaction.
- **Turn**: The active player's opportunity for one move, including its allowance, legal destinations, flight in progress, or a no-moves state awaiting a pass-button click.
- **Legal Route**: A sequence of orthogonally adjacent, unoccupied board squares from the origin to a destination; its number of steps determines affordability.
- **Animated Move**: The selected origin, destination, legal route, and visible flight ending in a single handoff of control.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For all 13 valid agility scores, displayed modifiers match FR-002 in 100% of checks, and no permitted move exceeds the corresponding nonnegative allowance.
- **SC-002**: Across at least 20 board arrangements covering center, edge, corner, blocked-direct-route, and affordable-detour cases, 100% of highlighted squares match the legal destinations and no legal destination is omitted.
- **SC-003**: Across 50 consecutive completed moves, players alternate correctly every time, each move ends on the selected square, and invalid or repeated clicks cause zero extra moves or turn changes.
- **SC-004**: On the existing 100-square board, actionable highlights appear within 200 milliseconds of a playable turn beginning. Every accepted move visibly animates and completes within 1.5 seconds, followed by the next turn's highlights within 200 milliseconds.
- **SC-005**: Across at least 10 observed animations covering straight moves, row-and-column changes, enemy detours, and board edges, all moves arrive at the selected square with continuous flight, all direction changes are curved, and zero moves visibly intersect another ship or leave the board.
- **SC-006**: At least 4 of 5 first-time players identify the active ship, choose a legal destination, and recognize the handoff to the other player within 30 seconds without assistance.
- **SC-007**: In checks of nonpositive modifiers, a blocked ship, both ships unable to move, invalid agility values, and a new game during flight, every case enforces the specified valid-stat, acknowledged-pass, or fresh-game behavior without accepting an illegal move or applying an interrupted move. Across 20 acknowledged passes, zero turns advance before a pass-button click and every click advances exactly one turn, including when both ships cannot move.
- **SC-008**: Across 1,000 new games, every assigned agility is an integer from 8 through 20, each ship receives all 13 scores at least once, and every displayed modifier matches FR-002. Equal probability and independent selection are additionally reviewed against FR-015; this sample alone does not establish fairness.

## Assumptions

- This feature extends `specs/001-spaceship-grid-setup/spec.md`: the existing 10 × 10 board, one-square ships, identities, and randomized starting zones remain the foundation. Rows are numbered top to bottom and columns left to right.
- Two players share one local game and mouse. Player 1 owns Ship 1 and starts; Player 2 owns Ship 2.
- Agility is independently randomized for each ship at the start of each game, as clarified by the user. Stat selection by players and progression are outside scope; all valid scores remain supported by the movement rules.
- Nonpositive modifiers provide zero movement. Players must acknowledge a no-moves turn with the pass button, including when neither ship can move. Voluntary passing when legal moves exist is outside scope.
- Players choose a destination rather than individual route steps. An available shortest legal route is used; any equally short route is acceptable. Visual curves smooth that route without altering grid-step costs or permitting blocked-square crossings.
- “Different row or column” is interpreted as flight that changes direction between grid axes, or requires an obstacle detour. An unobstructed flight wholly within one row or column may be straight.
- The first playable turn begins after the existing game initialization. Combat, scoring, victory conditions, additional obstacles, networking, and mid-turn stat changes are outside this feature.
- Timing targets are evaluated on the existing 100-square board in a foreground, visible tab using the current stable desktop Chromium browser, a 1280 × 800 viewport, hardware-accelerated WebGL, and a reference desktop with at least four logical CPU cores and 8 GB RAM. Developer-tool CPU/network throttling must be disabled. Record the exact browser version, OS, CPU, RAM, GPU and display refresh rate before acceptance testing. These conditions define the measurement baseline, not minimum requirements for running the game. No external service or data dependency is introduced.
