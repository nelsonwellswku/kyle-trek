import { describe, expect, it } from 'vitest';
import { setupGame } from '../../src/sim/setup.js';
import {
  dispatchAttack,
  endTurnEarly,
  initialTurn,
  resolveMove,
  skipAttack,
  skipMove,
} from '../../src/sim/turn.js';
import { loadBoardConfig } from '../../src/sim/board-config.js';
import type {
  BoardConfig,
  Rng,
  ShipId,
  Spaceship,
} from '../../src/sim/types.js';
import shippedConfig from '../../src/config/board.json';

// TDD (US2): two-action turn tests written BEFORE the turn.ts extension →
// must FAIL until T017. Existing 002-era tests below were updated to the new
// model (a move marks moveUsed but no longer ends the turn by itself).

const shipped = (): BoardConfig =>
  loadBoardConfig(JSON.parse(JSON.stringify(shippedConfig)));

const sequencePick = (picks: number[]): Rng => {
  let i = 0;
  return {
    integer: (min: number, max: number) => {
      const pick = picks[i % picks.length]!;
      i++;
      return Math.min(Math.max(pick, min), max);
    },
  };
};

/** Spawn idx 0 for both ships, then raw agility rolls 19 (-> +4) each. */
const strongSequence = (): Rng => sequencePick([0, 0, 19, 19]);

/** Attacker strength 18 (+4): roll 10 hits AC 12 (14), roll 1 misses (5). */
const battleStats = (): Rng =>
  sequencePick([0, 0, 19, 19, 18, 10, 14, 12, 15, 15]);

/** Fixed-value battle RNG with a draw counter (roll-consumption assertions). */
const counting = (values: number[]) => {
  let calls = 0;
  let i = 0;
  const rng: Rng = {
    integer: (min: number, max: number) => {
      calls++;
      const pick = values[i % values.length]!;
      i++;
      return Math.min(Math.max(pick, min), max);
    },
  };
  return { rng, calls: () => calls };
};
const hitRng = () => counting([15, 4]);
const missRng = () => counting([1]);

interface TestBoard {
  rows: number;
  cols: number;
  ships: Spaceship[];
}

const boardFromSeed = (seed: number, rng?: Rng): TestBoard => {
  const setup = setupGame(shipped(), seed, rng ?? strongSequence());
  return {
    rows: setup.grid.rows,
    cols: setup.grid.cols,
    ships: setup.ships.map((s) => ({ ...s, position: { ...s.position } })),
  };
};

const shipAt = (board: TestBoard, id: ShipId): Spaceship =>
  board.ships.find((s) => s.id === id)!;

const moveWith = (board: TestBoard, shipId: ShipId, dest: { row: number; col: number }): TestBoard => ({
  ...board,
  ships: board.ships.map((s) =>
    s.id === shipId ? { ...s, position: { ...dest } } : s,
  ),
});

/** A non-origin legal destination for the active ship. */
const aMove = (board: TestBoard, id: ShipId) => {
  const turn = initialTurn(board);
  void turn;
  const origin = shipAt(board, id).position;
  const state = initialTurn(board);
  return state.legalSet.find(
    (c) => c.row !== origin.row || c.col !== origin.col,
  )!;
};

describe('turn state machine (002, updated to two-action model)', () => {
  it('starts every game with ship-1 on turn 1 and both actions unused', () => {
    const turn = initialTurn(boardFromSeed(5));
    expect(turn.activeShipId).toBe('ship-1');
    expect(turn.turnNumber).toBe(1);
    expect(turn.moveUsed).toBe(false);
    expect(turn.attackUsed).toBe(false);
    expect(turn.over).toBeNull();
    expect(turn.legalSet.length).toBeGreaterThan(1);
  });

  it('an accepted move marks moveUsed but keeps ship-1 on turn 1', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const dest = aMove(board, 'ship-1');
    const result = resolveMove(turn, board, dest);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.next.activeShipId).toBe('ship-1');
    expect(result.next.turnNumber).toBe(1);
    expect(result.next.moveUsed).toBe(true);
    expect(result.next.attackUsed).toBe(false);
    expect(result.move.shipId).toBe('ship-1');
    expect(result.move.to).toEqual(dest);
  });

  it('move then skipAttack passes to ship-2, turn 2', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const dest = aMove(board, 'ship-1');
    const moved = resolveMove(turn, board, dest);
    expect(moved.accepted).toBe(true);
    if (!moved.accepted) return;
    const next = skipAttack(moved.next, moveWith(board, 'ship-1', dest));
    expect(next.activeShipId).toBe('ship-2');
    expect(next.turnNumber).toBe(2);
    expect(next.moveUsed).toBe(false);
    expect(next.attackUsed).toBe(false);
  });

  it('staying in place marks moveUsed without relocating or passing', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const origin = { ...shipAt(board, 'ship-1').position };
    const result = resolveMove(turn, board, origin);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.next.activeShipId).toBe('ship-1');
    expect(result.next.moveUsed).toBe(true);
    expect(shipAt(board, 'ship-1').position).toEqual(origin);
  });

  it('rejects a destination outside the legal set with no state change', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const result = resolveMove(turn, board, { row: 10, col: 10 });
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toMatch(/legal|highlight|range/i);
  });

  it('rejects a move onto the opponent square (wrong-ship input)', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const foe = { ...shipAt(board, 'ship-2').position };
    const result = resolveMove(turn, board, foe);
    expect(result.accepted).toBe(false);
  });
});

