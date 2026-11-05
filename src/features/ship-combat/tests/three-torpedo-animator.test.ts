import { describe, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { CubePosition } from '../../board/domain/CubePosition.js';
import type { PendingAttack } from '../domain/PendingAttack.js';
import { ThreeTorpedoAnimator } from '../presentation/ThreeTorpedoAnimator.js';

function pendingAttack(kind: 'hit' | 'miss', attackId = 7): PendingAttack {
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
    gameRevision: 3,
    turnToken: 5,
    attackId,
    attackerIdentity: 'ship-1',
    defenderIdentity: 'ship-2',
    attackerPosition: new CubePosition(2, 4, 5),
    defenderPosition: new CubePosition(5, 5, 3),
    outcome: Object.freeze(outcome),
  });
}

function harness() {
  const scene = new Scene();
  const scheduled = new Map<number, FrameRequestCallback>();
  const cancelled: number[] = [];
  let nextFrameId = 1;
  const scheduler = {
    request: vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      scheduled.set(id, callback);
      return id;
    }),
    cancel: vi.fn((id: number) => {
      cancelled.push(id);
      scheduled.delete(id);
    }),
  };
  const render = vi.fn();
  const animator = new ThreeTorpedoAnimator(scene, render, undefined, scheduler);
  const tick = (timestamp: number): void => {
    const frame = [...scheduled.entries()][0];
    if (!frame) throw new Error('Expected a scheduled animation frame.');
    scheduled.delete(frame[0]);
    frame[1](timestamp);
  };
  return { scene, scheduled, cancelled, scheduler, render, animator, tick };
}

describe('ThreeTorpedoAnimator', () => {
  it.each(['hit', 'miss'] as const)(
    'uses current cube-position endpoints and preserves the %s effect timing',
    (kind) => {
      const test = harness();
      const attack = pendingAttack(kind);
      const onComplete = vi.fn();
      const onFailure = vi.fn();
      const handle = test.animator.start(attack, onComplete, onFailure);
      const effect = test.scene.children.find((object) => object.userData['torpedoEffect']);
      expect(effect?.userData['startPosition']).toEqual(attack.attackerPosition);
      expect(effect?.userData['targetPosition']).toEqual(attack.defenderPosition);
      expect(effect?.position.toArray()).toEqual([-1, 1, 2]);
      expect(handle.identity).toEqual({ gameRevision: 3, turnToken: 5, attackId: 7 });
      expect(Object.isFrozen(handle.identity)).toBe(true);

      test.tick(100);
      test.tick(950);
      const hitFlash = effect?.children.find((child) => child.userData['torpedoExplosion']);
      expect(Boolean(hitFlash)).toBe(kind === 'hit');
      test.tick(1250);

      expect(test.scheduled.size).toBe(0);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(handle.identity);
      expect(onFailure).not.toHaveBeenCalled();
      expect(test.scene.children).not.toContain(effect);
      expect(test.render).toHaveBeenCalled();
    },
  );

  it('cancels a torpedo without terminal callbacks and disposes active effects exactly once', () => {
    const test = harness();
    const onComplete = vi.fn();
    const onFailure = vi.fn();
    const handle = test.animator.start(pendingAttack('hit'), onComplete, onFailure);
    const effect = test.scene.children[0];
    const staleFrame = [...test.scheduled.values()][0];
    handle.cancel();
    handle.cancel();
    staleFrame?.(200);

    expect(test.cancelled).toHaveLength(1);
    expect(test.scene.children).not.toContain(effect);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    expect(test.render).toHaveBeenCalled();

    test.animator.start(pendingAttack('miss', 8), onComplete, onFailure);
    const pendingFrameCount = test.scheduled.size;
    test.animator.dispose();
    test.animator.dispose();
    expect(test.scene.children).toHaveLength(0);
    expect(test.scheduled.size).toBe(0);
    expect(test.cancelled).toHaveLength(pendingFrameCount + 1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });
});
