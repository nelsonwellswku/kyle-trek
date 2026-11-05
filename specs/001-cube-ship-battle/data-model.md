# Data Model: Three-Dimensional Ship Battle

All coordinates are integer triples in 1..5; X runs left-to-right, Y top-to-bottom, Z near-to-far. Domain types reject invalid coordinates rather than exposing raw engine vectors. Visual transforms and camera state are not battle state.

## Entities and values

| Entity/value | Fields and invariants | Relationships |
|---|---|---|
| Cell | `x`, `y`, `z`; each 1..5. Occupancy and eligibility are derived, not stored independently. | One of 125; occupied by at most one ship. |
| Stats | agility, strength, constitution each integer 8..20; modifier `(score - 10) // 2`. | Fixed per ship per game. |
| Ship | player ID (1 or 2), cell, discrete orientation, stats, current and starting HP, AC 12. HP is between zero and starting HP. | Exactly one per player; cells differ. |
| Battle | unique generation ID, two ships, active player, phase, optional winner, last displayed outcome. | Owns current turn and invalidates prior presentations on restart/disposal. |
| Turn | active player, allowance `max(0, agility modifier)`, phase. | Movement resolves once before attack-or-end-turn. |
| Attack outcome | attacker, defender, d20, total, hit; optional d8, damage and remaining HP on hit; applied flag. | Rolled once at launch; immutable result applied at most once after presentation or failure. |
| Presentation | originating generation and action ID, kind, lifecycle (running, completed, failed, cancelled), timing and visual handles. | Completion/failure may resolve only its current pending action; cancellation discards it. |
| Inspection state | view orientation, selected depth layer, hovered cell and displayed occupancy. | UI-only; never changes battle state. |

## Setup and transitions

Setup independently samples each ship's X and Z in 1..5, Ship 1 Y in 1..2 and Ship 2 Y in 4..5; each score is independently uniform in 8..20 and HP is `max(1, uniform(0,20) + 2 * constitution_modifier)`. Initial facing is +Y for Ship 1 and −Y for Ship 2. Player 1 starts.

`MOVEMENT` → `MOVING` on a legal left click → `ATTACK_CHOICE` on arrival; when no legal destination exists, explicit skip goes directly from `MOVEMENT` to `ATTACK_CHOICE`. `ATTACK_CHOICE` → next player's `MOVEMENT` on End turn, or → `ATTACKING` after a valid target and one set of dice rolls. Normal presentation completion or presentation failure applies the pre-rolled result exactly once: lethal damage → `FINISHED`, otherwise → next player's `MOVEMENT`. No gameplay action is accepted in `MOVING`, `ATTACKING`, or `FINISHED`. Rotation is allowed only for the active ship in idle playable phases; camera changes never affect state. Restart or disposal invalidates the generation before cancelling effects, so old callbacks cannot mutate current state.

Legal destinations are distinct unoccupied cells at breadth-first face-adjacent distance 1..allowance avoiding the opponent. Flight paths are visual only and do not modify that cost. Hit is `d20 + strength_modifier >= 12`; on hit damage is `max(0, d8 + strength_modifier)` and remaining HP is floored at zero. Miss geometry uses a separate random stream from gameplay dice.
