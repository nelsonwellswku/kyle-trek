import { CubePosition } from '../../board/domain/CubePosition.js';
import { CubeSnapshot } from '../../board/domain/CubeSnapshot.js';
import type { ShipIdentity } from '../../board/domain/BoardSnapshot.js';
import { AgilityStat } from './AgilityStat.js';

export type PlayerIdentity = 'player-1' | 'player-2';

export interface MovementShip {
  readonly identity: ShipIdentity;
  readonly owner: PlayerIdentity;
  readonly position: CubePosition;
  readonly agility: AgilityStat;
}

/** Immutable movement snapshot using the shared canonical cube occupancy contract. */
export class MovementGame extends CubeSnapshot {
  declare readonly ship1: MovementShip;
  declare readonly ship2: MovementShip;

  constructor(ship1: MovementShip, ship2: MovementShip) {
    super(ship1, ship2);
    if (ship1.owner !== 'player-1' || ship2.owner !== 'player-2') {
      throw new RangeError('MovementGame requires each ship to belong to its matching player.');
    }
    if (!(ship1.agility instanceof AgilityStat) || !(ship2.agility instanceof AgilityStat)) {
      throw new RangeError('Each movement ship must have a validated AgilityStat.');
    }

    this.ship1 = Object.freeze({
      identity: 'ship-1',
      owner: 'player-1',
      position: ship1.position,
      agility: ship1.agility,
    });
    this.ship2 = Object.freeze({
      identity: 'ship-2',
      owner: 'player-2',
      position: ship2.position,
      agility: ship2.agility,
    });
    Object.freeze(this);
  }

  withPosition(identity: ShipIdentity, position: CubePosition): MovementGame {
    if (!(position instanceof CubePosition)) {
      throw new RangeError('A movement position must be a valid CubePosition.');
    }

    return new MovementGame(
      identity === 'ship-1' ? { ...this.ship1, position } : this.ship1,
      identity === 'ship-2' ? { ...this.ship2, position } : this.ship2,
    );
  }
}
