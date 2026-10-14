import { describe, expect, it } from 'vitest';
import { loadBoardConfig } from '../../src/sim/board-config.js';
import { setupGame } from '../../src/sim/setup.js';
import { validateSetup } from '../../src/sim/validation.js';
import type { BoardConfig, Rng } from '../../src/sim/types.js';
import shippedConfig from '../../src/config/board.json';

// TDD (T009): written BEFORE validation.ts/setup.ts exist → must FAIL until T012/T013.

const shipped = (): BoardConfig =>
  loadBoardConfig(JSON.parse(JSON.stringify(shippedConfig)));

const firstPick: Rng = { integer: (min: number) => min };

const validSetup = () => setupGame(shipped(), 42, firstPick);

describe('setup validation (FR-008)', () => {
  it('accepts a valid setup', () => {
    const setup = validSetup();
    expect(() => validateSetup(setup, shipped())).not.toThrow();
    expect(setup.ships).toHaveLength(2);
  });

  it('rejects wrong grid dimensions, naming dimensions', () => {
    const setup = validSetup();
    const broken = {
      ...setup,
      grid: { ...setup.grid, rows: 9 },
    };
    expect(() => validateSetup(broken, shipped())).toThrow(/dimensions/);
  });

  it('rejects a ship outside its spawn zone, naming the zone', () => {
    const setup = validSetup();
    const broken = {
      ...setup,
      ships: [
        { ...setup.ships[0]!, position: { row: 5, col: 5 } },
        setup.ships[1]!,
      ] as typeof setup.ships,
    };
    expect(() => validateSetup(broken, shipped())).toThrow(/zone/);
  });

  it('rejects ships sharing a square, naming distinctness', () => {
    // With disjoint zones a shared square always implies an out-of-zone ship
    // (caught by the zone rule), so exercise distinctness with overlapping
    // zones: both ships deterministically draw index 0 -> (1,1).
    const config = shipped();
    const overlapping: BoardConfig = {
      ...config,
      spawnZones: [
        config.spawnZones[0]!,
        { ...config.spawnZones[1]!, rows: [1, 2] as const },
      ],
    };
    expect(() => setupGame(overlapping, 7, firstPick)).toThrow(
      /distinct|shared/,
    );
  });

  it('rejects occupant bookkeeping mismatches, naming occupancy', () => {
    const setup = validSetup();
    const broken = {
      ...setup,
      grid: {
        ...setup.grid,
        cells: setup.grid.cells.map((c) => ({ ...c, occupant: null as null })),
      },
    };
    expect(() => validateSetup(broken, shipped())).toThrow(/occupan/);
  });
});
