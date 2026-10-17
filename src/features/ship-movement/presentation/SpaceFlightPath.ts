import type { BoardGeometry, BoardPoint } from '../../board/presentation/BoardGeometry.js';
import { BoardPosition } from '../../board/domain/BoardPosition.js';

export interface SpaceLineSegment {
  readonly kind: 'line';
  readonly start: BoardPoint;
  readonly end: BoardPoint;
}

export interface SpaceArcSegment {
  readonly kind: 'arc';
  readonly start: BoardPoint;
  readonly center: BoardPoint;
  readonly end: BoardPoint;
  readonly radius: number;
  readonly startAngleRadians: number;
  readonly sweepRadians: number;
}

export type SpaceFlightSegment = SpaceLineSegment | SpaceArcSegment;

export class SpaceFlightPath {
  private static readonly fullCircle = Math.PI * 2;
  readonly segments: readonly SpaceFlightSegment[];
  readonly pathLength: number;

  constructor(
    origin: BoardPosition,
    destination: BoardPosition,
    obstacle: BoardPosition,
    geometry: BoardGeometry,
  ) {
    const start = geometry.cellCenter(origin);
    const end = geometry.cellCenter(destination);
    const obstacleCenter = geometry.cellCenter(obstacle);
    const shipRadius = geometry.visualEnvelopeRadius();
    const obstacleRadius = shipRadius * 2;
    const boardMinimum = shipRadius;
    const boardMaximum = geometry.logicalSize - shipRadius;

    if (
      origin.equals(destination) ||
      Math.hypot(start.x - obstacleCenter.x, start.y - obstacleCenter.y) < obstacleRadius ||
      Math.hypot(end.x - obstacleCenter.x, end.y - obstacleCenter.y) < obstacleRadius
    ) {
      throw new RangeError('Flight endpoints must be distinct from, and clear of, the other ship.');
    }

    if (SpaceFlightPath.distanceToSegment(obstacleCenter, start, end) >= obstacleRadius - 1e-8) {
      this.segments = Object.freeze([SpaceFlightPath.line(start, end)]);
      this.pathLength = SpaceFlightPath.distance(start, end);
      Object.freeze(this);
      return;
    }

    const candidates: Array<{
      readonly segments: readonly SpaceFlightSegment[];
      readonly length: number;
    }> = [];
    const startTangents = SpaceFlightPath.tangentAngles(start, obstacleCenter, obstacleRadius);
    const endTangents = SpaceFlightPath.tangentAngles(end, obstacleCenter, obstacleRadius);

    for (const startAngle of startTangents) {
      const tangentStart = SpaceFlightPath.pointOnCircle(
        obstacleCenter,
        obstacleRadius,
        startAngle,
      );
      const incoming = SpaceFlightPath.subtract(tangentStart, start);

      for (const endAngle of endTangents) {
        const tangentEnd = SpaceFlightPath.pointOnCircle(obstacleCenter, obstacleRadius, endAngle);
        const outgoing = SpaceFlightPath.subtract(end, tangentEnd);

        for (const direction of [1, -1] as const) {
          const sweep = SpaceFlightPath.sweep(startAngle, endAngle, direction);
          if (Math.abs(sweep) < 1e-10) {
            continue;
          }

          const startTangent = SpaceFlightPath.arcTangent(startAngle, direction);
          const endTangent = SpaceFlightPath.arcTangent(endAngle, direction);
          if (
            SpaceFlightPath.dot(incoming, startTangent) <= 0 ||
            SpaceFlightPath.dot(endTangent, outgoing) <= 0
          ) {
            continue;
          }

          const arc: SpaceArcSegment = Object.freeze({
            kind: 'arc',
            start: tangentStart,
            center: obstacleCenter,
            end: tangentEnd,
            radius: obstacleRadius,
            startAngleRadians: startAngle,
            sweepRadians: sweep,
          });
          if (
            !SpaceFlightPath.withinBoard(tangentStart, boardMinimum, boardMaximum) ||
            !SpaceFlightPath.withinBoard(tangentEnd, boardMinimum, boardMaximum) ||
            !SpaceFlightPath.arcWithinBoard(arc, boardMinimum, boardMaximum)
          ) {
            continue;
          }

          const segments: SpaceFlightSegment[] = [];
          SpaceFlightPath.appendLine(segments, start, tangentStart);
          segments.push(arc);
          SpaceFlightPath.appendLine(segments, tangentEnd, end);
          const length =
            SpaceFlightPath.distance(start, tangentStart) +
            obstacleRadius * Math.abs(sweep) +
            SpaceFlightPath.distance(tangentEnd, end);
          candidates.push({ segments: Object.freeze(segments), length });
        }
      }
    }

    const shortest = candidates.reduce<(typeof candidates)[number] | null>(
      (current, candidate) =>
        current === null || candidate.length < current.length - 1e-8 ? candidate : current,
      null,
    );
    if (!shortest) {
      throw new RangeError('No collision-free shortest flight path fits within the board.');
    }

    this.segments = shortest.segments;
    this.pathLength = shortest.length;
    Object.freeze(this);
  }

