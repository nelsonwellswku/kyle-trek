import type Phaser from 'phaser';
import type { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import type { PendingAttack } from '../domain/PendingAttack.js';
import type {
  TorpedoAnimator,
  TorpedoCompletionHandler,
  TorpedoFailureHandler,
  TorpedoHandle,
  TorpedoIdentity,
} from './TorpedoAnimator.js';
import { TorpedoPath } from './TorpedoPath.js';

export type TorpedoVisualEvent = 'launch' | 'contact' | 'exit' | 'complete' | 'failure';
export type TorpedoVisualObserver = (
  identity: TorpedoIdentity,
  event: TorpedoVisualEvent,
  timestamp: number,
) => void;

export class PhaserTorpedoAnimator implements TorpedoAnimator {
  private static readonly totalMilliseconds = 1150;
  private static readonly hitTravelMilliseconds = 850;
  private static readonly hitExplosionMilliseconds = 300;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly geometry: BoardGeometry,
    private readonly observe: TorpedoVisualObserver = () => {},
  ) {}

  start(
    attack: PendingAttack,
    onComplete: TorpedoCompletionHandler,
    onFailure: TorpedoFailureHandler,
  ): TorpedoHandle {
    const identity = Object.freeze({
      gameRevision: attack.gameRevision,
      turnToken: attack.turnToken,
      attackId: attack.attackId,
    });
    const path = new TorpedoPath(
      attack.attackerPosition,
      attack.defenderPosition,
      attack.outcome.kind,
      this.geometry,
    );
    const scale = this.geometry.logicalSize / 10 / 60;
    let settled = false;
    let explosionCreated = false;
    let exitReported = false;
    let star: Phaser.GameObjects.Star | null = null;
    let explosion: Phaser.GameObjects.Arc | null = null;
    let tween: Phaser.Tweens.Tween | null = null;

    const destroyStar = (): void => {
      const activeStar = star;
      star = null;
      activeStar?.destroy();
    };
    const destroyExplosion = (): void => {
      const activeExplosion = explosion;
      explosion = null;
      activeExplosion?.destroy();
    };
    const cleanup = (): void => {
      destroyStar();
      destroyExplosion();
    };
    const stopTween = (): void => {
      const activeTween = tween;
      tween = null;
      activeTween?.stop();
      activeTween?.remove();
    };
    const handle: TorpedoHandle = {
      identity,
      cancel: () => {
        if (settled) return;
        settled = true;
        stopTween();
        cleanup();
      },
    };
    const report = (event: TorpedoVisualEvent): void => {
      try {
        this.observe(identity, event, performance.now());
      } catch {
        // Instrumentation must not change gameplay or animation outcomes.
      }
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      stopTween();
      cleanup();
      report('failure');
      onFailure(identity, error);
    };
    const createExplosion = (): void => {
      if (explosionCreated) return;
      explosionCreated = true;
      const contact = path.end;
      explosion = this.scene.add.circle(
        contact.x,
        contact.y,
        this.geometry.visualEnvelopeRadius(),
        0xffa742,
      );
      explosion.setScale(0.2);
      explosion.setAlpha(1);
      destroyStar();
      report('contact');
    };

    try {
      report('launch');
      star = this.scene.add.star(path.start.x, path.start.y, 4, 1.5 * scale, 3 * scale, 0xffffff);
      const createdTween = this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: PhaserTorpedoAnimator.totalMilliseconds,
        ease: 'Linear',
        onUpdate: (updatedTween) => {
          if (settled) return;
          const value = updatedTween.getValue();
          if (value === null || !Number.isFinite(value)) {
            fail(new Error('Phaser returned an invalid torpedo progress value.'));
            return;
          }

          const progress = Math.max(0, Math.min(1, value));
          const elapsed = progress * PhaserTorpedoAnimator.totalMilliseconds;
          star?.setAlpha(0.5 + 0.5 * Math.sin((2 * Math.PI * 2 * elapsed) / 1000));

          if (attack.outcome.kind === 'hit') {
            const travelProgress = Math.min(
              1,
              elapsed / PhaserTorpedoAnimator.hitTravelMilliseconds,
            );
            const point = path.pointAt(travelProgress);
            star?.setPosition(point.x, point.y);
            if (elapsed >= PhaserTorpedoAnimator.hitTravelMilliseconds) {
              createExplosion();
              const explosionProgress = Math.min(
                1,
                Math.max(0, elapsed - PhaserTorpedoAnimator.hitTravelMilliseconds) /
                  PhaserTorpedoAnimator.hitExplosionMilliseconds,
              );
              explosion?.setScale(0.2 + 1.8 * explosionProgress);
              explosion?.setAlpha(1 - explosionProgress);
            }
          } else {
            const point = path.pointAt(progress);
            star?.setPosition(point.x, point.y);
            if (progress >= 1 && !exitReported) {
              exitReported = true;
              report('exit');
            }
          }
        },
        onComplete: () => {
          if (settled) return;
          if (attack.outcome.kind === 'hit') {
            createExplosion();
          } else {
            const exit = path.end;
            star?.setPosition(exit.x, exit.y);
            if (!exitReported) {
              exitReported = true;
              report('exit');
            }
          }
          settled = true;
          stopTween();
          cleanup();
          report('complete');
          onComplete(identity);
        },
      });
      if (settled) {
        createdTween.stop();
        createdTween.remove();
      } else {
        tween = createdTween;
      }
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Torpedo animation could not start.'));
    }

    return handle;
  }
}
