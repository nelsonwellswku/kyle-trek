import { BoardSnapshot, type ShipPlacement } from '../../board/domain/BoardSnapshot.js';
import type { BoardSnapshot as GameSetupSnapshot } from '../../board/domain/BoardSnapshot.js';

export type { ShipIdentity, ShipPlacement } from '../../board/domain/BoardSnapshot.js';
export type { GameSetupSnapshot };

export class GameSetup extends BoardSnapshot implements GameSetupSnapshot {
  constructor(ship1: ShipPlacement, ship2: ShipPlacement) {
    super(ship1, ship2);

    if (ship1.position.row > 2 || ship2.position.row < 9) {
      throw new RangeError('Each ship must be placed in its assigned starting zone.');
    }
  }
}
