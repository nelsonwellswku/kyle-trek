import Phaser from 'phaser';
import { BoardGeometry } from '../features/board/presentation/BoardGeometry.js';
import type { BoardSnapshot } from '../features/board/domain/BoardSnapshot.js';
import { MathRandomSource } from '../features/game-setup/adapters/MathRandomSource.js';
import type { RandomSource } from '../features/game-setup/domain/RandomSource.js';
import { GameSetupControls } from '../features/game-setup/presentation/GameSetupControls.js';
import { MovementGameFactory } from '../features/ship-movement/domain/MovementGameFactory.js';
import type { MovementGame } from '../features/ship-movement/domain/MovementGame.js';
import { TurnSession } from '../features/ship-movement/domain/TurnSession.js';
import { MovementScene } from '../features/ship-movement/presentation/MovementScene.js';
import { TurnControls } from '../features/ship-movement/presentation/TurnControls.js';

const BOARD_SIZE = 600;
const STARTUP_ERROR =
  'Unable to start the game. Check that WebGL is available and reload the page.';

export class GameApplication {
  private game: Phaser.Game | null = null;
  private isReady = false;
  private isReplacementPending = false;
  private isDisposed = false;
  private queuedNewGames = 0;
  private session: TurnSession | null = null;
  private readonly factory: MovementGameFactory;
  private readonly controls: GameSetupControls;
  private readonly turnControls: TurnControls;
  private scene: MovementScene | null = null;

  constructor(root: HTMLElement, randomSource: RandomSource = new MathRandomSource()) {
    this.factory = new MovementGameFactory(randomSource);
    this.controls = new GameSetupControls(root, this.handleNewGame);
    this.turnControls = new TurnControls(this.controls.turnHudHost, this.handlePass);
    this.controls.showPreparing();
    window.addEventListener('error', this.handleStartupError);

    let initialGame: MovementGame;
    try {
      initialGame = this.factory.create();
      this.session = new TurnSession(initialGame);
      this.controls.updateBoard(initialGame);
      this.turnControls.render(this.session.snapshot);
    } catch {
      this.showStartupError();
      return;
    }

    const scene = new MovementScene(
      this.session,
      new BoardGeometry(BOARD_SIZE),
      this.turnControls,
      this.handleDrawn,
      this.handleMovementError,
      undefined,
      this.handleBoardChanged,
    );
    this.scene = scene;

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
        scene: [scene],
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
    this.session?.dispose();
    this.scene?.dispose();
    this.scene = null;
    this.turnControls.dispose();
    this.controls.dispose();
    this.game?.destroy(true);
    this.game = null;
  }

  private readonly handleDrawn = (revision: number): void => {
    const session = this.session;
    if (
      this.isDisposed ||
      !session ||
      revision !== session.snapshot.gameRevision ||
      !this.game?.canvas
    ) {
      return;
    }

    const snapshot = session.snapshot;
    if (snapshot.phase === 'disposed') {
      return;
    }

    this.isReady = true;
    this.controls.updateBoard(snapshot.game);
    this.controls.markReady(revision, this.game.canvas);
    this.turnControls.render(snapshot);

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

    const session = this.session;
    const scene = this.scene;
    if (!session || !scene) {
      return;
    }

    let replacement: MovementGame;
    try {
      replacement = this.factory.create();
    } catch {
      this.controls.showReplacementError('Unable to start a new game. Try again.');
      this.processQueuedNewGame();
      return;
    }

    let revision: number;
    try {
      revision = session.newGame(replacement);
    } catch {
      this.controls.showReplacementError('Unable to start a new game. Try again.');
      this.processQueuedNewGame();
      return;
    }

    this.isReady = false;
    this.isReplacementPending = true;
    this.controls.showPreparing();
    this.controls.clearMovementError();
    try {
      scene.updateGame(revision);
    } catch {
      this.isReplacementPending = false;
      this.showStartupError();
    }
  };

  private readonly handlePass = (gameRevision: number, turnToken: number): void => {
    this.scene?.acknowledgePass(gameRevision, turnToken);
  };

  private readonly handleMovementError = (message: string): void => {
    if (!this.isDisposed) {
      this.controls.showMovementError(message);
    }
  };

  private readonly handleBoardChanged = (snapshot: BoardSnapshot): void => {
    if (!this.isDisposed) {
      this.controls.updateBoard(snapshot);
      this.controls.clearMovementError();
    }
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
    this.session?.dispose();
    this.scene?.dispose();
    this.scene = null;
    this.turnControls.dispose();

    try {
      this.game?.destroy(true);
    } catch {
      // Renderer initialization may have stopped before Phaser completed its lifecycle.
    }
    this.game = null;
  }
}
