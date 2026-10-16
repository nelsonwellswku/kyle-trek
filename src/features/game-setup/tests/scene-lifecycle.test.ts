import { describe, expect, it, vi } from 'vitest';
import { BoardGeometry } from '../presentation/BoardGeometry.js';
import { GameSetupScene } from '../presentation/GameSetupScene.js';
import { GameSession } from '../domain/GameSession.js';
import { GameSetupFactory } from '../domain/GameSetupFactory.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';

interface TestEventEmitter {
  emit(event: string, ...args: unknown[]): void;
  listenerCount(event: string): number;
}

const sceneHarness = vi.hoisted(() => ({
  graphics: [] as Array<{
    clear: ReturnType<typeof vi.fn>;
    fillCircle: ReturnType<typeof vi.fn>;
    lineBetween: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('phaser', () => {
  interface EventHandler {
    (...args: unknown[]): void;
  }

  interface EventListener {
    readonly handler: EventHandler;
    readonly once: boolean;
    readonly context: unknown;
  }

  class MockEventEmitter {
    private readonly listeners = new Map<string, EventListener[]>();

    once(event: string, handler: EventHandler, context?: unknown): void {
      const current = this.listeners.get(event) ?? [];
      current.push({ handler, once: true, context });
      this.listeners.set(event, current);
    }

    off(event: string, handler: EventHandler): void {
      const current = this.listeners.get(event);
      if (current) {
        this.listeners.set(
          event,
          current.filter((listener) => listener.handler !== handler),
        );
      }
    }

    emit(event: string, ...args: unknown[]): void {
      const current = [...(this.listeners.get(event) ?? [])];
      for (const listener of current) {
        if (listener.once) {
          this.off(event, listener.handler);
        }
        listener.handler.apply(listener.context, args);
      }
    }

    listenerCount(event: string): number {
      return this.listeners.get(event)?.length ?? 0;
    }
  }

  class SceneBase {
    readonly events = new MockEventEmitter();
    readonly game = { events: new MockEventEmitter() };
    readonly add = {
      graphics: () => {
        const graphics = {
          clear: vi.fn().mockReturnThis(),
          fillStyle: vi.fn().mockReturnThis(),
          fillRect: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          lineBetween: vi.fn().mockReturnThis(),
          fillCircle: vi.fn().mockReturnThis(),
          strokeCircle: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        };
        sceneHarness.graphics.push(graphics);
        return graphics;
      },
      text: vi.fn((_x: number, _y: number, text: string) => ({
        text,
        setOrigin: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
    };

    constructor() {}
  }

  return {
    default: {
      Scene: SceneBase,
      Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    },
  };
});

describe('GameSetupScene lifecycle', () => {
  it('retains the setup and revision through redraw and scene recreation without placement draws', () => {
    sceneHarness.graphics.length = 0;
    const source = new ScriptedRandomSource([0.01, 0.91, 0.21, 0.71]);
    const session = new GameSession(new GameSetupFactory(source));
    const onDrawn = vi.fn();
    const scene = new GameSetupScene(session.currentSetup, new BoardGeometry(600), onDrawn);
    const harness = scene as unknown as {
      readonly events: TestEventEmitter;
      readonly game: { readonly events: TestEventEmitter };
    };

    scene.create();
    expect(source.consumedDraws).toBe(2);
    expect(harness.game.events.listenerCount('postrender')).toBe(1);
    harness.game.events.emit('postrender');
    expect(onDrawn).toHaveBeenLastCalledWith(1);

    const replacement = session.newGame();
    scene.updateSetup(replacement, session.revision);
    expect(source.consumedDraws).toBe(4);
    expect(harness.game.events.listenerCount('postrender')).toBe(1);
    harness.game.events.emit('postrender');
    expect(onDrawn).toHaveBeenLastCalledWith(2);
    expect(sceneHarness.graphics[0]?.fillCircle.mock.calls.slice(-2)).toEqual([
      [270, 30, 21],
      [270, 570, 21],
    ]);

    scene.updateSetup(session.currentSetup, session.revision);
    expect(source.consumedDraws).toBe(4);
    harness.game.events.emit('postrender');
    expect(onDrawn).toHaveBeenLastCalledWith(2);

    harness.events.emit('shutdown');
    expect(harness.game.events.listenerCount('postrender')).toBe(0);

    scene.create();
    expect(source.consumedDraws).toBe(4);
    expect(harness.game.events.listenerCount('postrender')).toBe(1);
    harness.game.events.emit('postrender');

    expect(onDrawn.mock.calls.map(([revision]) => revision)).toEqual([1, 2, 2, 2]);
    expect(sceneHarness.graphics[1]?.fillCircle.mock.calls).toEqual([
      [270, 30, 21],
      [270, 570, 21],
    ]);
    expect(session.currentSetup).toBe(replacement);
    expect(session.revision).toBe(2);
    expect(source.consumedDraws).toBe(4);

    scene.dispose();
  });
});
