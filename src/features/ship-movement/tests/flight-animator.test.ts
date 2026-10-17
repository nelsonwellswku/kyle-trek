import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import { AgilityStat } from '../domain/AgilityStat.js';
import { MovementGame } from '../domain/MovementGame.js';
import { TurnSession } from '../domain/TurnSession.js';
import { PhaserFlightAnimator } from '../presentation/PhaserFlightAnimator.js';

const pathHarness = vi.hoisted(() => ({
  created: [] as Array<{ lineTo: ReturnType<typeof vi.fn>; getPoint: ReturnType<typeof vi.fn> }>,
  point: { x: 300, y: 270 } as { x: number; y: number } | null,
}));

vi.mock('phaser', () => {
  class Path {
    readonly lineTo = vi.fn().mockReturnThis();
    readonly getPoint = vi.fn(() => pathHarness.point);

    constructor() {
      pathHarness.created.push(this);
    }
  }

  return { default: { Curves: { Path } } };
});

function pendingMove() {
  const game = new MovementGame(
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
  );
  const session = new TurnSession(game);
  const snapshot = session.snapshot;
  if (snapshot.phase !== 'ready') {
    throw new Error('Expected an initial ready turn.');
  }
  const move = session.selectDestination(snapshot.turnToken, new BoardPosition(5, 6));
  if (!move) {
    throw new Error('Expected a legal one-step move.');
  }
  return move;
}

function animatorHarness(throwOnStart = false) {
  let config: unknown;
  let progress = 0.5;
  const tween = {
    getValue: vi.fn(() => progress),
    stop: vi.fn(),
    remove: vi.fn(),
  };
  const addCounter = vi.fn((received: unknown) => {
    config = received;
    if (throwOnStart) {
      throw new Error('tween startup failed');
    }
    return tween;
  });
  const scene = { tweens: { addCounter } } as unknown as Phaser.Scene;
  const animator = new PhaserFlightAnimator(scene, new BoardGeometry(600));

  return {
    animator,
    addCounter,
    tween,
    get config() {
      return config as {
        readonly duration: number;
        readonly onUpdate?: (tween: unknown) => void;
        readonly onComplete?: (tween: unknown) => void;
      };
    },
    set progress(value: number) {
      progress = value;
    },
  };
}

describe('PhaserFlightAnimator', () => {
  beforeEach(() => {
    pathHarness.created.length = 0;
    pathHarness.point = { x: 300, y: 270 };
  });

  it('follows route points continuously and notifies one exact completion', () => {
    const harness = animatorHarness();
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const onFailure = vi.fn();
    const move = pendingMove();
    const handle = harness.animator.start(move, onProgress, onComplete, onFailure);

    expect(harness.addCounter).toHaveBeenCalledTimes(1);
    expect(harness.config.duration).toBe(250);
    expect(pathHarness.created).toHaveLength(1);
    expect(pathHarness.created[0]?.lineTo).toHaveBeenCalledWith(330, 270);
    harness.config.onUpdate?.(harness.tween);
    expect(onProgress).toHaveBeenCalledWith({ x: 300, y: 270 });
    harness.config.onComplete?.(harness.tween);
    harness.config.onComplete?.(harness.tween);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(handle.identity);
    expect(onProgress).toHaveBeenLastCalledWith({ x: 330, y: 270 });
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('cancels without reporting successful arrival', () => {
    const harness = animatorHarness();
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const onFailure = vi.fn();
    const handle = harness.animator.start(pendingMove(), onProgress, onComplete, onFailure);

    handle.cancel();
    harness.config.onUpdate?.(harness.tween);
    harness.config.onComplete?.(harness.tween);

    expect(harness.tween.stop).toHaveBeenCalledTimes(1);
    expect(onProgress).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('reports startup and mid-flight failures at most once', () => {
    const startup = animatorHarness(true);
    const onStartupFailure = vi.fn();
    expect(() =>
      startup.animator.start(pendingMove(), vi.fn(), vi.fn(), onStartupFailure),
    ).not.toThrow();
    expect(onStartupFailure).toHaveBeenCalledTimes(1);
    expect(onStartupFailure.mock.calls[0]?.[1].message).toBe('tween startup failed');

    const runtime = animatorHarness();
    const onFailure = vi.fn();
    runtime.animator.start(pendingMove(), vi.fn(), vi.fn(), onFailure);
    pathHarness.point = null;
    runtime.config.onUpdate?.(runtime.tween);
    runtime.config.onUpdate?.(runtime.tween);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0]?.[1]).toBeInstanceOf(Error);
  });
});
