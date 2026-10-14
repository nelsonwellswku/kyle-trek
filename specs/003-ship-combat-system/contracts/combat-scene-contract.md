# Contract: Combat Scene Presentation (UI Contract)

**Feature**: `specs/003-ship-combat-system/spec.md` · **Date**: 2026-10-14

This project exposes no network API, library API, or CLI — its user-facing interface is the rendered game board. This contract pins what the presentation layer (`src/scenes/battle-scene.ts`) MUST guarantee during combat turns, given the sim state (see `data-model.md`). It prescribes observable behavior, never implementation code. The 001 `scene-contract.md` guarantees (complete grid, faithful occupancy, ship distinction, viewport, failure surfacing) and the 002 `movement-scene-contract.md` guarantees (turn ownership, explainable range, truthful highlights, non-color-only markers, click-to-move) remain in force except where this contract explicitly extends the turn model from one move to move + attack.

## Inputs (from simulation core)

- Current `GameSetup` + battle state: `grid`, `ships` (positions + agility + `strength`/`strengthModifier` + `constitution`/`constitutionModifier` + `hitPoints`/`maxHitPoints` + `armorClass`), and the active `Turn` (`activeShipId`, `turnNumber`, `moveUsed`, `attackUsed`, `legalSet`, `over`).
- Last attack outcome (if any): `{ attackRoll, total, hit, damageRoll?, damage?, defenderHPBefore, defenderHPAfter }`.
- Torpedo styling from `board.json` `combat.torpedo` (data).

Precondition: the setup passed `validation.ts`. The scene MUST NOT recompute legality, re-roll RNG, or mutate sim state — one-way data flow: sim → scene, clicks/controls flow back only as reducer dispatches (`resolveMove`, `dispatchAttack`, `skipMove`, `skipAttack`/`endTurnEarly`).

## Rendering & interaction guarantees

1. **Combat stat display**: each ship's strength stat + modifier, constitution stat + modifier, current hit points (and max), and armor class are shown before or during turns, so combat math is explainable (FR-017).
2. **Remaining-action indicators**: it is always visible whose turn it is AND which of the two actions (move, attack) remain available for the duration of the turn; used actions read as used immediately after dispatch (FR-008).
3. **Attack targeting**: while the turn's attack action is unused and the game is not over, selecting (left-clicking) the enemy ship launches exactly one torpedo (FR-009). Selecting empty squares or the player's own ship launches nothing, consumes no roll, and leaves the attack available. After the attack is used, further enemy-ship selections launch nothing. Unlimited range: distance never blocks an attack.
4. **Hit animation**: on a hit, a blinking star visibly travels from the attacking ship's square to the defending ship's square followed by an explosion effect on contact; the HP reduction is shown in connection with this animation (FR-015).
5. **Miss animation**: on a miss, a blinking star visibly travels a near-miss trajectory toward but past the defending ship and continues off the grid, with no explosion effect on the ship (FR-016).
6. **Non-color-only outcomes**: hit vs. miss is distinguishable by path + explosion + text outcome, never by color alone (Principle II + accessibility baseline).
7. **Immediate outcome disclosure**: each attack's outcome is disclosed as text immediately: attack roll value and total, hit/miss verdict, and on a hit the damage roll value and the defender's remaining hit points (FR-018).
8. **Skip / end-turn controls**: a Skip Movement control (while move unused) and an End Turn / Skip Attack control are present, clickable, and keyboard-accessible; activating one consumes that action with no state change and no rolls consumed; the turn passes once both actions are used/skipped or the turn is ended early, unless the game is won (FR-020).
9. **Win display**: when any HP reaches 0, the game ends immediately: the attacking player is declared winner on screen, and no further moves or attacks are possible (FR-014).
10. **No silent divergence**: the board never shows HP, stats, actions, or positions the sim does not hold, and never advances the turn display without an accepted reducer result (Principle II).

## Acceptance mapping

- Guarantees 1 + 2 + 7 → User Story 1 (stat block) + FR-008/FR-017/FR-018 + SC-001/SC-006.
- Guarantee 3 + 8 → User Story 2 (all scenarios: any order, at-most-once, skips, early end) + FR-006/FR-007/FR-009/FR-020 + SC-002.
- Guarantees 4–7 + 9 → User Story 3 (attack math, damage, win) + FR-010–FR-014 + SC-003/SC-004.
- Guarantees 4 + 5 + 6 → User Story 4 (hit/miss animation) + FR-015/FR-016 + SC-005.
- SC-006 manual check (identify stats, HP, remaining actions, roll, verdict, damage within 10 s) is performed against guarantees 1–2 + 7 — see `quickstart.md`.

## Out of scope for this contract

Range/line-of-sight targeting, damage-preview odds, AI opponents, network/multiplayer play, sound design, and any actions beyond the one move + one attack per turn. Those belong to future features with their own contracts.
