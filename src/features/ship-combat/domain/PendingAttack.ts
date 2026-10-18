import type { BoardPosition } from '../../board/domain/BoardPosition.js';
import type { AttackOutcome } from './AttackResolver.js';
import type { ShipIdentity } from '../../board/domain/BoardSnapshot.js';

export interface PendingAttack {
  readonly gameRevision: number;
  readonly turnToken: number;
  readonly attackId: number;
  readonly attackerIdentity: ShipIdentity;
  readonly defenderIdentity: ShipIdentity;
  readonly attackerPosition: BoardPosition;
  readonly defenderPosition: BoardPosition;
  readonly outcome: AttackOutcome;
}
