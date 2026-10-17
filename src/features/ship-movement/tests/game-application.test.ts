import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameApplication } from '../../../app/GameApplication.js';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import type { TurnSession } from '../domain/TurnSession.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';
import { FakeRoot } from '../../game-setup/tests/fixtures/FakeDom.js';

interface TestGame {
  readonly canvas: HTMLCanvasElement;
  destroyCount: number;
}

interface UpdateCall {
  readonly revision: number;
  readonly game: unknown;
}

interface TestScene {
  readonly session: TurnSession;
  readonly updateCalls: UpdateCall[];
  disposeCount: number;
  updateGame(revision: number): void;
  reportDrawn(revision: number): void;
  selectDestination(position: BoardPosition): number | null;
}

const runtime = vi.hoisted(() => ({
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
          if (runtime.failGameConstruction) {
            throw new Error('WebGL initialization failed.');
          }
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

vi.mock('../presentation/MovementScene.js', () => ({
  MovementScene: class {
    readonly updateCalls: UpdateCall[] = [];
    disposeCount = 0;

    constructor(
      readonly session: TurnSession,
      _geometry: unknown,
      _controls: unknown,
      private readonly onDrawn: (revision: number) => void,
    ) {
      runtime.scenes.push(this as unknown as TestScene);
    }

    updateGame(revision: number): void {
      this.updateCalls.push({ revision, game: this.session.snapshot });
    }

    dispose(): void {
      this.disposeCount += 1;
    }

    reportDrawn(revision: number): void {
      this.onDrawn(revision);
    }

    selectDestination(position: BoardPosition): number | null {
      const snapshot = this.session.snapshot;
      if (snapshot.phase !== 'ready') {
        return null;
      }
      return this.session.selectDestination(snapshot.turnToken, position)?.moveId ?? null;
    }
  },
}));

vi.mock('../../../features/game-setup/presentation/GameSetupScene.js', () => ({
  GameSetupScene: class {},
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

function valuesForGame(
  ship1Placement: number,
  ship2Placement: number,
  ship1Agility: number,
  ship2Agility: number,
): number[] {
  return [ship1Placement, ship2Placement, ship1Agility, ship2Agility];
}

describe('GameApplication movement composition', () => {
  beforeEach(() => {
    runtime.failGameConstruction = false;
    runtime.gameConfigs.length = 0;
    runtime.games.length = 0;
    runtime.scenes.length = 0;
    vi.stubGlobal('window', new TestWindow());
  });

  it('stages fresh positions and independent agility before publishing a new ready revision', () => {
    const source = new ScriptedRandomSource([
      ...valuesForGame(0.01, 0.91, 0.5, 0.7),
      ...valuesForGame(0.41, 0.99, 0.1, 0.99),
    ]);
    const root = new FakeRoot();
    const application = new GameApplication(root as unknown as HTMLElement, source);
    const scene = runtime.scenes[0];
    if (!scene) {
      throw new Error('Expected the movement scene to be composed.');
    }
    const button = root.element('button.new-game-button');

    expect(source.consumedDraws).toBe(4);
    expect(root.element('#ship-1-position').textContent).toBe('Ship 1 — row 1, column 1');
    expect(root.element('#ship-1-agility').textContent).toBe('14');
    expect(root.element('#ship-1-modifier').textContent).toBe('+2');
    expect(root.element('#active-turn').textContent).toContain('Player 1');
    scene.reportDrawn(1);
    button.click();

    expect(source.consumedDraws).toBe(8);
    expect(scene.updateCalls).toHaveLength(1);
    expect(scene.updateCalls[0]?.revision).toBe(2);
    expect(root.element('[role="status"]').textContent).toBe('Preparing game…');
    scene.reportDrawn(2);

    expect(root.element('[role="status"]').textContent).toBe('Game 2 ready');
    expect(root.element('#ship-1-position').textContent).toBe('Ship 1 — row 1, column 9');
    expect(root.element('#ship-1-agility').textContent).toBe('9');
    expect(root.element('#ship-1-modifier').textContent).toBe('-1');
    expect(root.element('#active-turn').textContent).toContain('Player 1');
    application.dispose();
  });

  it('shows initial generation errors without publishing a partial game or starting Phaser', () => {
    const root = new FakeRoot();
    const application = new GameApplication(
      root as unknown as HTMLElement,
      new ScriptedRandomSource([0.1, 0.9, 1, 0.2]),
    );

    expect(root.element('[role="alert"]').hidden).toBe(false);
    expect(root.element('[role="alert"]').textContent).toContain('Unable to start the game');
    expect(runtime.games).toHaveLength(0);
    expect(runtime.scenes).toHaveLength(0);
    application.dispose();
  });

  it('discards an in-flight move on New Game and ignores stale arrival/readiness callbacks', () => {
    const source = new ScriptedRandomSource([
      ...valuesForGame(0.01, 0.91, 0.5, 0.7),
      ...valuesForGame(0.41, 0.99, 0.5, 0.7),
    ]);
    const root = new FakeRoot();
    const application = new GameApplication(root as unknown as HTMLElement, source);
    const scene = runtime.scenes[0];
    if (!scene) {
      throw new Error('Expected a movement scene.');
    }
    scene.reportDrawn(1);
    const moveId = scene.selectDestination(new BoardPosition(1, 2));
    expect(moveId).not.toBeNull();
    const pending = scene.session.snapshot;
    if (pending.phase !== 'moving') {
      throw new Error('Expected a pending move before New Game.');
    }
    const oldIdentity = pending.pendingMove;

    root.element('button.new-game-button').click();
    expect(scene.session.snapshot.phase).toBe('ready');
    expect(scene.session.snapshot.gameRevision).toBe(2);
    expect(
      scene.session.completeMove(
        oldIdentity.gameRevision,
        oldIdentity.turnToken,
        oldIdentity.moveId,
      ),
    ).toBe(false);
    scene.reportDrawn(1);
    expect(root.element('[role="status"]').textContent).toBe('Preparing game…');
    scene.reportDrawn(2);
    expect(root.element('[role="status"]').textContent).toBe('Game 2 ready');
    const replaced = scene.session.snapshot;
    expect(replaced.phase).not.toBe('disposed');
    if (replaced.phase !== 'disposed') {
      expect(replaced.activePlayer).toBe('player-1');
    }
    application.dispose();
  });

  it('queues repeated activations until each replacement has rendered', async () => {
    const source = new ScriptedRandomSource([
      ...valuesForGame(0, 0.99, 0.5, 0.7),
      ...valuesForGame(0, 0.99, 0.6, 0.8),
      ...valuesForGame(0, 0.99, 0.7, 0.9),
    ]);
    const root = new FakeRoot();
    const application = new GameApplication(root as unknown as HTMLElement, source);
    const scene = runtime.scenes[0];
    if (!scene) {
      throw new Error('Expected a movement scene.');
    }
    const button = root.element('button.new-game-button');
    scene.reportDrawn(1);

    button.click();
    button.click();
    expect(scene.updateCalls).toHaveLength(1);
    expect(source.consumedDraws).toBe(8);
    scene.reportDrawn(2);
    await Promise.resolve();

    expect(scene.updateCalls).toHaveLength(2);
    expect(scene.updateCalls[1]?.revision).toBe(3);
    expect(source.consumedDraws).toBe(12);
    scene.reportDrawn(3);
    expect(root.element('[role="status"]').textContent).toBe('Game 3 ready');
    application.dispose();
  });

  it('preserves the complete active game and in-flight move when replacement generation fails', () => {
    const source = new ScriptedRandomSource([
      ...valuesForGame(0.01, 0.91, 0.5, 0.7),
      0.4,
      0.9,
      1,
      0.3,
    ]);
    const root = new FakeRoot();
    const application = new GameApplication(root as unknown as HTMLElement, source);
    const scene = runtime.scenes[0];
    if (!scene) {
      throw new Error('Expected a movement scene.');
    }
    scene.reportDrawn(1);
    const moveId = scene.selectDestination(new BoardPosition(1, 2));
    expect(moveId).not.toBeNull();
    const before = scene.session.snapshot;
    if (before.phase !== 'moving') {
      throw new Error('Expected an active move before replacement failure.');
    }

    root.element('button.new-game-button').click();

    const after = scene.session.snapshot;
    expect(root.element('[role="status"]').textContent).toBe(
      'Unable to start a new game. Try again.',
    );
    expect(after.phase).toBe('moving');
    if (after.phase !== 'moving') {
      throw new Error('A failed replacement must preserve its pending move.');
    }
    expect(after.game).toBe(before.game);
    expect(after.gameRevision).toBe(before.gameRevision);
    expect(after.pendingMove).toBe(before.pendingMove);
    expect(scene.updateCalls).toHaveLength(0);
    expect(source.consumedDraws).toBe(7);
    application.dispose();
  });

  it('surfaces safe-integer revision overflow without replacing the active game', () => {
    const source = new ScriptedRandomSource([
      ...valuesForGame(0.01, 0.91, 0.5, 0.7),
      ...valuesForGame(0.41, 0.99, 0.6, 0.8),
    ]);
    const root = new FakeRoot();
    const application = new GameApplication(root as unknown as HTMLElement, source);
    const scene = runtime.scenes[0];
    if (!scene) {
      throw new Error('Expected a movement scene.');
    }
    scene.reportDrawn(1);
    const before = scene.session.snapshot;
    if (before.phase === 'disposed') {
      throw new Error('Expected an active game.');
    }
    (scene.session as unknown as { currentGameRevision: number }).currentGameRevision =
      Number.MAX_SAFE_INTEGER;

    root.element('button.new-game-button').click();

    const after = scene.session.snapshot;
    expect(root.element('[role="status"]').textContent).toBe(
      'Unable to start a new game. Try again.',
    );
    expect(after.gameRevision).toBe(Number.MAX_SAFE_INTEGER);
    if (after.phase !== 'disposed') {
      expect(after.game).toBe(before.game);
    }
    expect(scene.updateCalls).toHaveLength(0);
    expect(source.consumedDraws).toBe(8);
    application.dispose();
  });
});
