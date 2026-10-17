import { describe, expect, it } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardSnapshot } from '../../board/domain/BoardSnapshot.js';
import { Reachability, type ReachabilityResult } from '../domain/Reachability.js';

function board(ship1: BoardPosition, ship2: BoardPosition): BoardSnapshot {
  return new BoardSnapshot(
    { identity: 'ship-1', position: ship1 },
    { identity: 'ship-2', position: ship2 },
  );
}

function key(position: BoardPosition): string {
  return `${position.row},${position.column}`;
}

function expectLegalShortestRoutes(result: ReachabilityResult): void {
  for (const destination of result.destinations) {
    const { positions, stepCount } = destination.route;
    expect(stepCount).toBe(positions.length - 1);
    expect(stepCount).toBe(destination.distance);
    expect(stepCount).toBeGreaterThanOrEqual(1);
    expect(stepCount).toBeLessThanOrEqual(result.allowance);
    expect(positions[0]).toEqual(result.origin);
    expect(positions.at(-1)).toEqual(destination.position);
    expect(new Set(positions.map(key)).size).toBe(positions.length);

    positions.forEach((position, index) => {
      expect(position.row).toBeGreaterThanOrEqual(1);
      expect(position.row).toBeLessThanOrEqual(10);
      expect(position.column).toBeGreaterThanOrEqual(1);
      expect(position.column).toBeLessThanOrEqual(10);
      if (index > 0) {
        const previous = positions[index - 1];
        if (!previous) {
          throw new Error('Every non-origin route position must have a predecessor.');
        }
        expect(
          Math.abs(previous.row - position.row) + Math.abs(previous.column - position.column),
        ).toBe(1);
        expect(result.blockers.some((blocker) => blocker.equals(position))).toBe(false);
      }
    });
  }
}

interface RouteArrangement {
  readonly name: string;
  readonly origin: readonly [number, number];
  readonly blocker: readonly [number, number];
  readonly allowance: number;
}

const routeArrangements: readonly RouteArrangement[] = [
  { name: 'center, one step', origin: [5, 5], blocker: [10, 10], allowance: 1 },
  { name: 'center, two steps', origin: [5, 5], blocker: [10, 10], allowance: 2 },
  { name: 'center, five-step limit', origin: [5, 5], blocker: [10, 10], allowance: 5 },
  { name: 'center with northern blocker', origin: [5, 5], blocker: [4, 5], allowance: 3 },
  { name: 'center with eastern blocker', origin: [5, 5], blocker: [5, 6], allowance: 4 },
  { name: 'center with southern blocker', origin: [5, 5], blocker: [6, 5], allowance: 3 },
  { name: 'center with western blocker', origin: [5, 5], blocker: [5, 4], allowance: 3 },
  { name: 'top edge', origin: [1, 5], blocker: [10, 10], allowance: 5 },
  { name: 'left edge', origin: [5, 1], blocker: [10, 10], allowance: 4 },
  { name: 'top edge with adjacent blocker', origin: [1, 5], blocker: [1, 6], allowance: 5 },
  { name: 'top-left corner, one step', origin: [1, 1], blocker: [10, 10], allowance: 1 },
  { name: 'top-left corner, five steps', origin: [1, 1], blocker: [10, 10], allowance: 5 },
  { name: 'top-left corner with east blocker', origin: [1, 1], blocker: [1, 2], allowance: 5 },
  { name: 'bottom-right corner', origin: [10, 10], blocker: [10, 9], allowance: 4 },
  { name: 'bottom edge with blocker', origin: [10, 5], blocker: [9, 5], allowance: 3 },
  { name: 'near-corner detour', origin: [2, 2], blocker: [2, 3], allowance: 5 },
  { name: 'blocked direct route, allowance two', origin: [5, 4], blocker: [5, 5], allowance: 2 },
  { name: 'blocked direct route, allowance four', origin: [5, 4], blocker: [5, 5], allowance: 4 },
  { name: 'five-step detour limit', origin: [5, 5], blocker: [5, 6], allowance: 5 },
  { name: 'edge detour, five-step limit', origin: [1, 1], blocker: [1, 2], allowance: 5 },
];

