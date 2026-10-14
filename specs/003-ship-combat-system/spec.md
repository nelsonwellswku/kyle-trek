# Feature Specification: Ship Combat System

**Feature Branch**: `003-ship-combat-system`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "1. each ship should have a strength stat with a modifier that works similarly to the agility stat and modifier. 2. each ship should have a constitution stat with a modifer that works similarly to the agility stat and modifier. 3. each ship has a "hit points" stat. the stat is calculated at the start of the battle by rolling a random number between 0 and 20 and adding (constitution modifier * 2) to the roll. 4. each ship has an "armor class". this is statically the number value 12. 2. each ship may take two actions during a turn. 3. the first action is movement - a ship must move. 4. the second action is attack - an attack is made by clicking on the enemy ship - this "launches" the photo torpedo. 5. when the photo torpedo is launched, the following sequence of events happen: - an "attack roll" is made - the attack role is the roll of a 20 sided die + the ship's strength modifier value. if this value meets or exceeds the opposition ship's armor class, a hit is made. - if the attack misses, nothing happens. - if the attack hits, a damage roll happens. the damage roll is an 8 sided die + the ship's strength modifier. - if the attack hits, the opposing ship's hit points are reduced by the value of the damage roll. 6. if any ship reaches 0 hit points, the game is owner and attacking player wins. 7. if a ship's attack hits, an animated "photo torpedo" (animated as a blinking star) should travel from the attacking ship to the defending ship and an explode animation should show on contact. 8. if a ship's attack misses, the torpedo should be launched in a trajectory close to hitting the defending ship, but it should miss and go off into space (disappear off the grid)"

## Clarifications

### Session 2026-10-14

- Q: What die is rolled for starting hit points — what is the exact range of the base roll? → A: Hit points use a 20-sided die, range 1–20 inclusive, plus (constitution modifier × 2).
- Q: How should a player end their turn without launching a torpedo during the attack phase? → A: Via a dedicated on-screen End Turn / Skip Attack control shown during the attack phase.
- Q: Must the player move, and must movement come before the attack? → A: Neither. Each turn offers one optional move action and one optional attack action in any order; the player may use both, one, or neither. Skipping movement uses an explicit Skip Movement control, like the Skip Attack control.
- Q: After a torpedo attack resolves while the attacker's move action is still unused, should the turn continue so the player can still move? → A: Yes — the turn continues while any action remains unused; it passes only after both actions are used/skipped or the player ends the turn early.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Battle Stats Assigned At Start (Priority: P1)

At the start of a new battle, each ship receives a strength stat, a constitution stat, derived modifiers for both, a hit-points total, and a fixed armor class, all visible to the players before the first turn.

**Why this priority**: All combat math depends on these stats; without them no attack can be resolved. This is the foundation slice.

**Independent Test**: Can be fully tested by starting several new battles with known seeds and verifying each ship shows strength 8–20, constitution 8–20, correct modifiers per the shared mapping table, armor class 12, and hit points equal to the documented formula. Delivers the complete combat stat block independent of attacking.

**Acceptance Scenarios**:

1. **Given** a new battle starts, **When** stats are assigned, **Then** each ship shows a strength stat (8–20), a strength modifier per the shared stat→modifier table, a constitution stat (8–20), a constitution modifier per the same table, and armor class 12.
2. **Given** a new battle starts with a fixed seed, **When** the battle is restarted with the same seed, **Then** both ships receive identical strength, constitution, and hit-point values as the first run.
3. **Given** a ship has constitution modifier +2, **When** its hit points are computed from a base roll of 10, **Then** its hit points equal 14 (10 + 2×2).

---

### User Story 2 - Two Optional Actions In Any Order: Move And Attack (Priority: P1)

During their turn, the active player may use one move action and one attack action in either order — moving by selecting a destination square, attacking by selecting the enemy ship — or skip either or both via dedicated skip controls; the turn then passes to the other player.

**Why this priority**: This is the core turn loop change — movement plus combat. Tied for P1 with stats because the game is unplayable without the turn structure.

**Independent Test**: Can be fully tested by playing turns with known agility values: verify the player can move-then-attack, attack-then-move, skip either action via its control, skip both, and use neither action twice; control passes after both actions are used/skipped or the turn is ended early. Delivers a complete flexible turn.

**Acceptance Scenarios**:

