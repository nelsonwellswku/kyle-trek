import Phaser from 'phaser';
import type { CubeScreenGeometry } from '../../board/presentation/CubeScreenGeometry.js';
import type { RandomSource } from '../../game-setup/domain/RandomSource.js';
import type { CombatGame } from '../domain/CombatGame.js';
import { BattleSession } from '../domain/BattleSession.js';
import type { BattleSnapshot } from '../domain/BattleSession.js';
import type { FlightAnimator } from '../../ship-movement/presentation/FlightAnimator.js';
import { PhaserFlightAnimator } from '../../ship-movement/presentation/PhaserFlightAnimator.js';
import type { TorpedoAnimator } from './TorpedoAnimator.js';
import { PhaserTorpedoAnimator, type TorpedoVisualObserver } from './PhaserTorpedoAnimator.js';
import type { CombatControls } from './CombatControls.js';
import { PhaserCubeProjectionView } from '../../board/presentation/PhaserCubeProjectionView.js';
import { CombatController, type CombatCubeViewPort } from './CombatController.js';
import { ThreeCubeView } from '../../board/presentation/ThreeCubeView.js';
import type { CubePickTarget } from '../../board/presentation/CubePicker.js';
import { ThreeFlightAnimator } from '../../ship-movement/presentation/ThreeFlightAnimator.js';
import { ThreeTorpedoAnimator } from './ThreeTorpedoAnimator.js';

export type CombatSceneReadyHandler = (revision: number) => void;

/** Phaser requires Scene inheritance for lifecycle/input; combat behavior remains composed. */
export class CombatScene extends Phaser.Scene {
  private boardView: PhaserCubeProjectionView | null = null;
  private cubeView: ThreeCubeView | null = null;
  private controller: CombatController | null = null;
  private ownedTorpedoAnimator: TorpedoAnimator | null = null;
  private isListeningForPointer = false;
  private isCreated = false;
  private isDisposed = false;

  constructor(
    private readonly session: BattleSession,
    private readonly geometry: CubeScreenGeometry,
    private readonly controls: CombatControls,
    private readonly onDrawn: CombatSceneReadyHandler,
    private readonly onMovementError: (message: string) => void,
    private readonly onAttackError: (message: string) => void,
    private readonly torpedoAnimator?: TorpedoAnimator,
    private readonly flightAnimator?: FlightAnimator,
    private readonly onBoardChanged: (game: CombatGame) => void = () => {},
    private readonly onTorpedoEvent: TorpedoVisualObserver = () => {},
    private readonly torpedoPathRandomSource?: RandomSource,
    private readonly cubeHost?: HTMLElement,
    private readonly onCubeInspection: (
      target: CubePickTarget | null,
      game: CombatGame,
    ) => void = () => {},
    private readonly onRendererError: (message: string) => void = () => {},
  ) {
    super({ key: 'ship-combat' });
  }

  get cubeViewForFixture(): ThreeCubeView | null {
    return this.cubeView;
  }

  create(): void {
    if (this.isDisposed) throw new Error('A disposed CombatScene cannot be restarted.');
    if (this.isCreated) return;
    const snapshot = this.session.snapshot;
    if (snapshot.phase === 'disposed') throw new Error('A CombatScene requires a live battle.');

    this.isCreated = true;
    this.boardView = new PhaserCubeProjectionView(this, this.geometry);
    if (this.cubeHost) {
      try {
        this.cubeView = new ThreeCubeView(
          this.cubeHost,
          (target) => {
            const current = this.session.snapshot;
            if (current.phase !== 'disposed') this.onCubeInspection(target, current.game);
          },
          { onSelect: (target) => this.controller?.handlePickTarget(target) },
        );
      } catch (error) {
        this.onRendererError(
          error instanceof Error ? error.message : 'WebGL2 could not initialize the 3D cube view.',
        );
        this.dispose();
        return;
      }
    }
    this.controller = new CombatController(
      this.session,
      this.geometry,
      this.boardView,
      this.flightAnimator ??
        (this.cubeView ? new ThreeFlightAnimator() : new PhaserFlightAnimator(this, this.geometry)),
      this.getTorpedoAnimator(),
      this.controls,
      this.onMovementError,
      this.onAttackError,
      this.onBoardChanged,
      this.createCombatCubeViewPort(),
    );
    if (!this.cubeView) {
      this.input.on('pointerdown', this.handlePointerDown, this);
      this.isListeningForPointer = true;
    }
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
    this.ownedTorpedoAnimator?.dispose?.();
    this.ownedTorpedoAnimator = null;
    this.cubeView?.dispose();
    this.cubeView = null;
    this.boardView?.dispose();
    this.boardView = null;
    this.controls.dispose();
  }

  private drawSnapshot(snapshot: Exclude<BattleSnapshot, { phase: 'disposed' }>): void {
    const boardView = this.boardView;
    if (!boardView) throw new Error('The combat board is not initialized.');
    this.cubeView?.render(snapshot.game);
    boardView.draw(snapshot.game, snapshot.gameRevision, (renderedRevision) => {
      if (this.isDisposed) return;
      const current = this.session.snapshot;
      if (current.phase === 'disposed' || current.gameRevision !== renderedRevision) return;
      this.controller?.markReady(renderedRevision);
      this.onDrawn(renderedRevision);
    });
  }

  private createCombatCubeViewPort(): CombatCubeViewPort | undefined {
    const view = this.cubeView;
    if (!view) return undefined;
    return {
      setHighlights: (destinations) => view.setHighlights(destinations),
      setShipPosition: (identity, position) => view.setShipPosition(identity, position),
      setShipVisualPosition: (identity, point) => view.setShipVisualPosition(identity, point),
      setShipOrientation: (identity, orientation) => view.setShipOrientation(identity, orientation),
      animateShipRotation: (rotation, onComplete, onFailure) =>
        view.animateShipOrientation(
          rotation.shipIdentity,
          rotation.targetOrientation,
          onComplete,
          onFailure,
        ),
    };
  }

  private getTorpedoAnimator(): TorpedoAnimator {
    if (this.torpedoAnimator) return this.torpedoAnimator;
    if (this.cubeView) {
      const animator = new ThreeTorpedoAnimator(
        this.cubeView.scene,
        () => this.cubeView?.renderCurrentPose(),
        this.torpedoPathRandomSource,
        undefined,
        this.onTorpedoEvent,
      );
      this.ownedTorpedoAnimator = animator;
      return animator;
    }
    const animator = new PhaserTorpedoAnimator(
      this,
      this.geometry,
      this.onTorpedoEvent,
      this.torpedoPathRandomSource,
    );
    this.ownedTorpedoAnimator = animator;
    return animator;
  }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.controller?.handlePointerDown({
      button: pointer.button,
      worldX: pointer.worldX,
      worldY: pointer.worldY,
    });
  };
}