function enumerateBoundedRoutes(
  origin: BoardPosition,
  blockers: readonly BoardPosition[],
  allowance: number,
): ReadonlyMap<string, number> {
  const shortestDistance = new Map<string, number>();
  const blockerKeys = new Set(blockers.map(key));

  function visit(position: BoardPosition, steps: number, visited: ReadonlySet<string>): void {
    if (steps === allowance) {
      return;
    }

    for (const [rowDelta, columnDelta] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const nextRow = position.row + rowDelta;
      const nextColumn = position.column + columnDelta;
      if (nextRow < 1 || nextRow > 10 || nextColumn < 1 || nextColumn > 10) {
        continue;
      }

      const next = new BoardPosition(nextRow, nextColumn);
      const nextKey = key(next);
      if (blockerKeys.has(nextKey) || visited.has(nextKey)) {
        continue;
      }

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

  it('returns the exact 12 other center squares within two steps and excludes the origin', () => {
    const result = reachability.find(
      board(new BoardPosition(5, 5), new BoardPosition(10, 10)),
      'ship-1',
      2,
    );

    expect(result.destinations).toHaveLength(12);
    expect(new Set(result.destinations.map(({ position }) => key(position)))).toEqual(
      new Set(['4,5', '6,5', '5,4', '5,6', '3,5', '5,7', '7,5', '5,3', '4,4', '4,6', '6,4', '6,6']),
    );
    expect(result.routeTo(new BoardPosition(5, 5))).toBeNull();
    expectLegalShortestRoutes(result);
  });

  it.each([0, -1])('returns no destinations when the movement allowance is %s', (allowance) => {
    const result = reachability.find(
      board(new BoardPosition(5, 5), new BoardPosition(10, 10)),
      'ship-1',
      allowance,
    );

    expect(result.destinations).toEqual([]);
  });

  it('excludes the occupied enemy cell from reachable destinations and routes', () => {
    const result = reachability.find(
      board(new BoardPosition(5, 4), new BoardPosition(5, 5)),
      'ship-1',
      5,
    );

    expect(result.routeTo(new BoardPosition(5, 5))).toBeNull();
    for (const destination of result.destinations) {
      expect(
        destination.route.positions.some((position) => position.equals(new BoardPosition(5, 5))),
      ).toBe(false);
    }
    expectLegalShortestRoutes(result);
  });

  it('finds the empty four-step enemy detour only when the full route is affordable', () => {
    const snapshot = board(new BoardPosition(5, 4), new BoardPosition(5, 5));
    const tooShort = reachability.find(snapshot, 'ship-1', 2);
    const affordable = reachability.find(snapshot, 'ship-1', 4);
    const route = affordable.routeTo(new BoardPosition(5, 6));

    expect(tooShort.routeTo(new BoardPosition(5, 6))).toBeNull();
    expect(route?.stepCount).toBe(4);
    expect(route?.positions.map(key)).toEqual(['5,4', '4,4', '4,5', '4,6', '5,6']);
    expectLegalShortestRoutes(affordable);
  });

  it.each(routeArrangements)(
    'matches the independent bounded-route oracle for $name',
    ({ origin, blocker, allowance }) => {
      const originPosition = new BoardPosition(...origin);
      const blockerPosition = new BoardPosition(...blocker);
      const expected = enumerateBoundedRoutes(originPosition, [blockerPosition], allowance);
      const result = reachability.find(board(originPosition, blockerPosition), 'ship-1', allowance);
      const actual = new Map(
        result.destinations.map(({ position, distance }) => [key(position), distance]),
      );

      expect(actual).toEqual(expected);
      expectLegalShortestRoutes(result);
    },
  );

  it('selects the up-first route when two equally short enemy detours exist', () => {
    const result = reachability.find(
      board(new BoardPosition(5, 5), new BoardPosition(5, 6)),
      'ship-1',
      4,
    );

    expect(result.routeTo(new BoardPosition(5, 7))?.positions.map(key)).toEqual([
      '5,5',
      '4,5',
      '4,6',
      '4,7',
      '5,7',
    ]);
  });

  it('includes a five-step destination but excludes a six-step destination', () => {
    const result = reachability.find(
      board(new BoardPosition(5, 5), new BoardPosition(10, 10)),
      'ship-1',
      5,
    );

    expect(result.routeTo(new BoardPosition(5, 10))?.stepCount).toBe(5);
    expect(result.routeTo(new BoardPosition(6, 10))).toBeNull();
  });

  it('returns no destinations for a positive allowance when fixture blockers surround the origin', () => {
    const fixtureBlockers = [
      new BoardPosition(4, 5),
      new BoardPosition(5, 6),
      new BoardPosition(6, 5),
      new BoardPosition(5, 4),
    ];
    const result = reachability.find(
      board(new BoardPosition(5, 5), new BoardPosition(10, 10)),
      'ship-1',
      4,
      fixtureBlockers,
    );

    expect(result.allowance).toBe(4);
    expect(result.destinations).toEqual([]);
    expect(result.blockers.map(key)).toEqual(['10,10', '4,5', '5,6', '6,5', '5,4']);
  });
});
