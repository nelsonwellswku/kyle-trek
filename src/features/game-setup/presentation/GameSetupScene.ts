import Phaser from 'phaser';
import type { GameSetup } from '../domain/GameSetup.js';
import {
  PhaserCubeProjectionView,
  type RenderedRevisionHandler,
} from '../../board/presentation/PhaserCubeProjectionView.js';
import type { CubeScreenGeometry } from '../../board/presentation/CubeScreenGeometry.js';

/**
 * Phaser requires a Scene subclass to integrate its scene lifecycle. This adapter owns no
 * gameplay state beyond the supplied immutable snapshot and delegates drawing to a cube projection.
 */
export class GameSetupScene extends Phaser.Scene {
  private boardView: PhaserCubeProjectionView | null = null;
  private revision = 1;

  constructor(
    private setup: GameSetup,
    private readonly geometry: CubeScreenGeometry,
    private readonly onDrawn: RenderedRevisionHandler,
  ) {
    super({ key: 'game-setup' });
  }

  create(): void {
    this.boardView = new PhaserCubeProjectionView(this, this.geometry);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.dispose, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.dispose, this);
    this.boardView.draw(this.setup, this.revision, this.onDrawn);
  }

  updateSetup(setup: GameSetup, revision: number): void {
    if (!this.boardView) {
      throw new Error('The game setup scene is not ready to draw.');
    }

    this.setup = setup;
    this.revision = revision;
    this.boardView.draw(setup, revision, this.onDrawn);
  }

  dispose(): void {
    this.boardView?.dispose();
    this.boardView = null;
  }
}
