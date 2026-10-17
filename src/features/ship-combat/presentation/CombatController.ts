import type { BoardPosition } from '../../board/domain/BoardPosition.js';
import type { BoardGeometry, BoardPoint } from '../../board/presentation/BoardGeometry.js';
import type { BoardView } from '../../board/presentation/BoardView.js';
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
    const position = this.geometry.positionAt({ x: pointer.worldX, y: pointer.worldY });
    if (!position) return;

    if (snapshot.phase === 'movement-ready') {
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
      if (!position.equals(target.position)) return;
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

  private updateFlightPosition(move: PendingMove, point: BoardPoint): void {
    if (!this.isDisposed && this.matchesCurrentMove(move)) {
      this.boardView.setShipVisualPosition(move.shipIdentity, point);
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
    const highlights: readonly BoardPosition[] =
      snapshot.phase === 'movement-ready'
        ? snapshot.reachability.destinations.map(({ position }) => position)
        : [];
    this.boardView.setHighlights(highlights);
    this.controls.renderBattle(snapshot);
  }
}
