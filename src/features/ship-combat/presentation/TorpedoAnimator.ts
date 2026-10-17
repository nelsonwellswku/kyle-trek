import type { PendingAttack } from '../domain/PendingAttack.js';

export interface TorpedoIdentity {
  readonly gameRevision: number;
  readonly turnToken: number;
  readonly attackId: number;
}

export interface TorpedoHandle {
  readonly identity: TorpedoIdentity;
  cancel(): void;
}

export type TorpedoCompletionHandler = (identity: TorpedoIdentity) => void;
export type TorpedoFailureHandler = (identity: TorpedoIdentity, error: Error) => void;

export interface TorpedoAnimator {
  start(
    attack: PendingAttack,
    onComplete: TorpedoCompletionHandler,
    onFailure: TorpedoFailureHandler,
  ): TorpedoHandle;
}
