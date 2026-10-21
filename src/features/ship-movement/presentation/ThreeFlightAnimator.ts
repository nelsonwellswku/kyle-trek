import type { PendingMove } from '../domain/PendingMove.js';
import type {
  FlightAnimator,
  FlightFailureHandler,
  FlightHandle,
  FlightIdentity,
  FlightProgressHandler,
} from './FlightAnimator.js';
import { CubeFlightPath } from './CubeFlightPath.js';
import { CubePosition } from '../../board/domain/CubePosition.js';

export interface FlightFrameScheduler {
  now(): number;
  request(callback: (timestamp: number) => void): number;
  cancel(frameId: number): void;
}

export class ThreeFlightAnimator implements FlightAnimator {
  private static readonly millisecondsPerStep = 250;

  constructor(
    private readonly scheduler: FlightFrameScheduler = ThreeFlightAnimator.browserScheduler(),
  ) {}

  start(
    move: PendingMove,
    onProgress: FlightProgressHandler,
    onComplete: (identity: FlightIdentity) => void,
    onFailure: FlightFailureHandler,
  ): FlightHandle {
    const identity = Object.freeze({
      gameRevision: move.gameRevision,
      turnToken: move.turnToken,
      moveId: move.moveId,
    });
    let settled = false;
    let frameId: number | null = null;
    const cancelFrame = (): void => {
      if (frameId === null) return;
      const activeFrame = frameId;
      frameId = null;
      try {
        this.scheduler.cancel(activeFrame);
      } catch {
        // Cancellation is best effort; the settled guard rejects a late frame.
      }
    };
    const handle: FlightHandle = {
      identity,
      cancel: () => {
        if (settled) return;
        settled = true;
        cancelFrame();
      },
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cancelFrame();
      onFailure(identity, error);
    };

    try {
      if (
        move.route.stepCount < 1 ||
        move.route.stepCount > 5 ||
        !move.route.positions[0]?.equals(move.origin) ||
        !move.route.positions.at(-1)?.equals(move.destination)
      ) {
        throw new RangeError('A flight requires a valid route from its origin to destination.');
      }
      const obstacle = move.otherShipPosition;
      if (!(obstacle instanceof CubePosition)) {
        throw new RangeError('A flight requires the opposing ship cube position.');
      }
      const path = new CubeFlightPath(move.route, obstacle);
      const duration = move.route.stepCount * ThreeFlightAnimator.millisecondsPerStep;
      const startTime = this.scheduler.now();
      if (!Number.isFinite(startTime))
        throw new Error('The animation clock returned an invalid time.');

      const animate = (timestamp: number): void => {
        frameId = null;
        if (settled) return;
        try {
          if (!Number.isFinite(timestamp)) throw new Error('The animation frame time is invalid.');
          const elapsed = Math.max(0, timestamp - startTime);
          const progress = Math.min(1, elapsed / duration);
          onProgress(path.pointAt(progress));
          if (progress >= 1) {
            settled = true;
            onComplete(identity);
            return;
          }
          frameId = this.scheduler.request(animate);
        } catch (error) {
          fail(error instanceof Error ? error : new Error('Three.js movement animation failed.'));
        }
      };

      frameId = this.scheduler.request(animate);
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Three.js movement animation failed.'));
    }

    return handle;
  }

  private static browserScheduler(): FlightFrameScheduler {
    return {
      now: () => performance.now(),
      request: (callback) => {
        if (typeof requestAnimationFrame !== 'function') {
          throw new Error('Animation frames are unavailable in this environment.');
        }
        return requestAnimationFrame(callback);
      },
      cancel: (frameId) => cancelAnimationFrame(frameId),
    };
  }
}
