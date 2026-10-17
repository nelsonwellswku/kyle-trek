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
});
