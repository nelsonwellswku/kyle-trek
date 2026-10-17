import type { BoardPoint, BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import type { BoardView } from '../../board/presentation/BoardView.js';
import type { BoardPosition } from '../../board/domain/BoardPosition.js';
import type { BoardSnapshot } from '../../board/domain/BoardSnapshot.js';
import type { PendingMove, TurnSession, TurnSnapshot } from '../domain/TurnSession.js';
import type { TurnControls } from './TurnControls.js';
import type { FlightAnimator, FlightHandle, FlightIdentity } from './FlightAnimator.js';

export interface MovementPointer {
  readonly button: number;
  readonly worldX: number;
  readonly worldY: number;
}

export class MovementController {
  private readyRevision: number | null = null;
  private activeFlight: FlightHandle | null = null;
  private isDisposed = false;

  constructor(
    private readonly session: TurnSession,
    private readonly geometry: BoardGeometry,
    private readonly boardView: BoardView,
    private readonly animator: FlightAnimator,
    private readonly controls: TurnControls,
    private readonly onMovementError: (message: string) => void = () => {},
    private readonly onBoardChanged: (snapshot: BoardSnapshot) => void = () => {},
  ) {
    this.renderSnapshot(this.session.snapshot);
  }

  markReady(gameRevision: number): void {
    if (this.isDisposed || this.session.snapshot.gameRevision !== gameRevision) {
      return;
    }

    this.readyRevision = gameRevision;
    this.renderSnapshot(this.session.snapshot);
  }

  handlePointerDown(pointer: MovementPointer): void {
    if (this.isDisposed || pointer.button !== 0 || this.readyRevision === null) {
      return;
    }

    const snapshot = this.session.snapshot;
    if (snapshot.phase !== 'ready' || snapshot.gameRevision !== this.readyRevision) {
      return;
    }

    const destination = this.geometry.positionAt({ x: pointer.worldX, y: pointer.worldY });
    if (!destination) {
      return;
    }

    const move = this.session.selectDestination(snapshot.turnToken, destination);
    if (!move) {
      return;
    }

    this.renderSnapshot(this.session.snapshot);
    try {
      const handle = this.animator.start(
        move,
        (point) => this.updateFlightPosition(move, point),
        (identity) => this.completeFlight(identity),
        (identity, error) => this.failFlight(identity, error),
      );
      if (this.isCurrentMove(move)) {
        this.activeFlight = handle;
      } else {
        handle.cancel();
      }
    } catch (error) {
      this.failFlight(
        move,
        error instanceof Error ? error : new Error('Movement animation failed.'),
      );
    }
  }

  acknowledgePass(gameRevision: number, turnToken: number): boolean {
    if (this.isDisposed || !this.session.acknowledgePass(gameRevision, turnToken)) {
      return false;
    }

    this.renderSnapshot(this.session.snapshot);
    return true;
  }

  prepareForReplacement(): void {
    if (this.isDisposed) {
      return;
    }

    this.readyRevision = null;
    const flight = this.activeFlight;
    this.activeFlight = null;
    flight?.cancel();
    this.boardView.setHighlights([]);
    this.controls.render(this.session.snapshot);
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.readyRevision = null;
    const flight = this.activeFlight;
    this.activeFlight = null;
    flight?.cancel();
    this.boardView.setHighlights([]);
  }

  private updateFlightPosition(move: PendingMove, point: BoardPoint): void {
    if (!this.isDisposed && this.isCurrentMove(move)) {
      this.boardView.setShipVisualPosition(move.shipIdentity, point);
    }
  }

  private completeFlight(identity: FlightIdentity): void {
    if (this.isDisposed || !this.matchesCurrentMove(identity)) {
      return;
    }

    const snapshot = this.session.snapshot;
    if (snapshot.phase !== 'moving') {
      return;
    }

    const { pendingMove } = snapshot;
    if (!this.session.completeMove(identity.gameRevision, identity.turnToken, identity.moveId)) {
      return;
    }

    this.activeFlight = null;
    this.boardView.setShipPosition(pendingMove.shipIdentity, pendingMove.destination);
    const arrived = this.session.snapshot;
    this.renderSnapshot(arrived);
    if (arrived.phase !== 'disposed') {
      this.onBoardChanged(arrived.game);
    }
  }

  private failFlight(identity: FlightIdentity, error: Error): void {
    if (this.isDisposed || !this.matchesCurrentMove(identity)) {
      return;
    }

    const snapshot = this.session.snapshot;
    if (snapshot.phase !== 'moving') {
      return;
    }

    const { pendingMove } = snapshot;
    if (
      !this.session.recoverFailedMove(identity.gameRevision, identity.turnToken, identity.moveId)
    ) {
      return;
    }

    const flight = this.activeFlight;
    this.activeFlight = null;
    flight?.cancel();
    this.boardView.setShipPosition(pendingMove.shipIdentity, pendingMove.origin);
    this.renderSnapshot(this.session.snapshot);
    this.onMovementError(`Movement failed: ${error.message}`);
  }

  private isCurrentMove(move: PendingMove): boolean {
    return this.matchesCurrentMove(move);
  }

  private matchesCurrentMove(identity: FlightIdentity): boolean {
    const snapshot = this.session.snapshot;
    return (
      snapshot.phase === 'moving' &&
      snapshot.gameRevision === identity.gameRevision &&
      snapshot.turnToken === identity.turnToken &&
      snapshot.pendingMove.moveId === identity.moveId
    );
  }

  private renderSnapshot(snapshot: TurnSnapshot): void {
    if (snapshot.phase === 'disposed') {
      this.boardView.setHighlights([]);
      this.controls.render(snapshot);
      return;
    }

    const highlights: readonly BoardPosition[] =
      snapshot.phase === 'ready'
        ? snapshot.reachability.destinations.map(({ position }) => position)
        : [];
    this.boardView.setHighlights(highlights);
    this.controls.render(snapshot);
  }
}
