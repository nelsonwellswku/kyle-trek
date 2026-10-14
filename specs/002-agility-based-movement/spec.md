# Feature Specification: Agility-Based Movement

**Feature Branch**: `002-agility-based-movement`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "1. each ship has an "agility" stat that goes from 8 to 20 2. a stat has a stat modifier with the following values:
  | stat | modifier |
  | 8-9 | -1 |
  | 10-11 | 0 |
  | 12-13 | 1 |
  | 14-15 | 2 |
  | 16-17 | 3 |
  | 18-19 | 4 |
  | 20 | 5 |
3. local players alternate turns 4. each turn, they can move their ship up to the number of squares equal to their agility stat modifier 5. movement can only be left or right or up or down on the grid, not diagonal 6. the players available squares to move to should be highlighted 7. the player may select where they move by left clicking the mouse on the square 8. after a player movies, their turn is over and the other player may make their move"

## Clarifications

### Session 2026-10-14

- Q: How should each ship's agility stat value (8–20) be determined at game start? → A: Randomly rolled 8–20 per ship each game (seedable).
- Q: When the opposing ship sits on a square between the active ship and a farther destination, should squares beyond it still be reachable? → A: Ships may move any cardinal direction but may not pass through the opposing ship's square (an alternate orthogonal route around it still allows the destination).
- Q: Who should move first in each new game? → A: Player 1 (Ship 1) always moves first every game.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Alternate Turns Moving Up To Agility Range (Priority: P1)

Two local players share one screen. Player 1 moves Ship 1, then Player 2 moves Ship 2, alternating. On a turn, the active player moves their ship orthogonally (up/down/left/right only) by a number of squares up to their ship's agility modifier.

**Why this priority**: This is the core turn loop; without alternating bounded movement there is no playable game.

**Independent Test**: Can be fully tested by starting a game with known agility values, making one move per player, and verifying each ship moved only orthogonally within its allowed range and control passed to the other player. Delivers a playable movement turn.

**Acceptance Scenarios**:

1. **Given** it is Player 1's turn with Ship 1 having agility modifier 2, **When** Player 1 selects a square 2 steps away orthogonally (e.g., 2 up, or 1 up + 1 right), **Then** the ship relocates there and the turn ends.
2. **Given** it is a player's turn with agility modifier 2, **When** the player attempts to select a square requiring 3+ orthogonal steps (Manhattan distance > 2), **Then** the move is not allowed.
3. **Given** it is a player's turn, **When** the player attempts to move diagonally (a square reachable only via a diagonal step), **Then** the move is not allowed unless an orthogonal path of legal length also reaches it.
4. **Given** Player 1 has just completed a move, **When** the move resolves, **Then** it becomes Player 2's turn with Ship 2 as the active ship.

---

### User Story 2 - Preview Legal Destinations Via Highlighting (Priority: P2)

At the start of a player's turn, all squares the active ship can legally move to are visually highlighted on the grid so the player can plan without counting manually.

**Why this priority**: Highlighting makes the agility rule legible and prevents illegal-move trial and error; it directly serves informed strategy but depends on the movement rule existing first.

**Independent Test**: Can be fully tested by starting a turn with a known ship position and agility modifier and verifying the exact set of highlighted squares matches the legal destination set. Delivers decision support independent of click handling.

**Acceptance Scenarios**:

1. **Given** it is a player's turn with Ship at a central square and modifier 1, **When** the turn begins, **Then** exactly the orthogonally adjacent in-bounds legal squares (up to 4) are highlighted plus the option to stay in place.
2. **Given** a ship is at a board edge or corner, **When** the turn begins, **Then** only in-bounds squares within range are highlighted (no off-board highlights).
3. **Given** highlighted squares are shown, **When** it becomes the other player's turn, **Then** the previous highlights are cleared and replaced by the new active ship's legal set.

---

### User Story 3 - Click A Highlighted Square To Move (Priority: P3)

