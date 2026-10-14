import type { BoardConfig, Rng, ShipId } from './types.js';

/**
 * Pure combat-stat helpers (FR-001–FR-005). Engine-independent: all rolls go
 * through the injected RNG so setup stays deterministic for a given seed.
 *
 * Strength and constitution are rolled by separate functions (rather than one
 * per-ship call) so `setup.ts` can consume the stream in the pinned draw
 * order: strength ship-1, strength ship-2, constitution ship-1, constitution
 * ship-2, HP-base ship-1, HP-base ship-2 (research R-02). Attack/damage
 * resolution lives here only from US3 onwards.
 */

/**
 * Look up the modifier for a stat in the shared combat stat→modifier table
 * (FR-003). Exactly one band must contain the stat — anything else throws
 * instead of clamping or guessing (same strictness as agility.ts).
 */
export function modifierForStat(config: BoardConfig, stat: number): number {
  const bands = config.combat.statTable.filter(
    (band) => stat >= band.min && stat <= band.max,
  );
  if (bands.length !== 1 || bands[0] === undefined) {
    throw new Error(
      `combat: stat ${String(stat)} matches ${bands.length} table bands — expected exactly one (stat→modifier table)`,
    );
  }
  return bands[0].modifier;
}

/**
 * Roll one ship's strength from the combat roll range via the injected RNG
 * (FR-001) and derive its modifier. The ship id is only used to name errors.
 */
export function rollStrength(
  config: BoardConfig,
  shipId: ShipId,
  rng: Rng,
): { readonly strength: number; readonly strengthModifier: number } {
  const [min, max] = config.combat.strength.rollRange;
  const strength = rng.integer(min, max);
  try {
    return { strength, strengthModifier: modifierForStat(config, strength) };
  } catch (error) {
    throw new Error(
      `combat: ${shipId} rolled strength ${String(strength)}, outside roll range ${min}-${max}`,
      { cause: error },
    );
  }
}

/**
 * Roll one ship's constitution from the combat roll range via the injected
 * RNG (FR-002) and derive its modifier. The ship id is only used to name
 * errors.
 */
export function rollConstitution(
  config: BoardConfig,
  shipId: ShipId,
  rng: Rng,
): { readonly constitution: number; readonly constitutionModifier: number } {
  const [min, max] = config.combat.constitution.rollRange;
  const constitution = rng.integer(min, max);
  try {
    return {
      constitution,
      constitutionModifier: modifierForStat(config, constitution),
    };
  } catch (error) {
    throw new Error(
      `combat: ${shipId} rolled constitution ${String(constitution)}, outside roll range ${min}-${max}`,
      { cause: error },
    );
  }
}

/**
 * Compute starting hit points (FR-004): a die roll of
 * `integer(1, hitPoints.die)` plus (`constitutionModifier` ×
 * `hitPoints.perModifierBonus`), clamped to a minimum of
 * `hitPoints.minStart` so no battle starts already won.
 */
export function computeHitPoints(
  config: BoardConfig,
  constitutionModifier: number,
  rng: Rng,
): number {
  const { die, perModifierBonus, minStart } = config.combat.hitPoints;
  const base = rng.integer(1, die);
  return Math.max(minStart, base + constitutionModifier * perModifierBonus);
}

/** Outcome of one attack roll plus the conditional damage roll. */
export interface AttackRoll {
  readonly attackRoll: number;
  readonly total: number;
  readonly hit: boolean;
  readonly damageRoll?: number;
  readonly damage?: number;
}

/**
 * Resolve one torpedo attack (FR-010–FR-012): exactly one d20 attack roll
 * plus the attacker's strength modifier — a hit iff the total meets or
 * exceeds the defender's armor class. A miss consumes no further rolls;
 * a hit consumes exactly one damage roll (d8 + modifier, floored at the
 * configured minimum so a hit always matters). Pure; HP application and
 * win detection belong to the turn reducer.
 */
export function resolveAttack(
  config: BoardConfig,
  strengthModifier: number,
  defenderArmorClass: number,
  rng: Rng,
): AttackRoll {
  const attackRoll = rng.integer(1, config.combat.attack.die);
  const total = attackRoll + strengthModifier;
  if (total < defenderArmorClass) {
    return { attackRoll, total, hit: false };
  }
  const damageRoll = rng.integer(1, config.combat.damage.die);
  return {
    attackRoll,
    total,
    hit: true,
    damageRoll,
    damage: Math.max(
      config.combat.damage.minDamage,
      damageRoll + strengthModifier,
    ),
  };
}
