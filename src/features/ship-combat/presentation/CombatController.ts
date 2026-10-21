import { CubePosition } from '../../board/domain/CubePosition.js';
import type { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import type { BoardView } from '../../board/presentation/BoardView.js';
import type { CubePickTarget } from '../../board/presentation/CubePicker.js';
import type { CubeWorldPoint } from '../../ship-movement/presentation/CubeFlightPath.js';
import type { BattleSession, BattleSnapshot, AttackingSnapshot } from '../domain/BattleSession.js';
import type { CombatGame } from '../domain/CombatGame.js';
import type { PendingMove } from '../../ship-movement/domain/PendingMove.js';
import type {
  FlightAnimator,
  FlightHandle,
  FlightIdentity,
} from '../../ship-movement/presentation/FlightAnimator.js';
import type { CombatControls } from './CombatControls.js';
import type { TorpedoAnimator, TorpedoHandle, TorpedoIdentity } from './TorpedoAnimator.js';

export interface CombatPointer {
  readonly button: number;
  readonly worldX: number;
  readonly worldY: number;
}

export interface CombatCubeViewPort {
  setHighlights(destinations: readonly CubePosition[]): void;
  setShipPosition(identity: 'ship-1' | 'ship-2', position: CubePosition): void;
  setShipVisualPosition(identity: 'ship-1' | 'ship-2', point: CubeWorldPoint): void;
}

export class CombatController {
  private readyRevision: number | null = null;
  private activeFlight: FlightHandle | null = null;
  private activeTorpedo: TorpedoHandle | null = null;
  private isDisposed = false;

  constructor(
    private readonly session: BattleSession,
    private readonly geometry: BoardGeometry,
    private readonly boardView: BoardView,
    private readonly flightAnimator: FlightAnimator,
    private readonly torpedoAnimator: TorpedoAnimator,
    private readonly controls: CombatControls,
    private readonly onMovementError: (message: string) => void = () => {},
    private readonly onAttackError: (message: string) => void = () => {},
    private readonly onBoardChanged: (game: CombatGame) => void = () => {},
    private readonly cubeView?: CombatCubeViewPort,
  ) {
    this.controls.setActionHandlers(
      (gameRevision, turnToken) => this.acknowledgeMovementSkip(gameRevision, turnToken),
      (gameRevision, turnToken) => this.endTurn(gameRevision, turnToken),
    );
    this.renderSnapshot(this.session.snapshot);
  }

  markReady(gameRevision: number): void {
    if (this.isDisposed || this.session.snapshot.gameRevision !== gameRevision) return;
    this.readyRevision = gameRevision;
    this.renderSnapshot(this.session.snapshot);
  }

  handlePointerDown(pointer: CombatPointer): void {
    if (this.isDisposed || pointer.button !== 0 || this.readyRevision === null) return;
    const snapshot = this.session.snapshot;
    if (snapshot.phase === 'disposed' || snapshot.gameRevision !== this.readyRevision) return;
    const boardPosition = this.geometry.positionAt({ x: pointer.worldX, y: pointer.worldY });
    if (!boardPosition) return;

    if (snapshot.phase === 'movement-ready') {
      const position = new CubePosition(
        boardPosition.column,
        boardPosition.row,
        this.shipPosition(snapshot.activeShip, snapshot.game).z,
      );
      const move = this.session.selectDestination(
        snapshot.gameRevision,
        snapshot.turnToken,
        position,
      );
      if (!move) return;
      this.renderSnapshot(this.session.snapshot);
      this.startFlight(move);
      return;
    }

    if (snapshot.phase === 'attack-ready') {
      const target = snapshot.activeShip === 'ship-1' ? snapshot.game.ship2 : snapshot.game.ship1;
      if (!target.position.equals(boardPosition)) return;
      const attack = this.session.selectAttack(
        snapshot.gameRevision,
        snapshot.turnToken,
        target.identity,
      );
      if (!attack) return;
      this.renderSnapshot(this.session.snapshot);
      this.startTorpedo(attack);
    }
  }

  handlePickTarget(target: CubePickTarget | null): void {
    if (this.isDisposed || this.readyRevision === null || target === null) return;
    const snapshot = this.session.snapshot;
    if (snapshot.phase === 'disposed' || snapshot.gameRevision !== this.readyRevision) return;

    if (target.type === 'cell') {
      if (snapshot.phase !== 'movement-ready') return;
      const move = this.session.selectDestination(
        snapshot.gameRevision,
        snapshot.turnToken,
        target.position,
      );
      if (!move) return;
      this.renderSnapshot(this.session.snapshot);
      this.startFlight(move);
      return;
    }

    if (snapshot.phase !== 'attack-ready') return;
    const expectedTarget = snapshot.activeShip === 'ship-1' ? 'ship-2' : 'ship-1';
    if (target.identity !== expectedTarget) return;
    const attack = this.session.selectAttack(
      snapshot.gameRevision,
      snapshot.turnToken,
      target.identity,
    );
    if (!attack) return;
    this.renderSnapshot(this.session.snapshot);
    this.startTorpedo(attack);
  }

  acknowledgeMovementSkip(gameRevision: number, turnToken: number): boolean {
    if (
      this.isDisposed ||
      this.readyRevision !== gameRevision ||
      !this.session.acknowledgeMovementSkip(gameRevision, turnToken)
    ) {
      return false;
    }
    this.renderSnapshot(this.session.snapshot);
    return true;
  }

  endTurn(gameRevision: number, turnToken: number): boolean {
    if (
      this.isDisposed ||
      this.readyRevision !== gameRevision ||
      !this.session.endTurn(gameRevision, turnToken)
    ) {
      return false;
    }
    this.renderSnapshot(this.session.snapshot);
    return true;
  }

  prepareForReplacement(): void {
    if (this.isDisposed) return;
    this.readyRevision = null;
    const flight = this.activeFlight;
    const torpedo = this.activeTorpedo;
    this.activeFlight = null;
    this.activeTorpedo = null;
    flight?.cancel();
    torpedo?.cancel();
    this.boardView.setHighlights([]);
    this.cubeView?.setHighlights([]);
    this.renderSnapshot(this.session.snapshot);
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.readyRevision = null;
    const flight = this.activeFlight;
    const torpedo = this.activeTorpedo;
    this.activeFlight = null;
    this.activeTorpedo = null;
    flight?.cancel();
    torpedo?.cancel();
    this.boardView.setHighlights([]);
    this.cubeView?.setHighlights([]);
  }

  private startFlight(move: PendingMove): void {
    try {
      const handle = this.flightAnimator.start(
        move,
        (point) => this.updateFlightPosition(move, point),
        (identity) => this.completeFlight(identity),
        (identity, error) => this.failFlight(identity, error),
      );
      if (this.matchesCurrentMove(move)) {
        this.activeFlight = handle;
      } else {
        handle.cancel();
      }
    } catch (error) {
      this.failFlight(
        move,
        error instanceof Error ? error : new Error('Movement animation failed to start.'),
      );
    }
  }

  private startTorpedo(attack: AttackingSnapshot['pendingAttack']): void {
    try {
      const handle = this.torpedoAnimator.start(
        attack,
        (identity) => this.completeTorpedo(identity),
        (identity, error) => this.failTorpedo(identity, error),
      );
      if (this.matchesCurrentAttack(attack)) {
        this.activeTorpedo = handle;
      } else {
        handle.cancel();
      }
    } catch (error) {
      this.failTorpedo(
        attack,
        error instanceof Error ? error : new Error('Torpedo animation failed to start.'),
      );
    }
  }

  private updateFlightPosition(move: PendingMove, point: CubeWorldPoint): void {
    if (!this.isDisposed && this.matchesCurrentMove(move)) {
      if (this.cubeView) {
        this.cubeView.setShipVisualPosition(move.shipIdentity, point);
      } else {
        this.boardView.setShipVisualPosition(move.shipIdentity, {
          x: ((point.x + 5.5) / 10) * this.geometry.logicalSize,
          y: ((point.y + 5.5) / 10) * this.geometry.logicalSize,
        });
      }
    }
  }

  private completeFlight(identity: FlightIdentity): void {
    if (this.isDisposed || !this.matchesCurrentMove(identity)) return;
    const snapshot = this.session.snapshot;
    if (snapshot.phase !== 'moving') return;
    const pendingMove = snapshot.pendingMove;
    if (!this.session.completeMove(identity.gameRevision, identity.turnToken, identity.moveId)) {
      return;
    }

    this.activeFlight = null;
    this.cubeView?.setShipPosition(pendingMove.shipIdentity, pendingMove.destination);
    if (!this.cubeView)
      this.boardView.setShipPosition(pendingMove.shipIdentity, pendingMove.destination);
    const arrived = this.session.snapshot;
    this.renderSnapshot(arrived);
    if (arrived.phase !== 'disposed') this.onBoardChanged(arrived.game);
  }

  private failFlight(identity: FlightIdentity, error: Error): void {
    if (this.isDisposed || !this.matchesCurrentMove(identity)) return;
    const snapshot = this.session.snapshot;
    if (snapshot.phase !== 'moving') return;
    const { pendingMove } = snapshot;
    if (
      !this.session.recoverFailedMove(identity.gameRevision, identity.turnToken, identity.moveId)
    ) {
      return;
    }

    const activeFlight = this.activeFlight;
    this.activeFlight = null;
    activeFlight?.cancel();
    this.cubeView?.setShipPosition(pendingMove.shipIdentity, pendingMove.origin);
    if (!this.cubeView)
      this.boardView.setShipPosition(pendingMove.shipIdentity, pendingMove.origin);
    this.renderSnapshot(this.session.snapshot);
    this.onMovementError(`Movement failed: ${error.message}`);
  }

  private completeTorpedo(identity: TorpedoIdentity): void {
    if (this.isDisposed || !this.matchesCurrentAttack(identity)) return;
    if (
      !this.session.completeAttack(identity.gameRevision, identity.turnToken, identity.attackId)
    ) {
      return;
    }

    this.activeTorpedo = null;
    this.renderSnapshot(this.session.snapshot);
  }

  private failTorpedo(identity: TorpedoIdentity, error: Error): void {
    if (this.isDisposed || !this.matchesCurrentAttack(identity)) return;
    const current = this.session.snapshot;
    if (current.phase !== 'attacking') return;
    const activeTorpedo = this.activeTorpedo;
    this.activeTorpedo = null;
    activeTorpedo?.cancel();
    this.onAttackError(`Attack animation failed: ${error.message}`);
    if (
      !this.session.completeAttack(identity.gameRevision, identity.turnToken, identity.attackId)
    ) {
      return;
    }
    this.renderSnapshot(this.session.snapshot);
  }

  private matchesCurrentMove(move: PendingMove | FlightIdentity): boolean {
    const snapshot = this.session.snapshot;
    return (
      this.readyRevision === move.gameRevision &&
      snapshot.phase === 'moving' &&
      snapshot.gameRevision === move.gameRevision &&
      snapshot.turnToken === move.turnToken &&
      snapshot.pendingMove.moveId === move.moveId
    );
  }

  private matchesCurrentAttack(
    attack: AttackingSnapshot['pendingAttack'] | TorpedoIdentity,
  ): boolean {
    const snapshot = this.session.snapshot;
    return (
      this.readyRevision === attack.gameRevision &&
      snapshot.phase === 'attacking' &&
      snapshot.gameRevision === attack.gameRevision &&
      snapshot.turnToken === attack.turnToken &&
      snapshot.pendingAttack.attackId === attack.attackId
    );
  }

  private renderSnapshot(snapshot: BattleSnapshot): void {
    const highlights: readonly CubePosition[] =
      snapshot.phase === 'movement-ready'
        ? snapshot.reachability.destinations.map(({ position }) => position)
        : [];
    this.boardView.setHighlights(highlights);
    this.cubeView?.setHighlights(highlights);
    const boardReady =
      !this.isDisposed &&
      snapshot.phase !== 'disposed' &&
      this.readyRevision === snapshot.gameRevision;
    this.controls.renderBattle(snapshot, boardReady);
  }

  private shipPosition(identity: 'ship-1' | 'ship-2', game: CombatGame): CubePosition {
    return identity === 'ship-1' ? game.ship1.position : game.ship2.position;
  }
}
