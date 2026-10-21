import { describe, expect, it } from 'vitest';
import { CubePosition } from '../../board/domain/CubePosition.js';
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
        { identity: 'ship-1', position: new CubePosition(2, 1, 1) },
        { identity: 'ship-2', position: new CubePosition(9, 10, 10) },
      ),
    );
    controls.updateBoard(
      new MovementGame(
        {
          identity: 'ship-1',
          owner: 'player-1',
          position: new CubePosition(6, 5, 1),
          agility: new AgilityStat(14),
        },
        {
          identity: 'ship-2',
          owner: 'player-2',
          position: new CubePosition(8, 7, 1),
          agility: new AgilityStat(18),
        },
      ),
    );

    expect(root.element('#ship-1-position').textContent).toContain('X 6, Y 5, Z 1');
    expect(root.element('#ship-2-position').textContent).toContain('X 8, Y 7, Z 1');
    expect(root.element('#ship-1-position').textContent).toContain('occupied');
    expect(root.innerHTML).toContain(
      'aria-label="Cube axes: X left and right, Y front and back, Z up and down"',
    );
    expect(root.innerHTML).toContain('aria-label="Rotate the cube viewing angle"');
    expect(root.element('#cube-inspection').textContent).toContain('Hover over a cell marker');
    controls.updateInspection(new CubePosition(4, 5, 6), null);
    expect(root.element('#cube-inspection').textContent).toBe('Cell X 4, Y 5, Z 6 — empty.');
    expect(controls.turnHudHost).toBe(hudHost);
  });
});
