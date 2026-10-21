import { describe, expect, it } from 'vitest';
import { CubeOrientation } from '../domain/CubeOrientation.js';

describe('CubeOrientation', () => {
  it('enumerates exactly the 24 right-handed signed-axis orientations', () => {
    const orientations = new Map<string, CubeOrientation>();
    const queue = [CubeOrientation.ship1Default()];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const key = current.key;
      if (orientations.has(key)) continue;
      orientations.set(key, current);
      for (const axis of ['x', 'y', 'z'] as const) {
        for (const direction of [-1, 1] as const) {
          queue.push(current.rotate(axis, direction));
        }
      }
    }

    expect(orientations.size).toBe(24);
    for (const orientation of orientations.values()) {
      expect(orientation.right).not.toEqual(orientation.up);
      expect(orientation.up).not.toEqual(orientation.forward);
      expect(orientation.right).not.toEqual(orientation.forward);
      expect(orientation.isRightHanded).toBe(true);
      expect(Object.isFrozen(orientation)).toBe(true);
    }
  });

  it('sets default facing directions with +Z up and composes signed global quarter-turns', () => {
    const ship1 = CubeOrientation.ship1Default();
    const ship2 = CubeOrientation.ship2Default();

    expect(ship1.forward).toEqual({ axis: 'y', sign: 1 });
    expect(ship2.forward).toEqual({ axis: 'y', sign: -1 });
    expect(ship1.up).toEqual({ axis: 'z', sign: 1 });
    expect(ship2.up).toEqual({ axis: 'z', sign: 1 });
    expect(ship1.rotate('x', 1).rotate('x', -1).equals(ship1)).toBe(true);
    expect(ship1.rotate('y', 1).rotate('y', -1).equals(ship1)).toBe(true);
    expect(ship1.rotate('z', 1).rotate('z', -1).equals(ship1)).toBe(true);
    expect(ship1.rotate('x', 1).rotate('y', 1).equals(ship1.rotate('y', 1).rotate('x', 1))).toBe(
      false,
    );
  });
});
