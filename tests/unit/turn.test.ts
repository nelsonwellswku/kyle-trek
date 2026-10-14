import { describe, expect, it } from 'vitest';
import { setupGame } from '../../src/sim/setup.js';
import { initialTurn, resolveMove } from '../../src/sim/turn.js';
import { loadBoardConfig } from '../../src/sim/board-config.js';
import type { BoardConfig, Rng, Spaceship } from '../../src/sim/types.js';
import shippedConfig from '../../src/config/board.json';

// TDD (T008): written BEFORE src/sim/turn.ts exists → must FAIL until T011.

const shipped = (): BoardConfig =>
  loadBoardConfig(JSON.parse(JSON.stringify(shippedConfig)));

/** Spawn idx 0 for both ships, then raw agility rolls 19 (-> +4) each. */
const strongSequence = (): Rng => {
  const picks = [0, 0, 19, 19];
  let i = 0;
  return {
    integer: (min: number, max: number) => {
      const pick = picks[i % picks.length]!;
      i++;
      return Math.min(Math.max(pick, min), max);
    },
  };
};

interface MutableShip {
  id: 'ship-1' | 'ship-2';
  agility: number;
  agilityModifier: number;
  position: { row: number; col: number };
}

interface Board {
  rows: number;
  cols: number;
  ships: MutableShip[];
}

const boardFromSeed = (seed: number): Board => {
  const setup = setupGame(shipped(), seed, strongSequence());
  return {
    rows: setup.grid.rows,
    cols: setup.grid.cols,
    ships: setup.ships.map((s) => ({
      id: s.id,
      agility: s.agility,
      agilityModifier: s.agilityModifier,
      position: { ...s.position },
    })),
  };
};

const shipAt = (board: Board, id: 'ship-1' | 'ship-2'): MutableShip =>
  board.ships.find((s) => s.id === id)!;

describe('turn state machine (FR-003/FR-009/FR-010)', () => {
  it('starts every game with ship-1 on turn 1', () => {
    const turn = initialTurn(boardFromSeed(5));
    expect(turn.activeShipId).toBe('ship-1');
    expect(turn.turnNumber).toBe(1);
    expect(turn.legalSet.length).toBeGreaterThan(1);
  });

  it('accepts a highlighted destination and alternates to ship-2, turn 2', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const dest = turn.legalSet.find(
      (c) =>
        c.row !== shipAt(board, 'ship-1').position.row ||
        c.col !== shipAt(board, 'ship-1').position.col,
    )!;
    const result = resolveMove(turn, board, dest);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.next.activeShipId).toBe('ship-2');
    expect(result.next.turnNumber).toBe(2);
    expect(result.move.shipId).toBe('ship-1');
    expect(result.move.to).toEqual(dest);
  });

  it('alternates strictly over 4 accepted moves without skips or repeats', () => {
    const board = boardFromSeed(5);
    let turn = initialTurn(board);
    const owners: string[] = [turn.activeShipId];
    for (let n = 0; n < 4; n++) {
      const mover = shipAt(board, turn.activeShipId);
      const dest = turn.legalSet.find(
        (c) => c.row !== mover.position.row || c.col !== mover.position.col,
      )!;
      const result = resolveMove(turn, board, dest);
      expect(result.accepted).toBe(true);
      if (!result.accepted) return;
      mover.position = { ...dest };
      turn = result.next;
      owners.push(turn.activeShipId);
    }
    expect(owners).toEqual(['ship-1', 'ship-2', 'ship-1', 'ship-2', 'ship-1']);
    expect(turn.turnNumber).toBe(5);
  });

  it('staying in place passes the turn without moving', () => {
    const board = boardFromSeed(5);
    const turn = initialTurn(board);
    const origin = { ...shipAt(board, 'ship-1').position };
    const result = resolveMove(turn, board, origin);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.next.activeShipId).toBe('ship-2');
    expect(result.next.turnNumber).toBe(2);
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
