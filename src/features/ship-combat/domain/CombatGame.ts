import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { CubeOrientation } from '../../board/domain/CubeOrientation.js';
import { CubePosition } from '../../board/domain/CubePosition.js';
import { CubeSnapshot } from '../../board/domain/CubeSnapshot.js';
import type { ShipIdentity } from '../../board/domain/BoardSnapshot.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';
import type { PlayerIdentity } from '../../ship-movement/domain/MovementGame.js';

export interface CombatShip {
  readonly identity: ShipIdentity;
  readonly owner: PlayerIdentity;
  readonly position: CubePosition;
  readonly orientation: CubeOrientation;
  readonly agility: AgilityStat;
  readonly strength: AbilityStat;
  readonly constitution: AbilityStat;
  readonly armorClass: 12;
  readonly startingHitPoints: number;
  readonly hitPoints: number;
}

/** Complete immutable battle snapshot retaining combat data alongside cube state. */
export class CombatGame extends CubeSnapshot {
  declare readonly ship1: CombatShip;
  declare readonly ship2: CombatShip;

  constructor(ship1: CombatShip, ship2: CombatShip) {
    super(
      { identity: ship1.identity, position: ship1.position },
      { identity: ship2.identity, position: ship2.position },
    );
    if (ship1.identity !== 'ship-1' || ship2.identity !== 'ship-2') {
      throw new RangeError('CombatGame requires ship-1 followed by ship-2.');
    }
    if (ship1.owner !== 'player-1' || ship2.owner !== 'player-2') {
      throw new RangeError('Each combat ship must belong to its matching player.');
    }

    this.ship1 = CombatGame.freezeShip(ship1);
    this.ship2 = CombatGame.freezeShip(ship2);
    Object.freeze(this);
  }

  /** BoardPosition is accepted temporarily for the standalone legacy 2D session. */
  withPosition(identity: ShipIdentity, position: CubePosition | BoardPosition): CombatGame {
    if (!(position instanceof BoardPosition)) {
      throw new RangeError('A combat position must be a valid CubePosition.');
    }
    const current = identity === 'ship-1' ? this.ship1 : this.ship2;
    const cubePosition =
      position instanceof CubePosition
        ? position
        : new CubePosition(position.column, position.row, current.position.z);
    return new CombatGame(
      identity === 'ship-1' ? { ...this.ship1, position: cubePosition } : this.ship1,
      identity === 'ship-2' ? { ...this.ship2, position: cubePosition } : this.ship2,
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
      !(ship.position instanceof CubePosition) ||
      !(ship.orientation instanceof CubeOrientation) ||
      !(ship.agility instanceof AgilityStat) ||
      !(ship.strength instanceof AbilityStat) ||
      !(ship.constitution instanceof AbilityStat)
    ) {
      throw new RangeError(
        'Combat ships require validated cube positions, orientations, and abilities.',
      );
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
      orientation: ship.orientation,
      agility: ship.agility,
      strength: ship.strength,
      constitution: ship.constitution,
      armorClass: 12,
      startingHitPoints: ship.startingHitPoints,
      hitPoints: ship.hitPoints,
    });
  }
}
