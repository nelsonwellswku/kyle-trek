import { describe, expect, it } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { MovementGame } from '../../ship-movement/domain/MovementGame.js';
import { GameSetup } from '../domain/GameSetup.js';
import { GameSetupControls } from '../presentation/GameSetupControls.js';
import { FakeRoot } from './fixtures/FakeDom.js';

describe('GameSetupControls', () => {
  it('provides a stable turn HUD host and refreshes summaries from live board snapshots', () => {
    const root = new FakeRoot();
    const controls = new GameSetupControls(root as unknown as HTMLElement);
    const hudHost = controls.turnHudHost;

    expect(hudHost).toBe(root.element('#turn-hud'));
    expect(root.innerHTML).toContain('id="turn-hud"');

    controls.showSetup(
      new GameSetup(
        { identity: 'ship-1', position: new BoardPosition(1, 2) },
        { identity: 'ship-2', position: new BoardPosition(10, 9) },
      ),
    );
    controls.updateBoard(
      new MovementGame(
        {
          identity: 'ship-1',
          owner: 'player-1',
          position: new BoardPosition(5, 6),
          agility: new AgilityStat(14),
        },
        {
          identity: 'ship-2',
          owner: 'player-2',
          position: new BoardPosition(7, 8),
          agility: new AgilityStat(18),
        },
      ),
    );

    expect(root.element('#ship-1-position').textContent).toContain('row 5, column 6');
    expect(root.element('#ship-2-position').textContent).toContain('row 7, column 8');
    expect(controls.turnHudHost).toBe(hudHost);
  });
});
