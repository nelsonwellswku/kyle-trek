import { describe, expect, it } from 'vitest';
import { CubePosition } from '../../board/domain/CubePosition.js';
import { CubeSnapshot } from '../../board/domain/CubeSnapshot.js';
import { Reachability, type ReachabilityResult } from '../domain/Reachability.js';

function cube(ship1: CubePosition, ship2: CubePosition): CubeSnapshot {
  return new CubeSnapshot(
    { identity: 'ship-1', position: ship1 },
    { identity: 'ship-2', position: ship2 },
  );
}

function key(position: CubePosition): string {
  return `${position.x},${position.y},${position.z}`;
}

function expectLegalShortestRoutes(result: ReachabilityResult): void {
  for (const destination of result.destinations) {
    expect(destination.position).toBeInstanceOf(CubePosition);
    const { positions, stepCount } = destination.route;
    expect(stepCount).toBe(positions.length - 1);
    expect(stepCount).toBe(destination.distance);
    expect(stepCount).toBeGreaterThanOrEqual(1);
    expect(stepCount).toBeLessThanOrEqual(result.allowance);
    expect(positions[0]).toEqual(result.origin);
    expect(positions.at(-1)).toEqual(destination.position);
    expect(new Set(positions.map(key)).size).toBe(positions.length);

    positions.forEach((position, index) => {
      expect(position.x).toBeGreaterThanOrEqual(1);
      expect(position.x).toBeLessThanOrEqual(10);
      expect(position.y).toBeGreaterThanOrEqual(1);
      expect(position.y).toBeLessThanOrEqual(10);
      expect(position.z).toBeGreaterThanOrEqual(1);
      expect(position.z).toBeLessThanOrEqual(10);
      if (index > 0) {
        const previous = positions[index - 1];
        if (!previous) throw new Error('Every route step must have a predecessor.');
        expect(
          Math.abs(previous.x - position.x) +
            Math.abs(previous.y - position.y) +
            Math.abs(previous.z - position.z),
        ).toBe(1);
        expect(result.blockers.some((blocker) => blocker.equals(position))).toBe(false);
      }
    });
  }
}

interface RouteArrangement {
  readonly name: string;
  readonly origin: readonly [number, number, number];
  readonly blocker: readonly [number, number, number];
  readonly allowance: number;
}

const routeArrangements: readonly RouteArrangement[] = [
  { name: 'center, one step', origin: [5, 5, 5], blocker: [10, 10, 10], allowance: 1 },
  { name: 'center, two steps', origin: [5, 5, 5], blocker: [10, 10, 10], allowance: 2 },
  { name: 'center, five-step limit', origin: [5, 5, 5], blocker: [10, 10, 10], allowance: 5 },
  { name: 'center with +X blocker', origin: [5, 5, 5], blocker: [6, 5, 5], allowance: 3 },
  { name: 'center with -Y blocker', origin: [5, 5, 5], blocker: [5, 4, 5], allowance: 4 },
  { name: 'near face', origin: [5, 5, 1], blocker: [10, 10, 10], allowance: 5 },
  { name: 'upper edge', origin: [1, 5, 5], blocker: [10, 10, 10], allowance: 4 },
  { name: 'corner', origin: [1, 1, 1], blocker: [10, 10, 10], allowance: 5 },
  { name: 'corner with adjacent blocker', origin: [1, 1, 1], blocker: [2, 1, 1], allowance: 5 },
  { name: 'affordable blocker detour', origin: [5, 5, 5], blocker: [6, 5, 5], allowance: 4 },
];

function enumerateBoundedRoutes(
  origin: CubePosition,
  blockers: readonly CubePosition[],
  allowance: number,
): ReadonlyMap<string, number> {
  const shortestDistance = new Map<string, number>();
  const blockerKeys = new Set(blockers.map(key));
  const directions = [
    [-1, 0, 0],
    [1, 0, 0],
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [0, 0, 1],
  ] as const;

  function visit(position: CubePosition, steps: number, visited: ReadonlySet<string>): void {
    if (steps === allowance) return;

    for (const [dx, dy, dz] of directions) {
      const x = position.x + dx;
      const y = position.y + dy;
      const z = position.z + dz;
      if (x < 1 || x > 10 || y < 1 || y > 10 || z < 1 || z > 10) continue;

      const next = new CubePosition(x, y, z);
      const nextKey = key(next);
      if (blockerKeys.has(nextKey) || visited.has(nextKey)) continue;

      const nextSteps = steps + 1;
      const previousBest = shortestDistance.get(nextKey);
      if (previousBest === undefined || nextSteps < previousBest) {
        shortestDistance.set(nextKey, nextSteps);
      }
      visit(next, nextSteps, new Set([...visited, nextKey]));
    }
  }

  visit(origin, 0, new Set([key(origin)]));
  return shortestDistance;
}

