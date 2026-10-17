import type { ShipIdentity } from '../../board/domain/BoardSnapshot.js';
import type { CombatShip } from './CombatGame.js';

interface AttackOutcomeBase {
  readonly attacker: ShipIdentity;
  readonly defender: ShipIdentity;
  /** Integer from 1 through 20. */
  readonly attackDie: number;
  /** The attacker's ability modifier, from −1 through +5. */
  readonly strengthModifier: number;
  readonly attackTotal: number;
  readonly armorClass: 12;
  readonly hitPointsBefore: number;
  readonly hitPointsAfter: number;
}

export interface AttackMissOutcome extends AttackOutcomeBase {
  readonly kind: 'miss';
  /** Damage fields are absent on misses. */
  readonly damageDie?: never;
  readonly damage?: never;
}

export interface AttackHitOutcome extends AttackOutcomeBase {
  readonly kind: 'hit';
  /** Integer from 1 through 8. */
  readonly damageDie: number;
  /** damageDie + strengthModifier, from 0 through 13. */
  readonly damage: number;
}

/**
 * A validated result for two distinct ships. Totals below AC 12 miss; totals at
 * least 12 hit. Miss HP values are equal; hit HP-after is max(0, before-damage).
 */
export type AttackOutcome = AttackMissOutcome | AttackHitOutcome;

export interface AttackResolution {
  resolve(attacker: CombatShip, defender: CombatShip): AttackOutcome;
}
