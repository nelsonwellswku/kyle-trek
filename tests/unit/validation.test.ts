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

describe('combat setup validation (data-model rules 10–14)', () => {
  it('accepts combat stats on a valid setup', () => {
    const setup = validSetup();
    expect(() => validateSetup(setup, shipped())).not.toThrow();
    for (const ship of setup.ships) {
      expect(ship.strength).toBeGreaterThanOrEqual(8);
      expect(ship.strength).toBeLessThanOrEqual(20);
      expect(ship.armorClass).toBe(12);
      expect(ship.hitPoints).toBe(ship.maxHitPoints);
    }
  });

  it('rejects strength outside 8–20, naming strength', () => {
    const setup = validSetup();
    const broken = {
      ...setup,
      ships: [
        { ...setup.ships[0]!, strength: 7, strengthModifier: -1 },
        setup.ships[1]!,
      ] as typeof setup.ships,
    };
    expect(() => validateSetup(broken, shipped())).toThrow(/strength/);
  });

  it('rejects constitution outside 8–20, naming constitution', () => {
    const setup = validSetup();
    const broken = {
      ...setup,
      ships: [
        setup.ships[0]!,
        { ...setup.ships[1]!, constitution: 21, constitutionModifier: 5 },
      ] as typeof setup.ships,
    };
    expect(() => validateSetup(broken, shipped())).toThrow(/constitution/);
  });

  it('rejects a modifier mismatching its table band, naming the stat', () => {
    const setup = validSetup();
    const broken = {
      ...setup,
      ships: [
        { ...setup.ships[0]!, strength: 14, strengthModifier: 0 },
        setup.ships[1]!,
      ] as typeof setup.ships,
    };
    expect(() => validateSetup(broken, shipped())).toThrow(/strength/);
  });

  it('rejects current hit points above max, naming hit points', () => {
    const setup = validSetup();
    const broken = {
      ...setup,
      ships: [
        {
          ...setup.ships[0]!,
          hitPoints: setup.ships[0]!.maxHitPoints + 1,
        },
        setup.ships[1]!,
      ] as typeof setup.ships,
    };
    expect(() => validateSetup(broken, shipped())).toThrow(/hit-?points/i);
  });

  it('rejects a non-12 armor class, naming armor class', () => {
    const setup = validSetup();
    const broken = {
      ...setup,
      ships: [
        { ...setup.ships[0]!, armorClass: 10 },
        setup.ships[1]!,
      ] as typeof setup.ships,
    };
    expect(() => validateSetup(broken, shipped())).toThrow(/armor/i);
  });
});
