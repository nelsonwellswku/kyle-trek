# UI and Presentation Contracts: Ship Torpedo Combat

## Scope

The external interface is the local game's browser UI. There is no HTTP, network, storage, or interprocess API. This contract also specifies the typed seams needed to validate UI behavior independently of Phaser.

## Display contract

- Retain one 10 × 10 board and two distinguishable ships, randomized in their established opposing starting zones.
- Show each ship's identity/owner, agility, strength, constitution, all three separate signed modifiers, current HP, and armor class 12. Starting HP may be displayed alongside current HP but must not obscure current HP.
- Identify active player/ship and phase in text: movement, movement unavailable, attack choice, attack in progress, or battle finished.
- In attack-ready, instruct the player to click the opposing ship or choose **End turn**. Preserve the last completed attack result through the next player's turn: attacker, defender, hit/miss, attack total versus AC, and damage/remaining HP on hits.
- A lethal hit shows the attacking player's victory and defender HP 0. No movement highlights or gameplay buttons remain actionable; New Game remains available.
- Native Skip movement, End turn, and New Game buttons retain keyboard focus and activation semantics. Status/result/winner messages use the existing DOM live-status pattern and do not depend solely on color or the animation.

## Input matrix

All actions require current revision/token and a board-ready render, unless the action is New Game. One left click uses Phaser world coordinates through `BoardGeometry.positionAt`; non-left clicks do not perform board actions.

| Phase | Board left click | Skip movement | End turn |
| --- | --- | --- | --- |
| movement-ready | Highlighted empty destination starts one flight; all other targets ignored | Unavailable | Unavailable |
| awaiting-movement-skip | Ignored | Resolve movement without moving; enter attack-ready | Unavailable |
| moving | Ignored | Unavailable | Unavailable |
| attack-ready | Opponent's occupied cell starts one attack; own ship, empty/off-board targets ignored | Unavailable | Pass control once without attack, rolls, or HP change |
| attacking | Ignored | Unavailable | Unavailable |
| finished / disposed / board not ready | Ignored | Unavailable | Unavailable |

Clicking any point in the opponent's occupied grid cell counts as selecting the ship, consistent with square-based board interaction. Movement is mandatory when a destination exists. Skipping unavailable movement does not consume the optional attack opportunity. Invalid input never rolls dice or consumes an action.

Highlights contain exactly legal movement destinations only during movement-ready. Hide actionable highlights for flight, attack-ready, projectile animation, finished state, and redraw. Existing movement flight retains direct/diagonal and collision-safe circular-detour behavior; arriving opens attack-ready for the same player.

## Animation and result contract

### Hit

1. A valid attack is committed and its d20/d8 outcome retained by the session.
2. A prominent, blinking five-point star photo torpedo (12 px outer radius and 2 px outline at 60 px cells) travels from attacker center to defender center.
3. Contact triggers an explosion; no miss or unrelated ship effect is shown.
4. Complete the effect, commit/show HP change and result, then either open the opponent's movement phase or show victory.

### Miss

1. A valid attack retains its miss result, with no damage roll.
2. A prominent, blinking five-point star with a contrasting fill and outline follows a freshly and independently randomized path whose launch angle is 10°–35° to either side of direct aim, clearing the defender without contact.
3. Keep the entire star on-screen through its closest approach to the defender, then continue until the full projectile is outside the screen and remove it.
4. Show miss/attack total and open the opponent's movement phase with unchanged HP.

Both flows must complete all animation, outcome display, and next-turn readiness/winner display within **1,500 ms of launch** under the reference foreground-browser conditions. Nominal duration is 1,150 ms; the deadline is not merely a tween configuration value. A zero-damage hit still contacts and explodes. Nonlethal and lethal outcomes never produce a duplicate completion/handoff.

## Geometry contract

