import type { BoardPosition } from '../../board/domain/BoardPosition.js';
import type { ShipIdentity } from '../../board/domain/BoardSnapshot.js';
import type { LegalRoute } from './Reachability.js';

export interface PendingMove {
  readonly gameRevision: number;
  readonly turnToken: number;
  readonly moveId: number;
  readonly shipIdentity: ShipIdentity;
  readonly origin: BoardPosition;
  readonly destination: BoardPosition;
  readonly otherShipPosition: BoardPosition;
  readonly route: LegalRoute;
}
