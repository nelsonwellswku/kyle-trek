import { describe, expect, it } from 'vitest';
import { CUBE_CELL_COUNT, CUBE_SIZE, CubePosition } from '../domain/CubePosition.js';

describe('CubePosition', () => {
  it('represents all 125 valid coordinates with a stable bijective presentation index', () => {
    const positions = Array.from({ length: CUBE_CELL_COUNT }, (_, index) =>
      CubePosition.fromPresentationIndex(index),
    );

    expect(new Set(positions.map((position) => position.presentationIndex)).size).toBe(
      CUBE_CELL_COUNT,
    );
    for (const [index, position] of positions.entries()) {
      expect(position.presentationIndex).toBe(index);
      expect(CubePosition.fromPresentationIndex(position.presentationIndex)).toEqual(position);
    }
    expect(new CubePosition(1, 1, 1).presentationIndex).toBe(0);
    expect(new CubePosition(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE).presentationIndex).toBe(124);
  });

  it('is immutable and compares all three coordinates by value', () => {
    const position = new CubePosition(3, 4, 5);

    expect(Object.isFrozen(position)).toBe(true);
    expect(position.equals(new CubePosition(3, 4, 5))).toBe(true);
    expect(position.equals(new CubePosition(3, 4, 4))).toBe(false);
    expect(Reflect.set(position, 'z', 1)).toBe(false);
  });

  it.each([
    [0, 1, 1],
    [6, 1, 1],
    [1, 0, 1],
    [1, 6, 1],
    [1, 1, 0],
    [1, 1, 6],
    [1.5, 1, 1],
    [1, 2.5, 1],
    [1, 1, 3.5],
    [Number.NaN, 1, 1],
    [1, Number.POSITIVE_INFINITY, 1],
    [1, 1, Number.NEGATIVE_INFINITY],
  ])('rejects invalid coordinates (%s, %s, %s)', (x, y, z) => {
    expect(() => new CubePosition(x, y, z)).toThrow(RangeError);
  });

  it.each([-1, CUBE_CELL_COUNT, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid presentation index %s',
    (index) => {
      expect(() => CubePosition.fromPresentationIndex(index)).toThrow(RangeError);
    },
  );
});
