import type { BoardConfig, Rng, ShipId } from './types.js';

/**
 * Look up the movement modifier for an agility stat in the config
 * stat→modifier table (FR-002). Exactly one band must contain the stat —
 * anything else throws instead of clamping or guessing.
 */
export function modifierForStat(config: BoardConfig, stat: number): number {
  const bands = config.agility.table.filter(
    (band) => stat >= band.min && stat <= band.max,
  );
  if (bands.length !== 1 || bands[0] === undefined) {
    throw new Error(
      `agility: stat ${String(stat)} matches ${bands.length} table bands — expected exactly one (stat→modifier table)`,
    );
  }
  return bands[0].modifier;
}

/**
 * Roll one ship's agility from the config roll range via the injected RNG
 * (FR-001) and derive its modifier. The ship id is only used to name errors.
 * Rolls are deterministic for a given RNG sequence (see setup.ts draw order).
 */
export function rollShipAgility(
  config: BoardConfig,
  shipId: ShipId,
  rng: Rng,
): { readonly agility: number; readonly agilityModifier: number } {
  const [min, max] = config.agility.rollRange;
  const agility = rng.integer(min, max);
  try {
    return { agility, agilityModifier: modifierForStat(config, agility) };
  } catch (error) {
    throw new Error(
      `agility: ${shipId} rolled ${String(agility)}, outside roll range ${min}-${max}`,
      { cause: error },
    );
  }
}
