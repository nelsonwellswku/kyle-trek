import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import type { RandomSource } from '../../game-setup/domain/RandomSource.js';
import type { PendingAttack } from '../domain/PendingAttack.js';
import { PhaserTorpedoAnimator } from '../presentation/PhaserTorpedoAnimator.js';

type TweenConfig = Phaser.Types.Tweens.NumberTweenBuilderConfig;

type ShapeEvent =
  | { readonly kind: 'star-position'; readonly x: number; readonly y: number }
  | { readonly kind: 'explosion-created'; readonly x: number; readonly y: number };

function pendingAttack(
  kind: 'hit' | 'miss',
  attackerPosition = new BoardPosition(2, 2),
  defenderPosition = new BoardPosition(3, 2),
  attackId = 19,
): PendingAttack {
  const outcome =
    kind === 'hit'
      ? {
          kind: 'hit' as const,
          attacker: 'ship-1' as const,
          defender: 'ship-2' as const,
          attackDie: 12,
          strengthModifier: 0,
          attackTotal: 12,
          armorClass: 12 as const,
          damageDie: 4,
          damage: 4,
          hitPointsBefore: 10,
          hitPointsAfter: 6,
        }
      : {
          kind: 'miss' as const,
          attacker: 'ship-1' as const,
          defender: 'ship-2' as const,
          attackDie: 10,
          strengthModifier: 0,
          attackTotal: 10,
          armorClass: 12 as const,
          hitPointsBefore: 10,
          hitPointsAfter: 10,
        };

  return Object.freeze({
    gameRevision: 7,
    turnToken: 13,
    attackId,
    attackerIdentity: 'ship-1',
    defenderIdentity: 'ship-2',
    attackerPosition,
    defenderPosition,
    outcome: Object.freeze(outcome),
  });
}

