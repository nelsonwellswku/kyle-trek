import type {
  CubeScreenGeometry,
  ScreenPoint,
} from '../../board/presentation/CubeScreenGeometry.js';
import { CubePosition } from '../../board/domain/CubePosition.js';
import type { CubeWorldPoint } from '../../ship-movement/presentation/CubeFlightPath.js';

type BoardPoint = ScreenPoint;

interface NearMissPath {
  readonly waypoints: readonly BoardPoint[];
  readonly end: BoardPoint;
}

interface SegmentClosestApproach {
  readonly point: BoardPoint;
  readonly distance: number;
}

export class TorpedoPath {
  readonly start: BoardPoint;
  readonly end: BoardPoint;
  readonly waypoints: readonly BoardPoint[];

  constructor(
    attacker: CubePosition,
    defender: CubePosition,
    kind: 'hit' | 'miss',
    geometry: CubeScreenGeometry,
    missPathChoice = 0,
  ) {
    if (
      !(attacker instanceof CubePosition) ||
      !(defender instanceof CubePosition) ||
      attacker.equals(defender)
    ) {
      throw new RangeError('A torpedo path requires two distinct valid ship positions.');
    }

    this.start = geometry.cellCenter(attacker);
    if (kind === 'hit') {
      this.end = geometry.cellCenter(defender);
      this.waypoints = Object.freeze([this.start, this.end]);
    } else {
      const path = TorpedoPath.nearMissPath(
        this.start,
        geometry.cellCenter(defender),
        geometry,
        missPathChoice,
      );
      this.end = path.end;
      this.waypoints = Object.freeze(path.waypoints);
    }
    Object.freeze(this);
  }

  pointAt(progress: number): BoardPoint {
    if (!Number.isFinite(progress)) {
      throw new RangeError('Torpedo progress must be finite.');
    }
    const amount = Math.max(0, Math.min(1, progress));
    if (amount === 0) return this.start;
    if (amount === 1) return this.end;

    const segmentLengths: number[] = [];
    let totalLength = 0;
    for (let index = 1; index < this.waypoints.length; index += 1) {
      const previous = this.waypoints[index - 1];
      const current = this.waypoints[index];
      if (!previous || !current) continue;
      const length = Math.hypot(current.x - previous.x, current.y - previous.y);
      segmentLengths.push(length);
      totalLength += length;
    }

    let remaining = amount * totalLength;
    for (let index = 0; index < segmentLengths.length; index += 1) {
      const previous = this.waypoints[index];
      const current = this.waypoints[index + 1];
      const length = segmentLengths[index];
      if (!previous || !current || length === undefined || length === 0) continue;
      if (remaining <= length || index === segmentLengths.length - 1) {
        const segmentProgress = Math.min(1, remaining / length);
        return Object.freeze({
          x: previous.x + (current.x - previous.x) * segmentProgress,
          y: previous.y + (current.y - previous.y) * segmentProgress,
        });
      }
      remaining -= length;
    }
    return this.end;
  }

  private static nearMissPath(
    origin: BoardPoint,
    target: BoardPoint,
    geometry: CubeScreenGeometry,
    missPathChoice: number,
  ): NearMissPath {
    if (!Number.isSafeInteger(missPathChoice) || missPathChoice < 0) {
      throw new RangeError('A miss-path choice must be a nonnegative safe integer.');
    }

    const variation = missPathChoice % 52;
    const requestedDegrees = 10 + (variation % 26);
    const requestedSide = variation < 26 ? 1 : -1;
    const directAngle = Math.atan2(target.y - origin.y, target.x - origin.x);
    const cellSize = geometry.logicalSize / 10;
    const scale = cellSize / 60;
    const projectileRadius = 13 * scale;
    const clearance = scale;
    const clearanceRadius = geometry.visualEnvelopeRadius() + projectileRadius + clearance;
    const screenInset = projectileRadius;
    const originToTarget = Math.hypot(target.x - origin.x, target.y - origin.y);
    if (originToTarget <= clearanceRadius) {
      throw new RangeError('The attacker must be outside the defender clearance circle.');
    }

    // Keep the random choice within 10°–35°. Close/edge shots bend into a safe tangent instead.
    for (let degrees = requestedDegrees; degrees <= 35; degrees += 1) {
      for (const side of [requestedSide, -requestedSide]) {
        const straight = TorpedoPath.straightMissPath(
          origin,
          target,
          geometry,
          directAngle,
          originToTarget,
          degrees,
          side,
          clearanceRadius,
          screenInset,
        );
        if (straight) return straight;

        const curved = TorpedoPath.curvedMissPath(
          origin,
          target,
          geometry,
          directAngle,
          originToTarget,
          cellSize,
          degrees,
          side,
          clearanceRadius,
          screenInset,
        );
        if (curved) return curved;
      }
    }

    throw new RangeError('No valid near-miss path clears the defender and remains on-screen.');
  }

