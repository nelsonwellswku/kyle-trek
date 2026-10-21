import { describe, expect, it } from 'vitest';
import { CubePosition } from '../domain/CubePosition.js';

describe('CubePosition', () => {
  it('represents all 1,000 valid coordinates with a stable bijective presentation index', () => {
    const positions = Array.from({ length: 1_000 }, (_, index) =>
      CubePosition.fromPresentationIndex(index),
    );

    expect(new Set(positions.map((position) => position.presentationIndex)).size).toBe(1_000);
    for (const [index, position] of positions.entries()) {
      expect(position.presentationIndex).toBe(index);
      expect(CubePosition.fromPresentationIndex(position.presentationIndex)).toEqual(position);
    }
    expect(new CubePosition(1, 1, 1).presentationIndex).toBe(0);
    expect(new CubePosition(10, 10, 10).presentationIndex).toBe(999);
  });

  it('is immutable and compares all three coordinates by value', () => {
    const position = new CubePosition(3, 7, 9);

    expect(Object.isFrozen(position)).toBe(true);
    expect(position.equals(new CubePosition(3, 7, 9))).toBe(true);
    expect(position.equals(new CubePosition(3, 7, 8))).toBe(false);
    expect(Reflect.set(position, 'z', 1)).toBe(false);
  });

  it.each([
    [0, 1, 1],
    [11, 1, 1],
    [1, 0, 1],
    [1, 11, 1],
    [1, 1, 0],
    [1, 1, 11],
    [1.5, 1, 1],
    [1, 2.5, 1],
    [1, 1, 3.5],
    [Number.NaN, 1, 1],
    [1, Number.POSITIVE_INFINITY, 1],
    [1, 1, Number.NEGATIVE_INFINITY],
  ])('rejects invalid coordinates (%s, %s, %s)', (x, y, z) => {
    expect(() => new CubePosition(x, y, z)).toThrow(RangeError);
  });

  it.each([-1, 1_000, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid presentation index %s',
    (index) => {
      expect(() => CubePosition.fromPresentationIndex(index)).toThrow(RangeError);
    },
  );
});
