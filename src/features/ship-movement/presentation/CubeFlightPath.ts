import { CUBE_SIZE, CubePosition } from '../../board/domain/CubePosition.js';
import type { LegalRoute } from '../domain/Reachability.js';

export interface CubeWorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Describes a direct or collision-safe route through the cube for presentation. */
export class CubeFlightPath {
  private static readonly shipClearanceRadius = 0.55;
  readonly points: readonly CubeWorldPoint[];
  readonly isDetour: boolean;
  readonly pathLength: number;

  constructor(route: LegalRoute, obstacle: CubePosition) {
    if (!(obstacle instanceof CubePosition)) {
      throw new RangeError('A cube flight path requires a valid opposing ship position.');
    }
    if (
      !route ||
      !Array.isArray(route.positions) ||
      route.positions.length < 2 ||
      route.stepCount !== route.positions.length - 1
    ) {
      throw new RangeError('A cube flight path requires a complete typed route.');
    }
    for (let index = 0; index < route.positions.length; index += 1) {
      const position = route.positions[index];
      if (!(position instanceof CubePosition) || position.equals(obstacle)) {
        throw new RangeError('A flight route must contain valid, unoccupied cube positions.');
      }
      if (index === 0) continue;
      const previous = route.positions[index - 1];
      if (
        !previous ||
        Math.abs(previous.x - position.x) +
          Math.abs(previous.y - position.y) +
          Math.abs(previous.z - position.z) !==
          1
      ) {
        throw new RangeError('A flight route must contain only face-adjacent cube steps.');
      }
    }

    const cellPoints = route.positions.map(CubeFlightPath.worldPosition);
    const start = cellPoints[0];
    const end = cellPoints.at(-1);
    if (!start || !end) throw new RangeError('A flight route requires distinct endpoints.');
    const obstaclePoint = CubeFlightPath.worldPosition(obstacle);
    this.isDetour =
      CubeFlightPath.distanceToSegment(obstaclePoint, start, end) <
      CubeFlightPath.shipClearanceRadius;
    this.points = Object.freeze(this.isDetour ? cellPoints : [start, end]);
    this.pathLength = CubeFlightPath.measure(this.points);
    Object.freeze(this);
  }

  pointAt(progress: number): CubeWorldPoint {
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
      throw new RangeError('Flight progress must be in the inclusive range [0, 1].');
    }
    if (progress === 0) return this.points[0] as CubeWorldPoint;
    if (progress === 1) return this.points.at(-1) as CubeWorldPoint;

    let remaining = this.pathLength * progress;
    for (let index = 1; index < this.points.length; index += 1) {
      const start = this.points[index - 1];
      const end = this.points[index];
      if (!start || !end) continue;
      const segmentLength = CubeFlightPath.distance(start, end);
      if (remaining <= segmentLength) {
        const ratio = remaining / segmentLength;
        return Object.freeze({
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + (end.y - start.y) * ratio,
          z: start.z + (end.z - start.z) * ratio,
        });
      }
      remaining -= segmentLength;
    }
    return this.points.at(-1) as CubeWorldPoint;
  }

  private static worldPosition(position: CubePosition): CubeWorldPoint {
    const center = (CUBE_SIZE + 1) / 2;
    return Object.freeze({
      x: position.x - center,
      y: position.y - center,
      z: position.z - center,
    });
  }

  private static measure(points: readonly CubeWorldPoint[]): number {
    let length = 0;
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      if (start && end) length += CubeFlightPath.distance(start, end);
    }
    return length;
  }

  private static distance(first: CubeWorldPoint, second: CubeWorldPoint): number {
    return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
  }

  private static distanceToSegment(
    point: CubeWorldPoint,
    start: CubeWorldPoint,
    end: CubeWorldPoint,
  ): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const denominator = dx * dx + dy * dy + dz * dz;
    const factor = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz) /
          denominator,
      ),
    );
    return Math.hypot(
      point.x - (start.x + dx * factor),
      point.y - (start.y + dy * factor),
      point.z - (start.z + dz * factor),
    );
  }
}
