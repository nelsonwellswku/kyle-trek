import type { PendingAttack } from '../../domain/PendingAttack.js';
import type {
  TorpedoAnimator,
  TorpedoCompletionHandler,
  TorpedoFailureHandler,
  TorpedoHandle,
  TorpedoIdentity,
} from '../../presentation/TorpedoAnimator.js';

export interface ControlledTorpedoAnimatorOptions {
  readonly completeSynchronously?: boolean;
  readonly failSynchronously?: Error;
  readonly throwOnStart?: Error;
}

export interface ControlledTorpedo extends TorpedoHandle {
  readonly attack: PendingAttack;
  readonly completed: boolean;
  readonly failed: boolean;
  readonly cancelled: boolean;
  complete(): void;
  fail(error: Error): void;
  deliverLateCompletion(): void;
  deliverLateFailure(error: Error): void;
}

class ControlledTorpedoHandle implements ControlledTorpedo {
  private hasCompleted = false;
  private hasFailed = false;
  private hasCancelled = false;

  constructor(
    readonly attack: PendingAttack,
    readonly identity: TorpedoIdentity,
    private readonly onComplete: TorpedoCompletionHandler,
    private readonly onFailure: TorpedoFailureHandler,
  ) {}

  get completed(): boolean {
    return this.hasCompleted;
  }

  get failed(): boolean {
    return this.hasFailed;
  }

  get cancelled(): boolean {
    return this.hasCancelled;
  }

  complete(): void {
    if (this.isSettled()) return;
    this.hasCompleted = true;
    this.onComplete(this.identity);
  }

  fail(error: Error): void {
    if (this.isSettled()) return;
    this.hasFailed = true;
    this.onFailure(this.identity, error);
  }

  cancel(): void {
    if (this.isSettled()) return;
    this.hasCancelled = true;
  }

  deliverLateCompletion(): void {
    this.onComplete(this.identity);
  }

  deliverLateFailure(error: Error): void {
    this.onFailure(this.identity, error);
  }

  private isSettled(): boolean {
    return this.hasCompleted || this.hasFailed || this.hasCancelled;
  }
}

export class ControlledTorpedoAnimator implements TorpedoAnimator {
  readonly startedAttacks: ControlledTorpedo[] = [];

  constructor(private readonly options: ControlledTorpedoAnimatorOptions = {}) {}

  get completedAttacks(): readonly ControlledTorpedo[] {
    return this.startedAttacks.filter((attack) => attack.completed);
  }

  get failedAttacks(): readonly ControlledTorpedo[] {
    return this.startedAttacks.filter((attack) => attack.failed);
  }

  get cancelledAttacks(): readonly ControlledTorpedo[] {
    return this.startedAttacks.filter((attack) => attack.cancelled);
  }

  start(
    attack: PendingAttack,
    onComplete: TorpedoCompletionHandler,
    onFailure: TorpedoFailureHandler,
  ): ControlledTorpedo {
    if (this.options.throwOnStart) throw this.options.throwOnStart;

    const controlled = new ControlledTorpedoHandle(
      attack,
      Object.freeze({
        gameRevision: attack.gameRevision,
        turnToken: attack.turnToken,
        attackId: attack.attackId,
      }),
      onComplete,
      onFailure,
    );
    this.startedAttacks.push(controlled);

    if (this.options.failSynchronously) {
      controlled.fail(this.options.failSynchronously);
    } else if (this.options.completeSynchronously) {
      controlled.complete();
    }

    return controlled;
  }
}
