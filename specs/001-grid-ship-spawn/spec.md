# Feature Specification: Grid Ship Spawn

**Feature Branch**: `001-grid-ship-spawn`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "a 10 x 10 grid 2 space ships, where a space ship can occupy a single grid square the ships' starting points are random within a constrained space - ship 1 the first two rows at the top of the grid, ship 2 the first two rows at the bottom of the grid"

## Clarifications

### Session 2026-10-14

- Q: Who controls each ship in this game setup, and does that control distinction need to be part of this feature? → A: Setup only — ship placement only; ownership/control (player/AI/hotseat) is out of scope for this feature.
- Q: How must the 10x10 grid and ship positions be presented to the player in this feature? → A: Graphical 2D board with visible grid squares and ships.
- Q: How should the random seed for ship placement be chosen and surfaced in normal play? → A: Developer-only detail — no player-visible seed UX required; seedability is for tests/reproducibility.
- Q: How must Ship 1 and Ship 2 be visually distinguished from each other on the 2D board? → A: Distinct shape and color — identifiable without relying on color alone.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Battle Grid With Starting Ships (Priority: P1)

A player starts a new game and sees a 10x10 grid with two spaceships placed at random starting positions — one near the top edge, one near the bottom edge.

**Why this priority**: This is the foundational game setup; without a correctly sized grid and placed ships there is no playable game state.

**Independent Test**: Can be fully tested by starting a new game and verifying the grid dimensions and that each ship occupies exactly one square in its correct spawn zone. Delivers a visible initial board state.

**Acceptance Scenarios**:

1. **Given** a new game is started, **When** the board is created, **Then** the grid has exactly 10 rows and 10 columns (100 squares).
2. **Given** a new game is started, **When** spawn positions are resolved, **Then** Ship 1 occupies exactly one square within rows 1–2 (top zone) and Ship 2 occupies exactly one square within rows 9–10 (bottom zone).
3. **Given** a new game is started, **When** the board is displayed, **Then** both ships are visible at distinct squares and each square holds at most one ship.

---

### User Story 2 - Randomized Starting Positions Per Game (Priority: P2)

A player starts multiple new games and sees different ship starting positions across games, so each playthrough begins differently.

**Why this priority**: Randomization within constrained zones provides replayability while preserving fair separation between the two ships.

**Independent Test**: Can be fully tested by starting several new games (with different seeds) and observing that spawn positions vary over time while always remaining inside the correct zones.

**Acceptance Scenarios**:

1. **Given** two new games started with different random seeds, **When** spawn positions are compared, **Then** positions vary across games with uniform coverage of each spawn zone over many games (no single square always chosen).
2. **Given** a new game started with a fixed seed, **When** the game is restarted with the same seed, **Then** the same spawn positions are produced (reproducible setup).

---

### Edge Cases

- What happens when both ships would randomly select overlapping squares? Cannot occur with disjoint top/bottom zones, but the setup MUST still guarantee distinct squares if zones ever change.
- How does the system handle repeated game creation in quick succession? Each new game MUST produce an independent random draw (no deterministic repetition unless seeded).
- What happens at grid boundaries? Spawn zones include edge rows/columns; ships on edge squares MUST be valid positions (no off-board placement).
- How is invalid state (grid not 10x10, ship outside zone, ship sharing a square) detected? Setup MUST validate and reject/fail loudly rather than silently correcting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a grid with exactly 10 rows and 10 columns (100 uniquely addressable squares) at game start.
- **FR-002**: System MUST place exactly 2 spaceships on the grid at game start, each occupying exactly one grid square.
- **FR-003**: System MUST constrain Ship 1's starting position to the top spawn zone: rows 1–2, columns 1–10 (20 eligible squares).
- **FR-004**: System MUST constrain Ship 2's starting position to the bottom spawn zone: rows 9–10, columns 1–10 (20 eligible squares).
- **FR-005**: System MUST select each ship's starting square randomly with uniform probability across its eligible spawn zone squares per game.
- **FR-006**: System MUST use a seedable random source for spawn selection so a given seed always reproduces the same starting positions.
- **FR-007**: System MUST guarantee the two ships occupy distinct squares after setup.
- **FR-008**: System MUST validate the initial state (grid dimensions, one square per ship, zone membership, distinctness) and reject invalid setups with an explicit error.
- **FR-009**: System MUST render the grid state and both ship positions on a graphical 2D board so the player can see grid squares and ship locations (no hidden placement, no text-only substitute). Ship 1 and Ship 2 MUST be visually distinguishable by both shape/sprite and color (color MUST NOT be the sole distinguishing signal).

