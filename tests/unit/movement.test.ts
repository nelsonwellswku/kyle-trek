import { describe, expect, it } from 'vitest';
import { legalDestinations } from '../../src/sim/movement.js';

// TDD (T007): written BEFORE src/sim/movement.ts exists → must FAIL until T010.

interface Square {
  readonly row: number;
  readonly col: number;
}

const key = (s: Square): string => `${s.row}:${s.col}`;
const keys = (cells: readonly Square[]): string[] =>
  cells.map(key).sort();

describe('legal destination sets (FR-004/FR-005/FR-006)', () => {
  it('modifier 1 mid-board: origin plus the 4 orthogonal neighbors', () => {
    const set = legalDestinations({
      rows: 10,
      cols: 10,
      origin: { row: 5, col: 5 },
      modifier: 1,
      occupied: { row: 1, col: 1 },
    });
    expect(keys(set)).toEqual(
      ['5:5', '4:5', '6:5', '5:4', '5:6'].sort(),
    );
  });

  it('truncates at edges and corners with no off-board cells', () => {
    const corner = legalDestinations({
      rows: 10,
      cols: 10,
      origin: { row: 1, col: 1 },
      modifier: 2,
      occupied: { row: 10, col: 10 },
    });
    expect(keys(corner)).toEqual(
      ['1:1', '2:1', '1:2', '3:1', '1:3', '2:2'].sort(),
    );

    const edge = legalDestinations({
      rows: 10,
      cols: 10,
      origin: { row: 1, col: 5 },
      modifier: 1,
      occupied: { row: 10, col: 10 },
    });
    expect(keys(edge)).toEqual(['1:5', '1:4', '1:6', '2:5'].sort());
  });

  it('excludes the opponent-occupied square', () => {
    const set = legalDestinations({
      rows: 10,
      cols: 10,
      origin: { row: 5, col: 5 },
      modifier: 1,
      occupied: { row: 5, col: 6 },
    });
    expect(keys(set)).toEqual(['5:5', '4:5', '6:5', '5:4'].sort());
  });

  it('blocks a straight corridor with no alternate route (5:7 via 5:6)', () => {
    const set = legalDestinations({
      rows: 10,
      cols: 10,
      origin: { row: 5, col: 5 },
      modifier: 2,
      occupied: { row: 5, col: 6 },
    });
    expect(key({ row: 5, col: 7 })).toBe('5:7');
    expect(keys(set)).not.toContain('5:7');
  });

  it('allows a destination with an L-route around the opponent (6:6 via 6:5)', () => {
    const set = legalDestinations({
      rows: 10,
      cols: 10,
      origin: { row: 5, col: 5 },
      modifier: 2,
      occupied: { row: 5, col: 6 },
    });
    expect(keys(set)).toContain('6:6');
  });

  it('modifier 0 and -1 yield the origin square only (stay-in-place)', () => {
    for (const modifier of [0, -1]) {
      const set = legalDestinations({
        rows: 10,
        cols: 10,
        origin: { row: 5, col: 5 },
        modifier,
        occupied: { row: 1, col: 1 },
      });
      expect(keys(set)).toEqual(['5:5']);
    }
  });

  it('never includes diagonal-only squares beyond range', () => {
    const set = legalDestinations({
      rows: 10,
      cols: 10,
      origin: { row: 5, col: 5 },
      modifier: 1,
      occupied: { row: 1, col: 1 },
    });
    expect(keys(set)).not.toContain('6:6');
    expect(keys(set)).not.toContain('4:4');
  });

  it('is deterministic: identical inputs yield identical sets (FR-012)', () => {
    const args = {
      rows: 10,
      cols: 10,
      origin: { row: 4, col: 7 },
      modifier: 3,
      occupied: { row: 4, col: 8 },
    };
    expect(legalDestinations(args)).toEqual(legalDestinations(args));
  });
});
