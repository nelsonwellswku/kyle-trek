import { describe, expect, it } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';
import { CombatGame, type CombatShip } from '../domain/CombatGame.js';
import { CombatControls } from '../presentation/CombatControls.js';
import { FakeElement } from './fixtures/FakeDom.js';

function combatGame(strengthScore = 14): CombatGame {
  const ship = (identity: 'ship-1' | 'ship-2', row: number): CombatShip => ({
    identity,
    owner: identity === 'ship-1' ? 'player-1' : 'player-2',
    position: new BoardPosition(row, 4),
    agility: new AgilityStat(8),
    strength: new AbilityStat(strengthScore),
    constitution: new AbilityStat(18),
    armorClass: 12,
    startingHitPoints: 20,
    hitPoints: identity === 'ship-1' ? 17 : 9,
  });
  return new CombatGame(ship('ship-1', 1), ship('ship-2', 10));
}

function render(game: CombatGame): FakeElement {
  const root = new FakeElement();
  new CombatControls(root as unknown as HTMLElement).renderShips(game);
  return root;
}

describe('CombatControls.renderShips', () => {
  it('renders both ships, owners, separately labeled scores/modifiers, HP, and armor class', () => {
    const root = render(combatGame());
    expect(root.innerHTML).toContain('<dl class="combat-stat-list">');
    expect(root.querySelector<HTMLElement>('.combat-turn-controls')?.hidden).toBe(true);
    expect(root.innerHTML).toContain('<dt>Agility score</dt>');
    expect(root.innerHTML).toContain('<dt>Strength modifier</dt>');
    expect(root.innerHTML).toContain('<dt>Constitution modifier</dt>');
    for (const identity of ['ship-1', 'ship-2'] as const) {
      expect(root.querySelector(`#${identity}-identity`)?.textContent).toBe(identity);
      expect(root.querySelector(`#${identity}-owner`)?.textContent).toBe(
        identity === 'ship-1' ? 'Player 1' : 'Player 2',
      );
      expect(root.querySelector(`#${identity}-agility`)?.textContent).toBe('8');
      expect(root.querySelector(`#${identity}-agility-modifier`)?.textContent).toBe('−1');
      expect(root.querySelector(`#${identity}-strength`)?.textContent).toBe('14');
      expect(root.querySelector(`#${identity}-strength-modifier`)?.textContent).toBe('+2');
      expect(root.querySelector(`#${identity}-constitution`)?.textContent).toBe('18');
      expect(root.querySelector(`#${identity}-constitution-modifier`)?.textContent).toBe('+4');
      expect(root.querySelector(`#${identity}-armor-class`)?.textContent).toBe('12');
    }
    expect(root.querySelector('#ship-1-hit-points')?.textContent).toBe('17 / 20');
    expect(root.querySelector('#ship-2-hit-points')?.textContent).toBe('9 / 20');
  });

  it('is idempotent on repeat rendering and refreshes values for a replacement battle', () => {
    const root = new FakeElement();
    const controls = new CombatControls(root as unknown as HTMLElement);
    const initial = combatGame(14);
    controls.renderShips(initial);
    const strengthElement = root.querySelector('#ship-1-strength');
    controls.renderShips(initial);
    expect(root.querySelector('#ship-1-strength')).toBe(strengthElement);
    expect(strengthElement?.textContent).toBe('14');

    controls.renderShips(combatGame(20));
    expect(strengthElement?.textContent).toBe('20');
    expect(root.querySelector('#ship-1-strength-modifier')?.textContent).toBe('+5');
    controls.dispose();
    controls.dispose();
    expect(() => controls.renderShips(combatGame(14))).not.toThrow();
  });
});
