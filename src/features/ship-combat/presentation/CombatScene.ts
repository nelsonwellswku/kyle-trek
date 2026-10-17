import Phaser from 'phaser';
import type { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import type { RandomSource } from '../../game-setup/domain/RandomSource.js';
import type { CombatGame } from '../domain/CombatGame.js';
import { BattleSession } from '../domain/BattleSession.js';
import type { BattleSnapshot } from '../domain/BattleSession.js';
import type { FlightAnimator } from '../../ship-movement/presentation/FlightAnimator.js';
import { PhaserFlightAnimator } from '../../ship-movement/presentation/PhaserFlightAnimator.js';
import type { TorpedoAnimator } from './TorpedoAnimator.js';
import { PhaserTorpedoAnimator, type TorpedoVisualObserver } from './PhaserTorpedoAnimator.js';
import type { CombatControls } from './CombatControls.js';
import { BoardView } from '../../board/presentation/BoardView.js';
import { CombatController } from './CombatController.js';

export type CombatSceneReadyHandler = (revision: number) => void;

/** Phaser requires Scene inheritance for lifecycle/input; combat behavior remains composed. */
export class CombatScene extends Phaser.Scene {
  private boardView: BoardView | null = null;
  private controller: CombatController | null = null;
  private isListeningForPointer = false;
  private isCreated = false;
  private isDisposed = false;

  constructor(
    private readonly session: BattleSession,
    private readonly geometry: BoardGeometry,
    private readonly controls: CombatControls,
    private readonly onDrawn: CombatSceneReadyHandler,
    private readonly onMovementError: (message: string) => void,
    private readonly onAttackError: (message: string) => void,
    private readonly torpedoAnimator?: TorpedoAnimator,
    private readonly flightAnimator?: FlightAnimator,
    private readonly onBoardChanged: (game: CombatGame) => void = () => {},
    private readonly onTorpedoEvent: TorpedoVisualObserver = () => {},
    private readonly torpedoPathRandomSource?: RandomSource,
  ) {
    super({ key: 'ship-combat' });
  }

  create(): void {
    if (this.isDisposed) throw new Error('A disposed CombatScene cannot be restarted.');
    if (this.isCreated) return;
    const snapshot = this.session.snapshot;
    if (snapshot.phase === 'disposed') throw new Error('A CombatScene requires a live battle.');

    this.isCreated = true;
    this.boardView = new BoardView(this, this.geometry);
    this.controller = new CombatController(
      this.session,
      this.geometry,
      this.boardView,
      this.flightAnimator ?? new PhaserFlightAnimator(this, this.geometry),
      this.torpedoAnimator ??
        new PhaserTorpedoAnimator(
          this,
          this.geometry,
          this.onTorpedoEvent,
          this.torpedoPathRandomSource,
        ),
      this.controls,
      this.onMovementError,
      this.onAttackError,
      this.onBoardChanged,
    );
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.isListeningForPointer = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.dispose, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.dispose, this);
    this.drawSnapshot(snapshot);
  }

  updateGame(revision: number): void {
    if (this.isDisposed || !this.boardView || !this.controller) {
      throw new Error('The combat scene is not ready to replace its game.');
    }
    const snapshot = this.session.snapshot;
    if (snapshot.phase === 'disposed' || snapshot.gameRevision !== revision) {
      throw new Error('The replacement battle revision is no longer current.');
    }

    this.controller.prepareForReplacement();
    this.drawSnapshot(snapshot);
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    if (this.isListeningForPointer) {
      this.input.off('pointerdown', this.handlePointerDown, this);
      this.isListeningForPointer = false;
    }
    this.controller?.dispose();
    this.controller = null;
    this.boardView?.dispose();
    this.boardView = null;
    this.controls.dispose();
  }

  private drawSnapshot(snapshot: Exclude<BattleSnapshot, { phase: 'disposed' }>): void {
    const boardView = this.boardView;
    if (!boardView) throw new Error('The combat board is not initialized.');
    boardView.draw(snapshot.game, snapshot.gameRevision, (renderedRevision) => {
      if (this.isDisposed) return;
      const current = this.session.snapshot;
      if (current.phase === 'disposed' || current.gameRevision !== renderedRevision) return;
      this.controller?.markReady(renderedRevision);
      this.onDrawn(renderedRevision);
    });
  }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.controller?.handlePointerDown({
      button: pointer.button,
      worldX: pointer.worldX,
      worldY: pointer.worldY,
    });
  };
}
