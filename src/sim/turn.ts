import { resolveAttack } from './combat.js';
import { legalDestinations } from './movement.js';
import type {
  AttackResult,
  BoardConfig,
  MoveResult,
  Rng,
  ShipId,
  Spaceship,
  TurnState,
} from './types.js';

/**
 * Two-action turn state machine (FR-006/FR-009/FR-020, plus 002 movement).
 * Pure and engine-independent. Exactly one turn is active at a time; every
 * game starts with ship-1 on turn 1. Each turn offers one optional move
 * action and one optional attack action, each usable at most once and in
 * either order; skips consume their action with no other change. The turn
 * passes (other ship, turnNumber + 1, flags reset, fresh legalSet) once both
 * actions are used/skipped or the player ends the turn early. A lethal hit
 * sets `over` immediately: terminal, with no successor turn — every further
 * dispatch is rejected.
 *
 * The board is passed in and never mutated: accepted results carry the move
 * or the updated ships so the caller applies them to its own copy.
 */

export interface TurnBoard {
  readonly rows: number;
  readonly cols: number;
  readonly ships: readonly Spaceship[];
}

function shipById(board: TurnBoard, id: ShipId): Spaceship {
  const ship = board.ships.find((s) => s.id === id);
  if (ship === undefined) {
    throw new Error(`turn: no ship "${id}" on the board`);
  }
  return ship;
}

function otherShip(id: ShipId): ShipId {
  return id === 'ship-1' ? 'ship-2' : 'ship-1';
}

function startTurn(
  board: TurnBoard,
  activeShipId: ShipId,
  turnNumber: number,
): TurnState {
  const me = shipById(board, activeShipId);
  const foe = board.ships.find((s) => s.id !== activeShipId);
  if (foe === undefined) {
    throw new Error('turn: expected exactly two ships on the board');
  }
  const legalSet = legalDestinations({
    rows: board.rows,
    cols: board.cols,
    origin: { ...me.position },
    modifier: me.agilityModifier,
    occupied: { ...foe.position },
  });
  return {
    activeShipId,
    turnNumber,
    moveUsed: false,
    attackUsed: false,
    over: null,
    legalSet: legalSet.map((c) => ({ ...c })),
  };
}

export function initialTurn(board: TurnBoard): TurnState {
  return startTurn(board, 'ship-1', 1);
}

export function resolveMove(
  state: TurnState,
  board: TurnBoard,
  dest: { readonly row: number; readonly col: number },
): MoveResult {
  if (state.over !== null) {
    return {
      accepted: false,
      reason:
        `turn ${state.turnNumber} (${state.activeShipId}): ` +
        `the game is over — ${state.over.winner} has won, no moves allowed`,
    };
  }
  if (state.moveUsed) {
    return {
      accepted: false,
      reason:
        `turn ${state.turnNumber} (${state.activeShipId}): ` +
        `the move action has already been used — at most one move per turn`,
    };
  }
  const legal = state.legalSet.some(
    (c) => c.row === dest.row && c.col === dest.col,
  );
  if (!legal) {
    return {
      accepted: false,
      reason:
        `turn ${state.turnNumber} (${state.activeShipId}): ` +
        `(${dest.row},${dest.col}) is outside the legal destination set ` +
        `— only highlighted squares accept moves`,
    };
  }
  const mover = shipById(board, state.activeShipId);
  const movedShips = board.ships.map((s) =>
    s.id === state.activeShipId
      ? { ...s, position: { ...dest } }
      : s,
  );
  const marked: TurnState = { ...state, moveUsed: true };
  const next = marked.attackUsed
    ? startTurn(
        { rows: board.rows, cols: board.cols, ships: movedShips },
        otherShip(state.activeShipId),
        state.turnNumber + 1,
      )
    : marked;
  return {
    accepted: true,
    next,
    move: {
      shipId: state.activeShipId,
      from: { ...mover.position },
      to: { ...dest },
    },
  };
}

