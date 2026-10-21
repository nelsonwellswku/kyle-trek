import { BoardSnapshot, type ShipIdentity } from './BoardSnapshot.js';
import { CubePosition } from './CubePosition.js';

export interface CubeShipPlacement {
  readonly identity: ShipIdentity;
  readonly position: CubePosition;
}

/** Immutable fixed-size cube state; occupancy is derived from the two placements. */
export class CubeSnapshot extends BoardSnapshot {
  readonly width = 10 as const;
  readonly height = 10 as const;
  readonly depth = 10 as const;
  declare readonly ship1: CubeShipPlacement;
  declare readonly ship2: CubeShipPlacement;

  constructor(ship1: CubeShipPlacement, ship2: CubeShipPlacement) {
    super(ship1, ship2);
    if (!(ship1.position instanceof CubePosition) || !(ship2.position instanceof CubePosition)) {
      throw new RangeError('Each cube placement must contain a valid CubePosition.');
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
