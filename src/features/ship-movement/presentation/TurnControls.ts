import type { TurnSnapshot } from '../domain/TurnSession.js';

export type PassTurnHandler = (gameRevision: number, turnToken: number) => void;

export class TurnControls {
  private readonly status: HTMLElement;
  private readonly activeTurn: HTMLElement;
  private readonly ship1Agility: HTMLElement;
  private readonly ship1Modifier: HTMLElement;
  private readonly ship2Agility: HTMLElement;
  private readonly ship2Modifier: HTMLElement;
  private readonly passButton: HTMLButtonElement;
  private passHandler: EventListener | null = null;
  private isDisposed = false;

  constructor(
    host: HTMLElement,
    private readonly onPass: PassTurnHandler,
  ) {
    host.innerHTML = `
      <section class="turn-controls" aria-label="Current turn">
        <p id="turn-status" role="status" aria-live="polite"></p>
        <p id="active-turn"></p>
        <dl class="agility-summary">
          <div><dt>Ship 1 agility</dt><dd id="ship-1-agility"></dd></div>
          <div><dt>Ship 1 modifier</dt><dd id="ship-1-modifier"></dd></div>
          <div><dt>Ship 2 agility</dt><dd id="ship-2-agility"></dd></div>
          <div><dt>Ship 2 modifier</dt><dd id="ship-2-modifier"></dd></div>
        </dl>
        <button class="pass-turn-button" type="button" hidden disabled>Pass turn</button>
      </section>
    `;

    const status = host.querySelector<HTMLElement>('#turn-status');
    const activeTurn = host.querySelector<HTMLElement>('#active-turn');
    const ship1Agility = host.querySelector<HTMLElement>('#ship-1-agility');
    const ship1Modifier = host.querySelector<HTMLElement>('#ship-1-modifier');
    const ship2Agility = host.querySelector<HTMLElement>('#ship-2-agility');
    const ship2Modifier = host.querySelector<HTMLElement>('#ship-2-modifier');
    const passButton = host.querySelector<HTMLButtonElement>('button.pass-turn-button');
    if (
      !status ||
      !activeTurn ||
      !ship1Agility ||
      !ship1Modifier ||
      !ship2Agility ||
      !ship2Modifier ||
      !passButton
    ) {
      throw new Error('The turn controls could not be initialized.');
    }

    this.status = status;
    this.activeTurn = activeTurn;
    this.ship1Agility = ship1Agility;
    this.ship1Modifier = ship1Modifier;
    this.ship2Agility = ship2Agility;
    this.ship2Modifier = ship2Modifier;
    this.passButton = passButton;
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
  }

  render(snapshot: TurnSnapshot): void {
    if (this.isDisposed) {
      return;
    }

    this.removePassListener();
    if (snapshot.phase === 'disposed') {
      this.status.textContent = 'Game closed.';
      this.activeTurn.textContent = '';
      this.setPassAvailable(false);
      return;
    }

    const ship1 = snapshot.game.ship1;
    const ship2 = snapshot.game.ship2;
    this.ship1Agility.textContent = String(ship1.agility.score);
    this.ship1Modifier.textContent = TurnControls.formatModifier(ship1.agility.modifier);
    this.ship2Agility.textContent = String(ship2.agility.score);
    this.ship2Modifier.textContent = TurnControls.formatModifier(ship2.agility.modifier);
    this.activeTurn.textContent = `${TurnControls.playerName(snapshot.activePlayer)} controls ${TurnControls.shipName(snapshot.activeShip)}.`;

    if (snapshot.phase === 'awaiting-pass') {
      this.status.textContent = snapshot.reason;
      this.setPassAvailable(true);
      const { gameRevision, turnToken } = snapshot;
      this.passHandler = (): void => this.onPass(gameRevision, turnToken);
      this.passButton.addEventListener('click', this.passHandler);
      return;
    }

    this.setPassAvailable(false);
    this.status.textContent =
      snapshot.phase === 'moving'
        ? `${TurnControls.playerName(snapshot.activePlayer)} — ${TurnControls.shipName(snapshot.activeShip)} is moving.`
        : `${TurnControls.playerName(snapshot.activePlayer)} — ${TurnControls.shipName(snapshot.activeShip)}'s turn.`;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.removePassListener();
    this.setPassAvailable(false);
  }

  private setPassAvailable(available: boolean): void {
    this.passButton.hidden = !available;
    this.passButton.disabled = !available;
  }

  private removePassListener(): void {
    if (this.passHandler) {
      this.passButton.removeEventListener('click', this.passHandler);
      this.passHandler = null;
    }
  }

  private static formatModifier(modifier: number): string {
    return modifier > 0 ? `+${modifier}` : String(modifier);
  }

  private static playerName(player: 'player-1' | 'player-2'): string {
    return player === 'player-1' ? 'Player 1' : 'Player 2';
  }

  private static shipName(ship: 'ship-1' | 'ship-2'): string {
    return ship === 'ship-1' ? 'Ship 1' : 'Ship 2';
  }
}