function animatorHarness(throwOnStart = false, randomSource?: RandomSource) {
  const events: ShapeEvent[] = [];
  const stars: Array<ReturnType<typeof makeShape>> = [];
  const explosions: Array<ReturnType<typeof makeShape>> = [];
  let progress: number | null = 0;
  let config: TweenConfig | null = null;

  function makeShape() {
    return {
      setPosition: vi.fn((x: number, y: number) => {
        events.push({ kind: 'star-position', x, y });
      }),
      setAlpha: vi.fn().mockReturnThis(),
      setScale: vi.fn().mockReturnThis(),
      setFillStyle: vi.fn().mockReturnThis(),
      setStrokeStyle: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
  }

  const tween = {
    getValue: vi.fn(() => progress),
    stop: vi.fn(),
    remove: vi.fn(),
  } as unknown as Phaser.Tweens.Tween;

  const addCounter = vi.fn((received: TweenConfig) => {
    config = received;
    if (throwOnStart) {
      throw new Error('tween startup failed');
    }
    return tween;
  });

  const addStar = vi.fn(
    (_x?: number, _y?: number, _points?: number, _innerRadius?: number, _outerRadius?: number) => {
      void [_x, _y, _points, _innerRadius, _outerRadius];
      const star = makeShape();
      stars.push(star);
      return star as unknown as Phaser.GameObjects.Star;
    },
  );

  const addCircle = vi.fn((x?: number, y?: number) => {
    events.push({ kind: 'explosion-created', x: x ?? 0, y: y ?? 0 });
    const explosion = makeShape();
    explosions.push(explosion);
    return explosion as unknown as Phaser.GameObjects.Arc;
  });

  const scene = {
    add: { star: addStar, circle: addCircle },
    tweens: { addCounter },
  } as unknown as Phaser.Scene;
  const animator = new PhaserTorpedoAnimator(
    scene,
    new BoardGeometry(600),
    undefined,
    randomSource,
  );

  function requireConfig(): TweenConfig {
    if (!config) {
      throw new Error('Expected the animator to start a tween.');
    }
    return config;
  }

  return {
    animator,
    addCounter,
    addStar,
    addCircle,
    tween,
    stars,
    explosions,
    events,
    get config() {
      return requireConfig();
    },
    updateAt(milliseconds: number) {
      progress = milliseconds / (requireConfig().duration ?? Number.NaN);
      requireConfig().onUpdate?.(tween, [], '', 0, 0);
    },
    updateWithProgress(value: number | null) {
      progress = value;
      requireConfig().onUpdate?.(tween, [], '', 0, 0);
    },
    finish() {
      requireConfig().onComplete?.(tween, []);
    },
  };
}

describe('PhaserTorpedoAnimator', () => {
  it.each(['hit', 'miss'] as const)(
    'uses one finite normalized tween for a %s and finishes within the nominal timing budget',
    (kind) => {
      const harness = animatorHarness();
      const attack = pendingAttack(kind);

      harness.animator.start(attack, vi.fn(), vi.fn());

      const duration = harness.config.duration ?? Number.NaN;
      expect(harness.addCounter).toHaveBeenCalledTimes(1);
      expect(harness.config).toMatchObject({ from: 0, to: 1, duration: 1150 });
      expect(Number.isFinite(duration)).toBe(true);
      expect(duration).toBeLessThanOrEqual(1500);
      expect(harness.config.repeat ?? 0).toBe(0);
      expect(harness.addStar).toHaveBeenCalledTimes(1);
      expect(harness.addStar.mock.calls[0]).toEqual([
        expect.any(Number),
        expect.any(Number),
        5,
        6,
        12,
        0xffe36e,
        1,
      ]);
      expect(harness.stars[0]?.setStrokeStyle).toHaveBeenCalledWith(2, 0xffffff, 1);
    },
  );

  it('pulses the procedural star alpha at two cycles per second', () => {
    const harness = animatorHarness();
    harness.animator.start(pendingAttack('miss'), vi.fn(), vi.fn());
    const star = harness.stars[0];
    if (!star) {
      throw new Error('Expected a torpedo star.');
    }

    harness.updateAt(125);
    harness.updateAt(375);
    harness.updateAt(625);

    const alphaAt125 = Number(star.setAlpha.mock.calls[0]?.[0]);
    const alphaAt375 = Number(star.setAlpha.mock.calls[1]?.[0]);
    const alphaAt625 = Number(star.setAlpha.mock.calls[2]?.[0]);
    expect(alphaAt125).toBeGreaterThanOrEqual(0);
    expect(alphaAt125).toBeLessThanOrEqual(1);
    expect(Math.abs(alphaAt125 - alphaAt375)).toBeGreaterThan(0.5);
    expect(alphaAt625).toBeCloseTo(alphaAt125, 5);
  });

  it('creates the hit explosion only after the star reaches defender contact', () => {
    const harness = animatorHarness();
    const attack = pendingAttack('hit');
    const defender = new BoardGeometry(600).cellCenter(attack.defenderPosition);
    harness.animator.start(attack, vi.fn(), vi.fn());

    harness.updateAt(850);

    const contactIndex = harness.events.findIndex(
      (event) => event.kind === 'star-position' && event.x === defender.x && event.y === defender.y,
    );
    const explosionIndex = harness.events.findIndex((event) => event.kind === 'explosion-created');
    expect(contactIndex).toBeGreaterThanOrEqual(0);
    expect(explosionIndex).toBeGreaterThan(contactIndex);
    expect(harness.events[explosionIndex]).toEqual({
      kind: 'explosion-created',
      x: defender.x,
      y: defender.y,
    });
  });

  it('takes a miss fully off-board without an explosion, then removes the star', () => {
    const harness = animatorHarness();
    const attack = pendingAttack('miss', new BoardPosition(5, 8), new BoardPosition(5, 10));
    const onComplete = vi.fn();
    const handle = harness.animator.start(attack, onComplete, vi.fn());
    const star = harness.stars[0];
    if (!star) {
      throw new Error('Expected a torpedo star.');
    }

    harness.updateAt(1150);

    const [x, y] = star.setPosition.mock.calls.at(-1) ?? [];
    if (typeof x !== 'number' || typeof y !== 'number') {
      throw new Error('Expected the missed torpedo to reach its off-board endpoint.');
    }
    expect(x < 0 || x > 600 || y < 0 || y > 600).toBe(true);
    expect(harness.addCircle).not.toHaveBeenCalled();

    harness.finish();

    expect(star.destroy).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(handle.identity);
  });

  it('draws an independent random path choice for every miss', () => {
    const samples = [0.25, 0.25, 0.75];
    let sampleIndex = 0;
    const randomSource: RandomSource = {
      next: vi.fn(() => {
        const sample = samples[sampleIndex];
        if (sample === undefined) throw new Error('The controlled path samples are exhausted.');
        sampleIndex += 1;
        return sample;
      }),
    };
    const first = animatorHarness(false, randomSource);
    const second = animatorHarness(false, randomSource);
    const third = animatorHarness(false, randomSource);
    const positions = [new BoardPosition(5, 5), new BoardPosition(5, 6)] as const;
    first.animator.start(pendingAttack('miss', ...positions, 19), vi.fn(), vi.fn());
    second.animator.start(pendingAttack('hit', ...positions, 20), vi.fn(), vi.fn());
    second.animator.start(pendingAttack('miss', ...positions, 20), vi.fn(), vi.fn());
    third.animator.start(pendingAttack('miss', ...positions, 21), vi.fn(), vi.fn());
    first.updateAt(1150);
    second.updateAt(1150);
    third.updateAt(1150);

    const firstEnd = first.stars[0]?.setPosition.mock.calls.at(-1);
    const secondEnd = second.stars[1]?.setPosition.mock.calls.at(-1);
    const thirdEnd = third.stars[0]?.setPosition.mock.calls.at(-1);
    expect(randomSource.next).toHaveBeenCalledTimes(3);
    expect(firstEnd).toEqual(secondEnd);
    expect(thirdEnd).not.toEqual(firstEnd);
    if (!firstEnd || !secondEnd || !thirdEnd) {
      throw new Error('Expected all misses to reach their off-board endpoints.');
    }

    const geometry = new BoardGeometry(600);
    const attacker = geometry.cellCenter(positions[0]);
    const defender = geometry.cellCenter(positions[1]);
    const directX = defender.x - attacker.x;
    const directY = defender.y - attacker.y;
    const sideOf = (end: readonly [x: number, y: number]): number =>
      Math.sign(directX * (end[1] - attacker.y) - directY * (end[0] - attacker.x));
    expect(sideOf(firstEnd)).toBe(sideOf(secondEnd));
    expect(sideOf(thirdEnd)).toBe(-sideOf(firstEnd));
  });

  it('maps uniform sample buckets across every angle from 10 to 35 on both sides', () => {
    const positions = [new BoardPosition(5, 2), new BoardPosition(5, 9)] as const;

    for (let choice = 0; choice < 52; choice += 1) {
      const randomSource: RandomSource = { next: () => (choice + 0.5) / 52 };
      const harness = animatorHarness(false, randomSource);
      harness.animator.start(pendingAttack('miss', ...positions), vi.fn(), vi.fn());
      harness.updateAt(1150);

      const endpoint = harness.stars[0]?.setPosition.mock.calls.at(-1);
      if (!endpoint) throw new Error(`Miss choice ${choice} did not reach its endpoint.`);
      const expectedDegrees = 10 + (choice % 26);
      const expectedSide = choice < 26 ? 1 : -1;
      const angleDegrees = (Math.atan2(endpoint[1] - 270, endpoint[0] - 90) * 180) / Math.PI;
      expect(Math.round(Math.abs(angleDegrees)), `angle choice ${choice}`).toBe(expectedDegrees);
      expect(Math.sign(angleDegrees), `side choice ${choice}`).toBe(expectedSide);
    }
  });

  it('reports completion once with the T018 attack identity', () => {
    const harness = animatorHarness();
    const attack = pendingAttack('hit');
    const onComplete = vi.fn();
    const onFailure = vi.fn();
    const handle = harness.animator.start(attack, onComplete, onFailure);

    harness.updateAt(850);
    harness.finish();
    harness.finish();
    harness.updateAt(1150);

    expect(handle.identity).toEqual({ gameRevision: 7, turnToken: 13, attackId: 19 });
    expect(Object.isFrozen(handle.identity)).toBe(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(handle.identity);
    expect(onFailure).not.toHaveBeenCalled();
    expect(harness.stars[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(harness.explosions[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it('reports startup and runtime failures once with the attack identity and destroys resources', () => {
    const startup = animatorHarness(true);
    const startupFailure = vi.fn();
    const startupHandle = startup.animator.start(pendingAttack('hit'), vi.fn(), startupFailure);

    expect(startupFailure).toHaveBeenCalledTimes(1);
    expect(startupFailure).toHaveBeenCalledWith(
      startupHandle.identity,
      expect.objectContaining({ message: 'tween startup failed' }),
    );
    expect(startup.stars[0]?.destroy).toHaveBeenCalledTimes(1);

    const runtime = animatorHarness();
    const onComplete = vi.fn();
    const runtimeFailure = vi.fn();
    const runtimeHandle = runtime.animator.start(pendingAttack('miss'), onComplete, runtimeFailure);
    runtime.updateWithProgress(Number.NaN);
    runtime.updateWithProgress(Number.NaN);

    expect(runtimeFailure).toHaveBeenCalledTimes(1);
    expect(runtimeFailure).toHaveBeenCalledWith(runtimeHandle.identity, expect.any(Error));
    expect(runtime.stars[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(runtime.tween.stop).toHaveBeenCalledTimes(1);
    expect(runtime.tween.remove).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('destroys the star and explosion when cancelled, and makes cancel idempotent', () => {
    const harness = animatorHarness();
    const onComplete = vi.fn();
    const onFailure = vi.fn();
    const handle = harness.animator.start(pendingAttack('hit'), onComplete, onFailure);
    harness.updateAt(850);

    handle.cancel();
    handle.cancel();
    harness.updateAt(1150);
    harness.finish();

    expect(harness.tween.stop).toHaveBeenCalledTimes(1);
    expect(harness.tween.remove).toHaveBeenCalledTimes(1);
    expect(harness.stars[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(harness.explosions[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });
});
