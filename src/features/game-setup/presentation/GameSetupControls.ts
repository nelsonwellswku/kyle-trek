import type { GameSetup } from '../domain/GameSetup.js';
import type { CubeSnapshot } from '../../board/domain/CubeSnapshot.js';
import { CubePosition } from '../../board/domain/CubePosition.js';
import type { ShipIdentity } from '../../board/domain/CubeSnapshot.js';

export type NewGameHandler = () => void;

export class GameSetupControls {
  private readonly ship1Summary: HTMLElement;
  private readonly ship2Summary: HTMLElement;
  private readonly cubeInspection: HTMLElement;
  private readonly status: HTMLElement;
  private readonly error: HTMLElement;
  private readonly movementError: HTMLElement;
  private readonly newGameButton: HTMLButtonElement;
  private readonly canvasHost: HTMLElement;
  private readonly turnHudHostElement: HTMLElement;
  private readonly newGameHandler: NewGameHandler | undefined;

  constructor(root: HTMLElement, newGameHandler?: NewGameHandler) {
    root.innerHTML = `
      <main class="game-shell">
        <header class="page-header">
          <p class="eyebrow">FLEET COMMAND</p>
          <h1>Ship torpedo combat</h1>
        </header>
        <section class="turn-hud" id="turn-hud" aria-label="Turn controls"></section>
        <section class="game-layout" aria-label="Combat board">
          <div class="board-copy" id="board-description">
            <h2>10 × 10 × 10 battle cube</h2>
            <p>Orbit the cube to inspect cells. Movement, attack, and turn commands remain in the battle controls.</p>
          </div>
          <p class="cube-orbit-instructions" aria-label="Rotate the cube viewing angle">Drag with the primary mouse button to rotate the viewing angle; clicking a marker only inspects it.</p>
          <p class="cube-axis-legend" aria-label="Cube axes: X left and right, Y front and back, Z up and down">X axis: left ↔ right · Y axis: front ↔ back · Z axis: down ↕ up</p>
          <p id="cube-inspection" class="cube-inspection" role="status" aria-live="polite">Hover over a cell marker to inspect its coordinates and occupancy.</p>
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
        <p class="movement-error" id="movement-error" role="alert" hidden></p>
      </main>
    `;

    const ship1Summary = root.querySelector<HTMLElement>('#ship-1-position');
    const ship2Summary = root.querySelector<HTMLElement>('#ship-2-position');
    const cubeInspection = root.querySelector<HTMLElement>('#cube-inspection');
    const status = root.querySelector<HTMLElement>('[role="status"]');
    const error = root.querySelector<HTMLElement>('[role="alert"]');
    const movementError = root.querySelector<HTMLElement>('#movement-error');
    const newGameButton = root.querySelector<HTMLButtonElement>('button.new-game-button');
    const canvasHost = root.querySelector<HTMLElement>('#game-board');
    const turnHudHost = root.querySelector<HTMLElement>('#turn-hud');

    if (
      !ship1Summary ||
      !ship2Summary ||
      !cubeInspection ||
      !status ||
      !error ||
      !movementError ||
      !newGameButton ||
      !canvasHost ||
      !turnHudHost
    ) {
      throw new Error('The game controls could not be initialized.');
    }

    this.ship1Summary = ship1Summary;
    this.ship2Summary = ship2Summary;
    this.cubeInspection = cubeInspection;
    this.status = status;
    this.error = error;
    this.movementError = movementError;
    this.newGameButton = newGameButton;
    this.canvasHost = canvasHost;
    this.turnHudHostElement = turnHudHost;
    this.newGameHandler = newGameHandler;
    this.updateInspection(null);

    if (newGameHandler) {
      this.newGameButton.addEventListener('click', newGameHandler);
    }
  }

  get gameCanvasHost(): HTMLElement {
    return this.canvasHost;
  }

  get turnHudHost(): HTMLElement {
    return this.turnHudHostElement;
  }

  showSetup(setup: GameSetup): void {
    this.updateBoard(setup);
    this.showPreparing();
  }

  updateBoard(snapshot: CubeSnapshot): void {
    const ship1 = snapshot.ship1.position;
    const ship2 = snapshot.ship2.position;
    this.ship1Summary.textContent = `Ship 1 — X ${ship1.x}, Y ${ship1.y}, Z ${ship1.z} (occupied)`;
    this.ship2Summary.textContent = `Ship 2 — X ${ship2.x}, Y ${ship2.y}, Z ${ship2.z} (occupied)`;
  }

  updateInspection(position: CubePosition | null, occupant: ShipIdentity | null = null): void {
    if (!position) {
      this.cubeInspection.textContent =
        'Hover over a cell marker to inspect its coordinates and occupancy.';
      return;
    }
    const occupancy = occupant
      ? `occupied by ${occupant === 'ship-1' ? 'Ship 1' : 'Ship 2'}`
      : 'empty';
    this.cubeInspection.textContent = `Cell X ${position.x}, Y ${position.y}, Z ${position.z} — ${occupancy}.`;
  }

  showPreparing(): void {
    this.status.textContent = 'Preparing game…';
    this.error.textContent = '';
    this.error.hidden = true;
    this.clearMovementError();
  }

  markReady(revision: number, canvas: HTMLCanvasElement): void {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Orbitable 10 by 10 by 10 spaceship combat cube');
    canvas.setAttribute(
      'aria-describedby',
      'board-description ship-summary cube-inspection turn-hud',
    );
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

  showMovementError(message: string): void {
    this.movementError.textContent = message;
    this.movementError.hidden = false;
  }

  clearMovementError(): void {
    this.movementError.textContent = '';
    this.movementError.hidden = true;
  }

  dispose(): void {
    if (this.newGameHandler) {
      this.newGameButton.removeEventListener('click', this.newGameHandler);
    }
  }
}
