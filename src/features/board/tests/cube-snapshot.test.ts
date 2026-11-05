import { describe, expect, it } from 'vitest';
import { CubePosition } from '../domain/CubePosition.js';
import { CubeSnapshot } from '../domain/CubeSnapshot.js';

describe('CubeSnapshot', () => {
  it('has fixed dimensions, typed placements, and derives occupancy from the two ships', () => {
    const ship1 = { identity: 'ship-1' as const, position: new CubePosition(2, 1, 3) };
    const ship2 = { identity: 'ship-2' as const, position: new CubePosition(4, 5, 3) };
    const snapshot = new CubeSnapshot(ship1, ship2);

    expect(snapshot.width).toBe(5);
    expect(snapshot.height).toBe(5);
    expect(snapshot.depth).toBe(5);
    expect(snapshot.ship1).toEqual(ship1);
    expect(snapshot.ship2).toEqual(ship2);
    expect(snapshot.occupantAt(ship1.position)).toBe('ship-1');
    expect(snapshot.occupantAt(ship2.position)).toBe('ship-2');
    expect(snapshot.occupantAt(new CubePosition(2, 1, 4))).toBeNull();
    expect(snapshot.isOccupied(new CubePosition(2, 1, 3))).toBe(true);
    expect(snapshot.isOccupied(new CubePosition(2, 1, 4))).toBe(false);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.ship1)).toBe(true);
  });

  it('rejects duplicate positions and incorrectly identified placements', () => {
    const position = new CubePosition(1, 1, 1);
    const other = new CubePosition(5, 5, 5);

    expect(
      () =>
        new CubeSnapshot(
          { identity: 'ship-1', position },
          { identity: 'ship-2', position: new CubePosition(1, 1, 1) },
        ),
    ).toThrow(RangeError);
    expect(
      () =>
        new CubeSnapshot({ identity: 'ship-2', position }, { identity: 'ship-1', position: other }),
    ).toThrow(RangeError);
  });
});
