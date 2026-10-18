import { describe, expect, it } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardGeometry, type BoardPoint } from '../../board/presentation/BoardGeometry.js';
import { SpaceFlightPath, type SpaceArcSegment } from '../presentation/SpaceFlightPath.js';

const geometry = new BoardGeometry(600);

function createPath(
  origin: readonly [number, number],
  destination: readonly [number, number],
  obstacle: readonly [number, number],
): SpaceFlightPath {
  return new SpaceFlightPath(
    new BoardPosition(...origin),
    new BoardPosition(...destination),
    new BoardPosition(...obstacle),
    geometry,
  );
}

function containsAngle(arc: SpaceArcSegment, angle: number): boolean {
  const fullCircle = Math.PI * 2;
  const normalize = (value: number): number => ((value % fullCircle) + fullCircle) % fullCircle;
  const start = normalize(arc.startAngleRadians);
  const target = normalize(angle);
  const sweep = arc.sweepRadians;
  if (sweep >= 0) {
    return normalize(target - start) <= sweep + 1e-9;
  }
  return normalize(start - target) <= Math.abs(sweep) + 1e-9;
}

function expectPathWithinBoard(path: SpaceFlightPath, radius: number): void {
  const minimum = radius;
  const maximum = geometry.logicalSize - radius;
  const check = (point: BoardPoint): void => {
    expect(point.x).toBeGreaterThanOrEqual(minimum - 1e-8);
    expect(point.x).toBeLessThanOrEqual(maximum + 1e-8);
    expect(point.y).toBeGreaterThanOrEqual(minimum - 1e-8);
    expect(point.y).toBeLessThanOrEqual(maximum + 1e-8);
  };

  for (const segment of path.segments) {
    check(segment.start);
    check(segment.end);
    if (segment.kind === 'arc') {
      for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        if (containsAngle(segment, angle)) {
          check({
            x: segment.center.x + segment.radius * Math.cos(angle),
            y: segment.center.y + segment.radius * Math.sin(angle),
          });
        }
      }
    }
  }
}

describe('SpaceFlightPath', () => {
  it('flies diagonally in a single straight segment when the obstacle does not block it', () => {
    const path = createPath([5, 5], [7, 7], [10, 10]);

    expect(path.segments).toEqual([
      { kind: 'line', start: { x: 270, y: 270 }, end: { x: 390, y: 390 } },
    ]);
    expect(path.pathLength).toBeCloseTo(Math.hypot(120, 120), 10);
  });

  it('takes the shortest tangent-arc-tangent path around a blocking ship', () => {
    const path = createPath([5, 4], [5, 6], [5, 5]);
    const [entry, arc, exit] = path.segments;
    const cellSize = geometry.logicalSize / 10;
    const radius = geometry.visualEnvelopeRadius() * 2;
    const endpointDistance = cellSize;
    const tangentLength = Math.sqrt(endpointDistance ** 2 - radius ** 2);
    const shortestArc = Math.PI - 2 * Math.acos(radius / endpointDistance);
    const expectedLength = tangentLength * 2 + radius * shortestArc;

    expect(path.segments.map(({ kind }) => kind)).toEqual(['line', 'arc', 'line']);
    expect(entry?.kind).toBe('line');
    expect(arc?.kind).toBe('arc');
    expect(exit?.kind).toBe('line');
    if (entry?.kind !== 'line' || arc?.kind !== 'arc' || exit?.kind !== 'line') {
      throw new Error('Expected tangent segments joined by a circular arc.');
    }

    expect(arc.center).toEqual({ x: 270, y: 270 });
    expect(arc.radius).toBe(48);
    expect(Math.abs(arc.sweepRadians)).toBeCloseTo(shortestArc, 10);
    expect(arc.start).toEqual(entry.end);
    expect(arc.end).toEqual(exit.start);
    expect(path.pathLength).toBeCloseTo(expectedLength, 8);
    expect(path.pathLength).toBeLessThan(180);
    expect(Math.hypot(arc.start.x - arc.center.x, arc.start.y - arc.center.y)).toBeCloseTo(
      radius,
      10,
    );
    expect(Math.hypot(arc.end.x - arc.center.x, arc.end.y - arc.center.y)).toBeCloseTo(radius, 10);

    const sweepDirection = Math.sign(arc.sweepRadians);
    const tangentAtStart = {
      x: -Math.sin(arc.startAngleRadians) * sweepDirection,
      y: Math.cos(arc.startAngleRadians) * sweepDirection,
    };
    const endAngle = arc.startAngleRadians + arc.sweepRadians;
    const tangentAtEnd = {
      x: -Math.sin(endAngle) * sweepDirection,
      y: Math.cos(endAngle) * sweepDirection,
    };
    const incoming = { x: entry.end.x - entry.start.x, y: entry.end.y - entry.start.y };
    const outgoing = { x: exit.end.x - exit.start.x, y: exit.end.y - exit.start.y };
    expect(incoming.x * tangentAtStart.y - incoming.y * tangentAtStart.x).toBeCloseTo(0, 8);
    expect(incoming.x * tangentAtStart.x + incoming.y * tangentAtStart.y).toBeGreaterThan(0);
    expect(tangentAtEnd.x * outgoing.y - tangentAtEnd.y * outgoing.x).toBeCloseTo(0, 8);
    expect(tangentAtEnd.x * outgoing.x + tangentAtEnd.y * outgoing.y).toBeGreaterThan(0);
  });

  it('keeps the entire curved ship envelope inside the board near an edge obstacle', () => {
    const path = createPath([1, 2], [2, 1], [1, 1]);

    expect(path.segments.some((segment) => segment.kind === 'arc')).toBe(true);
    expectPathWithinBoard(path, geometry.visualEnvelopeRadius());
  });

  it('uses no arc when the direct diagonal clears the other ship envelope', () => {
    const path = createPath([2, 2], [4, 4], [8, 8]);

    expect(path.segments).toHaveLength(1);
    expect(path.segments[0]?.kind).toBe('line');
    expect(path.segments[0]?.start).toEqual({ x: 90, y: 90 });
    expect(path.segments[0]?.end).toEqual({ x: 210, y: 210 });
  });
});
