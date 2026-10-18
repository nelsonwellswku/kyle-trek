import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameApplication } from '../../../app/GameApplication.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';
import { FakeRoot } from './fixtures/FakeDom.js';

const runtime = vi.hoisted(() => ({
  gameConfigs: [] as unknown[],
  games: [] as unknown[],
  scenes: [] as unknown[],
}));

vi.mock('phaser', () => ({
  default: {
    Game: class {
      readonly canvas = {
        dataset: {},
        setAttribute(): void {},
      } as unknown as HTMLCanvasElement;

      constructor(config: unknown) {
        runtime.gameConfigs.push(config);
        runtime.games.push(this);
      }

      destroy(): void {}
    },
    WEBGL: 'webgl',
    Scale: { FIT: 'fit', CENTER_BOTH: 'center-both' },
  },
}));

vi.mock('../../ship-combat/presentation/CombatScene.js', () => ({
  CombatScene: class {
    constructor() {
      runtime.scenes.push(this);
    }
  },
}));
vi.mock('../../ship-movement/presentation/MovementScene.js', () => ({ MovementScene: class {} }));
vi.mock('../../ship-combat/presentation/CombatControls.js', () => ({
  CombatControls: class {
    setActionHandlers(): void {}
    renderShips(): void {}
    renderBattle(): void {}
    dispose(): void {}
  },
}));

class TestWindow {
  addEventListener(): void {}
  removeEventListener(): void {}
}

describe('GameApplication combat initialization errors', () => {
  beforeEach(() => {
    runtime.gameConfigs.length = 0;
    runtime.games.length = 0;
    runtime.scenes.length = 0;
    vi.stubGlobal('window', new TestWindow());
  });

  it('does not publish a partial battle or construct Phaser when a combat-stat draw is invalid', () => {
    const source = new ScriptedRandomSource([0.05, 0.95, 0.5, 0.5, 1, 0.3, 0.4, 0.5, 0.6, 0.7]);
    const root = new FakeRoot();

    new GameApplication(root as unknown as HTMLElement, source);

    expect(source.consumedDraws).toBe(5);
    expect(runtime.games).toHaveLength(0);
    expect(runtime.gameConfigs).toHaveLength(0);
    expect(runtime.scenes).toHaveLength(0);
    expect(root.element('[role="alert"]').hidden).toBe(false);
    expect(root.element('[role="alert"]').textContent).toContain('Unable to start the game');
  });
});
