# Feature Specification: Ship Torpedo Combat

**Feature Branch**: `redo`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "Add strength and constitution scores and modifiers to ships, calculate hit points at the start of battle, set armor class to 12, and let each player move then launch an animated photo torpedo attack. Resolve attacks with d20 attack rolls and d8 damage rolls; a ship reduced to zero hit points loses."

## Clarifications

### Session 2026-10-16

- Q: If the starting hit-point formula produces zero or a negative number, how should the game handle it? → A: Use the formula, but raise any result below 1 to 1 hit point.
- Q: After moving, must a player attack, or may they end their turn without attacking? → A: Allow the player to attack or explicitly end the turn without attacking.
- Q: How long should a torpedo attack take from launch until the result is shown and the next turn becomes available? → A: Complete each attack within 1.5 seconds, including the explosion on a hit or the projectile leaving the board on a miss.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prepare Ships for Battle (Priority: P1)

As a player starting a battle, I want to see each ship's combat stats and starting hit points so that I understand its strengths and how much damage it can take.

**Why this priority**: Combat cannot be resolved fairly or understood unless both ships have visible, consistently calculated stats before the first turn.

**Independent Test**: Start a new battle and inspect both ships. Confirm their agility, strength, constitution, corresponding modifiers, hit points, and armor class are visible and satisfy the stated ranges and formulas.

**Acceptance Scenarios**:

1. **Given** a new battle, **When** the ships are initialized, **Then** each ship has agility, strength, and constitution scores from 8 through 20 inclusive, and each score has a separate modifier calculated by the same mapping.
2. **Given** a ship's constitution modifier and its initial hit-point roll, **When** battle hit points are calculated, **Then** hit points equal the roll from 0 through 20 plus twice the constitution modifier, with a minimum starting value of 1.
3. **Given** either ship, **When** its battle stats are displayed, **Then** its armor class is 12 and its scores, modifiers, hit points, and armor class can be distinguished from one another.
4. **Given** an initialized battle, **When** the players take turns, **Then** these starting stats do not change; starting a new battle creates new stat assignments and hit-point rolls.

---

### User Story 2 - Move and Take a Combat Turn (Priority: P1)

As a local player, I want to move my ship and then choose the opposing ship to attack so that each turn follows a clear, alternating sequence.

**Why this priority**: The ordered movement-and-attack turn is the central interaction that makes the battle playable.

**Independent Test**: Start a battle with known agility and board positions. Move the active ship to a legal destination, then click the opponent and confirm one attack resolves before the next player becomes active.

**Acceptance Scenarios**:

1. **Given** a new battle, **When** turns begin, **Then** Player 1 acts first, each player controls their assigned ship, and players alternate after an attack resolves or the active player explicitly ends the turn without attacking.
2. **Given** a player's turn, **When** the movement action begins, **Then** the player may make one move to a different legal square within the ship's existing agility-based movement allowance, and cannot attack before the movement action is resolved.
3. **Given** the movement action is resolved, **When** the attack action begins, **Then** clicking the opposing ship launches one attack, and resolving that attack ends the active player's turn.
4. **Given** the active ship has no legal movement destination, **When** the player acknowledges skipping movement, **Then** the ship remains in place and the player proceeds to the attack action without ending the turn.
5. **Given** an action or attack animation is in progress, **When** either player clicks the board, **Then** no extra movement, attack, or turn change occurs.
6. **Given** the attack action is available after movement or an acknowledged movement skip, **When** the player chooses End turn, **Then** no torpedo is launched, neither ship's hit points change, and control passes exactly once to the other player.
7. **Given** movement is unresolved, an animation is playing, or the battle is over, **When** the player attempts to end the turn, **Then** the End turn action is unavailable and the battle state does not change.

---

### User Story 3 - Resolve and See a Torpedo Attack (Priority: P1)

As a player launching a photo torpedo, I want to see whether it hits, how much damage it causes, and whether the battle is over so that combat outcomes are clear and exciting.

**Why this priority**: Attacks, visible outcomes, and the win condition give the movement turns a meaningful objective.

**Independent Test**: Resolve attacks with known die results that produce both a hit and a miss. Confirm the attack threshold, damage calculation, ship hit points, projectile animation, and victory state.

**Acceptance Scenarios**:

