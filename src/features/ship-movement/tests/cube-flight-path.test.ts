import { describe, expect, it } from 'vitest';
import { CubePosition } from '../../board/domain/CubePosition.js';
import { CubeFlightPath } from '../presentation/CubeFlightPath.js';

function route(...positions: CubePosition[]) {
  return Object.freeze({
    positions: Object.freeze(positions),
    stepCount: positions.length - 1,
  });
}

function distanceToSegment(point: CubePosition, start: CubePosition, end: CubePosition): number {
  const delta = [end.x - start.x, end.y - start.y, end.z - start.z];
  const offset = [point.x - start.x, point.y - start.y, point.z - start.z];
  const squaredLength = delta.reduce((sum, value) => sum + value * value, 0);
  const factor = Math.max(
    0,
    Math.min(
      1,
      offset.reduce((sum, value, index) => sum + value * (delta[index] ?? 0), 0) / squaredLength,
    ),
  );
  return Math.hypot(
    point.x - (start.x + (delta[0] ?? 0) * factor),
    point.y - (start.y + (delta[1] ?? 0) * factor),
    point.z - (start.z + (delta[2] ?? 0) * factor),
  );
}

describe('CubeFlightPath', () => {
  it('uses a direct 3D path and maps both endpoints to cube world coordinates', () => {
    const start = new CubePosition(2, 3, 4);
    const end = new CubePosition(4, 3, 4);
    const path = new CubeFlightPath(
      route(start, new CubePosition(3, 3, 4), end),
      new CubePosition(5, 5, 5),
    );

    expect(path.isDetour).toBe(false);
    expect(path.points).toEqual([
      { x: -1, y: 0, z: 1 },
      { x: 1, y: 0, z: 1 },
    ]);
    expect(path.pathLength).toBeCloseTo(2);
    expect(path.pointAt(0)).toEqual(path.points[0]);
    expect(path.pointAt(1)).toEqual(path.points.at(-1));
    expect(path.pointAt(0.5)).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('follows the typed legal route when the direct flight intersects the opposing ship', () => {
    const positions = [
      new CubePosition(3, 3, 3),
      new CubePosition(3, 2, 3),
      new CubePosition(4, 2, 3),
      new CubePosition(5, 2, 3),
      new CubePosition(5, 3, 3),
    ];
    const obstacle = new CubePosition(4, 3, 3);
    const path = new CubeFlightPath(route(...positions), obstacle);

    expect(path.isDetour).toBe(true);
    expect(path.points[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(path.points.at(-1)).toEqual({ x: 2, y: 0, z: 0 });
    expect(path.pathLength).toBe(4);
    for (let index = 1; index < positions.length; index += 1) {
      const start = positions[index - 1];
      const end = positions[index];
      if (!start || !end) throw new Error('Expected each route segment to have two cells.');
      expect(distanceToSegment(obstacle, start, end)).toBeGreaterThanOrEqual(0.5);
    }
    expect(path.pointAt(0)).toEqual(path.points[0]);
    expect(path.pointAt(1)).toEqual(path.points.at(-1));
  });

  it('rejects a route whose endpoints do not match its typed cube positions or step count', () => {
    const start = new CubePosition(2, 2, 2);
    expect(
      () => new CubeFlightPath(route(start, new CubePosition(4, 2, 2)), new CubePosition(5, 5, 5)),
    ).toThrow(RangeError);
    expect(
      () =>
        new CubeFlightPath(
          { positions: [start, new CubePosition(3, 2, 2)], stepCount: 4 },
          new CubePosition(5, 5, 5),
        ),
    ).toThrow(RangeError);
  });
});
