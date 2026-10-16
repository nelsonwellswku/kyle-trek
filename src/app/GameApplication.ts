import Phaser from 'phaser';
import { MathRandomSource } from '../features/game-setup/adapters/MathRandomSource.js';
import { GameSession } from '../features/game-setup/domain/GameSession.js';
import { GameSetupFactory } from '../features/game-setup/domain/GameSetupFactory.js';
import type { GameSetup } from '../features/game-setup/domain/GameSetup.js';
import type { RandomSource } from '../features/game-setup/domain/RandomSource.js';
import { BoardGeometry } from '../features/game-setup/presentation/BoardGeometry.js';
import { GameSetupControls } from '../features/game-setup/presentation/GameSetupControls.js';
import { GameSetupScene } from '../features/game-setup/presentation/GameSetupScene.js';

const BOARD_SIZE = 600;
const STARTUP_ERROR =
  'Unable to start the game. Check that WebGL is available and reload the page.';

export class GameApplication {
  private game: Phaser.Game | null = null;
  private isReady = false;
  private isReplacementPending = false;
  private isDisposed = false;
  private queuedNewGames = 0;
  private readonly session: GameSession;
  private readonly controls: GameSetupControls;
  private readonly scene: GameSetupScene;

  constructor(root: HTMLElement, randomSource: RandomSource = new MathRandomSource()) {
    this.session = new GameSession(new GameSetupFactory(randomSource));
    this.controls = new GameSetupControls(root, this.handleNewGame);
    this.controls.showSetup(this.session.currentSetup);
    this.scene = new GameSetupScene(
      this.session.currentSetup,
      new BoardGeometry(BOARD_SIZE),
      this.handleDrawn,
    );
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
    if (this.isDisposed || revision !== this.session.revision || !this.game?.canvas) {
      return;
    }

    this.isReady = true;
    this.controls.showSetup(this.session.currentSetup);
    this.controls.markReady(revision, this.game.canvas);

    if (revision === 1) {
      window.removeEventListener('error', this.handleStartupError);
    }

    if (this.isReplacementPending) {
      this.isReplacementPending = false;
      this.processQueuedNewGame();
    }
  };

  private readonly handleNewGame = (): void => {
    if (this.isDisposed) {
      return;
    }

    if (this.isReplacementPending) {
      this.queuedNewGames += 1;
      return;
    }

    if (!this.isReady) {
      return;
    }

    let replacement: GameSetup;
    try {
      replacement = this.session.newGame();
    } catch {
      this.controls.showReplacementError('Unable to start a new game. Try again.');
      this.processQueuedNewGame();
      return;
    }

    this.isReady = false;
    this.isReplacementPending = true;
    this.controls.showPreparing();
    this.scene.updateSetup(replacement, this.session.revision);
  };

  private processQueuedNewGame(): void {
    if (this.queuedNewGames === 0 || this.isDisposed) {
      return;
    }

    this.queuedNewGames -= 1;
    queueMicrotask(this.handleNewGame);
  }

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
