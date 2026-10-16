import Phaser from 'phaser';
import type { GameSetup } from '../domain/GameSetup.js';
import { BoardView, type RenderedRevisionHandler } from './BoardView.js';
import type { BoardGeometry } from './BoardGeometry.js';

/**
 * Phaser requires a Scene subclass to integrate its scene lifecycle. This adapter owns no
 * gameplay state beyond the supplied immutable snapshot and delegates drawing to BoardView.
 */
export class GameSetupScene extends Phaser.Scene {
  private boardView: BoardView | null = null;

  constructor(
    private setup: GameSetup,
    private readonly geometry: BoardGeometry,
    private readonly onDrawn: RenderedRevisionHandler,
  ) {
    super({ key: 'game-setup' });
  }

  create(): void {
    this.boardView = new BoardView(this, this.geometry);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.dispose, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.dispose, this);
    this.boardView.draw(this.setup, 1, this.onDrawn);
  }

  updateSetup(setup: GameSetup, revision: number): void {
    if (!this.boardView) {
      throw new Error('The game setup scene is not ready to draw.');
    }

    this.setup = setup;
    this.boardView.draw(setup, revision, this.onDrawn);
  }

  dispose(): void {
    this.boardView?.dispose();
    this.boardView = null;
  }
}
