import type { BoardConfig, Grid } from './types.js';

/**
 * Build an empty grid from board tuning data (FR-001).
 * Pure: dimensions come from config, every cell starts unoccupied.
 */
export function createGrid(config: BoardConfig): Grid {
  const { rows, cols } = config.grid;
  const cells = [];
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      cells.push({ row, col, occupant: null });
    }
  }
  return { rows, cols, cells };
}
