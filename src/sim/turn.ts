import { legalDestinations } from './movement.js';
import type {
  MoveResult,
  ShipId,
  Spaceship,
  TurnState,
} from './types.js';

/**
 * Turn state machine (FR-003/FR-009/FR-010). Pure and engine-independent.
 * Exactly one turn is active at a time; every game starts with ship-1 on
 * turn 1 (clarified 2026-10-14). Each accepted move — including staying in
 * place — produces exactly one successor turn owned by the other ship.
 * Rejected dispatches (destination outside the frozen legal set, e.g. clicks
 * on non-highlighted or opponent-occupied squares) change nothing.
 *
 * The board is passed in and never mutated: accepted results carry the move
 * so the caller applies it to its own copy before opening the next turn.
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
  const nextActive: ShipId =
    state.activeShipId === 'ship-1' ? 'ship-2' : 'ship-1';
  const movedShips = board.ships.map((s) =>
    s.id === state.activeShipId
      ? { ...s, position: { ...dest } }
      : s,
  );
  const next = startTurn(
    { rows: board.rows, cols: board.cols, ships: movedShips },
    nextActive,
    state.turnNumber + 1,
  );
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
