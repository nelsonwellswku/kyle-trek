import { CubePosition } from '../domain/CubePosition.js';

export interface ScreenRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** Two-dimensional Phaser fallback projection for cube-typed compatibility scenes. */
export class CubeScreenGeometry {
  constructor(readonly logicalSize: number) {
    if (!Number.isFinite(logicalSize) || logicalSize <= 0) {
      throw new RangeError('The logical screen projection size must be finite and positive.');
    }
  }

  cellBounds(position: CubePosition): ScreenRectangle {
    CubeScreenGeometry.validatePosition(position);
    const cellSize = this.logicalSize / 10;

    return Object.freeze({
      x: (position.x - 1) * cellSize,
      y: (position.y - 1) * cellSize,
      width: cellSize,
      height: cellSize,
    });
  }

  cellCenter(position: CubePosition): ScreenPoint {
    const cell = this.cellBounds(position);

    return Object.freeze({
      x: cell.x + cell.width / 2,
      y: cell.y + cell.height / 2,
    });
  }

  positionAt(point: ScreenPoint, depth = 1): CubePosition | null {
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x < 0 ||
      point.y < 0 ||
      point.x >= this.logicalSize ||
      point.y >= this.logicalSize
    ) {
      return null;
    }

    const cellSize = this.logicalSize / 10;
    try {
      return new CubePosition(
        Math.floor(point.x / cellSize) + 1,
        Math.floor(point.y / cellSize) + 1,
        depth,
      );
    } catch {
      return null;
    }
  }

  markerBounds(position: CubePosition): ScreenRectangle {
    const cell = this.cellBounds(position);
    const markerSize = Math.min(
      cell.width * 0.7,
      Math.max(0, (this.visualEnvelopeRadius() - 1) * 2),
    );
    const inset = (cell.width - markerSize) / 2;

    return Object.freeze({
      x: cell.x + inset,
      y: cell.y + inset,
      width: markerSize,
      height: markerSize,
    });
  }

  visualEnvelopeRadius(): number {
    return (this.logicalSize / 10) * 0.4;
  }

  private static validatePosition(position: CubePosition): void {
    if (!(position instanceof CubePosition)) {
      throw new RangeError('Screen projection requires a valid CubePosition.');
    }
  }
}
