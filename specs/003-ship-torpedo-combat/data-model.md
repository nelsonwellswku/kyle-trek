# Data Model: Ship Torpedo Combat

## Shared ability score

`AbilityStat` is an immutable validated value in `ship-stats`:

| Field | Type / validation |
| --- | --- |
| score | Integer 8–20 inclusive |
| modifier | Derived integer `floor((score - 10) / 2)`, range −1 to +5 |

`AgilityStat` retains its existing interface and composes this value, adding `movementAllowance = max(0, modifier)`. Combat strength and constitution use `AbilityStat`; they do not inherit from agility.

## Combat ship and game

`CombatShip` is a readonly, frozen record owned by immutable `CombatGame`.

| Field | Type / constraint |
| --- | --- |
| identity | Existing `ShipIdentity`: ship-1 or ship-2 |
| owner | Existing `PlayerIdentity`: player-1 or player-2, matching ship suffix |
| position | Validated `BoardPosition`, rows/columns 1–10 |
| agility | `AgilityStat` |
| strength, constitution | `AbilityStat` |
| armorClass | Literal 12 |
| startingHitPoints | Integer 1–30; immutable for the battle |
| hitPoints | Integer 0–startingHitPoints |

`CombatGame` exposes literal rows/columns 10 and ship1/ship2 compatible with `BoardSnapshot`. It validates exactly one matching identity/owner per ship, no overlapping positions, and valid stats/HP. `withPosition` and `withDamage` return new complete states and preserve all unrelated fields. Damage must be a nonnegative integer and HP is clamped to zero. Dead ships remain visible at their final position; only battle state makes them inactive. No combat state is reconstructed using `MovementGame`.

Factory initialization draws two positions with existing `GameSetupFactory`, then draws agility, strength, constitution, HP roll for ship-1 followed by ship-2. Each stat draw uses independent equal-width 8–20 buckets; HP draws use 0–20. Starting/current HP both equal `max(1, hpRoll + 2 * constitution.modifier)`. Fresh draws may repeat previous values. Construction errors leave the current published battle untouched.

## Dice and attack result

`DiceRoller` composes `RandomSource`, rejects nonfinite or out-of-[0,1) samples, and maps each valid draw uniformly to an inclusive integer range. It supports initialization rolls, d20, and d8. `AttackResolver` composes it and returns a readonly discriminated union:

| Field | Miss | Hit |
| --- | --- | --- |
| kind | miss | hit |
| attacker / defender | Different `ShipIdentity` values | Different `ShipIdentity` values |
| attackDie | Integer 1–20 | Integer 1–20 |
| strengthModifier | Attacker's modifier, −1 to +5 | Attacker's modifier, −1 to +5 |
| attackTotal | attackDie + strengthModifier, below 12 | attackDie + strengthModifier, at least 12 |
| armorClass | 12 | 12 |
| damageDie | Absent | Integer 1–8 |
| damage | Absent; effective loss is zero | damageDie + strengthModifier, range 0–13 |
| hitPointsBefore / hitPointsAfter | Equal defender HP | Before HP and max(0, before − damage) |

Only a hit draws a d8. Natural die results have no special critical-hit/automatic-miss rules; only the total determines the outcome. Report rolled damage even on overkill; actual HP loss is bounded by remaining HP. A zero-damage hit is still a hit animation, not a miss. Invalid targets and End turn consume no dice draws.

## Battle session and identities

`BattleSession` owns a `CombatGame`, active player/ship, phase, optional last completed result, monotonically increasing game revision, turn token, move ID, and attack ID. Use positive safe-integer revision/token values and safe-integer action counters; reject counter overflow before publishing a transition. No network or persistence identities are needed.

Each phase is a distinct readonly snapshot variant, rather than independently mutable flags:

