import Phaser from 'phaser';
import { BoardPosition } from '../features/game-setup/domain/BoardPosition.js';
import { GameSetup } from '../features/game-setup/domain/GameSetup.js';
import { BoardGeometry } from '../features/game-setup/presentation/BoardGeometry.js';
import { GameSetupControls } from '../features/game-setup/presentation/GameSetupControls.js';
import { GameSetupScene } from '../features/game-setup/presentation/GameSetupScene.js';

const BOARD_SIZE = 600;
const STARTUP_ERROR =
  'Unable to start the game. Check that WebGL is available and reload the page.';

export class GameApplication {
  private game: Phaser.Game | null = null;
  private isReady = false;
  private isDisposed = false;
  private readonly controls: GameSetupControls;
  private readonly scene: GameSetupScene;
  private readonly setup: GameSetup;

  constructor(root: HTMLElement, setup: GameSetup) {
    this.setup = setup;
    this.controls = new GameSetupControls(root);
    this.controls.showSetup(this.setup);
    this.scene = new GameSetupScene(this.setup, new BoardGeometry(BOARD_SIZE), this.handleDrawn);
    window.addEventListener('error', this.handleStartupError);

    try {
      this.game = new Phaser.Game({
        type: Phaser.WEBGL,
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        parent: this.controls.gameCanvasHost,
        canvasStyle: 'display:block;width:100%;height:100%;',
        backgroundColor: '#0b1b2b',
        banner: false,
        antialias: true,
        roundPixels: true,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          expandParent: false,
        },
        scene: [this.scene],
      });
    } catch {
      this.showStartupError();
    }
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    window.removeEventListener('error', this.handleStartupError);
    this.scene.dispose();
    this.controls.dispose();
    this.game?.destroy(true);
    this.game = null;
  }

  private readonly handleDrawn = (revision: number): void => {
    if (this.isDisposed || this.isReady || !this.game?.canvas) {
      return;
    }

    this.isReady = true;
    window.removeEventListener('error', this.handleStartupError);
    this.controls.markReady(revision, this.game.canvas);
  };

  private readonly handleStartupError = (event: ErrorEvent): void => {
    if (this.isReady || this.isDisposed) {
      return;
    }

    event.preventDefault();
    this.showStartupError();
  };

  private showStartupError(): void {
    if (this.isReady || this.isDisposed) {
      return;
    }

    window.removeEventListener('error', this.handleStartupError);
    this.controls.showStartupError(STARTUP_ERROR);

    try {
      this.game?.destroy(true);
    } catch {
      // Renderer initialization may have stopped before Phaser completed its lifecycle.
    }
    this.game = null;
  }
}

export function createSuppliedSetup(): GameSetup {
  return new GameSetup(
    { identity: 'ship-1', position: new BoardPosition(1, 1) },
    { identity: 'ship-2', position: new BoardPosition(10, 10) },
  );
}