  private static line(start: BoardPoint, end: BoardPoint): SpaceLineSegment {
    return Object.freeze({
      kind: 'line',
      start: SpaceFlightPath.freezePoint(start),
      end: SpaceFlightPath.freezePoint(end),
    });
  }

  private static appendLine(
    segments: SpaceFlightSegment[],
    start: BoardPoint,
    end: BoardPoint,
  ): void {
    if (SpaceFlightPath.distance(start, end) > 1e-8) {
      segments.push(SpaceFlightPath.line(start, end));
    }
  }

  private static tangentAngles(
    point: BoardPoint,
    center: BoardPoint,
    radius: number,
  ): readonly number[] {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.hypot(dx, dy);
    const offset = Math.acos(Math.max(-1, Math.min(1, radius / distance)));
    const angle = Math.atan2(dy, dx);
    return Object.freeze([
      SpaceFlightPath.normalizeAngle(angle + offset),
      SpaceFlightPath.normalizeAngle(angle - offset),
    ]);
  }

  private static pointOnCircle(center: BoardPoint, radius: number, angle: number): BoardPoint {
    return SpaceFlightPath.freezePoint({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }

  private static arcTangent(angle: number, direction: 1 | -1): BoardPoint {
    return {
      x: -Math.sin(angle) * direction,
      y: Math.cos(angle) * direction,
    };
  }

  private static sweep(start: number, end: number, direction: 1 | -1): number {
    const delta = direction > 0 ? end - start : start - end;
    const positive =
      ((delta % SpaceFlightPath.fullCircle) + SpaceFlightPath.fullCircle) %
      SpaceFlightPath.fullCircle;
    return direction * positive;
  }

  private static normalizeAngle(angle: number): number {
    return (
      ((angle % SpaceFlightPath.fullCircle) + SpaceFlightPath.fullCircle) %
      SpaceFlightPath.fullCircle
    );
  }

  private static arcWithinBoard(arc: SpaceArcSegment, minimum: number, maximum: number): boolean {
    const cardinalAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    for (const angle of cardinalAngles) {
      if (!SpaceFlightPath.arcContainsAngle(arc, angle)) {
        continue;
      }

      const point = {
        x: arc.center.x + arc.radius * Math.cos(angle),
        y: arc.center.y + arc.radius * Math.sin(angle),
      };
      if (!SpaceFlightPath.withinBoard(point, minimum, maximum)) {
        return false;
      }
    }
    return true;
  }

  private static arcContainsAngle(arc: SpaceArcSegment, angle: number): boolean {
    const delta =
      arc.sweepRadians >= 0
        ? SpaceFlightPath.normalizeAngle(angle - arc.startAngleRadians)
        : SpaceFlightPath.normalizeAngle(arc.startAngleRadians - angle);
    return delta <= Math.abs(arc.sweepRadians) + 1e-10;
  }

  private static withinBoard(point: BoardPoint, minimum: number, maximum: number): boolean {
    return (
      point.x >= minimum - 1e-8 &&
      point.x <= maximum + 1e-8 &&
      point.y >= minimum - 1e-8 &&
      point.y <= maximum + 1e-8
    );
  }

  private static distanceToSegment(point: BoardPoint, start: BoardPoint, end: BoardPoint): number {
    const delta = SpaceFlightPath.subtract(end, start);
    const denominator = SpaceFlightPath.dot(delta, delta);
    const factor =
      denominator === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              SpaceFlightPath.dot(SpaceFlightPath.subtract(point, start), delta) / denominator,
            ),
          );
    return SpaceFlightPath.distance(point, {
      x: start.x + delta.x * factor,
      y: start.y + delta.y * factor,
    });
  }

  private static distance(first: BoardPoint, second: BoardPoint): number {
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  private static subtract(first: BoardPoint, second: BoardPoint): BoardPoint {
    return { x: first.x - second.x, y: first.y - second.y };
  }

  private static dot(first: BoardPoint, second: BoardPoint): number {
    return first.x * second.x + first.y * second.y;
  }

  private static freezePoint(point: BoardPoint): BoardPoint {
    return Object.freeze({ x: point.x, y: point.y });
  }
}