1. **Given** a turn starts, **When** the player selects the enemy ship before moving, **Then** a torpedo launches and the move action remains available.
2. **Given** a turn starts with legal relocation squares available, **When** the player activates the Skip Movement control, **Then** no relocation occurs, the move action is consumed, and the attack action remains available.
3. **Given** the player has already moved this turn, **When** the player attempts to move again, **Then** no second move occurs.
4. **Given** the player has already attacked this turn, **When** the player selects the enemy ship again, **Then** no second torpedo launches and no rolls are consumed.
5. **Given** a turn starts, **When** the player skips both actions (or ends the turn early), **Then** no game state changes and the turn passes to the other player.

---

### User Story 3 - Attack Resolution And Victory (Priority: P2)

Each torpedo launch resolves an attack roll (20-sided roll + attacker's strength modifier vs. defender's armor class 12); a miss changes nothing, while a hit deals 8-sided roll + strength modifier damage to the defender, and reducing a ship to 0 hit points ends the game with the attacker as winner.

**Why this priority**: This is the combat payoff — damage and winning. It depends on stats (P1) and the turn structure (P1/P2) but is the reason combat exists.

**Independent Test**: Can be fully tested by forcing known rolls/modifiers: verify a roll total ≥ 12 hits and reduces defender hit points by the damage total, a total < 12 leaves hit points unchanged, and reaching 0 hit points ends the game with the attacker declared winner. Delivers verifiable combat outcomes.

**Acceptance Scenarios**:

1. **Given** an attacker with strength modifier +2 rolls 10 on the attack roll, **When** the total (12) is compared to the defender's armor class 12, **Then** a hit is declared.
2. **Given** an attacker with strength modifier +1 rolls 9 on the attack roll, **When** the total (10) is compared to armor class 12, **Then** a miss is declared and neither ship's hit points change.
3. **Given** an attack hits with a damage roll of 5 and strength modifier +2, **When** damage resolves against a defender with 10 hit points, **Then** the defender shows 3 hit points.
4. **Given** a defender has 4 hit points, **When** an attack deals 6 damage, **Then** the defender shows 0 hit points, the game ends immediately, and the attacking player is declared the winner.

---

### User Story 4 - Torpedo Hit And Miss Animation (Priority: P3)

Every launched torpedo is visibly animated: on a hit a blinking star travels from attacker to defender and bursts on contact; on a miss a blinking star travels a near-miss path past the defender and disappears off the grid.

**Why this priority**: Animation makes hit/miss legible and satisfying, but the underlying combat outcome must be correct first; this is presentation over rules.

**Independent Test**: Can be fully tested by triggering one forced hit and one forced miss and observing the torpedo path and contact effect in each case while confirming the underlying hit-point outcome matches. Delivers the complete visual feedback slice.

**Acceptance Scenarios**:

1. **Given** an attack is declared a hit, **When** the torpedo launches, **Then** a blinking star visibly travels from the attacking ship's square to the defending ship's square and an explosion effect shows on contact.
2. **Given** an attack is declared a miss, **When** the torpedo launches, **Then** a blinking star visibly travels toward but past the defending ship (a near miss) and continues off the grid without an explosion on the ship.
3. **Given** a torpedo animation is playing, **When** it finishes, **Then** the declared outcome (hit-point reduction or no change) is shown and the turn continues if either action remains unused, otherwise the turn passes to the other player.

---

### Edge Cases

