import Phaser from 'phaser';
import { BoardGeometry } from '../features/board/presentation/BoardGeometry.js';
import type { BoardSnapshot } from '../features/board/domain/BoardSnapshot.js';
import { MathRandomSource } from '../features/game-setup/adapters/MathRandomSource.js';
import type { RandomSource } from '../features/game-setup/domain/RandomSource.js';
import { GameSetupControls } from '../features/game-setup/presentation/GameSetupControls.js';
import { AttackResolver } from '../features/ship-combat/domain/AttackResolver.js';
import { BattleSession } from '../features/ship-combat/domain/BattleSession.js';
import { CombatGameFactory } from '../features/ship-combat/domain/CombatGameFactory.js';
import type { CombatGame } from '../features/ship-combat/domain/CombatGame.js';
import { DiceRoller } from '../features/ship-combat/domain/DiceRoller.js';
import { CombatControls } from '../features/ship-combat/presentation/CombatControls.js';
import { CombatScene } from '../features/ship-combat/presentation/CombatScene.js';

const BOARD_SIZE = 600;
const STARTUP_ERROR =
  'Unable to start the game. Check that WebGL is available and reload the page.';

export class GameApplication {
  private game: Phaser.Game | null = null;
  private isReady = false;
  private isReplacementPending = false;
  private isDisposed = false;
  private queuedNewGames = 0;
  private session: BattleSession | null = null;
  private readonly factory: CombatGameFactory;
  private readonly controls: GameSetupControls;
  private readonly combatControls: CombatControls;
  private scene: CombatScene | null = null;

  constructor(root: HTMLElement, randomSource: RandomSource = new MathRandomSource()) {
    this.factory = new CombatGameFactory(randomSource);
    this.controls = new GameSetupControls(root, this.handleNewGame);
    this.combatControls = new CombatControls(this.controls.turnHudHost);
    this.controls.showPreparing();
    window.addEventListener('error', this.handleStartupError);

    let initialGame: CombatGame;
    try {
      initialGame = this.factory.create();
      this.session = new BattleSession(
        initialGame,
        new AttackResolver(new DiceRoller(randomSource)),
      );
      this.controls.updateBoard(initialGame);
      this.combatControls.renderBattle(this.session.snapshot, false);
    } catch {
      this.showStartupError();
      return;
    }

    const scene = new CombatScene(
      this.session,
      new BoardGeometry(BOARD_SIZE),
      this.combatControls,
      this.handleDrawn,
      this.handleMovementError,
      this.handleAttackError,
      undefined,
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
    if (this.isDisposed) return;

    this.isDisposed = true;
    window.removeEventListener('error', this.handleStartupError);
    this.session?.dispose();
    this.scene?.dispose();
    this.scene = null;
    this.combatControls.dispose();
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
    if (snapshot.phase === 'disposed') return;

    this.isReady = true;
    this.controls.updateBoard(snapshot.game);
    this.controls.markReady(revision, this.game.canvas);
    this.combatControls.renderBattle(snapshot);

    if (revision === 1) window.removeEventListener('error', this.handleStartupError);

    if (this.isReplacementPending) {
      this.isReplacementPending = false;
      this.processQueuedNewGame();
    }
  };

  private readonly handleNewGame = (): void => {
    if (this.isDisposed) return;

    if (this.isReplacementPending) {
      this.queuedNewGames += 1;
      return;
    }

    if (!this.isReady) return;
    const session = this.session;
    const scene = this.scene;
    if (!session || !scene) return;

    let replacement: CombatGame;
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

  private readonly handleMovementError = (message: string): void => {
    if (!this.isDisposed) this.controls.showMovementError(message);
  };

  private readonly handleAttackError = (message: string): void => {
    if (!this.isDisposed) this.controls.showMovementError(message);
  };

  private readonly handleBoardChanged = (snapshot: BoardSnapshot): void => {
    if (this.isDisposed) return;
    this.controls.updateBoard(snapshot);
    this.controls.clearMovementError();
  };

  private processQueuedNewGame(): void {
    if (this.queuedNewGames === 0 || this.isDisposed) return;
    this.queuedNewGames -= 1;
    queueMicrotask(this.handleNewGame);
  }

  private readonly handleStartupError = (event: ErrorEvent): void => {
    if (this.isReady || this.isDisposed) return;
    event.preventDefault();
    this.showStartupError();
  };

  private showStartupError(): void {
    if (this.isReady || this.isDisposed) return;

    window.removeEventListener('error', this.handleStartupError);
    this.controls.showStartupError(STARTUP_ERROR);
    this.session?.dispose();
    this.scene?.dispose();
    this.scene = null;
    this.combatControls.dispose();

    try {
      this.game?.destroy(true);
    } catch {
      // Renderer initialization may have stopped before Phaser completed its lifecycle.
    }
    this.game = null;
  }
}
