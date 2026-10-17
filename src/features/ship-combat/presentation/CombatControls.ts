import type { CombatGame } from '../domain/CombatGame.js';

export class CombatControls {
  private isDisposed = false;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <section class="combat-stats" aria-label="Combat ship statistics">
        ${CombatControls.shipMarkup('ship-1', 'Player 1')}
        ${CombatControls.shipMarkup('ship-2', 'Player 2')}
      </section>
    `;
  }

  renderShips(game: CombatGame): void {
    if (this.isDisposed) return;
    this.renderShip(game.ship1);
    this.renderShip(game.ship2);
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.root.replaceChildren();
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
}