describe('two-action turns (US2, FR-006/FR-009/FR-020)', () => {
  it('attack-before-move leaves the move action available', () => {
    const board = boardFromSeed(5, battleStats());
    const turn = initialTurn(board);
    const foeId: ShipId = 'ship-2';
    const attacked = dispatchAttack(
      turn,
      board,
      shipped(),
      foeId,
      hitRng().rng,
    );
    expect(attacked.accepted).toBe(true);
    if (!attacked.accepted) return;
    expect(attacked.next.activeShipId).toBe('ship-1');
    expect(attacked.next.turnNumber).toBe(1);
    expect(attacked.next.moveUsed).toBe(false);
    expect(attacked.next.attackUsed).toBe(true);
    // The move is still usable afterwards and then passes the turn.
    const dest = aMove(board, 'ship-1');
    const moved = resolveMove(attacked.next, board, dest);
    expect(moved.accepted).toBe(true);
    if (!moved.accepted) return;
    expect(moved.next.activeShipId).toBe('ship-2');
    expect(moved.next.turnNumber).toBe(2);
  });

  it('move-then-attack passes the turn once both actions are used', () => {
    const board = boardFromSeed(5, battleStats());
    const turn = initialTurn(board);
    const dest = aMove(board, 'ship-1');
    const moved = resolveMove(turn, board, dest);
    expect(moved.accepted).toBe(true);
    if (!moved.accepted) return;
    const afterMove = moveWith(board, 'ship-1', dest);
    const attacked = dispatchAttack(
      moved.next,
      afterMove,
      shipped(),
      'ship-2',
      hitRng().rng,
    );
    expect(attacked.accepted).toBe(true);
    if (!attacked.accepted) return;
    expect(attacked.next.activeShipId).toBe('ship-2');
    expect(attacked.next.turnNumber).toBe(2);
    expect(attacked.next.moveUsed).toBe(false);
    expect(attacked.next.attackUsed).toBe(false);
  });

  it('rejects a second move in one turn', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const dest = aMove(board, 'ship-1');
    const moved = resolveMove(turn, board, dest);
    expect(moved.accepted).toBe(true);
    if (!moved.accepted) return;
    const again = resolveMove(
      moved.next,
      moveWith(board, 'ship-1', dest),
      dest,
    );
    expect(again.accepted).toBe(false);
    if (again.accepted) return;
    expect(again.reason).toMatch(/used|once|move/i);
  });

  it('rejects a second attack in one turn and consumes no rolls', () => {
    const board = boardFromSeed(5, battleStats());
    const turn = initialTurn(board);
    const { rng, calls } = hitRng();
    const first = dispatchAttack(turn, board, shipped(), 'ship-2', rng);
    expect(first.accepted).toBe(true);
    if (!first.accepted) return;
    const usedCalls = calls();
    expect(usedCalls).toBeGreaterThan(0);
    const second = dispatchAttack(first.next, board, shipped(), 'ship-2', rng);
    expect(second.accepted).toBe(false);
    expect(calls()).toBe(usedCalls);
  });

  it('skipMove consumes the move with no relocation, no rolls, attack intact', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const before = shipAt(board, 'ship-1').position;
    const { rng, calls } = hitRng();
    void rng;
    const next = skipMove(turn, board);
    expect(next.moveUsed).toBe(true);
    expect(next.attackUsed).toBe(false);
    expect(next.activeShipId).toBe('ship-1');
    expect(shipAt(board, 'ship-1').position).toEqual(before);
    expect(calls()).toBe(0);
    // Attack remains available after the skip.
    const attacked = dispatchAttack(
      next,
      board,
      shipped(),
      'ship-2',
      missRng().rng,
    );
    expect(attacked.accepted).toBe(true);
  });

  it('skipping both actions leaves state unchanged and passes the turn', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const beforePos = { ...shipAt(board, 'ship-1').position };
    const beforeHP = shipAt(board, 'ship-2').hitPoints;
    const afterSkipMove = skipMove(turn, board);
    const next = skipAttack(afterSkipMove, board);
    expect(next.activeShipId).toBe('ship-2');
    expect(next.turnNumber).toBe(2);
    expect(shipAt(board, 'ship-1').position).toEqual(beforePos);
    expect(shipAt(board, 'ship-2').hitPoints).toBe(beforeHP);
  });

  it('endTurnEarly passes the turn with no state change and no rolls', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const { calls } = hitRng();
    const next = endTurnEarly(turn, board);
    expect(next.activeShipId).toBe('ship-2');
    expect(next.turnNumber).toBe(2);
    expect(next.moveUsed).toBe(false);
    expect(next.attackUsed).toBe(false);
    expect(calls()).toBe(0);
  });

  it('targeting the attacking ship itself launches nothing and rolls nothing', () => {
    const board = boardFromSeed(5, battleStats());
    const turn = initialTurn(board);
    const { rng, calls } = hitRng();
    const result = dispatchAttack(turn, board, shipped(), 'ship-1', rng);
    expect(result.accepted).toBe(false);
    expect(calls()).toBe(0);
  });

  it('rapid double-selection launches exactly one torpedo', () => {
    const board = boardFromSeed(5, battleStats());
    const turn = initialTurn(board);
    const { rng, calls } = hitRng();
    const first = dispatchAttack(turn, board, shipped(), 'ship-2', rng);
    const second = dispatchAttack(
      first.accepted ? first.next : turn,
      board,
      shipped(),
      'ship-2',
      rng,
    );
    const acceptedCount = [first, second].filter((r) => r.accepted).length;
    expect(acceptedCount).toBe(1);
    // One hit consumes exactly two draws (d20 attack + d8 damage).
    expect(calls()).toBe(2);
  });
});

