import { describe, expect, it } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { GameSetup } from '../domain/GameSetup.js';
import type { ShipPlacement } from '../domain/GameSetup.js';

function placement(
  identity: ShipPlacement['identity'],
  row: number,
  column: number,
): ShipPlacement {
  return { identity, position: new BoardPosition(row, column) };
}

describe('BoardPosition', () => {
  it('stores one-based integer coordinates and compares positions by value', () => {
    const position = new BoardPosition(1, 1);

    expect(position.row).toBe(1);
    expect(position.column).toBe(1);
    expect(position.equals(new BoardPosition(1, 1))).toBe(true);
    expect(position.equals(new BoardPosition(1, 2))).toBe(false);
  });

  it('is immutable', () => {
    const position = new BoardPosition(2, 3);

    expect(Object.isFrozen(position)).toBe(true);
    expect(Reflect.set(position, 'row', 8)).toBe(false);
  });

  it.each([
    [1.5, 1],
    [1, 2.5],
    [0, 1],
    [11, 1],
    [1, 0],
    [1, 11],
    [Number.NaN, 1],
    [1, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, 10],
  ])('rejects invalid coordinates (%s, %s)', (row, column) => {
    expect(() => new BoardPosition(row, column)).toThrow(RangeError);
  });
});

describe('GameSetup', () => {
  it('contains the fixed board and exactly one correctly identified placement per ship', () => {
    const setup = new GameSetup(placement('ship-1', 1, 4), placement('ship-2', 10, 7));

    expect(setup.rows).toBe(10);
    expect(setup.columns).toBe(10);
    expect(setup.ship1.identity).toBe('ship-1');
    expect(setup.ship1.position).toEqual(new BoardPosition(1, 4));
    expect(setup.ship2.identity).toBe('ship-2');
    expect(setup.ship2.position).toEqual(new BoardPosition(10, 7));
    expect(setup.ship1.position.equals(setup.ship2.position)).toBe(false);
  });

  it('rejects ship identities supplied in the wrong named zone', () => {
    expect(() => new GameSetup(placement('ship-2', 1, 4), placement('ship-1', 10, 7))).toThrow(
      RangeError,
    );
  });

  it('is deeply immutable and exposes named placements rather than a mutable collection', () => {
    const setup = new GameSetup(placement('ship-1', 2, 10), placement('ship-2', 9, 1));

    expect(Object.isFrozen(setup)).toBe(true);
    expect(Object.isFrozen(setup.ship1)).toBe(true);
    expect(Object.isFrozen(setup.ship2)).toBe(true);
    expect(Object.isFrozen(setup.ship1.position)).toBe(true);
    expect(Array.isArray(setup)).toBe(false);
    expect(Reflect.set(setup.ship1, 'identity', 'ship-2')).toBe(false);
  });
});
