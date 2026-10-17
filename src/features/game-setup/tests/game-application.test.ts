import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameApplication } from '../../../app/GameApplication.js';
import type { TurnSession } from '../../ship-movement/domain/TurnSession.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';
import { FakeRoot } from './fixtures/FakeDom.js';

interface TestGame {
  readonly canvas: HTMLCanvasElement;
  destroyCount: number;
}

interface TestScene {
  readonly session: TurnSession;
  readonly updateCalls: Array<{ readonly setup: unknown; readonly revision: number }>;
  disposeCount: number;
  reportDrawn(revision: number): void;
}

const testRuntime = vi.hoisted(() => ({
  failGameConstruction: false,
  gameConfigs: [] as unknown[],
  games: [] as TestGame[],
  scenes: [] as TestScene[],
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
          if (testRuntime.failGameConstruction) {
            throw new Error('WebGL initialization failed.');
          }

          testRuntime.gameConfigs.push(config);
          testRuntime.games.push(this as unknown as TestGame);
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

vi.mock('../../ship-movement/presentation/MovementScene.js', () => ({
  MovementScene: class {
    readonly updateCalls: Array<{ readonly setup: unknown; readonly revision: number }> = [];
    disposeCount = 0;

    constructor(
      readonly session: TurnSession,
      _geometry: unknown,
      _controls: unknown,
      private readonly onDrawn: (revision: number) => void,
    ) {
      testRuntime.scenes.push(this as unknown as TestScene);
    }

    updateGame(revision: number): void {
      this.updateCalls.push({ setup: this.session.snapshot, revision });
    }

    dispose(): void {
      this.disposeCount += 1;
    }

    reportDrawn(revision: number): void {
      this.onDrawn(revision);
    }
  },
}));

class TestWindow {
  private readonly errorHandlers = new Set<(event: ErrorEvent) => void>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === 'error' && typeof listener === 'function') {
      this.errorHandlers.add(listener as (event: ErrorEvent) => void);
    }
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === 'error' && typeof listener === 'function') {
      this.errorHandlers.delete(listener as (event: ErrorEvent) => void);
    }
  }
}