describe('attack dispatch routing preconditions (US2, FR-009)', () => {
  it('accepts the enemy ship at unlimited range (default spawns are far apart)', () => {
    const board = boardFromSeed(5, battleStats());
    const turn = initialTurn(board);
    const foe = shipAt(board, 'ship-2').position;
    const me = shipAt(board, 'ship-1').position;
    const distance =
      Math.abs(foe.row - me.row) + Math.abs(foe.col - me.col);
    expect(distance).toBeGreaterThan(1);
    const result = dispatchAttack(
      turn,
      board,
      shipped(),
      'ship-2',
      missRng().rng,
    );
    expect(result.accepted).toBe(true);
  });

  it('rejects attacks once the game is over', () => {
    const board = boardFromSeed(5, battleStats());
    const turn = initialTurn(board);
    const over = { ...turn, over: { winner: 'ship-1' as ShipId } };
    const result = dispatchAttack(
      over,
      board,
      shipped(),
      'ship-2',
      hitRng().rng,
    );
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toMatch(/over|won|ended/i);
  });

  it('rejects moves once the game is over', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const over = { ...turn, over: { winner: 'ship-1' as ShipId } };
    const result = resolveMove(turn && over, board, {
      ...shipAt(board, 'ship-1').position,
    });
    expect(result.accepted).toBe(false);
  });

  it('rejects skips and early ends once the game is over (rule 16)', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const over = { ...turn, over: { winner: 'ship-2' as ShipId } };
    // Skips and early ends are no-ops returning the terminal state itself.
    expect(skipMove(over, board)).toBe(over);
    expect(skipAttack(over, board)).toBe(over);
    expect(endTurnEarly(over, board)).toBe(over);
    // HP stays within 0…max on a finished board.
    for (const ship of board.ships) {
      expect(ship.hitPoints).toBeGreaterThanOrEqual(0);
      expect(ship.hitPoints).toBeLessThanOrEqual(ship.maxHitPoints);
    }
  });

  it('a lethal hit ends the game immediately with the attacker as winner', () => {
    const board = boardFromSeed(5, battleStats());
    const weakened: TestBoard = {
      ...board,
      ships: board.ships.map((s) =>
        s.id === 'ship-2' ? { ...s, hitPoints: 3, maxHitPoints: 3 } : s,
      ),
    };
    const turn = initialTurn(weakened);
    // Attack roll 15 + strength mod (+4 for battleStats ship-1) hits;
    // damage 8 (clamped) + 4 = 12 >= 3 HP.
    const result = dispatchAttack(
      turn,
      weakened,
      shipped(),
      'ship-2',
      sequencePick([15, 8]),
    );
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.outcome.hit).toBe(true);
    expect(result.ships.find((s) => s.id === 'ship-2')!.hitPoints).toBe(0);
    expect(result.next.over).toEqual({ winner: 'ship-1' });
    // No successor turn: same owner and number.
    expect(result.next.activeShipId).toBe('ship-1');
    expect(result.next.turnNumber).toBe(1);
  });
});
