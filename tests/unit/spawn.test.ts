import { describe, expect, it } from 'vitest';
import { loadBoardConfig } from '../../src/sim/board-config.js';
import { setupNewGame } from '../../src/sim/setup.js';
import { placeShips } from '../../src/sim/spawn.js';
import { validateSetup } from '../../src/sim/validation.js';
import type { BoardConfig, Rng, RngFactory } from '../../src/sim/types.js';
import shippedConfig from '../../src/config/board.json';

// TDD (T008): written BEFORE src/sim/spawn.ts exists → must FAIL until T011.

const shipped = (): BoardConfig =>
  loadBoardConfig(JSON.parse(JSON.stringify(shippedConfig)));

/** Deterministic stub: always picks the first eligible square. */
const firstPick: Rng = { integer: (min: number) => min };
/** Deterministic stub: always picks the last eligible square. */
const lastPick: Rng = { integer: (_min: number, max: number) => max };
/** Deterministic stub: replays a fixed index sequence. */
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

describe('spawn placement (FR-002/003/004/007)', () => {
  it('places ship-1 in rows 1-2 and ship-2 in rows 9-10 (first pick)', () => {
    const [ship1, ship2] = placeShips(shipped(), firstPick);
    expect(ship1.id).toBe('ship-1');
    expect(ship2.id).toBe('ship-2');
    expect(ship1.position).toEqual({ row: 1, col: 1 });
    expect(ship2.position).toEqual({ row: 9, col: 1 });
  });

  it('reaches the far edges of each zone (last pick)', () => {
    const [ship1, ship2] = placeShips(shipped(), lastPick);
    expect(ship1.position).toEqual({ row: 2, col: 10 });
    expect(ship2.position).toEqual({ row: 10, col: 10 });
  });

  it('picks uniformly-addressable squares: index 5 -> (1,6), index 7 -> (9,8)', () => {
    const [ship1, ship2] = placeShips(shipped(), sequencePick([5, 7]));
    expect(ship1.position).toEqual({ row: 1, col: 6 });
    expect(ship2.position).toEqual({ row: 9, col: 8 });
  });

  it('gives each ship exactly one square and keeps them distinct', () => {
    for (const rng of [firstPick, lastPick, sequencePick([0, 0, 19, 19])]) {
      const [ship1, ship2] = placeShips(shipped(), rng);
      const key = (p: { row: number; col: number }) => `${p.row}:${p.col}`;
      expect(key(ship1.position)).not.toBe(key(ship2.position));
    }
  });

  it('uses only the injected RNG: same sequence reproduces the same ships', () => {
    const config = shipped();
    const a = placeShips(config, sequencePick([3, 14]));
    const b = placeShips(config, sequencePick([3, 14]));
    expect(a).toEqual(b);
    // index 3 -> row-major 4th cell of top zone = (1,4);
    // index 14 -> row-major 15th cell of bottom zone (rows 9-10) = (10,5)
    expect(a[0].position).toEqual({ row: 1, col: 4 });
    expect(a[1].position).toEqual({ row: 10, col: 5 });
  });
});

describe('seed handling (FR-006/SC-003/SC-004)', () => {
  /** Deterministic LCG factory: same seed -> same RNG sequence. Uses the
   * high bits (like glibc rand()) — the low bits of an LCG are too
   * periodic for a fair uniformity check. */
  const stubFactory = (): RngFactory => ({
    create(seed: number = 1) {
      let state = seed >>> 0;
      return {
        rng: {
          integer: (min: number, max: number) => {
            state = (state * 1103515245 + 12345) & 0x7fffffff;
            return min + ((state >>> 16) % (max - min + 1));
          },
        },
        seed,
      };
    },
  });

  /** Mimics ex.Random: unseeded creation yields unique sequential seeds. */
  const autoFactory = (): RngFactory => {
    const base = stubFactory();
    let nextSeed = 1_000_000;
    return {
      create(seed?: number) {
        return base.create(seed === undefined ? nextSeed++ : seed);
      },
    };
  };

  it('records the passed seed and config version on the setup', () => {
    const config = shipped();
    const setup = setupNewGame(config, stubFactory(), 1234);
    expect(setup.seed).toBe(1234);
    expect(setup.configVersion).toBe(config.version);
    expect(() => validateSetup(setup, config)).not.toThrow();
  });

  it('reproduces identical positions for the same seed (SC-004)', () => {
    const config = shipped();
    const first = setupNewGame(config, stubFactory(), 99);
    const second = setupNewGame(config, stubFactory(), 99);
    expect(second.seed).toBe(first.seed);
    expect(second.ships).toEqual(first.ships);
    expect(second.grid.cells).toEqual(first.grid.cells);
  });

  it('covers every zone square approximately uniformly over 200 seeds (SC-003)', () => {
    const config = shipped();
    const hitsTop = new Map<string, number>();
    const hitsBottom = new Map<string, number>();
    for (let seed = 1; seed <= 200; seed++) {
      const setup = setupNewGame(config, stubFactory(), seed);
      const ship1 = setup.ships[0]!;
      const ship2 = setup.ships[1]!;
      const key1 = `${ship1.position.row}:${ship1.position.col}`;
      const key2 = `${ship2.position.row}:${ship2.position.col}`;
      hitsTop.set(key1, (hitsTop.get(key1) ?? 0) + 1);
      hitsBottom.set(key2, (hitsBottom.get(key2) ?? 0) + 1);
    }
    // 20 eligible squares per zone, 200 draws each: every square reachable...
    expect(hitsTop.size).toBe(20);
    expect(hitsBottom.size).toBe(20);
    // ...with no square dominating (lenient uniformity bound).
    for (const hits of [hitsTop, hitsBottom]) {
      const counts = [...hits.values()];
      const ratio = Math.max(...counts) / Math.min(...counts);
      expect(ratio).toBeLessThan(3);
    }
  });

  it('draws independently across unseeded setups with unique recorded seeds', () => {
    const config = shipped();
    const factory = autoFactory();
    const first = setupNewGame(config, factory);
    const second = setupNewGame(config, factory);
    expect(second.seed).not.toBe(first.seed);
    expect(() => validateSetup(first, config)).not.toThrow();
    expect(() => validateSetup(second, config)).not.toThrow();
  });
});