- What happens when a ship's strength modifier is negative (strength 8–9 → -1)? Attack totals and damage totals are reduced accordingly; damage on a hit is at least 1 so a hit always matters.
- What happens when a ship's constitution modifier is negative? The hit-point formula can yield zero or negative; hit points are clamped to a minimum of 1 so no battle starts already won.
- What happens when a ship has no legal relocation (agility modifier ≤ 0 or boxed in)? The move action is skipped via the Skip Movement control (or by confirming the ship's current square), consuming it with no relocation; the attack action remains available.
- What happens when the player selects an empty square or their own ship during the turn while the attack action is unused? No torpedo launches, no roll is consumed, and the attack remains available until used or skipped.
- What happens when the player attempts to move twice or attack twice in one turn? The second attempt is ignored; each action is usable at most once per turn.
- What happens when hit points would drop below 0 from a large damage roll? Hit points clamp at 0 and the game ends immediately with the attacker declared winner; no further actions or turns occur.
- What happens when attack and damage rolls use randomness? All rolls come from the seedable random source in fixed order (attack roll, then damage roll only on a hit) so a given seed + state reproduces the same battle.
- How does the system handle rapid double-selection of the enemy ship in one turn? Only the first selection launches a torpedo and consumes rolls; extra selections while the torpedo is in flight are ignored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST randomly assign each ship a strength stat integer from 8 to 20 inclusive at battle start, using a seedable random source so a given seed reproduces the same values; strength remains fixed for the battle.
- **FR-002**: System MUST randomly assign each ship a constitution stat integer from 8 to 20 inclusive at battle start, using a seedable random source so a given seed reproduces the same values; constitution remains fixed for the battle.
- **FR-003**: System MUST derive each ship's strength modifier and constitution modifier from the shared stat→modifier mapping: 8–9 → -1; 10–11 → 0; 12–13 → 1; 14–15 → 2; 16–17 → 3; 18–19 → 4; 20 → 5.
- **FR-004**: System MUST compute each ship's hit points at battle start as a 20-sided die roll (integer 1 to 20 inclusive) plus (constitution modifier × 2), clamped to a minimum of 1 hit point.
- **FR-005**: System MUST assign every ship an armor class of exactly 12 for the whole battle.
- **FR-006**: Each turn MUST offer two optional actions — one move action and one attack action — each usable at most once and in either order. The player MAY use both, one, or neither; using neither leaves all game state unchanged.
- **FR-007**: The move action MUST follow the existing orthogonal agility movement rules; the player MAY relocate to a legal destination square or skip movement via the dedicated Skip Movement control (selecting the ship's current square to stay in place is also allowed). Skipping consumes the move action with no relocation.
- **FR-008**: System MUST clearly indicate whose turn it is and which of the two actions (move, attack) remain available for the duration of the turn.
- **FR-009**: While the turn's attack action is still unused, the system MUST launch a torpedo attack when the active player selects the enemy ship; selecting empty squares or the player's own ship MUST NOT launch an attack or consume any roll. After the attack action is used, further selections of the enemy ship MUST NOT launch additional attacks.
- **FR-010**: Each attack MUST resolve exactly one attack roll: an integer 1–20 plus the attacker's strength modifier; the attack MUST hit when the total is greater than or equal to the defender's armor class (12) and MUST miss otherwise.
- **FR-011**: On a missed attack, the system MUST leave both ships' hit points unchanged and MUST NOT roll damage.
- **FR-012**: On a hitting attack, the system MUST resolve exactly one damage roll: an integer 1–8 plus the attacker's strength modifier, clamped to a minimum of 1 damage.
- **FR-013**: On a hitting attack, the system MUST reduce the defender's hit points by the damage total and clamp displayed hit points at a minimum of 0.
- **FR-014**: When any ship's hit points reach 0, the system MUST end the game immediately, declare the attacking player the winner, and prevent any further moves or attacks.
- **FR-015**: On a hit, the system MUST animate a blinking star traveling from the attacking ship's square to the defending ship's square followed by an explosion effect on contact; the hit-point reduction MUST be shown in connection with this animation.
- **FR-016**: On a miss, the system MUST animate a blinking star traveling a near-miss trajectory toward but past the defending ship and continuing off the grid, with no explosion effect on the ship.
- **FR-017**: System MUST display each ship's strength stat and modifier, constitution stat and modifier, current hit points, and armor class before or during turns so combat math is explainable.
- **FR-018**: System MUST disclose each attack's outcome immediately: the attack roll value and total, whether it hit or missed, and on a hit the damage roll value and the defender's remaining hit points.
- **FR-019**: All randomness (stat assignment, hit-point base rolls, attack rolls, damage rolls) MUST come from a seedable random source consumed in a fixed order, so the same seed plus action sequence reproduces the same battle; there MUST be no hidden modifiers affecting combat.
- **FR-020**: System MUST provide a Skip Movement control (available while the move action is unused) and an End Turn / Skip Attack control; activating a skip consumes that action with no state change and no rolls consumed. The system MUST end the turn and transfer control to the other player once both actions are used or skipped, or when the player ends the turn early, unless the game has been won.

### Key Entities

- **Ship Combat Stats**: Per-ship attributes for battle: strength stat (8–20, randomly rolled per ship at battle start, fixed for the battle) with derived strength modifier; constitution stat (8–20, same handling) with derived constitution modifier; relationship: strength modifier drives attack and damage rolls, constitution modifier drives starting hit points.
- **Hit Points**: A ship's remaining health; attributes: starting value (20-sided die roll 1–20 + constitution modifier × 2, minimum 1), current value decreasing only via hits, floored at 0; relationship: reaching 0 ends the game with the attacker winning.
- **Armor Class**: A ship's static defense target number, always 12; relationship: an attack roll total meeting or exceeding it is a hit.
- **Turn (Move + Attack)**: The unit of play; attributes: active player/ship, one optional move action (relocate per agility rules or skip via control), one optional attack action (one torpedo launch by selecting the enemy ship, or skip via control), each usable at most once in either order; relationship: exactly one turn active at a time, each resolved turn (without a win) yields a successor turn for the other player.
- **Attack Resolution**: The per-torpedo outcome; attributes: attack roll (1–20 + strength modifier), hit/miss verdict vs. armor class, conditional damage roll (1–8 + strength modifier, minimum 1); relationship: links attacker to defender hit-point change and to the hit vs. miss animation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of new battles, each ship shows strength 8–20, constitution 8–20, modifiers matching the shared mapping table, armor class 12, and hit points equal to base roll + (constitution modifier × 2) with a floor of 1.
- **SC-002**: In 100% of turns, the move and attack actions are each usable at most once and in either order: attack-before-move is allowed, a second use of either action is rejected, skipped actions cause no state change, and the turn passes only after both actions are used/skipped or the turn is ended early.
- **SC-003**: Attack outcomes are correct in 100% of tested launches: totals ≥ 12 always hit, totals < 12 always miss, misses never change hit points, and hits always reduce defender hit points by the (minimum-1) damage total.
- **SC-004**: The game ends with the attacker declared winner within one action of any ship reaching 0 hit points in 100% of battles; no further moves or attacks are possible afterward.
- **SC-005**: In 100% of observed attacks, hits show a blinking star traveling attacker-to-defender plus a contact explosion, and misses show a blinking star on a near-miss path disappearing off the grid with no contact explosion.
- **SC-006**: Players can identify each ship's key stats, current hit points, remaining actions, attack roll, hit/miss verdict, and damage dealt within 10 seconds of the outcome in 90% of observed turns.
- **SC-007**: Replaying the same seed and action sequence reproduces identical stats, rolls, hit-point totals, and winners in 100% of replay trials.

## Assumptions

- "Photo torpedo" in the request means the photon torpedo from the existing game vocabulary: a single blinking-star projectile per attack.
- Strength and constitution stats use the same 8–20 range, random seedable assignment, and stat→modifier table as the existing agility stat, keeping all three stats consistent and data-driven.
- Hit-point base roll is a 20-sided die (integer 1–20 inclusive, clarified 2026-10-14); the original "random number between 0 and 20" is superseded by this die roll, drawn from the seedable source.
- Hit points floor at 1 at battle start so a low constitution roll cannot end the battle before it begins; damage on a hit floors at 1 so a hit with a negative strength modifier still matters.
- Movement follows the prior agility rules unchanged (orthogonal steps, Manhattan-distance range, cannot land on or pass through the enemy-occupied square, staying in place allowed); the Skip Movement control offers an explicit pass that consumes the move action.
- Attack range is unlimited: any active ship on its turn while its attack action is unused may target the enemy ship regardless of grid distance; no line-of-sight or range limit applies in this feature.
- Each turn offers one optional move action and one optional attack action in either order (clarified 2026-10-14): the player may use both, one, or neither; each action is usable at most once; a turn with neither action used leaves all game state unchanged.
- "The game is over and attacking player wins" is the intended reading of the request's win-condition line.
- Torpedo animation (blinking star path, explosion, off-grid miss path) is visual feedback only and never changes the pre-rolled hit/miss and damage outcome.
- Hit-point, attack-roll, and damage-roll disclosure appears as on-screen text or log alongside the animation so outcomes are explainable, not color- or animation-only.
- Two local human players on one shared screen (hotseat); no AI, network play, or simultaneous actions.

## Constitution Compliance

- Principle I (Deterministic Rules): FR-001, FR-002, FR-004, FR-010, FR-012, FR-019 require seedable RNG, fixed roll order, exact modifier mapping, and state-reproducible combat outcomes.
- Principle II (Player Clarity): FR-008, FR-015, FR-016, FR-017, FR-018 + SC-006 require visible turn ownership, remaining-action indicators, disclosed rolls and verdicts, and non-color-only hit/miss feedback (path + explosion + text).
- Principle III (Test-First): Stat/modifier mapping (including -1/0 edges), HP formula and floors, attack ≥ AC hit rule, miss-no-damage, damage minimum, HP clamping, win-on-0, per-turn action limits (each action at most once, any order, skips allowed), and seeded replay MUST have automated tests written before implementation.
- Principle IV (Data-Driven): Strength/constitution stats, the shared stat→modifier table, armor class 12, HP formula constants, die sizes (20/8), and torpedo visual parameters MUST live in data, not hard-coded logic; tuning MUST NOT require logic rewrites.
- Principle V (Simplicity): Scope is stats plus one move-plus-one-attack turn on the existing grid; no range/line-of-sight systems, AI opponents, multiplayer, or extra actions beyond the two specified.
