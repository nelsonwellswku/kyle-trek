import { describe, expect, it } from 'vitest';
import { BoardPosition } from '../domain/BoardPosition.js';
import { BoardSnapshot } from '../domain/BoardSnapshot.js';

describe('BoardSnapshot', () => {
  it('keeps exactly two correctly identified, distinct occupied positions immutable', () => {
    const ship1 = { identity: 'ship-1' as const, position: new BoardPosition(2, 3) };
    const ship2 = { identity: 'ship-2' as const, position: new BoardPosition(9, 8) };
    const snapshot = new BoardSnapshot(ship1, ship2);

    expect(snapshot.rows).toBe(10);
    expect(snapshot.columns).toBe(10);
    expect(snapshot.ship1).toEqual(ship1);
    expect(snapshot.ship2).toEqual(ship2);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.ship1)).toBe(true);
    expect(() => new BoardSnapshot(ship1, { ...ship2, position: ship1.position })).toThrow(
      RangeError,
    );
    expect(
      () =>
        new BoardSnapshot(
          { identity: 'ship-2', position: ship1.position },
          { identity: 'ship-2', position: ship2.position },
        ),
    ).toThrow(RangeError);
  });
});
