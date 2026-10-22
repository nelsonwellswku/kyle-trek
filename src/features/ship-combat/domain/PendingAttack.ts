import type { CubePosition } from '../../board/domain/CubePosition.js';
import type { AttackOutcome } from './AttackResolver.js';
import type { ShipIdentity } from '../../board/domain/CubeSnapshot.js';

export interface PendingAttack {
  readonly gameRevision: number;
  readonly turnToken: number;
  readonly attackId: number;
  readonly attackerIdentity: ShipIdentity;
  readonly defenderIdentity: ShipIdentity;
  readonly attackerPosition: CubePosition;
  readonly defenderPosition: CubePosition;
  readonly outcome: AttackOutcome;
}