1. **Given** an attack action, **When** the player clicks the opposing ship, **Then** an attack roll uses a 20-sided die result from 1 through 20 plus the attacker's strength modifier.
2. **Given** an attack total equal to or greater than the defender's armor class, **When** the attack resolves, **Then** it hits, rolls an 8-sided die from 1 through 8 plus the attacker's strength modifier, subtracts the resulting damage from the defender's hit points, and displays the attack total, damage, and remaining hit points.
3. **Given** an attack total below the defender's armor class, **When** the attack resolves, **Then** it misses, displays the attack total and miss result, and the defender's hit points do not change.
4. **Given** a successful hit, **When** the photo torpedo is launched, **Then** a blinking star travels from the attacking ship to the defending ship and an explosion appears on contact before the hit's damage is shown.
5. **Given** a missed attack, **When** the photo torpedo is launched, **Then** its prominent blinking star uses a fresh independent random choice of launch angle from 10°–35° to either side of the direct attacker-to-defender line, remains fully on-screen through its closest approach to the defender, then continues off-screen and disappears without damaging either ship. Close shots use a curved/offset path as needed to avoid the defender without exceeding the 35° launch-angle cap.
6. **Given** an attack reduces a ship's hit points to zero, **When** the attack resolves, **Then** the battle ends and the player who made the attack is declared the winner.
7. **Given** a torpedo is launched, **When** its attack animation plays, **Then** within 1.5 seconds the hit explosion or off-board miss is complete, the outcome is displayed, and either the next turn is available or the winner is shown for a lethal hit.
8. **Given** a current attack with an already-rolled outcome, **When** its animation fails, **Then** the remaining effects are removed, a presentation error and the retained result are displayed, and damage and handoff or victory occur exactly once without rerolling, within 1.5 seconds of launch.

### Edge Cases

- A constitution modifier of −1 and a hit-point roll of 0 would produce a nonpositive result under the formula; starting hit points are floored at 1 so neither ship begins a battle defeated.
- A strength modifier of −1 and a damage die result of 1 produce 0 damage; a hit still displays its hit animation, but hit points do not change.
- If damage equals or exceeds the defender's remaining hit points, hit points stop at 0 and the attacking player wins immediately.
- An attack total of exactly 12 hits against armor class 12; an attack total of 11 misses.
- A click on the wrong ship, an empty square, or the attacker's own ship does not launch an attack or consume the attack action.
- A ship that has no legal movement destination can acknowledge skipping that action and still attack; it cannot use an illegal move to satisfy the movement action.
- A new battle begun during a torpedo animation discards the previous battle and its pending outcome; the new ships receive fresh starting values and Player 1 begins.
- Once a battle is over, further movement and attack clicks do not change its final state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each ship MUST have integer agility, strength, and constitution scores from 8 through 20 inclusive, each shown separately from its modifier.
- **FR-002**: Each of those three scores MUST use the same modifier mapping:

  | Score | Modifier |
  | --- | --- |
  | 8–9 | −1 |
  | 10–11 | 0 |
  | 12–13 | +1 |
  | 14–15 | +2 |
  | 16–17 | +3 |
  | 18–19 | +4 |
  | 20 | +5 |

