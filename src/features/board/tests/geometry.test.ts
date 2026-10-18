import { describe, expect, it } from 'vitest';
import { BoardPosition } from '../domain/BoardPosition.js';
import { BoardGeometry } from '../presentation/BoardGeometry.js';

describe('BoardGeometry', () => {
  const geometry = new BoardGeometry(500);

  it('maps all 100 positions to equal square cells', () => {
    const cells = [];

    for (let row = 1; row <= 10; row += 1) {
      for (let column = 1; column <= 10; column += 1) {
        cells.push(geometry.cellBounds(new BoardPosition(row, column)));
      }
    }

    expect(cells).toHaveLength(100);
    for (const cell of cells) {
      expect(cell.width).toBe(50);
      expect(cell.height).toBe(50);
    }
  });

  it('places the top-left and bottom-right cells in row-major screen orientation', () => {
    expect(geometry.cellBounds(new BoardPosition(1, 1))).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
    expect(geometry.cellBounds(new BoardPosition(10, 10))).toEqual({
      x: 450,
      y: 450,
      width: 50,
      height: 50,
    });
  });

  it('maps one-based coordinates to their exact cell centers', () => {
    expect(geometry.cellCenter(new BoardPosition(1, 1))).toEqual({ x: 25, y: 25 });
    expect(geometry.cellCenter(new BoardPosition(10, 10))).toEqual({ x: 475, y: 475 });
    expect(geometry.cellCenter(new BoardPosition(3, 8))).toEqual({ x: 375, y: 125 });
  });

  it('maps logical points inside half-open bounds to the cell on the right and below', () => {
    const board = new BoardGeometry(600);

    expect(board.positionAt({ x: 0, y: 0 })).toEqual(new BoardPosition(1, 1));
    expect(board.positionAt({ x: 60, y: 60 })).toEqual(new BoardPosition(2, 2));
    expect(board.positionAt({ x: 599.999, y: 599.999 })).toEqual(new BoardPosition(10, 10));
  });

  it('rejects outer-boundary, out-of-bounds and nonfinite logical points', () => {
    const board = new BoardGeometry(600);

    expect(board.positionAt({ x: 600, y: 300 })).toBeNull();
    expect(board.positionAt({ x: 300, y: 600 })).toBeNull();
    expect(board.positionAt({ x: -0.001, y: 300 })).toBeNull();
    expect(board.positionAt({ x: 300, y: -0.001 })).toBeNull();
    expect(board.positionAt({ x: Number.NaN, y: 10 })).toBeNull();
    expect(board.positionAt({ x: 10, y: Number.POSITIVE_INFINITY })).toBeNull();
  });

  it('keeps ship markers fully inside all corner cells', () => {
    const corners = [
      new BoardPosition(1, 1),
      new BoardPosition(1, 10),
      new BoardPosition(10, 1),
      new BoardPosition(10, 10),
    ];

    for (const position of corners) {
      const cell = geometry.cellBounds(position);
      const marker = geometry.markerBounds(position);

      expect(marker.x).toBeGreaterThan(cell.x);
      expect(marker.y).toBeGreaterThan(cell.y);
      expect(marker.x + marker.width).toBeLessThan(cell.x + cell.width);
      expect(marker.y + marker.height).toBeLessThan(cell.y + cell.height);
    }
  });

  it('reserves a cell-relative visual envelope for ship flight clearance', () => {
    expect(geometry.visualEnvelopeRadius()).toBe(20);
    expect(new BoardGeometry(600).visualEnvelopeRadius()).toBe(24);
  });
});