  private static straightMissPath(
    origin: BoardPoint,
    target: BoardPoint,
    geometry: CubeScreenGeometry,
    directAngle: number,
    originToTarget: number,
    degrees: number,
    side: number,
    clearanceRadius: number,
    screenInset: number,
  ): NearMissPath | null {
    const angle = directAngle + side * (degrees * (Math.PI / 180));
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const closestDistanceAlongRay = Math.max(
      0,
      originToTarget * Math.cos(degrees * (Math.PI / 180)),
    );
    const closestPoint = Object.freeze({
      x: origin.x + directionX * closestDistanceAlongRay,
      y: origin.y + directionY * closestDistanceAlongRay,
    });
    const closestDistance = Math.hypot(closestPoint.x - target.x, closestPoint.y - target.y);
    if (
      !TorpedoPath.isWithinInset(closestPoint, geometry.logicalSize, screenInset) ||
      closestDistance < clearanceRadius - 1e-7
    ) {
      return null;
    }

    const distanceToExit = TorpedoPath.distanceToExpandedExit(
      origin,
      directionX,
      directionY,
      geometry.logicalSize,
      screenInset,
    );
    if (closestDistanceAlongRay >= distanceToExit) return null;
    const exitMargin = geometry.logicalSize / 600;
    const end = Object.freeze({
      x: origin.x + directionX * (distanceToExit + screenInset + exitMargin),
      y: origin.y + directionY * (distanceToExit + screenInset + exitMargin),
    });
    return Object.freeze({ waypoints: Object.freeze([origin, end]), end });
  }

  private static curvedMissPath(
    origin: BoardPoint,
    target: BoardPoint,
    geometry: CubeScreenGeometry,
    directAngle: number,
    originToTarget: number,
    cellSize: number,
    degrees: number,
    side: number,
    clearanceRadius: number,
    screenInset: number,
  ): NearMissPath | null {
    const deviation = degrees * (Math.PI / 180);
    const launchAngle = directAngle + side * deviation;
    const launchDirectionX = Math.cos(launchAngle);
    const launchDirectionY = Math.sin(launchAngle);
    const closestDistanceFromTarget = clearanceRadius + geometry.logicalSize / 600;
    if (closestDistanceFromTarget >= originToTarget) return null;
    const closestDirectionAngle = directAngle + Math.PI - side * deviation;
    const closestPoint = Object.freeze({
      x: target.x + Math.cos(closestDirectionAngle) * closestDistanceFromTarget,
      y: target.y + Math.sin(closestDirectionAngle) * closestDistanceFromTarget,
    });
    if (!TorpedoPath.isWithinInset(closestPoint, geometry.logicalSize, screenInset)) return null;

    const maxLeadDistance = Math.min(
      cellSize * 0.25,
      (originToTarget - closestDistanceFromTarget) / 2,
    );
    const leadDistances = [
      maxLeadDistance,
      maxLeadDistance / 2,
      maxLeadDistance / 4,
      maxLeadDistance / 8,
    ];
    const exitMargin = geometry.logicalSize / 600;

    for (const leadDistance of leadDistances) {
      if (leadDistance <= 1e-7) continue;
      const bend = Object.freeze({
        x: origin.x + launchDirectionX * leadDistance,
        y: origin.y + launchDirectionY * leadDistance,
      });
      if (!TorpedoPath.isWithinInset(bend, geometry.logicalSize, screenInset)) continue;
      const initialSegmentClosest = TorpedoPath.closestPointOnSegment(origin, bend, target);
      const approachSegmentClosest = TorpedoPath.closestPointOnSegment(bend, closestPoint, target);
      if (
        initialSegmentClosest.distance < clearanceRadius - 1e-7 ||
        approachSegmentClosest.distance < clearanceRadius - 1e-7
      ) {
        continue;
      }

      for (const exitSide of [side, -side]) {
        const exitAngle = closestDirectionAngle + exitSide * (Math.PI / 2);
        const directionX = Math.cos(exitAngle);
        const directionY = Math.sin(exitAngle);
        const distanceToExit = TorpedoPath.distanceToExpandedExit(
          closestPoint,
          directionX,
          directionY,
          geometry.logicalSize,
          screenInset,
        );
        const end = Object.freeze({
          x: closestPoint.x + directionX * (distanceToExit + screenInset + exitMargin),
          y: closestPoint.y + directionY * (distanceToExit + screenInset + exitMargin),
        });
        return Object.freeze({
          waypoints: Object.freeze([origin, bend, closestPoint, end]),
          end,
        });
      }
    }
    return null;
  }

  private static closestPointOnSegment(
    start: BoardPoint,
    end: BoardPoint,
    target: BoardPoint,
  ): SegmentClosestApproach {
    const directionX = end.x - start.x;
    const directionY = end.y - start.y;
    const lengthSquared = directionX ** 2 + directionY ** 2;
    const progress = Math.max(
      0,
      Math.min(
        1,
        ((target.x - start.x) * directionX + (target.y - start.y) * directionY) / lengthSquared,
      ),
    );
    const point = Object.freeze({
      x: start.x + progress * directionX,
      y: start.y + progress * directionY,
    });
    return Object.freeze({ point, distance: Math.hypot(point.x - target.x, point.y - target.y) });
  }

