import type {
  ScreenPoint,
  CubeScreenGeometry,
} from '../../board/presentation/CubeScreenGeometry.js';
import type { PhaserCubeProjectionView } from '../../board/presentation/PhaserCubeProjectionView.js';
import { CUBE_SIZE, CubePosition } from '../../board/domain/CubePosition.js';
import type { CubeSnapshot } from '../../board/domain/CubeSnapshot.js';
import type { ShipIdentity } from '../../board/domain/CubeSnapshot.js';
import type { MovementGame } from '../domain/MovementGame.js';
import type { PendingMove, TurnSession, TurnSnapshot } from '../domain/TurnSession.js';
import type { TurnControls } from './TurnControls.js';
import type { FlightAnimator, FlightHandle, FlightIdentity } from './FlightAnimator.js';
import type { CubeWorldPoint } from './CubeFlightPath.js';
import type { CubePickTarget } from '../../board/presentation/CubePicker.js';

export interface MovementPointer {
  readonly button: number;
  readonly worldX: number;
  readonly worldY: number;
}

export interface MovementCubeViewPort {
  render(game: CubeSnapshot): void;
  setHighlights(destinations: readonly CubePosition[]): void;
  setShipPosition(identity: ShipIdentity, position: CubePosition): void;
  setShipVisualPosition(identity: ShipIdentity, point: CubeWorldPoint): void;
}

export class MovementController {
  private readyRevision: number | null = null;
  private activeFlight: FlightHandle | null = null;
  private isDisposed = false;

  constructor(
    private readonly session: TurnSession,
    private readonly geometry: CubeScreenGeometry,
    private readonly boardView: PhaserCubeProjectionView,
    private readonly animator: FlightAnimator,
    private readonly controls: TurnControls,
    private readonly onMovementError: (message: string) => void = () => {},
    private readonly onBoardChanged: (snapshot: CubeSnapshot) => void = () => {},
    private readonly cubeView?: MovementCubeViewPort,
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

    const activePosition = this.shipPosition(snapshot.activeShip, snapshot.game);
    const destination = this.geometry.positionAt(
      { x: pointer.worldX, y: pointer.worldY },
      activePosition.z,
    );
    if (!destination) {
      return;
    }

    this.handlePickTarget({ type: 'cell', position: destination });
  }

  handlePickTarget(target: CubePickTarget | null): void {
    if (
      this.isDisposed ||
      this.readyRevision === null ||
      target === null ||
      target.type !== 'cell'
    ) {
      return;
    }
    const snapshot = this.session.snapshot;
    if (snapshot.phase !== 'ready' || snapshot.gameRevision !== this.readyRevision) return;

    const move = this.session.selectDestination(snapshot.turnToken, target.position);
    if (!move) {
      return;
    }

    this.renderSnapshot(this.session.snapshot);
    this.startFlight(move);
  }

  private startFlight(move: PendingMove): void {
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
    this.cubeView?.setHighlights([]);
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
    this.cubeView?.setHighlights([]);
  }

  private updateFlightPosition(move: PendingMove, point: CubeWorldPoint): void {
    if (!this.isDisposed && this.isCurrentMove(move)) {
      if (this.cubeView) {
        this.cubeView.setShipVisualPosition(move.shipIdentity, point);
      } else {
        const center = (CUBE_SIZE + 1) / 2;
        const projected: ScreenPoint = {
          x: ((point.x + center) / CUBE_SIZE) * this.geometry.logicalSize,
          y: ((point.y + center) / CUBE_SIZE) * this.geometry.logicalSize,
        };
        this.boardView.setShipVisualPosition(move.shipIdentity, projected);
      }
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
    this.cubeView?.setShipPosition(pendingMove.shipIdentity, pendingMove.destination);
    if (!this.cubeView)
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
    this.cubeView?.setShipPosition(pendingMove.shipIdentity, pendingMove.origin);
    if (!this.cubeView)
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

    const highlights: readonly CubePosition[] =
      snapshot.phase === 'ready'
        ? snapshot.reachability.destinations.map(({ position }) => position)
        : [];
    this.boardView.setHighlights(highlights);
    this.cubeView?.setHighlights(highlights);
    this.cubeView?.render(snapshot.game);
    this.controls.render(snapshot);
  }

  private shipPosition(identity: ShipIdentity, game: MovementGame): CubePosition {
    return identity === 'ship-1' ? game.ship1.position : game.ship2.position;
  }
}
