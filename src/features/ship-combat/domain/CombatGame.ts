import { BoardPosition } from '../../board/domain/BoardPosition.js';
import type { BoardSnapshot, ShipIdentity } from '../../board/domain/BoardSnapshot.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';
import type { PlayerIdentity } from '../../ship-movement/domain/MovementGame.js';

export interface CombatShip {
  readonly identity: ShipIdentity;
  readonly owner: PlayerIdentity;
  readonly position: BoardPosition;
  readonly agility: AgilityStat;
  readonly strength: AbilityStat;
  readonly constitution: AbilityStat;
  readonly armorClass: 12;
  readonly startingHitPoints: number;
  readonly hitPoints: number;
}

export class CombatGame implements BoardSnapshot {
  readonly rows = 10 as const;
  readonly columns = 10 as const;
  readonly ship1: CombatShip;
  readonly ship2: CombatShip;

  constructor(ship1: CombatShip, ship2: CombatShip) {
    if (ship1.identity !== 'ship-1' || ship2.identity !== 'ship-2') {
      throw new RangeError('CombatGame requires ship-1 followed by ship-2.');
    }
    if (ship1.owner !== 'player-1' || ship2.owner !== 'player-2') {
      throw new RangeError('Each combat ship must belong to its matching player.');
    }
    if (
      !(ship1.position instanceof BoardPosition) ||
      !(ship2.position instanceof BoardPosition) ||
      ship1.position.equals(ship2.position)
    ) {
      throw new RangeError('Combat ships require distinct valid board positions.');
    }

    this.ship1 = CombatGame.freezeShip(ship1);
    this.ship2 = CombatGame.freezeShip(ship2);
    Object.freeze(this);
  }

  withPosition(identity: ShipIdentity, position: BoardPosition): CombatGame {
    if (!(position instanceof BoardPosition)) {
      throw new RangeError('A combat position must be a valid BoardPosition.');
    }
    return new CombatGame(
      identity === 'ship-1' ? { ...this.ship1, position } : this.ship1,
      identity === 'ship-2' ? { ...this.ship2, position } : this.ship2,
    );
  }

  withDamage(identity: ShipIdentity, damage: number): CombatGame {
    if (!Number.isInteger(damage) || damage < 0) {
      throw new RangeError('Damage must be a nonnegative integer.');
    }
    const ship = identity === 'ship-1' ? this.ship1 : this.ship2;
    const replacement = { ...ship, hitPoints: Math.max(0, ship.hitPoints - damage) };
    return new CombatGame(
      identity === 'ship-1' ? replacement : this.ship1,
      identity === 'ship-2' ? replacement : this.ship2,
    );
  }

  private static freezeShip(ship: CombatShip): CombatShip {
    if (
      !(ship.agility instanceof AgilityStat) ||
      !(ship.strength instanceof AbilityStat) ||
      !(ship.constitution instanceof AbilityStat)
    ) {
      throw new RangeError('Combat ships require validated ability values.');
    }
    if (
      ship.armorClass !== 12 ||
      !Number.isInteger(ship.startingHitPoints) ||
      ship.startingHitPoints < 1 ||
      ship.startingHitPoints > 30 ||
      !Number.isInteger(ship.hitPoints) ||
      ship.hitPoints < 0 ||
      ship.hitPoints > ship.startingHitPoints
    ) {
      throw new RangeError('Combat ship armor class and hit points are invalid.');
    }
    return Object.freeze({
      identity: ship.identity,
      owner: ship.owner,
      position: ship.position,
      agility: ship.agility,
      strength: ship.strength,
      constitution: ship.constitution,
      armorClass: 12,
      startingHitPoints: ship.startingHitPoints,
      hitPoints: ship.hitPoints,
    });
  }
}