- Hit geometry is a direct center-to-center path.
- The torpedo star scales with cell size and has a 12 px outer radius and 2 px white outline at 60 px cells, with a bright contrasting fill; it pulses while in flight. Use a 13 px collision envelope and 1 px additional clearance.
- Each miss consumes a fresh validated random sample that uniformly selects an integer launch angle from 10° through 35° and either side of the direct attacker-to-defender line. The choice is independent of attack identity and previous attacks; consecutive misses may repeat the same path. If the straight path would intersect the defender or put the full star off-screen at closest approach, use a curved/offset path and try the other side or another choice within 10°–35°; never increase the selected launch angle above 35°.
- The closest-approach point must be within the board inset by the projectile radius, so the entire star stays on-screen while passing its closest point to the defender. Continue each valid path until the entire projectile is outside the screen, not merely its center. The same positions and random choice reproduce the same geometry; path randomness does not draw gameplay dice.
- Scale geometry with cell size. Test adjacent, same-row/column, diagonal, edge, corner, and maximum-distance placements. Continuous segment distance and rectangle intersection checks establish clearance and exit; sampled frames alone do not prove them.

## Internal typed seams

### BattleSession commands

The implementation exposes typed operations equivalent to:

| Operation | Inputs | Accepted effect |
| --- | --- | --- |
| selectDestination | revision, token, BoardPosition | Return PendingMove or null; no handoff |
| completeMove / recoverFailedMove | revision, token, moveId | Commit arrival/open attack or restore movement; boolean acceptance |
| acknowledgeMovementSkip | revision, token | Open attack-ready only when immobile |
| selectAttack | revision, token, target ShipIdentity | Return PendingAttack or null; roll once only when accepted |
| completeAttack | revision, token, attackId | Commit stored outcome once and hand off or finish |
| endTurn | revision, token | Handoff only in attack-ready |
| newGame | Complete validated CombatGame | Publish new revision, clear previous pending/result/winner |
| dispose | None | Idempotent invalidation |

The session exposes readonly discriminated snapshots as specified in [data-model.md](../data-model.md). Commands do not accept presentation-selected damage or winner values.

### TorpedoAnimator

`start(pendingAttack, onComplete, onFailure)` returns a handle containing the revision/token/attack ID and idempotent `cancel()`. Completion and failure callbacks carry that identity; failure additionally carries a typed Error. The implementation may evaluate pure path progress internally, but cannot alter domain HP, positions, or turn state directly.

- Callbacks may occur synchronously before `start` returns; controller stores a returned handle only if the attack remains current.
- Normal completion removes effects before notifying the controller.
- Cancellation removes all effects/tweens and does not request a domain completion.
- Even if a faulty or late callback occurs after cancellation, the session's identity/phase gate rejects it.
- Failure replaces the remaining visual sequence under FR-019 and cleans up effects. Controller reports a readable error and commits/displays the same retained outcome once if still current; it never rerolls. Result display and next-turn availability or winner display must still occur within 1,500 ms of launch. An old failure cannot finalize a replacement battle; replacement/disposal cancellation discards the old attack without applying its outcome.

Ship movement continues using the existing `FlightAnimator` contract and extracted `PendingMove` data interface.

## Application lifecycle contract

- Construct a complete replacement before mutating current state. A generation error leaves the existing battle intact and shows the existing retryable New Game error.
- On replacement, invalidate the old revision before cancelling animators. Clear projectile/explosion objects, pending visual callbacks, winner/result, and old button listeners.
- Wait for matching postrender before enabling new board actions. Stale render signals cannot mark a new revision ready.
- Serialize rapid New Game requests using the application's existing queue. Keep one canvas and one input listener set.
- Disposal cancels effects and removes DOM/Phaser listeners exactly once. Do not restart an already disposed scene.

## Acceptance references

Stats/initialization cover FR-001–FR-006 and FR-018; input/phase behavior covers FR-007–FR-011; dice/results cover FR-012–FR-015; visuals/deadline cover FR-016, FR-020, FR-021, SC-009, and SC-010; winner/final input lock cover FR-017; attack-animation failure recovery covers FR-019. See [quickstart.md](../quickstart.md) for executable verification procedures.
