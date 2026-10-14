/**
 * Legal-destination computation (FR-004/FR-005/FR-006). Pure and
 * engine-independent: the returned set feeds BOTH highlight rendering and
 * move acceptance, so the two can never disagree.
 *
 * Rules: the origin (stay-in-place) is always legal; every other member is
 * an in-bounds cell with Manhattan distance 1..modifier from the origin,
 * excluding the opponent-occupied cell and any cell with NO orthogonal path
 * of length ≤ modifier that avoids the occupied cell (go-around routes
 * allowed — clarified 2026-10-14). Modifier ≤ 0 yields the origin alone.
 * Enumeration uses row/col offsets only, so diagonal steps are never taken.
 */

interface Square {
  readonly row: number;
  readonly col: number;
}

export interface LegalSetInput {
  readonly rows: number;
  readonly cols: number;
  readonly origin: Square;
  readonly modifier: number;
  readonly occupied: Square;
}

const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Shortest-path BFS avoiding `occupied`, capped at `maxLen` steps. */
function hasClearPath(
  origin: Square,
  dest: Square,
  occupied: Square,
  maxLen: number,
  rows: number,
  cols: number,
): boolean {
  const seen = new Set<string>([`${origin.row}:${origin.col}`]);
  let frontier: Square[] = [{ ...origin }];
  let steps = 0;
  while (frontier.length > 0 && steps < maxLen) {
    steps++;
    const next: Square[] = [];
    for (const cell of frontier) {
      for (const [dr, dc] of ORTHOGONAL) {
        const row = cell.row + dr;
        const col = cell.col + dc;
        if (row < 1 || row > rows || col < 1 || col > cols) continue;
        if (row === occupied.row && col === occupied.col) continue;
        if (row === dest.row && col === dest.col) return true;
        const key = `${row}:${col}`;
        if (!seen.has(key)) {
          seen.add(key);
          next.push({ row, col });
        }
      }
    }
    frontier = next;
  }
  return false;
}

export function legalDestinations(input: LegalSetInput): Square[] {
  const { rows, cols, origin, modifier, occupied } = input;
  const members: Square[] = [{ ...origin }];
  if (modifier < 1) return members;
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      if (row === origin.row && col === origin.col) continue;
      const distance =
        Math.abs(row - origin.row) + Math.abs(col - origin.col);
      if (distance < 1 || distance > modifier) continue;
      if (row === occupied.row && col === occupied.col) continue;
      if (!hasClearPath(origin, { row, col }, occupied, modifier, rows, cols)) {
        continue;
      }
      members.push({ row, col });
    }
  }
  return members;
}
