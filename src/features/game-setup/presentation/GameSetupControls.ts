import type { GameSetup } from '../domain/GameSetup.js';

export type NewGameHandler = () => void;

export class GameSetupControls {
  private readonly ship1Summary: HTMLElement;
  private readonly ship2Summary: HTMLElement;
  private readonly status: HTMLElement;
  private readonly error: HTMLElement;
  private readonly newGameButton: HTMLButtonElement;
  private readonly canvasHost: HTMLElement;
  private readonly newGameHandler: NewGameHandler | undefined;

  constructor(root: HTMLElement, newGameHandler?: NewGameHandler) {
    root.innerHTML = `
      <main class="game-shell">
        <header class="page-header">
          <p class="eyebrow">FLEET COMMAND</p>
          <h1>Spaceship starting positions</h1>
        </header>
        <section class="game-layout" aria-label="Starting board">
          <div class="board-copy" id="board-description">
            <h2>10 × 10 grid</h2>
            <p>Rows count from top to bottom; columns count from left to right.</p>
          </div>
          <div class="board-host" id="game-board"></div>
        </section>
        <section class="game-details" id="ship-summary" aria-label="Ship positions">
          <p id="ship-1-position"></p>
          <p id="ship-2-position"></p>
        </section>
        <div class="game-actions">
          <button class="new-game-button" type="button" disabled>New Game</button>
          <p class="game-status" role="status" aria-live="polite">Preparing game…</p>
        </div>
        <p class="startup-error" role="alert" hidden></p>
      </main>
    `;

    const ship1Summary = root.querySelector<HTMLElement>('#ship-1-position');
    const ship2Summary = root.querySelector<HTMLElement>('#ship-2-position');
    const status = root.querySelector<HTMLElement>('[role="status"]');
    const error = root.querySelector<HTMLElement>('[role="alert"]');
    const newGameButton = root.querySelector<HTMLButtonElement>('button.new-game-button');
    const canvasHost = root.querySelector<HTMLElement>('#game-board');

    if (!ship1Summary || !ship2Summary || !status || !error || !newGameButton || !canvasHost) {
      throw new Error('The game controls could not be initialized.');
    }

    this.ship1Summary = ship1Summary;
    this.ship2Summary = ship2Summary;
    this.status = status;
    this.error = error;
    this.newGameButton = newGameButton;
    this.canvasHost = canvasHost;
    this.newGameHandler = newGameHandler;

    if (newGameHandler) {
      this.newGameButton.addEventListener('click', newGameHandler);
    }
  }

  get gameCanvasHost(): HTMLElement {
    return this.canvasHost;
  }

  showSetup(setup: GameSetup): void {
    this.ship1Summary.textContent = `Ship 1 — row ${setup.ship1.position.row}, column ${setup.ship1.position.column}`;
    this.ship2Summary.textContent = `Ship 2 — row ${setup.ship2.position.row}, column ${setup.ship2.position.column}`;
    this.showPreparing();
  }

  showPreparing(): void {
    this.status.textContent = 'Preparing game…';
    this.error.textContent = '';
    this.error.hidden = true;
  }

  markReady(revision: number, canvas: HTMLCanvasElement): void {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Spaceship starting positions board');
    canvas.setAttribute('aria-describedby', 'board-description ship-summary');
    canvas.dataset.renderedRevision = String(revision);
    this.status.textContent = `Game ${revision} ready`;
    this.newGameButton.disabled = this.newGameHandler === undefined;
  }

  showReplacementError(message: string): void {
    this.status.textContent = message;
    this.newGameButton.disabled = this.newGameHandler === undefined;
  }

  showStartupError(message: string): void {
    this.error.textContent = message;
    this.error.hidden = false;
    this.status.textContent = '';
    this.newGameButton.disabled = true;
    this.canvasHost.replaceChildren();
  }

  dispose(): void {
    if (this.newGameHandler) {
      this.newGameButton.removeEventListener('click', this.newGameHandler);
    }
  }
}