The active player confirms their move by left-clicking a highlighted destination square (or their current square to stay in place); the ship moves there and the turn passes.

**Why this priority**: Click-to-move is the input mechanism that completes the loop; it has value only once movement rules and highlights exist.

**Independent Test**: Can be fully tested by clicking a highlighted square and observing the ship relocate and turn ownership change, and by clicking a non-highlighted square and observing nothing changes. Delivers the complete interactive turn.

**Acceptance Scenarios**:

1. **Given** it is a player's turn with highlights shown, **When** the player left-clicks a highlighted square, **Then** the ship moves to that square and the turn passes to the other player.
2. **Given** it is a player's turn, **When** the player left-clicks a non-highlighted square (out of range, diagonal-only, or off-limits), **Then** the ship does not move and the turn does not pass.
3. **Given** it is a player's turn, **When** the player left-clicks the ship's current square, **Then** the ship stays in place and the turn passes (a pass move).

---

### Edge Cases

- What happens when a ship's agility modifier is 0 or negative (agility 8–11)? The ship has no legal relocation squares; the only legal action is to stay in place (left-click current square), which ends the turn.
- What happens when a ship is boxed in at an edge with the opponent's ship occupying one of the few in-range squares? Occupied squares are excluded from highlights and cannot be landed on or moved through.
- What happens when the player clicks during the other player's turn or clicks the non-active ship? Input is ignored; only the active player's ship responds during its turn.
- What happens when the legal destination set is empty except staying in place (low agility + blocked surroundings)? Highlights show only the current square; the player must confirm staying in place to pass the turn.
- How does the system handle rapid double-clicks or clicking after the turn has already passed? Only the first valid click on the active turn takes effect; post-move clicks belong to the next player's turn state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST randomly assign each ship an agility stat integer from 8 to 20 inclusive at game start, using a seedable random source so a given seed reproduces the same agility values; agility stats remain fixed for the duration of the game.
- **FR-002**: System MUST derive each ship's agility modifier from its agility stat using exactly this mapping: 8–9 → -1; 10–11 → 0; 12–13 → 1; 14–15 → 2; 16–17 → 3; 18–19 → 4; 20 → 5.
- **FR-003**: Game MUST alternate turns between the two local players sharing one screen; only the active player's ship may move during that turn, starting with Player 1 / Ship 1 on the first turn of a game.
- **FR-004**: On a turn, the active ship MAY move up to a number of squares equal to its agility modifier; moving fewer squares (including zero) is always allowed. Effective relocations require modifier ≥ 1; modifier ≤ 0 means the ship cannot relocate and may only stay in place.
- **FR-005**: Movement MUST be orthogonal only (up, down, left, right along grid rows/columns); diagonal steps are not allowed, and a destination is legal only if its Manhattan distance from the origin is ≤ the agility modifier and at least one orthogonal path of that length exists within the board that does not pass through the square occupied by the other ship.
- **FR-006**: System MUST compute the legal destination set at the start of each turn as all in-bounds squares with Manhattan distance ≤ modifier, excluding the square occupied by the other ship and excluding any destination for which every orthogonal path of legal length would pass through the other ship's square, plus the ship's current square (stay-in-place).
- **FR-007**: System MUST visually highlight all legal destination squares for the active ship for the duration of that player's turn and MUST clear or replace highlights when the turn changes. Highlighting MUST use a signal beyond color alone (e.g., shape/outline/marker) so it is not color-only.
- **FR-008**: System MUST allow the active player to select their destination by left-clicking a highlighted square, including their current square to stay in place.
- **FR-009**: System MUST ignore left-clicks on non-highlighted squares (no movement, no turn change) and MUST ignore input directed at the non-active ship.
- **FR-010**: After a legal destination (including staying in place) is selected and resolved, the system MUST end the active player's turn and transfer control to the other player.
- **FR-011**: System MUST display whose turn it is and which ship is active, and MUST show each ship's agility stat and derived modifier before or during the turn so movement range is explainable.
- **FR-012**: Movement legality (range computation, occupancy exclusion, turn alternation) MUST be deterministic from game state with no hidden modifiers; the same state MUST always produce the same legal destination set.

