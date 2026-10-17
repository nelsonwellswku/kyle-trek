import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameApplication } from '../../../app/GameApplication.js';
import type { BattleSession } from '../domain/BattleSession.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';
import { FakeRoot } from '../../game-setup/tests/fixtures/FakeDom.js';

interface TestGame {
  readonly canvas: HTMLCanvasElement;
  destroyCount: number;
}

interface TestScene {
  readonly session: unknown;
  readonly updateCalls: number[];
  disposeCount: number;
  reportDrawn(revision: number): void;
  updateGame(revision: number): void;
}

const runtime = vi.hoisted(() => ({
  failGameConstruction: false,
  gameConfigs: [] as unknown[],
  games: [] as TestGame[],
  scenes: [] as TestScene[],
  combatBoardReadiness: [] as boolean[],
}));

vi.mock('phaser', () => {
  const createCanvas = (): HTMLCanvasElement => {
    const attributes = new Map<string, string>();
    return {
      dataset: {},
      setAttribute(name: string, value: string): void {
        attributes.set(name, value);
      },
      getAttribute(name: string): string | null {
        return attributes.get(name) ?? null;
      },
    } as unknown as HTMLCanvasElement;
  };

  return {
    default: {
      Game: class {
        readonly canvas = createCanvas();
        destroyCount = 0;

        constructor(config: unknown) {
          if (runtime.failGameConstruction) throw new Error('WebGL initialization failed.');
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
  };
});

function sceneMock() {
  return class {
    readonly updateCalls: number[] = [];
    disposeCount = 0;
    private readonly onDrawn: (revision: number) => void;

    constructor(
      readonly session: unknown,
      ...rest: unknown[]
    ) {
      this.onDrawn = rest[2] as (revision: number) => void;
      runtime.scenes.push(this as unknown as TestScene);
    }

    updateGame(revision: number): void {
      this.updateCalls.push(revision);
    }

    dispose(): void {
      this.disposeCount += 1;
    }

    reportDrawn(revision: number): void {
      this.onDrawn(revision);
    }
  };
}

vi.mock('../presentation/CombatScene.js', () => ({ CombatScene: sceneMock() }));
vi.mock('../../ship-movement/presentation/MovementScene.js', () => ({
  MovementScene: sceneMock(),
}));
vi.mock('../presentation/CombatControls.js', () => ({
  CombatControls: class {
    setActionHandlers(): void {}
    renderShips(): void {}
    renderBattle(_snapshot: unknown, boardReady = true): void {
      runtime.combatBoardReadiness.push(boardReady);
    }
    dispose(): void {}
  },
}));

class TestWindow {
  addEventListener(): void {}
  removeEventListener(): void {}
}

function battleDraws(position1 = 0.01, position2 = 0.91): number[] {
  return [position1, position2, 0.5, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.1];
}

function battleSession(scene: TestScene): BattleSession {
  return scene.session as BattleSession;
}

describe('GameApplication combat composition', () => {
  beforeEach(() => {
    runtime.failGameConstruction = false;
    runtime.gameConfigs.length = 0;
    runtime.games.length = 0;
    runtime.scenes.length = 0;
    runtime.combatBoardReadiness.length = 0;
    vi.stubGlobal('window', new TestWindow());
  });

  it('draws ten initialization samples, starts one combat scene/canvas, and waits for matching readiness', () => {
    const source = new ScriptedRandomSource(battleDraws());
    const root = new FakeRoot();
    const application = new GameApplication(root as unknown as HTMLElement, source);
    const scene = runtime.scenes[0];
    if (!scene) throw new Error('Expected the combat scene to be composed.');

    expect(source.consumedDraws).toBe(10);
    expect(runtime.combatBoardReadiness).toEqual([false]);
    expect(runtime.games).toHaveLength(1);
    expect(runtime.gameConfigs).toHaveLength(1);
    expect(runtime.scenes).toHaveLength(1);
    expect(battleSession(scene).snapshot).toMatchObject({
      phase: 'movement-ready',
      activePlayer: 'player-1',
      gameRevision: 1,
    });
    expect(root.element('button.new-game-button').disabled).toBe(true);

    scene.reportDrawn(2);
    expect(root.element('[role="status"]').textContent).toBe('Preparing game…');
    scene.reportDrawn(1);
    expect(root.element('[role="status"]').textContent).toBe('Game 1 ready');
    expect(runtime.combatBoardReadiness).toEqual([false, true]);
    expect(runtime.games[0]?.canvas.getAttribute('aria-label')).toBe(
      'Two-player spaceship combat board',
    );
    expect(root.element('button.new-game-button').disabled).toBe(false);

    application.dispose();
    expect(runtime.games[0]?.destroyCount).toBe(1);
    expect(scene.disposeCount).toBe(1);
  });

  it('keeps the current battle intact when replacement generation fails', () => {
    const source = new ScriptedRandomSource([...battleDraws(), 1]);
    const root = new FakeRoot();
    const application = new GameApplication(root as unknown as HTMLElement, source);
    const scene = runtime.scenes[0];
    if (!scene) throw new Error('Expected the combat scene to be composed.');
    scene.reportDrawn(1);
    const before = battleSession(scene).snapshot;
    if (before.phase === 'disposed') throw new Error('Expected a live battle before replacement.');

    root.element('button.new-game-button').click();

    expect(source.consumedDraws).toBe(11);
    const after = battleSession(scene).snapshot;
    if (after.phase === 'disposed') throw new Error('The active battle must remain live.');
    expect(after.gameRevision).toBe(before.gameRevision);
    expect(after.game).toBe(before.game);
    expect(scene.updateCalls).toEqual([]);
    expect(root.element('[role="status"]').textContent).toBe(
      'Unable to start a new game. Try again.',
    );
    expect(runtime.games).toHaveLength(1);
    application.dispose();
  });

  it('serializes replacements and ignores readiness from an obsolete revision without creating another canvas', async () => {
    const source = new ScriptedRandomSource([
      ...battleDraws(),
      ...battleDraws(0.2, 0.8),
      ...battleDraws(0.3, 0.7),
    ]);
    const root = new FakeRoot();
    const application = new GameApplication(root as unknown as HTMLElement, source);
    const scene = runtime.scenes[0];
    if (!scene) throw new Error('Expected the combat scene to be composed.');
    const newGameButton = root.element('button.new-game-button');
    scene.reportDrawn(1);

    newGameButton.click();
    newGameButton.click();
    expect(scene.updateCalls).toEqual([2]);
    expect(source.consumedDraws).toBe(20);
    expect(runtime.games).toHaveLength(1);
    expect(runtime.scenes).toHaveLength(1);

    scene.reportDrawn(1);
    expect(root.element('[role="status"]').textContent).toBe('Preparing game…');
    scene.reportDrawn(2);
    await Promise.resolve();

    expect(scene.updateCalls).toEqual([2, 3]);
    expect(source.consumedDraws).toBe(30);
    expect(runtime.games).toHaveLength(1);
    expect(runtime.scenes).toHaveLength(1);
    scene.reportDrawn(3);
    expect(root.element('[role="status"]').textContent).toBe('Game 3 ready');
    expect(battleSession(scene).snapshot).toMatchObject({
      gameRevision: 3,
      activePlayer: 'player-1',
    });
    application.dispose();
  });
});