- **FR-003**: At the start of each new battle, each ship MUST receive a random integer agility, strength, and constitution score from 8 through 20 inclusive. Each score MUST be selected independently and with equal likelihood, and its modifier MUST be derived using FR-002. Scores MUST remain fixed for that battle.
- **FR-004**: At the start of each new battle, each ship MUST calculate starting hit points by selecting a uniformly random integer from 0 through 20 inclusive and adding twice its constitution modifier. If the calculated result is below 1, it MUST be raised to 1 without rerolling.
- **FR-005**: Each ship MUST have an armor class of exactly 12 for the duration of a battle.
- **FR-006**: Each ship's agility, strength, constitution, associated modifiers, current hit points, and armor class MUST be visible to both local players.
- **FR-007**: Player 1 MUST take the first turn of a new battle. The two players MUST alternate turns after an attack resolves or the active player explicitly ends the turn without attacking, and each player MUST control only their assigned ship.
- **FR-008**: Each turn MUST proceed in this order: one movement action followed by the opportunity for one attack. The attack phase MUST NOT begin until the movement action has been completed or explicitly skipped because the ship has no legal destination. During the attack phase, the player MUST be able to attack or choose End turn without attacking. End turn MUST cause no attack, damage, or hit-point changes and MUST pass control exactly once to the other player. End turn MUST be unavailable before movement resolves, during animations, and after battle completion. A launched attack MUST end the turn after it resolves, unless it ends the battle.
- **FR-009**: A movement action MUST allow the active ship to move once to a different legal square within its nonnegative agility-modifier allowance, preserving the established movement rules: movement cost is measured in orthogonal grid steps, the ship cannot leave the board or pass through or land on the opposing ship, and only reachable empty squares are selectable.
- **FR-010**: If a ship has no legal movement destination, its player MUST be able to acknowledge skipping movement and continue to the attack action. Skipping movement MUST NOT move the ship or end the turn.
- **FR-011**: During the attack action, a click on the opposing ship MUST initiate exactly one attack. Clicking any other target MUST leave the attack action available and must not alter either ship.
- **FR-012**: Each attack MUST roll a uniformly selected integer from 1 through 20 and add the attacking ship's strength modifier. An attack total that equals or exceeds the opposing ship's armor class MUST hit; a lower total MUST miss.
- **FR-013**: A hit MUST roll a uniformly selected integer from 1 through 8 and add the attacking ship's strength modifier. The resulting damage MUST be nonnegative and MUST be subtracted from the defender's current hit points. Hit points MUST NOT fall below 0.
- **FR-014**: A miss MUST cause no damage and MUST NOT change either ship's hit points.
- **FR-015**: Every attack MUST visibly report whether it hit or missed and show the attack total. A hit MUST also show the damage and the defender's resulting hit points.
- **FR-016**: On a hit, an animated blinking-star photo torpedo MUST travel from the attacker to the defender, followed by an explosion on contact. On a miss, it MUST follow a randomly selected angular trajectory, clear the defender without contact, remain fully on-screen through its closest approach, then continue off-screen and disappear. The attack outcome and turn MUST resolve once, without accepting additional actions during the animation. Within 1.5 seconds of launch, the complete animation MUST finish, the attack result MUST be displayed, and either the next turn MUST be available or the winner MUST be shown for a lethal hit. If attack animation fails, the rendering-failure behavior in FR-019 replaces the remaining visual sequence; the failure MUST NOT cause a reroll or duplicate outcome.
- **FR-017**: When a ship's hit points reach 0, the battle MUST end, the attacking player MUST be declared the winner, and no further gameplay actions MUST alter that result.
- **FR-018**: Starting a new battle MUST clear the prior battle's outcome and pending actions, assign fresh ship stats and hit points, and begin with Player 1's turn.
- **FR-019**: If a current attack's animation fails to start or fails during playback, the game MUST remove its remaining effects, show a readable presentation-error message, and apply and display the already-rolled outcome exactly once. It MUST then make the next turn available or show the winner for a lethal hit. Result display and next-turn availability or winner display MUST still occur within 1.5 seconds of launch. Cancellation caused by New Game or disposal MUST discard the old attack instead and MUST NOT apply its outcome.
- **FR-020**: The animated torpedo MUST be visually prominent at gameplay scale: at 60 logical pixels per board cell, its five-point star MUST have an outer radius of at least 12 logical pixels, use a bright contrasting fill and clearly visible outline, and scale with the board.
- **FR-021**: For each miss, the game MUST consume a fresh validated random sample to uniformly select an integer launch angle from 10° through 35° and one of the two sides of the direct attacker-to-defender line. Each choice MUST be independent of attack identity and previous attacks; consecutive choices may repeat either side, angle, or path. If a straight path would intersect the defender or put the closest approach off-screen, the game MUST use a curved/offset path whose launch angle remains within the selected 10°–35° range and whose entire star clears the defender while staying on-screen through closest approach. It MUST NOT increase the selected launch angle above 35°. The path then continues until the entire star has exited the screen. Path randomness MUST NOT consume attack/damage dice or change gameplay outcomes.

### Key Entities *(include if feature involves data)*

