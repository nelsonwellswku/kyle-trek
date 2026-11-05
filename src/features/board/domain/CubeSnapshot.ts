import { CUBE_SIZE, CubePosition } from './CubePosition.js';

export type ShipIdentity = 'ship-1' | 'ship-2';

export interface CubeShipPlacement {
  readonly identity: ShipIdentity;
  readonly position: CubePosition;
}

/** Immutable fixed-size cube state; occupancy is derived from the two placements. */
export class CubeSnapshot {
  readonly width = CUBE_SIZE;
  readonly height = CUBE_SIZE;
  readonly depth = CUBE_SIZE;
  readonly ship1: CubeShipPlacement;
  readonly ship2: CubeShipPlacement;

  constructor(ship1: CubeShipPlacement, ship2: CubeShipPlacement) {
    if (ship1.identity !== 'ship-1' || ship2.identity !== 'ship-2') {
      throw new RangeError('CubeSnapshot requires ship-1 followed by ship-2.');
    }
    if (
      !(ship1.position instanceof CubePosition) ||
      !(ship2.position instanceof CubePosition) ||
      ship1.position.equals(ship2.position)
    ) {
      throw new RangeError('A cube snapshot requires two distinct valid CubePositions.');
    }
    this.ship1 = Object.freeze({ identity: 'ship-1', position: ship1.position });
    this.ship2 = Object.freeze({ identity: 'ship-2', position: ship2.position });
    if (new.target === CubeSnapshot) Object.freeze(this);
  }

  occupantAt(position: CubePosition): ShipIdentity | null {
    if (!(position instanceof CubePosition)) {
      throw new RangeError('Cube occupancy requires a valid CubePosition.');
    }
    if (this.ship1.position.equals(position)) return this.ship1.identity;
    if (this.ship2.position.equals(position)) return this.ship2.identity;
    return null;
  }

  isOccupied(position: CubePosition): boolean {
    return this.occupantAt(position) !== null;
  }
}
