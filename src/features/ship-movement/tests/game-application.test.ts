import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameApplication } from '../../../app/GameApplication.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';
import { FakeRoot } from '../../game-setup/tests/fixtures/FakeDom.js';

interface TestScene {
  readonly session: unknown;
  disposeCount: number;
  reportDrawn(revision: number): void;
}

interface TestGame {
  readonly canvas: HTMLCanvasElement;
  destroyCount: number;
}

const runtime = vi.hoisted(() => ({
  gameConfigs: [] as unknown[],
  games: [] as TestGame[],
  scenes: [] as TestScene[],
}));

vi.mock('phaser', () => ({
  default: {
    Game: class {
      readonly canvas = {
        dataset: {},
        setAttribute(): void {},
      } as unknown as HTMLCanvasElement;
      destroyCount = 0;

      constructor(config: unknown) {
        runtime.gameConfigs.push(config);
        runtime.games.push(this as unknown as TestGame);
      }

      destroy(): void {
        this.destroyCount += 1;
      }
    },
    WEBGL: 'webgl',
    Scale: { FIT: 'fit', CENTER_BOTH: 'center-both' },
  },
}));

function combatSceneMock() {
  return class {
    disposeCount = 0;
    private readonly onDrawn: (revision: number) => void;

    constructor(
      readonly session: unknown,
      _geometry: unknown,
      _controls: unknown,
      onDrawn: (revision: number) => void,
    ) {
      this.onDrawn = onDrawn;
      runtime.scenes.push(this as unknown as TestScene);
    }

    reportDrawn(revision: number): void {
      this.onDrawn(revision);
    }

    dispose(): void {
      this.disposeCount += 1;
    }
  };
}

vi.mock('../../ship-combat/presentation/CombatScene.js', () => ({
  CombatScene: combatSceneMock(),
}));
vi.mock('../presentation/MovementScene.js', () => ({ MovementScene: class {} }));
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

describe('GameApplication combat setup regression', () => {
  beforeEach(() => {
    runtime.gameConfigs.length = 0;
    runtime.games.length = 0;
    runtime.scenes.length = 0;
    vi.stubGlobal('window', new TestWindow());
  });

  it('initializes a combat battle with ten random draws while movement remains a composed mechanic', () => {
    const source = new ScriptedRandomSource([0.01, 0.91, 0.5, 0.4, 0.6, 0.2, 0.7, 0.5, 0.8, 0.1]);
    const root = new FakeRoot();
    const application = new GameApplication(root as unknown as HTMLElement, source);
    const scene = runtime.scenes[0];
    if (!scene) throw new Error('Expected a combat scene.');

    expect(source.consumedDraws).toBe(10);
    expect(runtime.gameConfigs).toHaveLength(1);
    expect(runtime.scenes).toHaveLength(1);
    expect(scene.session).toMatchObject({
      snapshot: { phase: 'movement-ready', activePlayer: 'player-1' },
    });
    scene.reportDrawn(1);
    expect(root.element('[role="status"]').textContent).toBe('Game 1 ready');
    application.dispose();
  });
});
