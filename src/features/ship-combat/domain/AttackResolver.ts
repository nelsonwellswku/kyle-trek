import type { ShipIdentity } from '../../board/domain/BoardSnapshot.js';
import type { DiceRoller } from './DiceRoller.js';
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

export class AttackResolver implements AttackResolution {
  constructor(private readonly diceRoller: DiceRoller) {}

  resolve(attacker: CombatShip, defender: CombatShip): AttackOutcome {
    if (
      attacker.identity === defender.identity ||
      attacker.armorClass !== 12 ||
      defender.armorClass !== 12 ||
      !Number.isInteger(attacker.strength.modifier) ||
      attacker.strength.modifier < -1 ||
      attacker.strength.modifier > 5 ||
      !Number.isInteger(defender.hitPoints) ||
      defender.hitPoints < 0 ||
      defender.hitPoints > defender.startingHitPoints
    ) {
      throw new RangeError('An attack requires distinct valid ships and combat values.');
    }

    const attackDie = this.diceRoller.rollD20();
    const strengthModifier = attacker.strength.modifier;
    const attackTotal = attackDie + strengthModifier;
    const hitPointsBefore = defender.hitPoints;
    const common = {
      attacker: attacker.identity,
      defender: defender.identity,
      attackDie,
      strengthModifier,
      attackTotal,
      armorClass: 12 as const,
      hitPointsBefore,
    };

    if (attackTotal < defender.armorClass) {
      return Object.freeze({
        ...common,
        kind: 'miss',
        hitPointsAfter: hitPointsBefore,
      });
    }

    const damageDie = this.diceRoller.rollD8();
    const damage = Math.max(0, damageDie + strengthModifier);
    return Object.freeze({
      ...common,
      kind: 'hit',
      damageDie,
      damage,
      hitPointsAfter: Math.max(0, hitPointsBefore - damage),
    });
  }
}