  private static isWithinInset(point: BoardPoint, size: number, inset: number): boolean {
    return (
      point.x >= inset - 1e-7 &&
      point.x <= size - inset + 1e-7 &&
      point.y >= inset - 1e-7 &&
      point.y <= size - inset + 1e-7
    );
  }

  private static distanceToExpandedExit(
    origin: BoardPoint,
    directionX: number,
    directionY: number,
    size: number,
    margin: number,
  ): number {
    const distances: number[] = [];
    if (directionX > 0) distances.push((size + margin - origin.x) / directionX);
    else if (directionX < 0) distances.push((-margin - origin.x) / directionX);
    if (directionY > 0) distances.push((size + margin - origin.y) / directionY);
    else if (directionY < 0) distances.push((-margin - origin.y) / directionY);
    const exit = Math.min(...distances.filter((distance) => distance >= 0));
    if (!Number.isFinite(exit)) throw new RangeError('The torpedo ray has no board exit.');
    return exit;
  }
}

/** A camera-independent projectile path joining the combatants' current cube cells. */
export class CubeTorpedoPath {
  readonly start: CubeWorldPoint;
  readonly end: CubeWorldPoint;
  readonly targetPosition: CubePosition;
  readonly waypoints: readonly CubeWorldPoint[];

  constructor(
    attacker: CubePosition,
    defender: CubePosition,
    kind: 'hit' | 'miss',
    missPathChoice = 0,
  ) {
    if (
      !(attacker instanceof CubePosition) ||
      !(defender instanceof CubePosition) ||
      attacker.equals(defender)
    ) {
      throw new RangeError('A cube torpedo path requires two distinct ship cells.');
    }
    if (!Number.isSafeInteger(missPathChoice) || missPathChoice < 0) {
      throw new RangeError('A cube torpedo path choice must be a nonnegative safe integer.');
    }
    this.start = CubeTorpedoPath.worldPosition(attacker);
    this.end = CubeTorpedoPath.worldPosition(defender);
    this.targetPosition = defender;
    if (kind === 'hit') {
      this.waypoints = Object.freeze([this.start, this.end]);
    } else {
      const direction = CubeTorpedoPath.normalize({
        x: this.end.x - this.start.x,
        y: this.end.y - this.start.y,
        z: this.end.z - this.start.z,
      });
      const reference =
        Math.abs(direction.x) < 0.8
          ? { x: 1, y: 0, z: 0 }
          : Math.abs(direction.y) < 0.8
            ? { x: 0, y: 1, z: 0 }
            : { x: 0, y: 0, z: 1 };
      const normal = CubeTorpedoPath.normalize({
        x: direction.y * reference.z - direction.z * reference.y,
        y: direction.z * reference.x - direction.x * reference.z,
        z: direction.x * reference.y - direction.y * reference.x,
      });
      const side = missPathChoice % 2 === 0 ? 1 : -1;
      const bendAmount = 0.4 + (Math.floor(missPathChoice / 2) % 5) * 0.1;
      const midpoint = Object.freeze({
        x: (this.start.x + this.end.x) / 2 + normal.x * bendAmount * side,
        y: (this.start.y + this.end.y) / 2 + normal.y * bendAmount * side,
        z: (this.start.z + this.end.z) / 2 + normal.z * bendAmount * side,
      });
      this.waypoints = Object.freeze([this.start, midpoint, this.end]);
    }
    Object.freeze(this);
  }

  pointAt(progress: number): CubeWorldPoint {
    if (!Number.isFinite(progress)) {
      throw new RangeError('Cube torpedo progress must be finite.');
    }
    const amount = Math.max(0, Math.min(1, progress));
    if (amount === 0) return this.start;
    if (amount === 1) return this.end;
    const lengths = this.waypoints.slice(1).map((point, index) => {
      const previous = this.waypoints[index];
      return previous ? CubeTorpedoPath.distance(previous, point) : 0;
    });
    const total = lengths.reduce((sum, length) => sum + length, 0);
    let remaining = total * amount;
    for (let index = 0; index < lengths.length; index += 1) {
      const start = this.waypoints[index];
      const end = this.waypoints[index + 1];
      const length = lengths[index];
      if (!start || !end || length === undefined || length === 0) continue;
      if (remaining <= length || index === lengths.length - 1) {
        const ratio = Math.min(1, remaining / length);
        return Object.freeze({
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + (end.y - start.y) * ratio,
          z: start.z + (end.z - start.z) * ratio,
        });
      }
      remaining -= length;
    }
    return this.end;
  }

  private static worldPosition(position: CubePosition): CubeWorldPoint {
    return Object.freeze({ x: position.x - 5.5, y: position.y - 5.5, z: position.z - 5.5 });
  }

  private static normalize(point: CubeWorldPoint): CubeWorldPoint {
    const length = Math.hypot(point.x, point.y, point.z);
    if (length === 0) throw new RangeError('A cube torpedo route requires distinct endpoints.');
    return Object.freeze({ x: point.x / length, y: point.y / length, z: point.z / length });
  }

  private static distance(first: CubeWorldPoint, second: CubeWorldPoint): number {
    return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
  }
}
