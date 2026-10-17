import { describe, expect, it, vi } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { AgilityStat } from '../domain/AgilityStat.js';
import { MovementGame } from '../domain/MovementGame.js';
import { TurnSession } from '../domain/TurnSession.js';
import { TurnControls } from '../presentation/TurnControls.js';
import { FakeRoot } from '../../game-setup/tests/fixtures/FakeDom.js';

function game(score1: number, score2: number): MovementGame {
  return new MovementGame(
    {
      identity: 'ship-1',
      owner: 'player-1',
      position: new BoardPosition(5, 5),
      agility: new AgilityStat(score1),
    },
    {
      identity: 'ship-2',
      owner: 'player-2',
      position: new BoardPosition(10, 10),
      agility: new AgilityStat(score2),
    },
  );
}

describe('TurnControls', () => {
  it('displays separate scores/modifiers and keeps the active ship/status controls stable', () => {
    const root = new FakeRoot();
    const onPass = vi.fn();
    const controls = new TurnControls(root as unknown as HTMLElement, onPass);
    const session = new TurnSession(game(18, 10));
    const passButton = root.element('button.pass-turn-button');
    const status = root.element('#turn-status');

    controls.render(session.snapshot);
    expect(root.element('#active-turn').textContent).toContain('Player 1');
    expect(root.element('#active-turn').textContent).toContain('Ship 1');
    expect(root.element('#ship-1-agility').textContent).toBe('18');
    expect(root.element('#ship-1-modifier').textContent).toBe('+4');
    expect(root.element('#ship-2-agility').textContent).toBe('10');
    expect(root.element('#ship-2-modifier').textContent).toBe('0');
    expect(passButton.hidden).toBe(true);
    expect(passButton.disabled).toBe(true);
    expect(status.attributes.get('aria-live')).toBe('polite');
    expect(status.attributes.get('role')).toBe('status');
    expect(root.innerHTML).toContain('type="button"');

    const turnStatusElement = root.element('#turn-status');
    controls.render(session.snapshot);
    expect(root.element('#turn-status')).toBe(turnStatusElement);
  });

  it('shows a native Pass turn button only for no-moves and binds its displayed turn identity', () => {
    const root = new FakeRoot();
    const onPass = vi.fn();
    const controls = new TurnControls(root as unknown as HTMLElement, onPass);
    const session = new TurnSession(game(8, 11));
    const passButton = root.element('button.pass-turn-button');

    controls.render(session.snapshot);
    expect(passButton.hidden).toBe(false);
    expect(passButton.disabled).toBe(false);
    expect(root.innerHTML).toContain('Pass turn');
    expect(root.element('#turn-status').textContent).toContain('no legal destinations');

    const firstHandler = [...(passButton.listeners.get('click') ?? [])][0];
    if (!firstHandler) {
      throw new Error('Expected a pass-turn activation listener.');
    }
    session.acknowledgePass(1, 1);
    controls.render(session.snapshot);
    firstHandler(new Event('click'));
    expect(onPass).toHaveBeenLastCalledWith(1, 1);
    passButton.click();
    expect(onPass).toHaveBeenLastCalledWith(1, 2);

    controls.dispose();
    expect(passButton.listeners.get('click')?.size ?? 0).toBe(0);
  });
});
