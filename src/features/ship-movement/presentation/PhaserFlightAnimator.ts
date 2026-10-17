import Phaser from 'phaser';
import type { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import type { PendingMove } from '../domain/TurnSession.js';
import type {
  FlightAnimator,
  FlightFailureHandler,
  FlightHandle,
  FlightIdentity,
  FlightProgressHandler,
} from './FlightAnimator.js';

export class PhaserFlightAnimator implements FlightAnimator {
  private static readonly millisecondsPerStep = 250;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly geometry: BoardGeometry,
  ) {}

  start(
    move: PendingMove,
    onProgress: FlightProgressHandler,
    onComplete: (identity: FlightIdentity) => void,
    onFailure: FlightFailureHandler,
  ): FlightHandle {
    const identity: FlightIdentity = Object.freeze({
      gameRevision: move.gameRevision,
      turnToken: move.turnToken,
      moveId: move.moveId,
    });
    let settled = false;
    let tween: Phaser.Tweens.Tween | null = null;

    const handle: FlightHandle = {
      identity,
      cancel: () => {
        if (settled) {
          return;
        }

        settled = true;
        const activeTween = tween;
        tween = null;
        activeTween?.stop();
        activeTween?.remove();
      },
    };

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      const activeTween = tween;
      tween = null;
      activeTween?.stop();
      activeTween?.remove();
      onFailure(identity, error);
    };

    try {
      const origin = this.geometry.cellCenter(move.origin);
      const path = new Phaser.Curves.Path(origin.x, origin.y);
      for (const position of move.route.positions.slice(1)) {
        const point = this.geometry.cellCenter(position);
        path.lineTo(point.x, point.y);
      }

      tween = this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: move.route.stepCount * PhaserFlightAnimator.millisecondsPerStep,
        ease: 'Sine.easeInOut',
        onUpdate: (updatedTween) => {
          if (settled) {
            return;
          }

          const progress = updatedTween.getValue();
          if (progress === null || !Number.isFinite(progress)) {
            fail(new Error('Phaser returned an invalid movement progress value.'));
            return;
          }

          const point = path.getPoint(Math.max(0, Math.min(1, progress)));
          if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
            fail(new Error('Phaser could not resolve a point on the movement route.'));
            return;
          }

          onProgress({ x: point.x, y: point.y });
        },
        onComplete: () => {
          if (settled) {
            return;
          }

          const destination = this.geometry.cellCenter(move.destination);
          onProgress(destination);
          settled = true;
          onComplete(identity);
        },
      });
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Movement animation could not start.'));
    }

    return handle;
  }
}
