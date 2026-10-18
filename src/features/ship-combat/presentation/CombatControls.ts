import type { CombatGame } from '../domain/CombatGame.js';
import type { BattleSnapshot } from '../domain/BattleSession.js';
import type { AttackOutcome } from '../domain/AttackResolver.js';

export type BattleActionHandler = (gameRevision: number, turnToken: number) => void;

export class CombatControls {
  private readonly turnControls: HTMLElement;
  private readonly status: HTMLElement;
  private readonly activeTurn: HTMLElement;
  private readonly skipButton: HTMLButtonElement;
  private readonly endTurnButton: HTMLButtonElement;
  private skipHandler: EventListener | null = null;
  private endTurnHandler: EventListener | null = null;
  private onSkipMovement: BattleActionHandler = () => {};
  private onEndTurn: BattleActionHandler = () => {};
  private isDisposed = false;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <section class="combat-stats" aria-label="Combat ship statistics">
        ${CombatControls.shipMarkup('ship-1', 'Player 1')}
        ${CombatControls.shipMarkup('ship-2', 'Player 2')}
      </section>
      <section class="combat-turn-controls" aria-label="Battle turn controls" hidden>
        <p id="turn-status" role="status" aria-live="polite"></p>
        <p id="active-turn"></p>
        <p id="battle-result" aria-live="polite"></p>
        <p id="battle-winner" role="status" aria-live="polite"></p>
        <div class="combat-action-buttons">
          <button class="skip-movement-button" type="button" hidden disabled>Skip movement</button>
          <button class="end-turn-button" type="button" hidden disabled>End turn</button>
        </div>
      </section>
    `;

    const turnControls = root.querySelector<HTMLElement>('.combat-turn-controls');
    const status = root.querySelector<HTMLElement>('#turn-status');
    const activeTurn = root.querySelector<HTMLElement>('#active-turn');
    const skipButton = root.querySelector<HTMLButtonElement>('button.skip-movement-button');
    const endTurnButton = root.querySelector<HTMLButtonElement>('button.end-turn-button');
    if (!turnControls || !status || !activeTurn || !skipButton || !endTurnButton) {
      throw new Error('Combat turn controls could not be initialized.');
    }
    this.turnControls = turnControls;
    this.status = status;
    this.activeTurn = activeTurn;
    this.skipButton = skipButton;
    this.endTurnButton = endTurnButton;
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
  }

  setActionHandlers(onSkipMovement: BattleActionHandler, onEndTurn: BattleActionHandler): void {
    if (this.isDisposed) return;
    this.onSkipMovement = onSkipMovement;
    this.onEndTurn = onEndTurn;
  }

  renderShips(game: CombatGame): void {
    if (this.isDisposed) return;
    this.renderShip(game.ship1);
    this.renderShip(game.ship2);
  }

  renderBattle(snapshot: BattleSnapshot, boardReady = true): void {
    if (this.isDisposed) return;
    this.turnControls.hidden = false;
    this.removeActionListeners();

    if (snapshot.phase === 'disposed') {
      this.status.textContent = 'Battle closed.';
      this.activeTurn.textContent = '';
      CombatControls.setText(this.root, '#battle-result', '');
      CombatControls.setText(this.root, '#battle-winner', '');
      this.setButtonAvailable(this.skipButton, false);
      this.setButtonAvailable(this.endTurnButton, false);
      return;
    }

    this.renderShips(snapshot.game);
    CombatControls.setText(
      this.root,
      '#battle-result',
      snapshot.lastCompletedAttack ? CombatControls.attackResult(snapshot.lastCompletedAttack) : '',
    );
    CombatControls.setText(
      this.root,
      '#battle-winner',
      snapshot.phase === 'finished'
        ? `${CombatControls.playerName(snapshot.winner)} wins. ${CombatControls.shipName(snapshot.defeatedShip)} is defeated at 0 HP.`
        : '',
    );
    this.activeTurn.textContent = `${CombatControls.playerName(snapshot.activePlayer)} controls ${CombatControls.shipName(snapshot.activeShip)}.`;
    this.setButtonAvailable(
      this.skipButton,
      boardReady && snapshot.phase === 'awaiting-movement-skip',
    );
    this.setButtonAvailable(this.endTurnButton, boardReady && snapshot.phase === 'attack-ready');

    switch (snapshot.phase) {
      case 'movement-ready':
        this.status.textContent = `${CombatControls.playerName(snapshot.activePlayer)} — move ${CombatControls.shipName(snapshot.activeShip)} to a highlighted destination.`;
        break;
      case 'awaiting-movement-skip': {
        this.status.textContent = snapshot.reason;
        const { gameRevision, turnToken } = snapshot;
        this.skipHandler = (): void => this.onSkipMovement(gameRevision, turnToken);
        this.skipButton.addEventListener('click', this.skipHandler);
        break;
      }
      case 'moving':
        this.status.textContent = `${CombatControls.shipName(snapshot.activeShip)} is moving.`;
        break;
      case 'attack-ready': {
        this.status.textContent = `Movement is complete. Click the opposing ship to attack or choose End turn.`;
        const { gameRevision, turnToken } = snapshot;
        this.endTurnHandler = (): void => this.onEndTurn(gameRevision, turnToken);
        this.endTurnButton.addEventListener('click', this.endTurnHandler);
        break;
      }
      case 'attacking':
        this.status.textContent = `Attack in progress. The torpedo result is resolving.`;
        break;
      case 'finished':
        this.status.textContent = `Battle finished. ${CombatControls.playerName(snapshot.winner)} wins.`;
        break;
    }
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.removeActionListeners();
    this.setButtonAvailable(this.skipButton, false);
    this.setButtonAvailable(this.endTurnButton, false);
    this.root.replaceChildren();
  }

  private setButtonAvailable(button: HTMLButtonElement, available: boolean): void {
    button.hidden = !available;
    button.disabled = !available;
  }

  private removeActionListeners(): void {
    if (this.skipHandler) {
      this.skipButton.removeEventListener('click', this.skipHandler);
      this.skipHandler = null;
    }
    if (this.endTurnHandler) {
      this.endTurnButton.removeEventListener('click', this.endTurnHandler);
      this.endTurnHandler = null;
    }
  }

  private renderShip(ship: CombatGame['ship1']): void {
    const id = ship.identity;
    CombatControls.setText(this.root, `#${id}-identity`, ship.identity);
    CombatControls.setText(
      this.root,
      `#${id}-owner`,
      ship.owner === 'player-1' ? 'Player 1' : 'Player 2',
    );
    CombatControls.setText(this.root, `#${id}-agility`, String(ship.agility.score));
    CombatControls.setText(
      this.root,
      `#${id}-agility-modifier`,
      CombatControls.signed(ship.agility.modifier),
    );
    CombatControls.setText(this.root, `#${id}-strength`, String(ship.strength.score));
    CombatControls.setText(
      this.root,
      `#${id}-strength-modifier`,
      CombatControls.signed(ship.strength.modifier),
    );
    CombatControls.setText(this.root, `#${id}-constitution`, String(ship.constitution.score));
    CombatControls.setText(
      this.root,
      `#${id}-constitution-modifier`,
      CombatControls.signed(ship.constitution.modifier),
    );
    CombatControls.setText(
      this.root,
      `#${id}-hit-points`,
      `${ship.hitPoints} / ${ship.startingHitPoints}`,
    );
    CombatControls.setText(this.root, `#${id}-armor-class`, String(ship.armorClass));
  }

  private static shipMarkup(identity: 'ship-1' | 'ship-2', owner: string): string {
    const title = identity === 'ship-1' ? 'Ship 1' : 'Ship 2';
    return `
      <article class="combat-ship-stats" aria-label="${title} statistics">
        <h2><span id="${identity}-identity">${identity}</span> · <span id="${identity}-owner">${owner}</span></h2>
        <dl class="combat-stat-list">
          <div><dt>Agility score</dt><dd id="${identity}-agility"></dd></div>
          <div><dt>Agility modifier</dt><dd id="${identity}-agility-modifier"></dd></div>
          <div><dt>Strength score</dt><dd id="${identity}-strength"></dd></div>
          <div><dt>Strength modifier</dt><dd id="${identity}-strength-modifier"></dd></div>
          <div><dt>Constitution score</dt><dd id="${identity}-constitution"></dd></div>
          <div><dt>Constitution modifier</dt><dd id="${identity}-constitution-modifier"></dd></div>
          <div><dt>Hit points (current / starting)</dt><dd id="${identity}-hit-points"></dd></div>
          <div><dt>Armor class</dt><dd id="${identity}-armor-class"></dd></div>
        </dl>
      </article>
    `;
  }

  private static setText(root: HTMLElement, selector: string, text: string): void {
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Combat stats element ${selector} is missing.`);
    element.textContent = text;
  }

  private static signed(value: number): string {
    return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
  }

  private static playerName(player: 'player-1' | 'player-2'): string {
    return player === 'player-1' ? 'Player 1' : 'Player 2';
  }

  private static shipName(ship: 'ship-1' | 'ship-2'): string {
    return ship === 'ship-1' ? 'Ship 1' : 'Ship 2';
  }

  private static attackResult(outcome: AttackOutcome): string {
    const attacker = `${CombatControls.shipName(outcome.attacker)} (${outcome.attacker})`;
    const defender = `${CombatControls.shipName(outcome.defender)} (${outcome.defender})`;
    const total = `Attack total ${outcome.attackTotal} vs AC ${outcome.armorClass}`;
    if (outcome.kind === 'miss') {
      return `Attack result: ${attacker} missed ${defender}. ${total}. ${defender} remains at ${outcome.hitPointsAfter} HP.`;
    }
    return `Attack result: ${attacker} hit ${defender}. ${total}. Damage ${outcome.damage}; ${defender} remaining HP ${outcome.hitPointsAfter}.`;
  }
}
