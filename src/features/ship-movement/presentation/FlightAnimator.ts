import type { PendingMove } from '../domain/PendingMove.js';
import type { CubeWorldPoint } from './CubeFlightPath.js';

export interface FlightIdentity {
  readonly gameRevision: number;
  readonly turnToken: number;
  readonly moveId: number;
}

export interface FlightHandle {
  readonly identity: FlightIdentity;
  cancel(): void;
}

export type FlightProgressHandler = (point: CubeWorldPoint) => void;
export type FlightCompletionHandler = (identity: FlightIdentity) => void;
export type FlightFailureHandler = (identity: FlightIdentity, error: Error) => void;

export interface FlightAnimator {
  start(
    move: PendingMove,
    onProgress: FlightProgressHandler,
    onComplete: FlightCompletionHandler,
    onFailure: FlightFailureHandler,
  ): FlightHandle;
}
