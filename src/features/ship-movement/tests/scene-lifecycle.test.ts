import { describe, expect, it, vi } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import { AgilityStat } from '../domain/AgilityStat.js';
import { MovementGame } from '../domain/MovementGame.js';
import { TurnSession } from '../domain/TurnSession.js';
import { MovementScene } from '../presentation/MovementScene.js';
import type {
  FlightAnimator,
  FlightHandle,
  FlightIdentity,
} from '../presentation/FlightAnimator.js';
import { ControlledFlightAnimator } from './fixtures/ControlledFlightAnimator.js';

interface EventEmitterPort {
  emit(event: string, ...args: unknown[]): void;
  listenerCount(event: string): number;
}

const sceneHarness = vi.hoisted(() => ({
  gameEvents: null as null | {
    emit(event: string, ...args: unknown[]): void;
    listenerCount(event: string): number;
  },
  input: null as null | {
    emit(event: string, ...args: unknown[]): void;
    listenerCount(event: string): number;
  },
}));

vi.mock('phaser', () => {
  interface Listener {
    readonly callback: (...args: unknown[]) => void;
    readonly once: boolean;
    readonly context: unknown;
  }

  class MockEventEmitter {
    private readonly listeners = new Map<string, Listener[]>();

    on(event: string, callback: (...args: unknown[]) => void, context?: unknown): void {
      const current = this.listeners.get(event) ?? [];
      current.push({ callback, once: false, context });
      this.listeners.set(event, current);
    }

    once(event: string, callback: (...args: unknown[]) => void, context?: unknown): void {
      const current = this.listeners.get(event) ?? [];
      current.push({ callback, once: true, context });
      this.listeners.set(event, current);
    }

    off(event: string, callback: (...args: unknown[]) => void): void {
      this.listeners.set(
        event,
        (this.listeners.get(event) ?? []).filter((listener) => listener.callback !== callback),
      );
    }

    emit(event: string, ...args: unknown[]): void {
      for (const listener of [...(this.listeners.get(event) ?? [])]) {
        if (listener.once) {
          this.off(event, listener.callback);
        }
        listener.callback.apply(listener.context, args);
      }
    }

    listenerCount(event: string): number {
      return this.listeners.get(event)?.length ?? 0;
    }
  }

  class SceneBase {
    readonly events = new MockEventEmitter();
    readonly game = { events: new MockEventEmitter() };
    readonly input = new MockEventEmitter();
    readonly add = {
      graphics: () => ({
        clear: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        lineBetween: vi.fn().mockReturnThis(),
        strokeRect: vi.fn().mockReturnThis(),
        fillCircle: vi.fn().mockReturnThis(),
        strokeCircle: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      }),
      text: vi.fn((_x: number, _y: number, text: string) => ({
        text,
        setOrigin: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      container: vi.fn((x: number, y: number) => ({
        setPosition: vi.fn().mockReturnThis(),
        x,
        y,
        destroy: vi.fn(),
      })),
    };

    constructor() {
      sceneHarness.gameEvents = this.game.events;
      sceneHarness.input = this.input;
    }
  }

  return {
    default: {
      Scene: SceneBase,
      Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
      Curves: { Path: class {} },
    },
  };
});

function session(): TurnSession {
  return new TurnSession(
    new MovementGame(
      {
        identity: 'ship-1',
        owner: 'player-1',
        position: new BoardPosition(5, 5),
        agility: new AgilityStat(14),
      },
      {
        identity: 'ship-2',
        owner: 'player-2',
        position: new BoardPosition(10, 10),
        agility: new AgilityStat(18),
      },
    ),
  );
}

class LateCallbackAnimator implements FlightAnimator {
  private identity: FlightIdentity | null = null;
  private completeHandler: ((identity: FlightIdentity) => void) | null = null;
  private failureHandler: ((identity: FlightIdentity, error: Error) => void) | null = null;
  cancelled = false;
  onCancel: (() => void) | null = null;

  start(
    move: Parameters<FlightAnimator['start']>[0],
    _progress: Parameters<FlightAnimator['start']>[1],
    onComplete: Parameters<FlightAnimator['start']>[2],
    onFailure: Parameters<FlightAnimator['start']>[3],
  ): FlightHandle {
    this.identity = Object.freeze({
      gameRevision: move.gameRevision,
      turnToken: move.turnToken,
      moveId: move.moveId,
    });
    this.completeHandler = onComplete;
    this.failureHandler = onFailure;
    return {
      identity: this.identity,
      cancel: () => {
        this.cancelled = true;
        this.onCancel?.();
      },
    };
  }

  deliverSuccess(): void {
    if (this.identity) {
      this.completeHandler?.(this.identity);
    }
  }

  deliverFailure(): void {
    if (this.identity) {
      this.failureHandler?.(this.identity, new Error('late failure'));
    }
  }
}

function sceneWithHarness() {
  const gameSession = session();
  const controls = { render: vi.fn(), dispose: vi.fn() };
  const animator = new ControlledFlightAnimator();
  const onDrawn = vi.fn();
  const scene = new MovementScene(
    gameSession,
    new BoardGeometry(600),
    controls as never,
    onDrawn,
    vi.fn(),
    animator,
  );
  return { gameSession, controls, animator, onDrawn, scene };
}

describe('MovementScene lifecycle', () => {
  it('gates logical left-click movement until the matching revision has rendered', () => {
    const { gameSession, animator, onDrawn, scene } = sceneWithHarness();
    const harness = scene as unknown as {
      readonly input: EventEmitterPort;
      readonly game: { readonly events: EventEmitterPort };
    };

    scene.create();
    harness.input.emit('pointerdown', { button: 0, worldX: 330, worldY: 270 });
    expect(gameSession.snapshot.phase).toBe('ready');
    expect(animator.startedFlights).toHaveLength(0);
    expect(harness.input.listenerCount('pointerdown')).toBe(1);

    harness.game.events.emit('postrender');
    expect(onDrawn).toHaveBeenCalledWith(1);
    harness.input.emit('pointerdown', { button: 2, worldX: 330, worldY: 270 });
    expect(gameSession.snapshot.phase).toBe('ready');
    harness.input.emit('pointerdown', { button: 0, worldX: 330, worldY: 270 });
    expect(gameSession.snapshot.phase).toBe('moving');
    expect(animator.startedFlights).toHaveLength(1);
  });

  it('removes pointer and postrender listeners and rejects stale render readiness on shutdown', () => {
    const { onDrawn, scene } = sceneWithHarness();
    const harness = scene as unknown as {
      readonly events: EventEmitterPort;
      readonly input: EventEmitterPort;
      readonly game: { readonly events: EventEmitterPort };
    };

    scene.create();
    harness.events.emit('shutdown');
    expect(harness.input.listenerCount('pointerdown')).toBe(0);
    expect(harness.game.events.listenerCount('postrender')).toBe(0);
    expect(onDrawn).not.toHaveBeenCalled();
    harness.game.events.emit('postrender');
    expect(onDrawn).not.toHaveBeenCalled();
  });

  it('cancels the current flight during scene disposal', () => {
    const { animator, scene } = sceneWithHarness();
    const harness = scene as unknown as {
      readonly input: EventEmitterPort;
      readonly game: { readonly events: EventEmitterPort };
    };

    scene.create();
    harness.game.events.emit('postrender');
    harness.input.emit('pointerdown', { button: 0, worldX: 330, worldY: 270 });
    scene.dispose();
    expect(animator.startedFlights[0]?.cancelled).toBe(true);
    expect(harness.input.listenerCount('pointerdown')).toBe(0);
  });

  it('invalidates a near-completion flight before cancelling and rendering New Game', () => {
    const gameSession = session();
    const controls = { render: vi.fn(), dispose: vi.fn() };
    const animator = new LateCallbackAnimator();
    const onDrawn = vi.fn();
    const scene = new MovementScene(
      gameSession,
      new BoardGeometry(600),
      controls as never,
      onDrawn,
      vi.fn(),
      animator,
    );
    const harness = scene as unknown as {
      readonly input: EventEmitterPort;
      readonly game: { readonly events: EventEmitterPort };
    };

    scene.create();
    harness.game.events.emit('postrender');
    harness.input.emit('pointerdown', { button: 0, worldX: 330, worldY: 270 });
    const replacement = new MovementGame(
      {
        identity: 'ship-1',
        owner: 'player-1',
        position: new BoardPosition(2, 2),
        agility: new AgilityStat(16),
      },
      {
        identity: 'ship-2',
        owner: 'player-2',
        position: new BoardPosition(9, 9),
        agility: new AgilityStat(18),
      },
    );
    const revision = gameSession.newGame(replacement);
    scene.updateGame(revision);

    expect(animator.cancelled).toBe(true);
    animator.deliverSuccess();
    animator.deliverFailure();
    const current = gameSession.snapshot;
    expect(current.gameRevision).toBe(2);
    expect(current.phase).toBe('ready');
    if (current.phase !== 'disposed') {
      expect(current.activePlayer).toBe('player-1');
      expect(current.game).toBe(replacement);
    }
    expect(onDrawn).toHaveBeenCalledTimes(1);
    harness.game.events.emit('postrender');
    expect(onDrawn).toHaveBeenLastCalledWith(2);
  });

  it('rejects resets before first readiness, cancellation-time callbacks, and callbacks after shutdown', () => {
    const gameSession = session();
    const controls = { render: vi.fn(), dispose: vi.fn() };
    const animator = new LateCallbackAnimator();
    const onDrawn = vi.fn();
    const scene = new MovementScene(
      gameSession,
      new BoardGeometry(600),
      controls as never,
      onDrawn,
      vi.fn(),
      animator,
    );
    const harness = scene as unknown as {
      readonly input: EventEmitterPort;
      readonly events: EventEmitterPort;
      readonly game: { readonly events: EventEmitterPort };
    };

    scene.create();
    const beforeReady = new MovementGame(
      {
        identity: 'ship-1',
        owner: 'player-1',
        position: new BoardPosition(2, 2),
        agility: new AgilityStat(16),
      },
      {
        identity: 'ship-2',
        owner: 'player-2',
        position: new BoardPosition(9, 9),
        agility: new AgilityStat(18),
      },
    );
    const beforeReadyRevision = gameSession.newGame(beforeReady);
    scene.updateGame(beforeReadyRevision);
    harness.game.events.emit('postrender');
    expect(onDrawn).toHaveBeenCalledTimes(1);
    expect(onDrawn).toHaveBeenCalledWith(beforeReadyRevision);

    harness.input.emit('pointerdown', { button: 0, worldX: 150, worldY: 90 });
    expect(gameSession.snapshot.phase).toBe('moving');
    const replacement = new MovementGame(
      {
        identity: 'ship-1',
        owner: 'player-1',
        position: new BoardPosition(3, 3),
        agility: new AgilityStat(18),
      },
      {
        identity: 'ship-2',
        owner: 'player-2',
        position: new BoardPosition(8, 8),
        agility: new AgilityStat(16),
      },
    );
    animator.onCancel = () => {
      animator.deliverSuccess();
      animator.deliverFailure();
    };
    const replacementRevision = gameSession.newGame(replacement);
    scene.updateGame(replacementRevision);

    expect(animator.cancelled).toBe(true);
    expect(gameSession.snapshot.phase).toBe('ready');
    if (gameSession.snapshot.phase !== 'disposed') {
      expect(gameSession.snapshot.game).toBe(replacement);
      expect(gameSession.snapshot.gameRevision).toBe(replacementRevision);
      expect(gameSession.snapshot.activePlayer).toBe('player-1');
    }

    harness.game.events.emit('postrender');
    harness.input.emit('pointerdown', { button: 0, worldX: 210, worldY: 210 });
    expect(gameSession.snapshot.phase).toBe('moving');
    const turnBeforeShutdown = gameSession.snapshot;
    harness.events.emit('shutdown');
    animator.deliverSuccess();
    animator.deliverFailure();
    expect(gameSession.snapshot).toEqual(turnBeforeShutdown);
    expect(harness.input.listenerCount('pointerdown')).toBe(0);
  });
});
