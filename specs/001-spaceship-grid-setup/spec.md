# Feature Specification: Spaceship Grid Setup

**Feature Branch**: `redo`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "a 10 x 10 grid 2 space ships, where a space ship can occupy a single grid square the ships' starting points are random within a constrained space - ship 1 the first two rows at the top of the grid, ship 2 the first two rows at the bottom of the grid"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View the Initial Board (Priority: P1)

As a player starting a game, I want to see a 10 × 10 board with two distinguishable spaceships, each occupying one square, so that I can understand the starting layout.

**Why this priority**: The board and the two ships provide the foundational game state and make the starting positions visible to the player.

**Independent Test**: Start a game and inspect the board. Confirm that it contains 10 rows, 10 columns, and exactly two identifiable ships occupying one square each.

**Acceptance Scenarios**:

1. **Given** a game has not yet started, **When** the player starts a game, **Then** a board containing exactly 10 rows and 10 columns is displayed with exactly two ships, identified as Ship 1 and Ship 2.
2. **Given** an initialized board, **When** the player inspects either ship, **Then** that ship occupies exactly one square and no square contains both ships.
3. **Given** an initialized board, **When** the player views it again without starting a new game, **Then** both starting positions remain unchanged.

---

### User Story 2 - Receive Randomized Opposing Starting Positions (Priority: P2)

As a player starting a new game, I want each ship to start at a randomly selected square within its own starting zone, so that starting layouts can vary while the ships begin at opposite ends of the board.

**Why this priority**: Constrained random placement provides variation while preserving the requested top-versus-bottom setup.

**Independent Test**: Initialize repeated new games and inspect the starting positions. Confirm that each ship stays in its assigned zone, all 20 squares in each zone are eligible, and selection is not restricted to a fixed position or column.

**Acceptance Scenarios**:

1. **Given** a new game is starting, **When** Ship 1 is placed, **Then** its square is randomly selected from rows 1 or 2 and columns 1 through 10.
2. **Given** a new game is starting, **When** Ship 2 is placed, **Then** its square is randomly selected from rows 9 or 10 and columns 1 through 10.
3. **Given** a previous game has been initialized, **When** another new game starts, **Then** each ship receives a fresh, independent random selection from its own 20 eligible squares; matching a previous position is permitted.
4. **Given** the starting zones, **When** starting positions are selected, **Then** every square within each ship's zone is equally eligible and neither ship's selection constrains the other's column.

### Edge Cases

- The outermost squares are valid: Ship 1 may occupy row 1 or 2 at column 1 or 10, and Ship 2 may occupy row 9 or 10 at column 1 or 10.
- Rows 3 through 8 must contain no ships in the initial layout.
- Both ships may start in the same column because their row ranges are disjoint.
- Consecutive new games may produce the same position for one or both ships; randomness does not guarantee a different layout each time.
- Viewing an existing game repeatedly must not reselect its starting positions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST present a board with exactly 10 rows and 10 columns, totaling 100 squares.
- **FR-002**: Every new game MUST initialize exactly two distinguishable spaceships, identified as Ship 1 and Ship 2.
- **FR-003**: Each spaceship MUST occupy exactly one board square, entirely within the board boundaries, and the two ships MUST occupy distinct squares.
- **FR-004**: Ship 1's initial square MUST be in one of the topmost two rows, defined as rows 1 and 2 when counting from top to bottom.
- **FR-005**: Ship 2's initial square MUST be in one of the bottommost two rows, defined as rows 9 and 10 when counting from top to bottom.
- **FR-006**: Each ship's initial square MUST be selected randomly with equal probability among the 20 squares in its starting zone, independently of the other ship's selection.
- **FR-007**: Starting a new game MUST perform a fresh selection for both ships; the resulting positions MAY match those of a previous game.
- **FR-008**: The initial board MUST visibly associate each ship's identity with its occupied square so that the player can distinguish Ship 1 from Ship 2.
- **FR-009**: Once initialized, the starting layout MUST remain stable when viewed repeatedly within the same game.

### Key Entities *(include if feature involves data)*

- **Board**: The game area containing 100 squares arranged into 10 rows and 10 columns.
- **Square**: One location on the board, identified by a row and a column; rows run from 1 at the top to 10 at the bottom, and columns run from 1 at the left to 10 at the right. A square is empty or occupied by one ship.
- **Spaceship**: One of the two identifiable game pieces, with an identity and one occupied square.
- **Starting Zone**: The 20 eligible starting squares assigned to a ship: rows 1–2 for Ship 1 and rows 9–10 for Ship 2.
- **Game Setup**: A new game's board and two selected starting positions, retained while that game's initial layout is viewed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100 consecutive new-game setups, 100% display exactly 100 squares and exactly two ships, with each ship occupying one distinct square.
- **SC-002**: Across 1,000 new-game setups, 100% of Ship 1's starting positions lie in rows 1–2 and 100% of Ship 2's starting positions lie in rows 9–10; rows 3–8 are empty in every initial layout.
- **SC-003**: Across 1,000 new-game setups, each ship appears in all 20 eligible squares at least once, demonstrating that starting layouts are not fixed to a single row, column, or square. Equal-probability selection is additionally reviewed against FR-006; this sample alone does not establish fairness.
- **SC-004**: In a usability check, at least 4 of 5 first-time players correctly identify both ships and their occupied squares within 10 seconds of seeing the initialized board, without assistance.
- **SC-005**: In 20 repeated views of the same initialized game, both ships retain their original starting squares in every view.

## Assumptions

- This feature covers the initial board and ship placement. Movement, turns, combat, scoring, obstacles, and win conditions are outside this feature's scope.
- The board is shown with a consistent top and bottom. Row and column numbers define requirements and need not be displayed to players.
- "Random" means every eligible square has an equal chance of selection; each ship is selected independently.
- Starting a game is the trigger for setup; the exact entry-point interaction will be determined during planning.
- No specific visual style is required beyond a readable grid, visible occupancy, and distinguishable ship identities.
- The initial board contains only the two ships and empty squares, leaving all 20 squares of each starting zone available.
- There are no external data or service dependencies for determining starting positions.
