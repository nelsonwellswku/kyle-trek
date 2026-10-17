import { describe, expect, it } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardGeometry, type BoardPoint } from '../../board/presentation/BoardGeometry.js';
import { TorpedoPath } from '../presentation/TorpedoPath.js';

type Coordinates = readonly [row: number, column: number];

interface NearMissCase {
  readonly name: string;
  readonly attacker: Coordinates;
  readonly defender: Coordinates;
}

interface ClosestApproach {
  readonly parameter: number;
  readonly point: BoardPoint;
  readonly distance: number;
}

interface PathClosestApproach extends ClosestApproach {
  readonly segmentIndex: number;
}

const projectileRadiusAtSixtyPixelCells = 13;
const clearanceAtSixtyPixelCells = 1;

function position(coordinates: Coordinates): BoardPosition {
  return new BoardPosition(...coordinates);
}

function closestApproach(start: BoardPoint, end: BoardPoint, target: BoardPoint): ClosestApproach {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const parameter = Math.max(
    0,
    Math.min(1, ((target.x - start.x) * dx + (target.y - start.y) * dy) / lengthSquared),
  );
  const point = { x: start.x + parameter * dx, y: start.y + parameter * dy };

  return {
    parameter,
    point,
    distance: Math.hypot(point.x - target.x, point.y - target.y),
  };
}

function closestApproachOnPath(path: TorpedoPath, target: BoardPoint): PathClosestApproach {
  let closest: PathClosestApproach | null = null;
  for (let segmentIndex = 0; segmentIndex < path.waypoints.length - 1; segmentIndex += 1) {
    const start = path.waypoints[segmentIndex];
    const end = path.waypoints[segmentIndex + 1];
    if (!start || !end) continue;
    const segment = closestApproach(start, end, target);
    if (!closest || segment.distance < closest.distance) {
      closest = { ...segment, segmentIndex };
    }
  }
  if (!closest) throw new Error('A torpedo path must contain at least one segment.');
  return closest;
}

function expectAnalyticalNearMiss(
  attackerCoordinates: Coordinates,
  defenderCoordinates: Coordinates,
  geometry: BoardGeometry,
  missPathChoice = 0,
): void {
  const attacker = position(attackerCoordinates);
  const defender = position(defenderCoordinates);
  const path = new TorpedoPath(attacker, defender, 'miss', geometry, missPathChoice);
  const start = geometry.cellCenter(attacker);
  const defenderCenter = geometry.cellCenter(defender);
  const endpoint: BoardPoint = path.end;
  const closest = closestApproachOnPath(path, defenderCenter);
  const cellSize = geometry.logicalSize / 10;
  const scale = cellSize / 60;
  const projectileRadius = projectileRadiusAtSixtyPixelCells * scale;
  const shipEnvelopeRadius = geometry.visualEnvelopeRadius();
  const clearance = clearanceAtSixtyPixelCells * scale;
  const minimumClearanceRadius = shipEnvelopeRadius + projectileRadius + clearance;
  const directAngle = Math.atan2(defenderCenter.y - start.y, defenderCenter.x - start.x);
  const firstWaypoint = path.waypoints[1];
  if (!firstWaypoint) throw new Error('A miss path must include an outgoing segment.');
  const pathAngle = Math.atan2(firstWaypoint.y - start.y, firstWaypoint.x - start.x);
  const angleDifference = Math.atan2(
    Math.sin(pathAngle - directAngle),
    Math.cos(pathAngle - directAngle),
  );
  const requestedAngle = 10 + ((missPathChoice % 52) % 26);
  const exitMargin = projectileRadius;

  expect(path.start).toEqual(start);
  expect(path.pointAt(0)).toEqual(start);
  expect(closest.point.x).toBeGreaterThanOrEqual(projectileRadius - 1e-7);
  expect(closest.point.x).toBeLessThanOrEqual(geometry.logicalSize - projectileRadius + 1e-7);
  expect(closest.point.y).toBeGreaterThanOrEqual(projectileRadius - 1e-7);
  expect(closest.point.y).toBeLessThanOrEqual(geometry.logicalSize - projectileRadius + 1e-7);

  // Check every linear segment analytically, including curved close-shot paths.
  for (let index = 0; index < path.waypoints.length - 1; index += 1) {
    const segmentStart = path.waypoints[index];
    const segmentEnd = path.waypoints[index + 1];
    if (!segmentStart || !segmentEnd) continue;
    const segmentClosest = closestApproach(segmentStart, segmentEnd, defenderCenter);
    expect(segmentClosest.distance).toBeGreaterThanOrEqual(minimumClearanceRadius - 1e-7);
  }
  expect(closest.distance).toBeGreaterThan(shipEnvelopeRadius + projectileRadius);
  expect(closest.distance).toBeGreaterThanOrEqual(minimumClearanceRadius - 1e-7);
  expect(Math.abs(angleDifference) * (180 / Math.PI)).toBeGreaterThanOrEqual(requestedAngle - 1e-7);
  expect(Math.abs(angleDifference) * (180 / Math.PI)).toBeLessThanOrEqual(35 + 1e-7);

  for (const point of path.waypoints.slice(0, closest.segmentIndex + 1)) {
    expect(point.x).toBeGreaterThanOrEqual(projectileRadius - 1e-7);
    expect(point.x).toBeLessThanOrEqual(geometry.logicalSize - projectileRadius + 1e-7);
    expect(point.y).toBeGreaterThanOrEqual(projectileRadius - 1e-7);
    expect(point.y).toBeLessThanOrEqual(geometry.logicalSize - projectileRadius + 1e-7);
  }

  // The projectile's center must pass far enough beyond a board edge for its whole radius to exit.
  expect(
    endpoint.x < -exitMargin ||
      endpoint.x > geometry.logicalSize + exitMargin ||
      endpoint.y < -exitMargin ||
      endpoint.y > geometry.logicalSize + exitMargin,
  ).toBe(true);
  expect(path.pointAt(1)).toEqual(endpoint);
  expect(endpoint).not.toBeInstanceOf(BoardPosition);
}

