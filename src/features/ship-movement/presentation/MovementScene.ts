import Phaser from 'phaser';
import type { CubeSnapshot } from '../../board/domain/CubeSnapshot.js';
import type { CubeScreenGeometry } from '../../board/presentation/CubeScreenGeometry.js';
import { PhaserCubeProjectionView } from '../../board/presentation/PhaserCubeProjectionView.js';
import type { TurnSession } from '../domain/TurnSession.js';
import type { FlightAnimator } from './FlightAnimator.js';
import { PhaserFlightAnimator } from './PhaserFlightAnimator.js';
import { MovementController } from './MovementController.js';
import type { TurnControls } from './TurnControls.js';
import { ThreeCubeView } from '../../board/presentation/ThreeCubeView.js';
import { ThreeFlightAnimator } from './ThreeFlightAnimator.js';

export type MovementSceneReadyHandler = (revision: number) => void;

/** Phaser requires a Scene subclass for lifecycle and input integration; gameplay remains composed. */
export class MovementScene extends Phaser.Scene {
  private boardView: PhaserCubeProjectionView | null = null;
  private cubeView: ThreeCubeView | null = null;
  private controller: MovementController | null = null;
  private isListeningForPointer = false;
  private isDisposed = false;

  constructor(
    private readonly session: TurnSession,
    private readonly geometry: CubeScreenGeometry,
    private readonly controls: TurnControls,
    private readonly onDrawn: MovementSceneReadyHandler,
    private readonly onMovementError: (message: string) => void,
    private readonly animator?: FlightAnimator,
    private readonly onBoardChanged: (snapshot: CubeSnapshot) => void = () => {},
    private readonly cubeHost?: HTMLElement,
  ) {
    super({ key: 'ship-movement' });
  }

  create(): void {
    if (this.isDisposed) {
      throw new Error('A disposed MovementScene cannot be restarted.');
    }

    const snapshot = this.session.snapshot;
    if (snapshot.phase === 'disposed') {
      throw new Error('A MovementScene requires a live turn session.');
    }

    this.boardView = new PhaserCubeProjectionView(this, this.geometry);
    if (this.cubeHost) {
      this.cubeView = new ThreeCubeView(this.cubeHost, undefined, {
        onSelect: (target) => this.controller?.handlePickTarget(target),
      });
    }
    this.controller = new MovementController(
      this.session,
      this.geometry,
      this.boardView,
      this.animator ??
        (this.cubeView ? new ThreeFlightAnimator() : new PhaserFlightAnimator(this, this.geometry)),
      this.controls,
      this.onMovementError,
      this.onBoardChanged,
      this.cubeView ?? undefined,
    );
    if (!this.cubeView) {
      this.input.on('pointerdown', this.handlePointerDown, this);
      this.isListeningForPointer = true;
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.dispose, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.dispose, this);
    this.cubeView?.render(snapshot.game);
    this.boardView.draw(snapshot.game, snapshot.gameRevision, (revision) => {
      if (this.isDisposed) {
        return;
      }

      const current = this.session.snapshot;
      if (current.phase === 'disposed' || current.gameRevision !== revision) {
        return;
      }

      this.controller?.markReady(revision);
      this.onDrawn(revision);
    });
  }

  updateGame(revision: number): void {
    if (this.isDisposed || !this.boardView || !this.controller) {
      throw new Error('The movement scene is not ready to replace its game.');
    }

    const snapshot = this.session.snapshot;
    if (snapshot.phase === 'disposed' || snapshot.gameRevision !== revision) {
      throw new Error('The replacement game revision is no longer current.');
    }

    this.controller.prepareForReplacement();
    this.cubeView?.render(snapshot.game);
    this.boardView.draw(snapshot.game, revision, (renderedRevision) => {
      if (this.isDisposed) {
        return;
      }

      const current = this.session.snapshot;
      if (current.phase === 'disposed' || current.gameRevision !== renderedRevision) {
        return;
      }

      this.controller?.markReady(renderedRevision);
      this.onDrawn(renderedRevision);
    });
  }

  acknowledgePass(gameRevision: number, turnToken: number): boolean {
    return this.controller?.acknowledgePass(gameRevision, turnToken) ?? false;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    if (this.isListeningForPointer) {
      this.input.off('pointerdown', this.handlePointerDown, this);
      this.isListeningForPointer = false;
    }
    this.controller?.dispose();
    this.controller = null;
    this.cubeView?.dispose();
    this.cubeView = null;
    this.boardView?.dispose();
    this.boardView = null;
    this.controls.dispose();
  }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.controller?.handlePointerDown({
      button: pointer.button,
      worldX: pointer.worldX,
      worldY: pointer.worldY,
    });
  };
}
