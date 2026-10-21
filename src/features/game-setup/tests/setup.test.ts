import { describe, expect, it } from 'vitest';
import { CubePosition } from '../../board/domain/CubePosition.js';
import { GameSetup } from '../domain/GameSetup.js';
import type { ShipPlacement } from '../domain/GameSetup.js';

function placement(
  identity: ShipPlacement['identity'],
  x: number,
  y: number,
  z: number,
): ShipPlacement {
  return { identity, position: new CubePosition(x, y, z) };
}

describe('GameSetup', () => {
  it('contains the fixed cube and exactly one correctly identified placement per ship', () => {
    const setup = new GameSetup(placement('ship-1', 1, 1, 4), placement('ship-2', 10, 10, 7));

    expect(setup.width).toBe(10);
    expect(setup.height).toBe(10);
    expect(setup.depth).toBe(10);
    expect(setup.ship1.identity).toBe('ship-1');
    expect(setup.ship1.position).toEqual(new CubePosition(1, 1, 4));
    expect(setup.ship2.identity).toBe('ship-2');
    expect(setup.ship2.position).toEqual(new CubePosition(10, 10, 7));
    expect(setup.ship1.position.equals(setup.ship2.position)).toBe(false);
  });

  it('rejects ship identities supplied in the wrong named zone', () => {
    expect(
      () => new GameSetup(placement('ship-2', 1, 1, 4), placement('ship-1', 10, 10, 7)),
    ).toThrow(RangeError);
  });

  it('is deeply immutable and exposes named placements rather than a mutable collection', () => {
    const setup = new GameSetup(placement('ship-1', 2, 2, 10), placement('ship-2', 9, 9, 1));

    expect(Object.isFrozen(setup)).toBe(true);
    expect(Object.isFrozen(setup.ship1)).toBe(true);
    expect(Object.isFrozen(setup.ship2)).toBe(true);
    expect(Object.isFrozen(setup.ship1.position)).toBe(true);
    expect(Array.isArray(setup)).toBe(false);
    expect(Reflect.set(setup.ship1, 'identity', 'ship-2')).toBe(false);
  });
});
