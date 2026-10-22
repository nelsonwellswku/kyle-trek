import {
  CubeOrientation,
  type CubeAxis,
  type QuarterTurn,
} from '../../board/domain/CubeOrientation.js';
import type { ShipIdentity } from '../../board/domain/CubeSnapshot.js';

export interface RotationIdentity {
  readonly gameRevision: number;
  readonly turnToken: number;
  readonly rotationId: number;
}

/** Immutable description of a visual rotation authorized by the current battle turn. */
export class PendingRotation {
  readonly identity: RotationIdentity;

  constructor(
    readonly gameRevision: number,
    readonly turnToken: number,
    readonly rotationId: number,
    readonly shipIdentity: ShipIdentity,
    readonly axis: CubeAxis,
    readonly direction: QuarterTurn,
    readonly previousOrientation: CubeOrientation,
    readonly targetOrientation: CubeOrientation,
    readonly resumePhase: 'movement-ready' | 'awaiting-movement-skip' | 'attack-ready',
  ) {
    if (
      !Number.isSafeInteger(gameRevision) ||
      gameRevision < 1 ||
      !Number.isSafeInteger(turnToken) ||
      turnToken < 1 ||
      !Number.isSafeInteger(rotationId) ||
      rotationId < 1 ||
      (shipIdentity !== 'ship-1' && shipIdentity !== 'ship-2') ||
      !['x', 'y', 'z'].includes(axis) ||
      (direction !== -1 && direction !== 1) ||
      !(previousOrientation instanceof CubeOrientation) ||
      !(targetOrientation instanceof CubeOrientation) ||
      !['movement-ready', 'awaiting-movement-skip', 'attack-ready'].includes(resumePhase)
    ) {
      throw new RangeError('A pending rotation requires a complete valid action identity.');
    }
    this.identity = Object.freeze({ gameRevision, turnToken, rotationId });
    Object.freeze(this);
  }
}
