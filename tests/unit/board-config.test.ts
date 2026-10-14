import { describe, expect, it } from 'vitest';
import { loadBoardConfig } from '../../src/sim/board-config.js';
import shippedConfig from '../../src/config/board.json';

// TDD (T005): these tests are written BEFORE src/sim/board-config.ts exists,
// so they must FAIL (collection error) until T006 implements the loader.

const validRaw = () =>
  JSON.parse(JSON.stringify(shippedConfig)) as Record<string, unknown>;

describe('board config loader', () => {
  it('loads the shipped board.json (v1.0.0, 10x10, zoned ships)', () => {
    const config = loadBoardConfig(validRaw());
    expect(config.version).toBe('1.0.0');
    expect(config.grid).toEqual({ rows: 10, cols: 10 });
    expect(config.spawnZones).toHaveLength(2);
    expect(config.ships).toHaveLength(2);
    expect(config.spawnZones.map((z) => z.shipId).sort()).toEqual([
      'ship-1',
      'ship-2',
    ]);
  });

  it('fails fast naming "version" when version is missing', () => {
    const raw = validRaw();
    delete raw['version'];
    expect(() => loadBoardConfig(raw)).toThrow(/version/);
  });

  it('fails fast naming "grid" when grid is missing or malformed', () => {
    expect(() => loadBoardConfig({ ...validRaw(), grid: undefined })).toThrow(
      /grid/,
    );
    expect(() =>
      loadBoardConfig({ ...validRaw(), grid: { rows: 0, cols: 10 } }),
    ).toThrow(/grid\.rows/);
  });

  it('rejects overlapping spawn zones, naming the zone rows', () => {
    const raw = validRaw() as {
      spawnZones: Array<{ rows: [number, number] }>;
    };
    raw.spawnZones[1]!.rows = [1, 2];
    expect(() => loadBoardConfig(raw)).toThrow(/spawnZones.*rows/);
  });

  it('rejects a zone reaching outside the grid', () => {
    const raw = validRaw() as {
      spawnZones: Array<{ rows: [number, number] }>;
    };
    raw.spawnZones[1]!.rows = [9, 11];
    expect(() => loadBoardConfig(raw)).toThrow(/spawnZones.*rows/);
  });

  it('rejects ships that are identical in both shape and color', () => {
    const raw = validRaw() as {
      ships: Array<{ shape: string; color: string }>;
    };
    raw.ships[1]!.shape = raw.ships[0]!.shape;
    raw.ships[1]!.color = raw.ships[0]!.color;
    expect(() => loadBoardConfig(raw)).toThrow(/ships/);
  });

  it('rejects a ship id with no matching spawn zone', () => {
    const raw = validRaw() as { ships: Array<{ id: string }> };
    raw.ships[0]!.id = 'ship-3';
    expect(() => loadBoardConfig(raw)).toThrow(/shipId|ships/);
  });

  it('ignores unknown fields', () => {
    expect(() =>
      loadBoardConfig({ ...validRaw(), extraFutureKey: { nested: true } }),
    ).not.toThrow();
  });
});