### Key Entities

- **Grid**: A 10x10 arrangement of uniquely addressable squares; attributes: row count (10), column count (10), coordinate addressing of each square.
- **Spaceship**: An entity occupying exactly one grid square; attributes: identity (Ship 1 / Ship 2), current position (single square coordinate).
- **Spawn Zone**: A constrained set of eligible starting squares; Ship 1 zone = top two rows, Ship 2 zone = bottom two rows; relationship: each ship's initial position MUST be a member of its zone.
- **Game Setup / Seed**: The initial configuration inputs; attributes: random seed driving spawn selection, resulting ship positions; relationship: seed + rules deterministically produce starting positions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every new game produces a 10x10 board with 2 ships each occupying exactly one square in 100% of setups.
- **SC-002**: In 100% of new games, Ship 1 starts within the top two rows and Ship 2 starts within the bottom two rows.
- **SC-003**: Across 100 seeded new games covering all eligible squares, each spawn-zone square is selected at least once (no unreachable square) and selection distribution is approximately uniform.
- **SC-004**: Repeating a setup with the same seed reproduces identical ship positions in 100% of trials.
- **SC-005**: A player can identify the grid boundaries and both ship starting positions within 10 seconds of viewing a new game board.

## Assumptions

- Coordinate convention: rows 1–10 top-to-bottom, columns 1–10 left-to-right; row 1 is the top edge, row 10 is the bottom edge. Zero- vs one-indexing is an implementation detail as long as the top-two / bottom-two row semantics hold.
- Each ship occupies a single square with no size, orientation, or overlap; no movement, combat, or turn rules are in scope for this feature — setup only.
- Uniform random selection across the 20 eligible squares per ship is the default distribution.
- Randomness MUST be seedable per Constitution Principle I (deterministic rules); seed selection/surfacing is a developer-only detail with no player-visible seed UX required — reproducibility from a stored seed is required for tests/replays (clarified 2026-10-14).
- Spawn zones are fixed game data (top two rows / bottom two rows) and MUST be defined as data separate from setup logic per Constitution Principle IV.
- Single local game session; no multiplayer, persistence, or save/load behavior is introduced by this feature beyond seed reproducibility (full save/load round-trip applies to later features).
- Both ships are always present; no option to play with fewer/more ships in this feature.
- Ship ownership/control (human player, AI opponent, hotseat, or sandbox control of both ships) is explicitly out of scope for this feature; ships are identified only as Ship 1 / Ship 2 with positions (clarified 2026-10-14).
- Visual representation MUST be a graphical 2D board showing grid squares and ships legibly per Constitution Principle II (clarified 2026-10-14); the two ships MUST differ by both shape/sprite and color; specific sprite art is flexible, but a text/console-only or data-only presentation does not satisfy this feature.

## Constitution Compliance

- Principle I (Deterministic Rules): FR-006 + SC-004 require seedable, reproducible spawn selection.
- Principle II (Player Clarity): FR-009 + SC-005 require visible, legible starting positions.
- Principle III (Test-First): Setup rules, zone constraints, and seeded RNG cases MUST have automated tests before implementation.
- Principle IV (Data-Driven): grid dimensions (10x10) and spawn zone definitions MUST live in data, not hard-coded logic.
- Principle V (Simplicity): setup-only scope; no movement/combat/multiplayer speculative systems.