| Phase | Additional state | Accepted gameplay actions |
| --- | --- | --- |
| movement-ready | Reachability result with ≥1 destination | One legal destination selection |
| awaiting-movement-skip | Empty reachability and explanation | Skip movement |
| moving | PendingMove | Matching animation progress/completion/failure |
| attack-ready | Movement already resolved | Opponent selection or End turn |
| attacking | PendingAttack | Matching attack completion/failure |
| finished | Winner, defeated ship, final game/result | None |
| disposed | Invalidated revision/token only | None |

Every live snapshot carries game revision, turn token, game, active identity, and last completed attack result or null. Finished snapshots contain winner rather than suggesting a new playable turn. Last result persists through the next turn until a new outcome is completed or New Game clears it.

`PendingMove` retains the existing movement contract: revision, token, move ID, moving ship identity, origin, destination, other ship position, and validated `LegalRoute`. Extract this data interface without importing a live `TurnSession` into combat.

`PendingAttack` contains revision, token, attack ID, attacker and defender identities/positions, and the immutable precomputed outcome. Logical HP remains unchanged while pending. Animation completion supplies identity only, never replacement outcome/damage data.

### Transition rules

| From | Event | To / effect |
| --- | --- | --- |
| New battle | Initialize | Player 1 movement-ready, or awaiting-movement-skip if immobile |
| movement-ready | Legal destination | moving; retain authoritative origin until arrival |
| moving | Matching arrival | Commit destination; attack-ready; same player and token |
| moving | Matching failure | Restore origin visual; movement-ready; pending move cleared, no handoff |
| awaiting-movement-skip | Explicit Skip movement | attack-ready; same player and token; no position change |
| attack-ready | Opponent click | Roll once; attacking; no immediate HP change |
| attack-ready | End turn | Opponent movement phase; increment turn token once; no rolls or HP change |
| attacking | Matching completion, defender survives | Commit stored outcome; opponent movement phase; increment token once |
| attacking | Matching completion, lethal hit | Commit stored outcome; finished; winner is attacker; no playable handoff |
| attacking | Matching animation failure | Clean effects and expose error; commit same stored outcome once as above |
| Any live phase including finished | Successfully constructed New Game | Increment revision/token, reset player to 1, clear pending actions/result/winner, compute movement phase |
| Any phase | Dispose | Invalidate identity and clear pending work; disposed |

Invalid or stale events return a no-change result. Each mutating operation validates phase plus supplied revision/token/action ID as applicable. After accepted completion, phase and identity no longer match duplicate callbacks. Old HUD handlers cannot affect new turns. Do not reuse action IDs after a recovery or replacement.

## Presentation-only data

- `BoardPoint` may be outside the board for a torpedo exit; `BoardPosition` may not.
- `TorpedoPath` contains attack origin, contact or an angle-selected miss path with optional curved/offset waypoints, off-screen endpoint on misses, and geometry-derived progress evaluation. Each miss consumes one fresh validated random sample, uniformly selecting one of 52 choices (integer launch angle 10°–35° and either side); its choice is independent of the attack identity and all previous attacks. The 12 px star uses a 13 px projectile envelope and 1 px clearance at 60 px cells, all scaled by cell size. A candidate must clear the defender and keep the entire star on-screen through closest approach; close or edge-constrained geometry bends the path rather than increasing the selected launch angle above 35°. It then continues until the entire star is off-screen. It carries no dice or mutable HP; its callback identity remains `(gameRevision, turnToken, attackId)`.
- `TorpedoIdentity` is revision + token + attack ID. A cancellable handle owns its effects; progress/completion/error are ignored when stale.
- `CombatControls` derives button availability from phase and board-ready revision. Controls own no battle state.
- Visual readiness is separate from battle phase: after initialization/replacement the controller ignores input until the matching postrender. A valid domain movement phase alone does not make an undrawn board interactive.

## Persistence and volume

Exactly two ship records, one active pending action, and one last result are retained. No unbounded history, database, save format, serialization contract, or external synchronization is introduced.