describe('TorpedoPath', () => {
  it.each([
    { attacker: [5, 5], defender: [5, 6] },
    { attacker: [1, 10], defender: [10, 1] },
    { attacker: [3, 8], defender: [7, 2] },
  ] as const)(
    'uses exact cell-center endpoints for a hit from $attacker to $defender',
    ({ attacker: attackerCoordinates, defender: defenderCoordinates }) => {
      const geometry = new BoardGeometry(600);
      const attacker = position(attackerCoordinates);
      const defender = position(defenderCoordinates);
      const path = new TorpedoPath(attacker, defender, 'hit', geometry);
      const start = geometry.cellCenter(attacker);
      const end = geometry.cellCenter(defender);

      expect(path.start).toEqual(start);
      expect(path.end).toEqual(end);
      expect(path.pointAt(0)).toEqual(start);
      expect(path.pointAt(1)).toEqual(end);
      expect(path.pointAt(0.5)).toEqual({
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      });
    },
  );

  const nearMissCases: readonly NearMissCase[] = [
    { name: 'adjacent horizontal cells', attacker: [5, 5], defender: [5, 6] },
    { name: 'adjacent vertical cells', attacker: [5, 5], defender: [6, 5] },
    { name: 'same row', attacker: [5, 1], defender: [5, 10] },
    { name: 'same column', attacker: [1, 5], defender: [10, 5] },
    { name: 'diagonal positions', attacker: [2, 3], defender: [8, 9] },
    { name: 'top edge defender', attacker: [3, 5], defender: [1, 5] },
    { name: 'left edge defender', attacker: [5, 3], defender: [5, 1] },
    { name: 'upper-left corner defender', attacker: [4, 4], defender: [1, 1] },
    { name: 'lower-right corner defender', attacker: [7, 7], defender: [10, 10] },
    { name: 'maximum board separation', attacker: [1, 1], defender: [10, 10] },
  ];

  for (const { name, attacker, defender } of nearMissCases) {
    it(`clears the defender and fully exits for ${name}`, () => {
      for (let missPathChoice = 0; missPathChoice < 52; missPathChoice += 1) {
        expectAnalyticalNearMiss(attacker, defender, new BoardGeometry(600), missPathChoice);
      }
    });
  }

  it('scales safe miss clearance and the fully off-board endpoint with cell size', () => {
    const smallGeometry = new BoardGeometry(600);
    const largeGeometry = new BoardGeometry(900);
    const attacker = position([5, 5]);
    const defender = position([5, 6]);
    const smallPath = new TorpedoPath(attacker, defender, 'miss', smallGeometry);
    const largePath = new TorpedoPath(attacker, defender, 'miss', largeGeometry);
    const smallClosest = closestApproachOnPath(smallPath, smallGeometry.cellCenter(defender));
    const largeClosest = closestApproachOnPath(largePath, largeGeometry.cellCenter(defender));

    expect(smallClosest.distance).toBeCloseTo(39, 8);
    expect(largeClosest.distance).toBeCloseTo(58.5, 8);
    expect(largePath.start.x).toBeCloseTo(smallPath.start.x * 1.5, 8);
    expect(largePath.start.y).toBeCloseTo(smallPath.start.y * 1.5, 8);
    expect(largePath.end.x).toBeCloseTo(smallPath.end.x * 1.5, 8);
    expect(largePath.end.y).toBeCloseTo(smallPath.end.y * 1.5, 8);
    expectAnalyticalNearMiss([5, 5], [5, 6], largeGeometry);
  });

  it('curves adjacent misses within the launch-angle cap on both sides', () => {
    const geometry = new BoardGeometry(600);
    const attacker = position([5, 5]);
    const defender = position([5, 6]);
    const firstPath = new TorpedoPath(attacker, defender, 'miss', geometry, 19);
    const repeatedPath = new TorpedoPath(attacker, defender, 'miss', geometry, 19);
    const endpoints = new Set<string>();
    const sides = new Set<number>();
    const directions: number[] = [];

    expect(repeatedPath.end).toEqual(firstPath.end);
    for (let missPathChoice = 0; missPathChoice < 52; missPathChoice += 1) {
      const path = new TorpedoPath(attacker, defender, 'miss', geometry, missPathChoice);
      expect(path.waypoints).toHaveLength(4);
      endpoints.add(`${path.end.x},${path.end.y}`);
      const firstWaypoint = path.waypoints[1];
      if (!firstWaypoint) throw new Error('The miss path must have an outgoing segment.');
      directions.push(Math.atan2(firstWaypoint.y - path.start.y, firstWaypoint.x - path.start.x));
      expectAnalyticalNearMiss([5, 5], [5, 6], geometry, missPathChoice);
      sides.add(Math.sign(directions.at(-1) ?? 0));
    }
    expect(endpoints.size).toBeGreaterThan(30);
    expect(Math.max(...directions) - Math.min(...directions)).toBeGreaterThan(Math.PI / 3);
    expect(sides.size).toBe(2);
  });

  it('selects miss angles from 10 to 35 degrees in both directions for a long shot', () => {
    const geometry = new BoardGeometry(600);
    const attacker = position([5, 2]);
    const defender = position([5, 9]);
    const angles = new Set<number>();
    const sides = new Set<number>();

    for (let missPathChoice = 0; missPathChoice < 52; missPathChoice += 1) {
      const path = new TorpedoPath(attacker, defender, 'miss', geometry, missPathChoice);
      expectAnalyticalNearMiss([5, 2], [5, 9], geometry, missPathChoice);
      const firstWaypoint = path.waypoints[1];
      if (!firstWaypoint) throw new Error('The miss path must have an outgoing segment.');
      const angle = Math.atan2(firstWaypoint.y - path.start.y, firstWaypoint.x - path.start.x);
      const degrees = Math.round(Math.abs(angle) * (180 / Math.PI));
      angles.add(degrees);
      sides.add(Math.sign(angle));
    }
    expect(Math.min(...angles)).toBe(10);
    expect(Math.max(...angles)).toBe(35);
    expect(angles.size).toBe(26);
    expect(sides.size).toBe(2);
  });
});
