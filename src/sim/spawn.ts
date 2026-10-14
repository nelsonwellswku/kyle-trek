import type { BoardConfig, Rng, Spaceship } from './types.js';

/**
 * Place both ships at uniform-random squares inside their own spawn zones
 * (FR-002/003/004/005/007). Pure and deterministic for a given RNG sequence:
 * each zone's eligible cells are enumerated row-major and one index is drawn
 * via `rng.integer(0, count - 1)`. Zones are disjoint (enforced at config
 * load), so the two ships always land on distinct squares.
 */
export function placeShips(
  config: BoardConfig,
  rng: Rng,
): [Spaceship, Spaceship] {
  const ships = config.spawnZones.map((zone) => {
    const candidates: Array<{ row: number; col: number }> = [];
    for (let row = zone.rows[0]; row <= zone.rows[1]; row++) {
      for (let col = zone.cols[0]; col <= zone.cols[1]; col++) {
        candidates.push({ row, col });
      }
    }
    if (candidates.length === 0) {
      throw new Error(
        `spawn: zone "${zone.name}" has no eligible squares`,
      );
    }
    const pick = candidates[rng.integer(0, candidates.length - 1)];
    if (pick === undefined) {
      throw new Error(
        `spawn: RNG returned an out-of-range index for zone "${zone.name}"`,
      );
    }
    return { id: zone.shipId, position: pick } satisfies Spaceship;
  });
  if (ships.length !== 2 || ships[0] === undefined || ships[1] === undefined) {
    throw new Error('spawn: config must define exactly 2 spawn zones');
  }
  return [ships[0], ships[1]];
}
