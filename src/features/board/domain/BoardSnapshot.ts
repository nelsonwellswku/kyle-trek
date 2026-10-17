import { BoardPosition } from './BoardPosition.js';

export type ShipIdentity = 'ship-1' | 'ship-2';

export interface ShipPlacement {
  readonly identity: ShipIdentity;
  readonly position: BoardPosition;
}

export class BoardSnapshot {
  readonly rows = 10 as const;
  readonly columns = 10 as const;
  readonly ship1: ShipPlacement;
  readonly ship2: ShipPlacement;

  constructor(ship1: ShipPlacement, ship2: ShipPlacement) {
    if (ship1.identity !== 'ship-1' || ship2.identity !== 'ship-2') {
      throw new RangeError('BoardSnapshot requires ship-1 followed by ship-2.');
    }

    if (!(ship1.position instanceof BoardPosition) || !(ship2.position instanceof BoardPosition)) {
      throw new RangeError('Each ship placement must contain a valid BoardPosition.');
    }

    if (ship1.position.equals(ship2.position)) {
      throw new RangeError('Ships must occupy distinct board positions.');
    }

    this.ship1 = Object.freeze({ identity: 'ship-1', position: ship1.position });
    this.ship2 = Object.freeze({ identity: 'ship-2', position: ship2.position });
    Object.freeze(this);
  }
}