describe('GameApplication', () => {
  beforeEach(() => {
    testRuntime.failGameConstruction = false;
    testRuntime.gameConfigs.length = 0;
    testRuntime.games.length = 0;
    testRuntime.scenes.length = 0;
    vi.stubGlobal('window', new TestWindow());
  });

  it('publishes readiness only after drawing, routes New Game, and retains a failed replacement for recovery', () => {
    const source = new ScriptedRandomSource([
      0.01, 0.91, 0.5, 0.7, 0.21, 0.71, 0.5, 0.6, 0.41, 1, 0.99, 0.99, 0.4, 0.8,
    ]);
    const root = new FakeRoot();
    const application = new GameApplication(root as unknown as HTMLElement, source);
    const controls = {
      button: root.element('button.new-game-button'),
      status: root.element('[role="status"]'),
      ship1: root.element('#ship-1-position'),
      ship2: root.element('#ship-2-position'),
    };
    const scene = testRuntime.scenes[0];

    expect(controls.status.textContent).toBe('Preparing game…');
    expect(controls.button.disabled).toBe(true);
    expect(source.consumedDraws).toBe(4);
    expect(testRuntime.games).toHaveLength(1);

    scene?.reportDrawn(1);

    expect(controls.status.textContent).toBe('Game 1 ready');
    expect(controls.button.disabled).toBe(false);
    expect(controls.ship1.textContent).toBe('Ship 1 — row 1, column 1');
    expect(controls.ship2.textContent).toBe('Ship 2 — row 10, column 9');
    expect(testRuntime.games[0]?.canvas.getAttribute('aria-describedby')).toBe(
      'board-description ship-summary turn-hud',
    );

    controls.button.click();

    expect(controls.status.textContent).toBe('Preparing game…');
    expect(scene?.updateCalls).toHaveLength(1);
    expect(scene?.updateCalls[0]?.revision).toBe(2);
    expect(source.consumedDraws).toBe(8);

    scene?.reportDrawn(2);

    expect(controls.status.textContent).toBe('Game 2 ready');
    expect(controls.ship1.textContent).toBe('Ship 1 — row 1, column 5');
    expect(controls.ship2.textContent).toBe('Ship 2 — row 10, column 5');
    scene?.reportDrawn(1);
    scene?.reportDrawn(2);
    expect(controls.status.textContent).toBe('Game 2 ready');
    expect(scene?.updateCalls).toHaveLength(1);
    expect(source.consumedDraws).toBe(8);

    const failedSetupSummary = [controls.ship1.textContent, controls.ship2.textContent];
    controls.button.click();

    expect(controls.status.textContent).toBe('Unable to start a new game. Try again.');
    expect([controls.ship1.textContent, controls.ship2.textContent]).toEqual(failedSetupSummary);
    expect(scene?.updateCalls).toHaveLength(1);
    expect(source.consumedDraws).toBe(10);
    expect(controls.button.disabled).toBe(false);

    controls.button.click();

    expect(controls.status.textContent).toBe('Preparing game…');
    expect(scene?.updateCalls).toHaveLength(2);
    expect(scene?.updateCalls[1]?.revision).toBe(3);
    expect(source.consumedDraws).toBe(14);

    scene?.reportDrawn(3);

    expect(controls.status.textContent).toBe('Game 3 ready');
    expect(controls.ship1.textContent).toBe('Ship 1 — row 2, column 10');
    expect(controls.ship2.textContent).toBe('Ship 2 — row 10, column 10');

    application.dispose();
  });

  it('shows the documented startup error if Phaser cannot construct the game', () => {
    testRuntime.failGameConstruction = true;
    const root = new FakeRoot();

    new GameApplication(root as unknown as HTMLElement, new ScriptedRandomSource([0, 0, 0.5, 0.5]));

    expect(root.element('[role="alert"]').textContent).toBe(
      'Unable to start the game. Check that WebGL is available and reload the page.',
    );
    expect(root.element('[role="alert"]').hidden).toBe(false);
    expect(root.element('[role="status"]').textContent).toBe('');
    expect(root.element('button.new-game-button').disabled).toBe(true);
    expect(root.element('#game-board').childrenWereReplaced).toBe(true);
  });

  it('serializes activations and advances the ready revision when layouts repeat', async () => {
    const source = new ScriptedRandomSource([
      0, 0.95, 0.5, 0.5, 0, 0.95, 0.5, 0.5, 0, 0.95, 0.5, 0.5,
    ]);
    const root = new FakeRoot();
    const application = new GameApplication(root as unknown as HTMLElement, source);
    const button = root.element('button.new-game-button');
    const scene = testRuntime.scenes[0];

    scene?.reportDrawn(1);
    const initialSummary = [
      root.element('#ship-1-position').textContent,
      root.element('#ship-2-position').textContent,
    ];

    button.click();
    button.click();

    expect(scene?.updateCalls).toHaveLength(1);
    expect(scene?.updateCalls[0]?.revision).toBe(2);
    expect(source.consumedDraws).toBe(8);

    scene?.reportDrawn(2);
    await Promise.resolve();

    expect(scene?.updateCalls).toHaveLength(2);
    expect(scene?.updateCalls[1]?.revision).toBe(3);
    expect(scene?.updateCalls[1]?.setup).toMatchObject({
      game: {
        ship1: { position: { row: 1, column: 1 } },
        ship2: { position: { row: 10, column: 10 } },
      },
    });
    expect(source.consumedDraws).toBe(12);
    expect(root.element('button.new-game-button')).toBe(button);

    scene?.reportDrawn(3);

    expect(root.element('[role="status"]').textContent).toBe('Game 3 ready');
    const repeatedSummary = [
      root.element('#ship-1-position').textContent,
      root.element('#ship-2-position').textContent,
    ];
    expect(repeatedSummary).toEqual(initialSummary);
    expect(source.consumedDraws).toBe(12);

    application.dispose();
  });

  it('disposes application collaborators and the owned Phaser game once', () => {
    const root = new FakeRoot();
    const application = new GameApplication(
      root as unknown as HTMLElement,
      new ScriptedRandomSource([0, 0, 0.5, 0.5]),
    );
    const game = testRuntime.games[0];
    const scene = testRuntime.scenes[0];
    scene?.reportDrawn(1);

    application.dispose();
    application.dispose();
    root.element('button.new-game-button').click();

    expect(game?.destroyCount).toBe(1);
    expect(scene?.disposeCount).toBe(1);
    expect(scene?.updateCalls).toHaveLength(0);
  });
});
