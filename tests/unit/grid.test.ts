import { describe, expect, it } from 'vitest';
import { loadBoardConfig } from '../../src/sim/board-config.js';
import { createGrid } from '../../src/sim/grid.js';
import type { BoardConfig } from '../../src/sim/types.js';
import shippedConfig from '../../src/config/board.json';

// TDD (T007): written BEFORE src/sim/grid.ts exists → must FAIL until T010.

const shipped = () =>
  loadBoardConfig(JSON.parse(JSON.stringify(shippedConfig)));

describe('grid construction (FR-001)', () => {
  it('builds exactly 10 rows x 10 columns from the shipped config', () => {
    const grid = createGrid(shipped());
    expect(grid.rows).toBe(10);
    expect(grid.cols).toBe(10);
    expect(grid.cells).toHaveLength(100);
  });

  it('addresses every square with unique 1-based (row, col) coordinates', () => {
    const grid = createGrid(shipped());
    const keys = grid.cells.map((c) => `${c.row}:${c.col}`);
    expect(new Set(keys).size).toBe(100);
    for (const cell of grid.cells) {
      expect(cell.row).toBeGreaterThanOrEqual(1);
      expect(cell.row).toBeLessThanOrEqual(10);
      expect(cell.col).toBeGreaterThanOrEqual(1);
      expect(cell.col).toBeLessThanOrEqual(10);
    }
    // Edge squares exist: corners of the board.
    for (const [row, col] of [
      [1, 1],
      [1, 10],
      [10, 1],
      [10, 10],
    ]) {
      expect(keys).toContain(`${row}:${col}`);
    }
  });

  it('starts with every square empty', () => {
    const grid = createGrid(shipped());
    expect(grid.cells.every((c) => c.occupant === null)).toBe(true);
  });

  it('is data-driven: a 3x4 config yields 12 cells (no hard-coded 10)', () => {
    const base = shipped();
    const custom: BoardConfig = {
      ...base,
      grid: { rows: 3, cols: 4 },
    };
    const grid = createGrid(custom);
    expect(grid.rows).toBe(3);
    expect(grid.cols).toBe(4);
    expect(grid.cells).toHaveLength(12);
  });
});
