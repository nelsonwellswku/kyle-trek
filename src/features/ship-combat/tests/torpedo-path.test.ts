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

const projectileRadiusAtSixtyPixelCells = 3;
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

function expectAnalyticalNearMiss(
  attackerCoordinates: Coordinates,
  defenderCoordinates: Coordinates,
  geometry: BoardGeometry,
): void {
  const attacker = position(attackerCoordinates);
  const defender = position(defenderCoordinates);
  const path = new TorpedoPath(attacker, defender, 'miss', geometry);
  const start = geometry.cellCenter(attacker);
  const defenderCenter = geometry.cellCenter(defender);
  const endpoint: BoardPoint = path.end;
  const closest = closestApproach(path.start, endpoint, defenderCenter);
  const cellSize = geometry.logicalSize / 10;
  const scale = cellSize / 60;
  const projectileRadius = projectileRadiusAtSixtyPixelCells * scale;
  const shipEnvelopeRadius = geometry.visualEnvelopeRadius();
  const clearance = clearanceAtSixtyPixelCells * scale;
  const exitMargin = projectileRadius;

  expect(path.start).toEqual(start);
  expect(path.pointAt(0)).toEqual(start);
  expect(closest.parameter).toBeGreaterThan(0);
  expect(closest.parameter).toBeLessThan(1);
  expect(closest.point.x).toBeGreaterThanOrEqual(0);
  expect(closest.point.x).toBeLessThanOrEqual(geometry.logicalSize);
  expect(closest.point.y).toBeGreaterThanOrEqual(0);
  expect(closest.point.y).toBeLessThanOrEqual(geometry.logicalSize);

  // This is the continuous point-to-segment distance, not a sampled-frame approximation.
  expect(closest.distance).toBeCloseTo(shipEnvelopeRadius + projectileRadius + clearance, 8);
  expect(closest.distance).toBeGreaterThan(shipEnvelopeRadius + projectileRadius);

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
      expectAnalyticalNearMiss(attacker, defender, new BoardGeometry(600));
    });
  }

  it('scales tangent clearance and the fully off-board endpoint with cell size', () => {
    const smallGeometry = new BoardGeometry(600);
    const largeGeometry = new BoardGeometry(900);
    const attacker = position([5, 5]);
    const defender = position([5, 6]);
    const smallPath = new TorpedoPath(attacker, defender, 'miss', smallGeometry);
    const largePath = new TorpedoPath(attacker, defender, 'miss', largeGeometry);
    const smallClosest = closestApproach(
      smallPath.start,
      smallPath.end,
      smallGeometry.cellCenter(defender),
    );
    const largeClosest = closestApproach(
      largePath.start,
      largePath.end,
      largeGeometry.cellCenter(defender),
    );

    expect(smallClosest.distance).toBeCloseTo(28, 8);
    expect(largeClosest.distance).toBeCloseTo(42, 8);
    expect(largePath.start.x).toBeCloseTo(smallPath.start.x * 1.5, 8);
    expect(largePath.start.y).toBeCloseTo(smallPath.start.y * 1.5, 8);
    expect(largePath.end.x).toBeCloseTo(smallPath.end.x * 1.5, 8);
    expect(largePath.end.y).toBeCloseTo(smallPath.end.y * 1.5, 8);
    expectAnalyticalNearMiss([5, 5], [5, 6], largeGeometry);
  });
});
