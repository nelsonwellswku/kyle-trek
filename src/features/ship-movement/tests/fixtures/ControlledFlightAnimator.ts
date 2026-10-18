import type { PendingMove } from '../../domain/TurnSession.js';
import type {
  FlightAnimator,
  FlightCompletionHandler,
  FlightFailureHandler,
  FlightIdentity,
  FlightProgressHandler,
  FlightHandle,
} from '../../presentation/FlightAnimator.js';

export interface ControlledFlight extends FlightHandle {
  readonly move: PendingMove;
  readonly identity: FlightIdentity;
  readonly completed: boolean;
  readonly cancelled: boolean;
  readonly failed: boolean;
  update(point: { readonly x: number; readonly y: number }): void;
  complete(): void;
  fail(error: Error): void;
  cancel(): void;
}

export class ControlledFlightAnimator implements FlightAnimator {
  readonly startedFlights: ControlledFlight[] = [];

  get completedFlights(): readonly ControlledFlight[] {
    return this.startedFlights.filter((flight) => flight.completed);
  }

  get cancelledFlights(): readonly ControlledFlight[] {
    return this.startedFlights.filter((flight) => flight.cancelled);
  }

  start(
    move: PendingMove,
    onProgress: FlightProgressHandler,
    onComplete: FlightCompletionHandler,
    onFailure: FlightFailureHandler,
  ): ControlledFlight {
    let completed = false;
    let cancelled = false;
    let failed = false;
    const flight: ControlledFlight = {
      move,
      identity: Object.freeze({
        gameRevision: move.gameRevision,
        turnToken: move.turnToken,
        moveId: move.moveId,
      }),
      get completed() {
        return completed;
      },
      get cancelled() {
        return cancelled;
      },
      get failed() {
        return failed;
      },
      update(point) {
        if (!completed && !cancelled && !failed) {
          onProgress(point);
        }
      },
      complete() {
        if (completed || cancelled || failed) {
          return;
        }

        completed = true;
        onComplete(flight.identity);
      },
      fail(error) {
        if (completed || cancelled || failed) {
          return;
        }

        failed = true;
        onFailure(flight.identity, error);
      },
      cancel() {
        if (completed || cancelled || failed) {
          return;
        }

        cancelled = true;
      },
    };

    this.startedFlights.push(flight);
    return flight;
  }
}