/**
 * Launch one torpedo at the enemy ship (FR-009–FR-014). Consumes exactly one
 * d20 attack roll, plus one d8 only on a hit; misses change nothing. Hits
 * reduce the defender's HP (clamped at 0); a lethal hit ends the game
 * immediately with the attacker as winner and no successor turn. Any-order:
 * the turn passes only if the move action is already used.
 */
export function dispatchAttack(
  state: TurnState,
  board: TurnBoard,
  config: BoardConfig,
  targetId: ShipId,
  rng: Rng,
): AttackResult {
  if (state.over !== null) {
    return {
      accepted: false,
      reason:
        `turn ${state.turnNumber} (${state.activeShipId}): ` +
        `the game is over — ${state.over.winner} has won, no attacks allowed`,
    };
  }
  if (state.attackUsed) {
    return {
      accepted: false,
      reason:
        `turn ${state.turnNumber} (${state.activeShipId}): ` +
        `the attack action has already been used — at most one attack per turn`,
    };
  }
  const foe = board.ships.find((s) => s.id !== state.activeShipId);
  if (foe === undefined) {
    throw new Error('turn: expected exactly two ships on the board');
  }
  if (targetId !== foe.id) {
    return {
      accepted: false,
      reason:
        `turn ${state.turnNumber} (${state.activeShipId}): ` +
        `"${targetId}" is not the enemy ship — no torpedo launched, no roll consumed`,
    };
  }
  const attacker = shipById(board, state.activeShipId);
  const roll = resolveAttack(
    config,
    attacker.strengthModifier,
    foe.armorClass,
    rng,
  );
  const defenderHPBefore = foe.hitPoints;
  const defenderHPAfter = roll.hit
    ? Math.max(0, defenderHPBefore - roll.damage!)
    : defenderHPBefore;
  const ships = board.ships.map((s) =>
    s.id === foe.id ? { ...s, hitPoints: defenderHPAfter } : s,
  );
  const marked: TurnState = { ...state, attackUsed: true };
  const next =
    defenderHPAfter <= 0
      ? { ...marked, over: { winner: state.activeShipId } }
      : marked.moveUsed
        ? startTurn(
            { rows: board.rows, cols: board.cols, ships },
            otherShip(state.activeShipId),
            state.turnNumber + 1,
          )
        : marked;
  return {
    accepted: true,
    next,
    ships,
    outcome: {
      attackerId: state.activeShipId,
      defenderId: foe.id,
      attackRoll: roll.attackRoll,
      total: roll.total,
      hit: roll.hit,
      damageRoll: roll.damageRoll,
      damage: roll.damage,
      defenderHPBefore,
      defenderHPAfter,
    },
  };
}

/**
 * Skip the move action (FR-007/FR-020): no relocation, no rolls. Passes the
 * turn if the attack action is already used. No-ops (same state) once the
 * game is over or the move is already used.
 */
export function skipMove(state: TurnState, board: TurnBoard): TurnState {
  if (state.over !== null || state.moveUsed) {
    return state;
  }
  const marked: TurnState = { ...state, moveUsed: true };
  return marked.attackUsed
    ? startTurn(board, otherShip(state.activeShipId), state.turnNumber + 1)
    : marked;
}

/**
 * Skip the attack action (FR-020): no torpedo, no rolls. Passes the turn if
 * the move action is already used. No-ops (same state) once the game is
 * over or the attack is already used.
 */
export function skipAttack(state: TurnState, board: TurnBoard): TurnState {
  if (state.over !== null || state.attackUsed) {
    return state;
  }
  const marked: TurnState = { ...state, attackUsed: true };
  return marked.moveUsed
    ? startTurn(board, otherShip(state.activeShipId), state.turnNumber + 1)
    : marked;
}

/**
 * End the turn early (FR-020): whatever remains unused is forfeited with no
 * state change and no rolls, and control passes to the other player —
 * unless the game has been won, in which case the terminal state stands.
 */
export function endTurnEarly(state: TurnState, board: TurnBoard): TurnState {
  if (state.over !== null) {
    return state;
  }
  return startTurn(board, otherShip(state.activeShipId), state.turnNumber + 1);
}
