import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import { AgilityStat } from '../domain/AgilityStat.js';
import { MovementGame } from '../domain/MovementGame.js';
import type { LegalRoute } from '../domain/Reachability.js';
import type { PendingMove } from '../domain/TurnSession.js';
import { TurnSession } from '../domain/TurnSession.js';
import { PhaserFlightAnimator } from '../presentation/PhaserFlightAnimator.js';

const pathHarness = vi.hoisted(() => ({
  created: [] as Array<{
    lineTo: ReturnType<typeof vi.fn>;
    quadraticBezierTo: ReturnType<typeof vi.fn>;
    ellipseTo: ReturnType<typeof vi.fn>;
    getPoint: ReturnType<typeof vi.fn>;
  }>,
  point: { x: 300, y: 270 } as { x: number; y: number } | null,
}));

vi.mock('phaser', () => {
  class Path {
    readonly lineTo = vi.fn().mockReturnThis();
    readonly quadraticBezierTo = vi.fn().mockReturnThis();
    readonly ellipseTo = vi.fn().mockReturnThis();
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

function multiTurnMove() {
  const game = new MovementGame(
    {
      identity: 'ship-1',
      owner: 'player-1',
      position: new BoardPosition(5, 5),
      agility: new AgilityStat(20),
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
  const move = session.selectDestination(snapshot.turnToken, new BoardPosition(7, 7));
  if (!move) {
    throw new Error('Expected a legal four-step multi-turn move.');
  }
  const route: LegalRoute = Object.freeze({
    positions: Object.freeze([
      new BoardPosition(5, 5),
      new BoardPosition(5, 6),
      new BoardPosition(6, 6),
      new BoardPosition(6, 7),
      new BoardPosition(7, 7),
    ]),
    stepCount: 4,
  });
  return Object.freeze({ ...move, route }) satisfies PendingMove;
}

function fiveStepMove() {
  const game = new MovementGame(
    {
      identity: 'ship-1',
      owner: 'player-1',
      position: new BoardPosition(5, 5),
      agility: new AgilityStat(20),
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
  const move = session.selectDestination(snapshot.turnToken, new BoardPosition(5, 10));
  if (!move || move.route.stepCount !== 5) {
    throw new Error('Expected a legal five-step straight move.');
  }
  return move;
}

function enemyDetourMove() {
  const game = new MovementGame(
    {
      identity: 'ship-1',
      owner: 'player-1',
      position: new BoardPosition(5, 4),
      agility: new AgilityStat(18),
    },
    {
      identity: 'ship-2',
      owner: 'player-2',
      position: new BoardPosition(5, 5),
      agility: new AgilityStat(18),
    },
  );
  const session = new TurnSession(game);
  const snapshot = session.snapshot;
  if (snapshot.phase !== 'ready') {
    throw new Error('Expected an initial ready turn.');
  }
  const move = session.selectDestination(snapshot.turnToken, new BoardPosition(5, 6));
  if (!move || move.route.stepCount !== 4) {
    throw new Error('Expected the legal four-step route around the enemy.');
  }
  return move;
}

function animatorHarness(throwOnStart = false) {
  let config: unknown;
  let progress: number | null = 0.5;
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
    set progress(value: number | null) {
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

  it('uses a diagonal direct flight independent of grid route turns', () => {
    const harness = animatorHarness();
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    harness.animator.start(multiTurnMove(), onProgress, onComplete, vi.fn());

    expect(harness.addCounter).toHaveBeenCalledTimes(1);
    expect(harness.config.duration).toBe(1000);
    expect(harness.config).toMatchObject({ ease: 'Sine.easeInOut', from: 0, to: 1 });
    expect(pathHarness.created).toHaveLength(1);
    expect(pathHarness.created[0]?.lineTo.mock.calls).toEqual([[390, 390]]);
    expect(pathHarness.created[0]?.quadraticBezierTo).not.toHaveBeenCalled();
    expect(pathHarness.created[0]?.ellipseTo).not.toHaveBeenCalled();
    expect(pathHarness.created[0]?.getPoint).toHaveBeenCalledTimes(0);

    harness.config.onUpdate?.(harness.tween);
    expect(pathHarness.created[0]?.getPoint).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledTimes(1);

    const maximumDuration = animatorHarness();
    maximumDuration.animator.start(fiveStepMove(), vi.fn(), vi.fn(), vi.fn());
    expect(maximumDuration.config.duration).toBe(1250);
  });

  it('uses one numeric Phaser circular arc between tangent line segments around an enemy', () => {
    const harness = animatorHarness();
    harness.animator.start(enemyDetourMove(), vi.fn(), vi.fn(), vi.fn());
    const path = pathHarness.created[0];

    expect(harness.addCounter).toHaveBeenCalledTimes(1);
    expect(harness.config.duration).toBe(1000);
    expect(path?.lineTo).toHaveBeenCalledTimes(2);
    expect(path?.ellipseTo).toHaveBeenCalledTimes(1);
    const [radiusX, radiusY, startDegrees, endDegrees, clockwise, rotation] =
      path?.ellipseTo.mock.calls[0] ?? [];
    expect(radiusX).toBe(48);
    expect(radiusY).toBe(48);
    expect(typeof startDegrees).toBe('number');
    expect(typeof endDegrees).toBe('number');
    expect(typeof clockwise).toBe('boolean');
    expect(rotation).toBe(0);
    const rawSweep = Number(endDegrees) - Number(startDegrees);
    const effectiveSweep = clockwise ? rawSweep - 360 : rawSweep;
    expect(Math.abs(effectiveSweep)).toBeCloseTo(
      ((Math.PI - 2 * Math.acos(48 / 60)) * 180) / Math.PI,
      8,
    );
  });

  it('handles invalid progress/point values and ignores callbacks after cancellation', () => {
    const invalidProgress = animatorHarness();
    const progressFailure = vi.fn();
    invalidProgress.animator.start(multiTurnMove(), vi.fn(), vi.fn(), progressFailure);
    invalidProgress.progress = null;
    invalidProgress.config.onUpdate?.(invalidProgress.tween);
    expect(progressFailure).toHaveBeenCalledTimes(1);

    const invalidPoint = animatorHarness();
    const pointFailure = vi.fn();
    invalidPoint.animator.start(multiTurnMove(), vi.fn(), vi.fn(), pointFailure);
    pathHarness.point = null;
    invalidPoint.config.onUpdate?.(invalidPoint.tween);
    expect(pointFailure).toHaveBeenCalledTimes(1);

    const cancelled = animatorHarness();
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const handle = cancelled.animator.start(multiTurnMove(), onProgress, onComplete, vi.fn());
    handle.cancel();
    cancelled.config.onUpdate?.(cancelled.tween);
    cancelled.config.onComplete?.(cancelled.tween);
    cancelled.config.onComplete?.(cancelled.tween);
    expect(onProgress).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
