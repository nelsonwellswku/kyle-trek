import { BoardPosition } from '../../board/domain/BoardPosition.js';
import type { BoardGeometry, BoardPoint } from '../../board/presentation/BoardGeometry.js';

export class TorpedoPath {
  readonly start: BoardPoint;
  readonly end: BoardPoint;

  constructor(
    attacker: BoardPosition,
    defender: BoardPosition,
    kind: 'hit' | 'miss',
    geometry: BoardGeometry,
  ) {
    if (
      !(attacker instanceof BoardPosition) ||
      !(defender instanceof BoardPosition) ||
      attacker.equals(defender)
    ) {
      throw new RangeError('A torpedo path requires two distinct valid ship positions.');
    }

    this.start = geometry.cellCenter(attacker);
    if (kind === 'hit') {
      this.end = geometry.cellCenter(defender);
    } else {
      this.end = TorpedoPath.nearMissEnd(this.start, geometry.cellCenter(defender), geometry);
    }
    Object.freeze(this);
  }

  pointAt(progress: number): BoardPoint {
    if (!Number.isFinite(progress)) {
      throw new RangeError('Torpedo progress must be finite.');
    }
    const amount = Math.max(0, Math.min(1, progress));
    return Object.freeze({
      x: this.start.x + (this.end.x - this.start.x) * amount,
      y: this.start.y + (this.end.y - this.start.y) * amount,
    });
  }

  private static nearMissEnd(
    origin: BoardPoint,
    target: BoardPoint,
    geometry: BoardGeometry,
  ): BoardPoint {
    const cellSize = geometry.logicalSize / 10;
    const scale = cellSize / 60;
    const projectileRadius = 3 * scale;
    const clearance = 1 * scale;
    const clearanceRadius = geometry.visualEnvelopeRadius() + projectileRadius + clearance;
    const relativeX = origin.x - target.x;
    const relativeY = origin.y - target.y;
    const distanceSquared = relativeX * relativeX + relativeY * relativeY;
    const distance = Math.sqrt(distanceSquared);
    if (distance <= clearanceRadius) {
      throw new RangeError('The attacker must be outside the defender clearance circle.');
    }

    const tangentBase = (clearanceRadius * clearanceRadius) / distanceSquared;
    const tangentSide =
      (clearanceRadius * Math.sqrt(distanceSquared - clearanceRadius * clearanceRadius)) /
      distanceSquared;
    const size = geometry.logicalSize;
    const expanded = projectileRadius;
    const exitMargin = scale;

    for (const side of [1, -1]) {
      const tangentX = target.x + tangentBase * relativeX - side * tangentSide * relativeY;
      const tangentY = target.y + tangentBase * relativeY + side * tangentSide * relativeX;
      const vectorX = tangentX - origin.x;
      const vectorY = tangentY - origin.y;
      const length = Math.hypot(vectorX, vectorY);
      const directionX = vectorX / length;
      const directionY = vectorY / length;
      const distanceToExit = TorpedoPath.distanceToExpandedExit(
        origin,
        directionX,
        directionY,
        size,
        expanded,
      );
      const closestX = origin.x + directionX * length;
      const closestY = origin.y + directionY * length;
      const closestOnBoard = closestX >= 0 && closestX <= size && closestY >= 0 && closestY <= size;

      if (length >= distanceToExit || !closestOnBoard) continue;

      return Object.freeze({
        x: origin.x + directionX * (distanceToExit + exitMargin),
        y: origin.y + directionY * (distanceToExit + exitMargin),
      });
    }

    throw new RangeError('No valid near-miss ray clears the defender before leaving the board.');
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
