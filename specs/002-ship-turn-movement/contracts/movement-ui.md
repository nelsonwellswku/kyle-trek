# UI and Interaction Contract: Ship Turn Movement

**Date**: 2026-10-16
**Scope**: Local browser UI; no HTTP API. Domain details: [data-model.md](../data-model.md).

## Display contract

- Preserve the 10 × 10 board, numbered/distinguishable ships and starting-zone random placement.
- Show current row/column summaries, each ship's agility score and separate modifier, and the active player and ship.
- Highlight all and only destinations of the current ready turn. Origin and occupied cells are not highlighted. Use a visible border/pattern as well as color, while retaining readable grid/ships.
- During flight, clear actionable highlights and identify movement in progress. Current occupancy summaries remain at origin until arrival, then update with the committed position.
- A no-moves turn displays its reason and a native button labeled **Pass turn**; no turn changes before activation. Pass is hidden or disabled outside awaiting-pass.
- Keep New Game available during flight after initial readiness. Readiness/errors belong to the existing shell; active-turn messages belong to TurnControls.
- Update existing DOM elements rather than replacing the application root. Preserve native keyboard/focus behavior for buttons and announce turn/pass changes with a polite live status. Grid destination selection remains left-mouse-driven for this scope.

## Input contract

| Input / precondition | Result |
| --- | --- |
| Left click a highlighted cell in ready | Accept once, immediately enter moving, remove highlights, animate |
| Click current, occupied, unreachable, or off-board cell | No ship or turn change |
| Non-left mouse button | No ship or turn change |
| Movement input during moving, preparing, or disposal | Ignore |
| Pass turn activation in awaiting-pass with matching displayed token | Advance exactly one turn without moving a ship |
| Stale pass callback or activation while ready/moving | Ignore |
| New Game after readiness, including moving/awaiting-pass | Stage fresh placements and stats; on success reset to Player 1 and invalidate old work |
| New-game generation error | Keep prior complete game and show retryable error |
| Matching flight startup or mid-flight failure | Restore the visual to the authoritative origin, retain the active player, refresh the turn token/legal input, and show a retryable movement error without handoff |
| Stale flight failure or completion after recovery | Ignore |

Scene input uses Phaser logical world coordinates under FIT scaling. Finite points on an internal grid line belong to the cell on its right/below; points on right/bottom outer boundary are outside. A single pointer activation dispatches one command; avoid both board-level and object-level handlers consuming the same event.

When both ships cannot move, each click acknowledges only its displayed turn. There is no timer, automatic loop, or game-over conversion. Native double clicks are separate activations; each still validates the current displayed turn identity, and a single activation never passes multiple turns.

## Domain/presentation collaboration contract

Names below describe the planned typed boundaries, not a public remote API.

| Collaborator / operation | Input | Output / guarantee |
| --- | --- | --- |
| MovementGameFactory.create | injected random source | Complete validated initial MovementGame or error, no partial publication |
| TurnSession.selectDestination | current turn token, BoardPosition | Accepted PendingMove or rejected result; accepted command locks turn synchronously |
| TurnSession.completeMove | game revision, turn token, move ID | Exactly one arrival commit and handoff, or unchanged stale rejection |
| TurnSession.acknowledgePass | game revision, displayed turn token | Exactly one handoff only in awaiting-pass |
| TurnSession.newGame | staged factory result | Atomic replacement/revision update; failure preserves state |
| Reachability.find | board occupancy, active origin, allowance | Readonly destination/route result with shortest legal paths |
| FlightAnimator.start | PendingMove, safe geometric path, completion and typed failure callbacks | Owned cancellable flight; one terminal success or failure notification at most, carrying the move identity |
| FlightAnimator.cancel | owned handle | Stop visual work without successful completion |
| BoardView.render | BoardSnapshot, highlights, readiness identity | Static board and ship groups; postrender readiness for matching game only |

No Phaser type enters domain classes. MovementController connects session results to view, animator, and TurnControls. Application alone coordinates whole-game creation/readiness/replacement. Setup never imports movement.

## Flight contract

- Animation geometry is independent of the BFS route used for logical legality and step cost. If the origin-to-destination segment clears the other ship's combined visual envelope, fly that direct segment, including diagonally.
- If the direct segment is blocked, use the shortest feasible tangent-line/circular-arc/tangent-line path around the other ship. Empty grid cells do not constrain the flight; the path must not overlap either visual envelope or leave the board.
- At current geometry, each ship reserves a 24 px visual radius and the center path clears the other ship's circle by 48 px. Preserve the marker/label bounds used in [plan.md](../plan.md).
- Animation runs continuously from origin to exact destination center, nominally 250 ms per logical step, completing within 1.5 seconds in the acceptance environment.
- Commit and hand off only after arrival. New Game, scene shutdown, and disposal invalidate old callbacks before cancellation. A stop callback is not arrival.
- On a matching startup/mid-flight failure, invalidate the move before cancellation, restore its origin visual, retain its player, issue a fresh turn token and recompute legal input. Report a retryable error without committing or advancing the turn. Failure callbacks for old/cancelled moves have no effect.

## Observable acceptance matrix

| Contract area | Spec coverage | Verification |
| --- | --- | --- |
| Stats and initialization | FR-001–FR-004, FR-015; SC-001/SC-008 | All 13 score buckets, 169 score pairs, display checks and fresh-game fixtures |
| Destination legality and input | FR-005–FR-009; SC-002/SC-003 | At least 20 known arrangements, scaled-pointer browser checks, invalid-button tests |
| Smooth safe arrival | FR-010–FR-012; SC-004/SC-005 | Analytic geometry tests, real-Phaser visual fixture, recorded timing |
| Explicit pass | FR-013; SC-007 | 20 acknowledged passes, both-immobile scenario, stale-token rejection |
| Reset and lifecycle | FR-014; SC-007 | Reset during flight, stale completions, generation failure and disposal tests |
| Understandability | SC-006 | Five first-time-player observation sessions; at least four succeed within 30 seconds |
