import type { CubePosition } from '../../board/domain/CubePosition.js';
import type { ShipIdentity } from '../../board/domain/CubeSnapshot.js';
import type { LegalRoute } from './Reachability.js';

export interface PendingMove {
  readonly gameRevision: number;
  readonly turnToken: number;
  readonly moveId: number;
  readonly shipIdentity: ShipIdentity;
  readonly origin: CubePosition;
  readonly destination: CubePosition;
  readonly otherShipPosition: CubePosition;
  readonly route: LegalRoute;
}
