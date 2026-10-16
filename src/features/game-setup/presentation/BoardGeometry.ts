import { BoardPosition } from '../domain/BoardPosition.js';

export interface BoardRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BoardPoint {
  readonly x: number;
  readonly y: number;
}

export class BoardGeometry {
  constructor(readonly logicalSize: number) {
    if (!Number.isFinite(logicalSize) || logicalSize <= 0) {
      throw new RangeError('The logical board size must be a finite positive number.');
    }
  }

  cellBounds(position: BoardPosition): BoardRectangle {
    BoardGeometry.validatePosition(position);
    const cellSize = this.logicalSize / 10;

    return Object.freeze({
      x: (position.column - 1) * cellSize,
      y: (position.row - 1) * cellSize,
      width: cellSize,
      height: cellSize,
    });
  }

  cellCenter(position: BoardPosition): BoardPoint {
    const cell = this.cellBounds(position);

    return Object.freeze({
      x: cell.x + cell.width / 2,
      y: cell.y + cell.height / 2,
    });
  }

  markerBounds(position: BoardPosition): BoardRectangle {
    const cell = this.cellBounds(position);
    const markerSize = cell.width * 0.7;
    const inset = (cell.width - markerSize) / 2;

    return Object.freeze({
      x: cell.x + inset,
      y: cell.y + inset,
      width: markerSize,
      height: markerSize,
    });
  }

  private static validatePosition(position: BoardPosition): void {
    if (
      !(position instanceof BoardPosition) ||
      !Number.isInteger(position.row) ||
      !Number.isInteger(position.column) ||
      position.row < 1 ||
      position.row > 10 ||
      position.column < 1 ||
      position.column > 10
    ) {
      throw new RangeError('Board geometry requires a valid one-based board position.');
    }
  }
}