### Key Entities

- **Ship**: A player-controlled entity occupying exactly one grid square; attributes: identity (Ship 1 / Ship 2), current position, agility stat (8–20, randomly rolled per ship at game start via seedable RNG, fixed for the game).
- **Agility Stat & Modifier**: Agility stat is an integer 8–20 per ship; modifier is derived via the fixed mapping table (-1 to 5); relationship: modifier sets the maximum orthogonal movement range for that ship's turns.
- **Turn**: The unit of alternating play; attributes: active player (Player 1 / Player 2), active ship, legal destination set; relationship: exactly one turn is active at a time; each resolved move produces exactly one successor turn owned by the other player.
- **Legal Destination Set**: The squares the active ship may move to this turn; attributes: origin square, Manhattan-distance bound (modifier), occupancy exclusions; relationship: computed from ship position + modifier + board occupancy at turn start.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of turns, a ship that moves relocates only to a square within its agility modifier range via orthogonal steps; zero out-of-range or diagonal relocations occur.
- **SC-002**: Players can identify whose turn it is, their movement range, and all legal destinations within 10 seconds of a turn starting in 90% of observed turns.
- **SC-003**: 100% of left-clicks on highlighted squares result in the ship relocating (or passing when clicking the current square) and the turn passing; 100% of clicks on non-highlighted squares result in no movement and no turn change.
- **SC-004**: Turn alternation holds without skips or repeats — after each resolved move, control transfers to the other player in 100% of turns over a 20-turn session.
- **SC-005**: Ships with agility 8–11 (modifier ≤ 0) correctly have no relocation options and can complete their turn by staying in place in 100% of such turns.

## Assumptions

- Grid and spawn behavior from the prior feature (10×10 grid, one square per ship, distinct positions) still hold; movement is bounded to rows 1–10, columns 1–10.
- Two local human players on one screen (hotseat); no AI, network play, or simultaneous moves in this feature.
- Player 1 controls Ship 1 and moves first each game; Player 2 controls Ship 2.
- Manhattan distance is the range metric: distance = |row difference| + |column difference|; any destination with distance ≤ modifier is reachable orthogonally on an open board.
- A ship may not land on or pass through the square occupied by the other ship; a destination beyond the opponent is still legal if at least one orthogonal route of legal length goes around it (clarified 2026-10-14; preserves the distinctness invariant).
- Staying in place (moving zero squares) is always legal, counts as the turn's move, and passes the turn — this keeps modifier ≤ 0 turns from deadlocking the game.
- Agility stats and the stat→modifier table are game data separable from movement logic; agility values are randomly rolled 8–20 per ship at game start via the seedable random source (clarified 2026-10-14) and stay fixed for the game.
- Input is a standard mouse with left-click as the confirm action; keyboard equivalents are out of scope for this feature.
- No terrain, obstacles, attacks, or action points beyond movement in this feature; movement is the only action a turn contains.

## Constitution Compliance

- Principle I (Deterministic Rules): FR-002, FR-006, FR-012 require exact modifier mapping and state-determined legal sets reproducible from state.
- Principle II (Player Clarity): FR-007, FR-011 + SC-002 require visible turn ownership, previewed range, and non-color-only highlights with no silent state changes.
- Principle III (Test-First): Movement bounds, modifier mapping (including -1/0 edge), highlight set correctness, click accept/reject, and turn handoff MUST have automated tests written before implementation.
- Principle IV (Data-Driven): Agility stats and the stat→modifier table MUST live in data, not hard-coded logic; balance changes MUST NOT require logic rewrites.
- Principle V (Simplicity): Scope is movement-only on the existing grid; no combat, terrain, AI, or multiplayer speculative systems.
