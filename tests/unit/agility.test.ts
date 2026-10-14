import { describe, expect, it } from 'vitest';
import { loadBoardConfig } from '../../src/sim/board-config.js';
import { modifierForStat, rollShipAgility } from '../../src/sim/agility.js';
import { setupGame } from '../../src/sim/setup.js';
import type { BoardConfig, Rng } from '../../src/sim/types.js';
import shippedConfig from '../../src/config/board.json';

// TDD (T006): written BEFORE src/sim/agility.ts exists → must FAIL until T009.

const shipped = (): BoardConfig =>
  loadBoardConfig(JSON.parse(JSON.stringify(shippedConfig)));

const firstPick: Rng = { integer: (min: number) => min };
const lastPick: Rng = { integer: (_min: number, max: number) => max };
const sequencePick = (picks: number[]): Rng => {
  let i = 0;
  return {
    integer: (min: number, max: number) => {
      const pick = picks[i % picks.length]!;
      i++;
      return Math.min(Math.max(pick, min), max);
    },
  };
};

describe('agility modifier table (FR-002)', () => {
  const expected: Array<[number, number]> = [
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [13, 1],
    [14, 2],
    [15, 2],
    [16, 3],
    [17, 3],
    [18, 4],
    [19, 4],
    [20, 5],
  ];

  it.each(expected)('stat %i maps to modifier %i', (stat, modifier) => {
    expect(modifierForStat(shipped(), stat)).toBe(modifier);
  });

  it('pins the band boundaries (9/-1, 10/0, 11/0, 12/1, 19/4, 20/5)', () => {
    const config = shipped();
    expect(modifierForStat(config, 9)).toBe(-1);
    expect(modifierForStat(config, 10)).toBe(0);
    expect(modifierForStat(config, 11)).toBe(0);
    expect(modifierForStat(config, 12)).toBe(1);
    expect(modifierForStat(config, 19)).toBe(4);
    expect(modifierForStat(config, 20)).toBe(5);
  });

  it('throws for stats outside the table (7 and 21)', () => {
    const config = shipped();
    expect(() => modifierForStat(config, 7)).toThrow(/7/);
    expect(() => modifierForStat(config, 21)).toThrow(/21/);
  });
});

describe('agility rolls (FR-001)', () => {
  it('rolls the minimum (8 → -1) on a min-stub RNG', () => {
    const { agility, agilityModifier } = rollShipAgility(
      shipped(),
      'ship-1',
      firstPick,
    );
    expect(agility).toBe(8);
    expect(agilityModifier).toBe(-1);
  });

  it('rolls the maximum (20 → 5) on a max-stub RNG', () => {
    const { agility, agilityModifier } = rollShipAgility(
      shipped(),
      'ship-2',
      lastPick,
    );
    expect(agility).toBe(20);
    expect(agilityModifier).toBe(5);
  });

  it('rolls ship-1 then ship-2 AFTER both spawns (pinned draw order)', () => {
    // Draws: spawn idx 5 -> (1,6), spawn idx 7 -> (9,8), then raw agility
    // rolls 12 (-> +1) and 18 (-> +4). Any other draw order changes these.
    const setup = setupGame(shipped(), 1, sequencePick([5, 7, 12, 18]));
    const [ship1, ship2] = setup.ships;
    expect(ship1.position).toEqual({ row: 1, col: 6 });
    expect(ship2.position).toEqual({ row: 9, col: 8 });
    expect(ship1.agility).toBe(12);
    expect(ship1.agilityModifier).toBe(1);
    expect(ship2.agility).toBe(18);
    expect(ship2.agilityModifier).toBe(4);
  });

  it('reproduces identical agility for the same seed (determinism)', () => {
    const config = shipped();
    const first = setupGame(config, 77, sequencePick([3, 14, 16, 9]));
    const second = setupGame(config, 77, sequencePick([3, 14, 16, 9]));
    expect(second.ships).toEqual(first.ships);
  });
});

describe('agility config shape (contracts/agility-config-schema.md)', () => {
  const rawAgility = () =>
    (JSON.parse(JSON.stringify(shippedConfig)) as { agility: unknown })
      .agility as {
      rollRange: [number, number];
      table: Array<{ min: number; max: number; modifier: number }>;
    };

  const rawWithAgility = (agility: unknown) => ({
    ...JSON.parse(JSON.stringify(shippedConfig)),
    agility,
  });

  it('rejects a missing agility section, naming agility', () => {
    const raw = JSON.parse(JSON.stringify(shippedConfig)) as Record<
      string,
      unknown
    >;
    delete raw['agility'];
    expect(() => loadBoardConfig(raw)).toThrow(/agility/);
  });

  it('rejects overlapping bands, naming the overlap', () => {
    const agility = rawAgility();
    agility.table[1] = { min: 9, max: 11, modifier: 0 };
    expect(() => loadBoardConfig(rawWithAgility(agility))).toThrow(/overlap/);
  });

  it('rejects a gappy table (deleted 20 band), naming the gap', () => {
    const agility = rawAgility();
    agility.table = agility.table.filter((b) => b.max !== 20);
    expect(() => loadBoardConfig(rawWithAgility(agility))).toThrow(
      /gap|cover/,
    );
  });

  it('rejects a table that does not start at the roll range, naming coverage', () => {
    const agility = rawAgility();
    agility.table = agility.table.filter((b) => b.min !== 8);
    expect(() => loadBoardConfig(rawWithAgility(agility))).toThrow(
      /gap|cover/,
    );
  });
});