describe('Reachability', () => {
  const reachability = new Reachability();

  it('returns exactly the six face-adjacent neighbors and rejects diagonal steps', () => {
    const result = reachability.find(
      cube(new CubePosition(5, 5, 5), new CubePosition(10, 10, 10)),
      'ship-1',
      1,
    );

    expect(new Set(result.destinations.map(({ position }) => key(position)))).toEqual(
      new Set(['4,5,5', '6,5,5', '5,4,5', '5,6,5', '5,5,4', '5,5,6']),
    );
    expect(result.routeTo(new CubePosition(5, 5, 5))).toBeNull();
    expect(result.routeTo(new CubePosition(6, 6, 5))).toBeNull();
    expectLegalShortestRoutes(result);
  });

  it('matches an independent 3D bounded-route oracle for faces, edges, blockers, and detours', () => {
    for (const { name, origin, blocker, allowance } of routeArrangements) {
      const originPosition = new CubePosition(...origin);
      const blockerPosition = new CubePosition(...blocker);
      const expected = enumerateBoundedRoutes(originPosition, [blockerPosition], allowance);
      const result = reachability.find(cube(originPosition, blockerPosition), 'ship-1', allowance);
      const actual = new Map(
        result.destinations.map(({ position, distance }) => [key(position), distance]),
      );

      expect(actual, name).toEqual(expected);
      expectLegalShortestRoutes(result);
    }
  });

  it('keeps opposing occupancy out of routes and selects a shortest affordable detour', () => {
    const snapshot = cube(new CubePosition(5, 5, 5), new CubePosition(6, 5, 5));
    const short = reachability.find(snapshot, 'ship-1', 2);
    const affordable = reachability.find(snapshot, 'ship-1', 4);
    const route = affordable.routeTo(new CubePosition(7, 5, 5));

    expect(short.routeTo(new CubePosition(7, 5, 5))).toBeNull();
    expect(route?.stepCount).toBe(4);
    expect(route?.positions.map(key)).toEqual(['5,5,5', '5,4,5', '6,4,5', '7,4,5', '7,5,5']);
    expect(affordable.routeTo(new CubePosition(6, 5, 5))).toBeNull();
    expectLegalShortestRoutes(affordable);
  });

  it.each([0, -1])('returns no destinations for a nonpositive allowance: %s', (allowance) => {
    const result = reachability.find(
      cube(new CubePosition(5, 5, 5), new CubePosition(10, 10, 10)),
      'ship-1',
      allowance,
    );
    expect(result.destinations).toEqual([]);
  });

  it('caps allowance at five and reaches no more than the 231 cells in the radius-five ball', () => {
    const result = reachability.find(
      cube(new CubePosition(5, 5, 5), new CubePosition(10, 10, 10)),
      'ship-1',
      99,
    );
    expect(result.allowance).toBe(5);
    expect(result.destinations.length + 1).toBeLessThanOrEqual(231);
    expect(result.destinations).toHaveLength(227);
    expect(result.routeTo(new CubePosition(10, 5, 5))?.stepCount).toBe(5);
    expect(result.routeTo(new CubePosition(10, 6, 5))).toBeNull();
    expectLegalShortestRoutes(result);
  });

  it('does not return any destination when fixture blockers surround the origin on all axes', () => {
    const origin = new CubePosition(5, 5, 5);
    const fixtureBlockers = [
      new CubePosition(4, 5, 5),
      new CubePosition(6, 5, 5),
      new CubePosition(5, 4, 5),
      new CubePosition(5, 6, 5),
      new CubePosition(5, 5, 4),
      new CubePosition(5, 5, 6),
    ];
    const result = reachability.find(
      cube(origin, new CubePosition(10, 10, 10)),
      'ship-1',
      5,
      fixtureBlockers,
    );

    expect(result.destinations).toEqual([]);
    expect(result.blockers).toHaveLength(7);
  });

  it('rejects nonfinite movement allowances', () => {
    const snapshot = cube(new CubePosition(5, 5, 5), new CubePosition(10, 10, 10));
    expect(() => reachability.find(snapshot, 'ship-1', Number.NaN)).toThrow(RangeError);
    expect(() => reachability.find(snapshot, 'ship-1', Infinity)).toThrow(RangeError);
  });
});
