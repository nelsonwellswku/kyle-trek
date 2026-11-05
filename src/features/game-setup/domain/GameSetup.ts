import { CubeSnapshot, type CubeShipPlacement } from '../../board/domain/CubeSnapshot.js';
import type { CubeSnapshot as GameSetupSnapshot } from '../../board/domain/CubeSnapshot.js';
import { CUBE_SIZE } from '../../board/domain/CubePosition.js';

export type { ShipIdentity } from '../../board/domain/CubeSnapshot.js';
export type { CubeShipPlacement as ShipPlacement } from '../../board/domain/CubeSnapshot.js';
export type { GameSetupSnapshot };

export class GameSetup extends CubeSnapshot implements GameSetupSnapshot {
  constructor(ship1: CubeShipPlacement, ship2: CubeShipPlacement) {
    super(ship1, ship2);

    if (ship1.position.y > 2 || ship2.position.y < CUBE_SIZE - 1) {
      throw new RangeError('Each ship must be placed in its assigned starting zone.');
    }
    Object.freeze(this);
  }
}
