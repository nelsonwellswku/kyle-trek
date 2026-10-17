import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardSnapshot, type ShipIdentity } from '../../board/domain/BoardSnapshot.js';
import { AgilityStat } from './AgilityStat.js';

export type PlayerIdentity = 'player-1' | 'player-2';

export interface MovementShip {
  readonly identity: ShipIdentity;
  readonly owner: PlayerIdentity;
  readonly position: BoardPosition;
  readonly agility: AgilityStat;
}

export class MovementGame implements BoardSnapshot {
  readonly rows = 10 as const;
  readonly columns = 10 as const;
  readonly ship1: MovementShip;
  readonly ship2: MovementShip;

  constructor(ship1: MovementShip, ship2: MovementShip) {
    const placements = new BoardSnapshot(ship1, ship2);
    if (ship1.owner !== 'player-1' || ship2.owner !== 'player-2') {
      throw new RangeError('MovementGame requires each ship to belong to its matching player.');
    }

    if (!(ship1.agility instanceof AgilityStat) || !(ship2.agility instanceof AgilityStat)) {
      throw new RangeError('Each movement ship must have a validated AgilityStat.');
    }

    this.ship1 = Object.freeze({
      identity: placements.ship1.identity,
      owner: 'player-1',
      position: placements.ship1.position,
      agility: ship1.agility,
    });
    this.ship2 = Object.freeze({
      identity: placements.ship2.identity,
      owner: 'player-2',
      position: placements.ship2.position,
      agility: ship2.agility,
    });
    Object.freeze(this);
  }

  withPosition(identity: ShipIdentity, position: BoardPosition): MovementGame {
    if (!(position instanceof BoardPosition)) {
      throw new RangeError('A movement position must be a valid BoardPosition.');
    }

    const ship1 = this.ship1;
    const ship2 = this.ship2;
    return new MovementGame(
      identity === 'ship-1' ? { ...ship1, position } : ship1,
      identity === 'ship-2' ? { ...ship2, position } : ship2,
    );
  }
}