- **Spaceship**: One of two ships controlled by a local player; has agility, strength, and constitution scores and modifiers, armor class, current hit points, and a board position.
- **Ability Score and Modifier**: A score from 8 through 20 and the separate modifier derived from the shared score-to-modifier mapping. Agility determines movement allowance; strength modifies attack and damage rolls; constitution modifies starting hit points.
- **Battle**: One game session containing both ships' starting stats, current hit points, turn order, action phase, and either an active state or a completed winner.
- **Turn**: A player's sequential movement and optional attack opportunities, with movement completed or skipped before a single attack or an explicit End turn choice.
- **Attack**: An attempt by one ship against the opposing ship, containing an attack roll, hit or miss result, and, on a hit, a damage roll and hit-point change.
- **Photo Torpedo**: The visible, prominent blinking-star projectile animation whose hit or independently randomized near-miss path represents the resolved attack result.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every score from 8 through 20, all three displayed modifiers match FR-002 in 100% of verification cases, and no score outside that range is assigned to a ship.
- **SC-002**: In 100 controlled battle initializations with known random rolls, both ships' starting hit points equal the greater of 1 and the roll plus twice the constitution modifier, without rerolling, and both armor classes equal 12.
- **SC-003**: Across 50 completed turns covering attacks and explicit End turn choices, every turn resolves movement before at most one attack, players alternate exactly once after the attack or End turn, skipped attacks cause zero hit-point changes, and invalid or repeated clicks cause zero additional actions or turn changes.
- **SC-004**: In 100 controlled attacks covering totals below, equal to, and above 12, every hit or miss follows the threshold; hit damage equals the d8 result plus strength modifier, and misses cause zero hit-point loss.
- **SC-005**: Across at least 20 observed hit and miss animations, all hits visibly contact and explode on the defender, all misses avoid contact, remain on-screen through closest approach, then disappear fully off-screen, and no animation causes a duplicate attack or damage change.
- **SC-006**: In every test where damage reduces a ship to zero hit points, the attacking player is declared the winner immediately and the completed battle accepts no further gameplay changes.
- **SC-007**: At least 4 of 5 first-time players can identify both ships' current hit points, perform a legal movement action, launch an attack, and identify the result without assistance.
- **SC-008**: In 1,000 new battle initializations, every assigned agility, strength, and constitution score is within the specified range, and every modifier matches FR-002; randomness is reviewed for independent, equal-likelihood selection, with the sample alone not treated as proof of fairness.
- **SC-009**: Across at least 20 attacks covering hits, misses, adjacent ships, maximum board separation, and lethal hits, 100% finish their full animation and display the result within 1.5 seconds of launch. By that deadline, nonlethal attacks make the next turn available and lethal hits show the winner. Timing is measured under the reference acceptance conditions established for Ship Turn Movement in `specs/002-ship-turn-movement/spec.md`.
- **SC-010**: With a long same-row shot, 52 controlled independent random samples cover all 26 integer angles from 10° through 35° on both sides of the direct aim line. Repeated samples are permitted and consecutive misses are not required to switch sides. With adjacent, edge, and corner ships, curved/offset paths avoid the defender without exceeding the 35° launch-angle cap, keep the entire star on-screen through closest approach, and then exit the screen completely. Miss-path sampling does not consume attack/damage dice.

## Assumptions

- This feature extends the existing 10 × 10 board, two ships, randomized opposing starting zones, agility stat, and agility-limited movement rules in `specs/001-spaceship-grid-setup/spec.md` and `specs/002-ship-turn-movement/spec.md`.
- Strength and constitution use the same 8–20 score range and modifier table as agility. In keeping with the existing randomized agility setup, all three scores are randomly and independently assigned when a new battle starts; players do not edit them.
- “A random number between 0 and 20” for starting hit points means an equally likely integer from 0 through 20 inclusive. A minimum of 1 starting hit point prevents a ship from beginning defeated while preserving the stated formula for all positive results.
- A turn's movement is mandatory when at least one legal destination exists. If none exists, the player explicitly skips movement and proceeds to attack, avoiding a turn lock while retaining the required action order.
- After movement or an acknowledged movement skip, the player may launch one attack by clicking the opponent or choose End turn without attacking. Once launched, an attack cannot be skipped.
- The opponent may be attacked from any board position; no attack range, line-of-sight, ammunition, or additional combat resource is specified.
- A battle begins when a new game is initialized. Starting a new game also starts a new battle and rerolls the battle's stats and hit points.
- The two-player game remains local and uses the existing board and ship identities. Networking, additional ships, player-controlled stat assignment, and mechanics beyond movement and at most one photo-torpedo attack per turn are outside scope.
