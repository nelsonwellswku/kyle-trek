import {
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import type { RandomSource } from '../../game-setup/domain/RandomSource.js';
import { MathRandomSource } from '../../game-setup/adapters/MathRandomSource.js';
import { CubePosition } from '../../board/domain/CubePosition.js';
import type { PendingAttack } from '../domain/PendingAttack.js';
import type {
  TorpedoAnimator,
  TorpedoCompletionHandler,
  TorpedoFailureHandler,
  TorpedoHandle,
  TorpedoIdentity,
} from './TorpedoAnimator.js';
import type { TorpedoVisualObserver, TorpedoVisualEvent } from './PhaserTorpedoAnimator.js';
import { CubeTorpedoPath } from './TorpedoPath.js';

export interface TorpedoAnimationFrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export class ThreeTorpedoAnimator implements TorpedoAnimator {
  private static readonly totalMilliseconds = 1150;
  private static readonly hitTravelMilliseconds = 850;
  private static readonly hitExplosionMilliseconds = 300;
  private readonly activeEffects = new Map<string, () => void>();

  constructor(
    private readonly scene: Scene,
    private readonly render: () => void,
    private readonly randomSource: RandomSource = new MathRandomSource(),
    private readonly scheduler: TorpedoAnimationFrameScheduler = {
      request: (callback) => globalThis.requestAnimationFrame(callback),
      cancel: (handle) => globalThis.cancelAnimationFrame(handle),
    },
    private readonly observe: TorpedoVisualObserver = () => {},
  ) {}

  start(
    attack: PendingAttack,
    onComplete: TorpedoCompletionHandler,
    onFailure: TorpedoFailureHandler,
  ): TorpedoHandle {
    if (
      !(attack.attackerPosition instanceof CubePosition) ||
      !(attack.defenderPosition instanceof CubePosition)
    ) {
      throw new RangeError('The 3D torpedo animator requires current CubePosition endpoints.');
    }
    const identity: TorpedoIdentity = Object.freeze({
      gameRevision: attack.gameRevision,
      turnToken: attack.turnToken,
      attackId: attack.attackId,
    });
    const key = ThreeTorpedoAnimator.identityKey(identity);
    const missPathChoice = attack.outcome.kind === 'miss' ? this.randomMissPathChoice() : 0;
    const path = new CubeTorpedoPath(
      attack.attackerPosition,
      attack.defenderPosition,
      attack.outcome.kind,
      missPathChoice,
    );
    const effect = new Group();
    effect.name = `torpedo-effect-${key}`;
    effect.userData['torpedoEffect'] = true;
    effect.userData['torpedoIdentity'] = identity;
    effect.userData['startPosition'] = attack.attackerPosition;
    effect.userData['targetPosition'] = attack.defenderPosition;
    effect.position.set(path.start.x, path.start.y, path.start.z);
    const projectileMaterial = new MeshBasicMaterial({
      color: 0xffe36e,
      transparent: true,
      opacity: 1,
    });
    const projectile = new Mesh(new SphereGeometry(0.13, 8, 6), projectileMaterial);
    projectile.name = 'torpedo-projectile';
    effect.add(projectile);
    this.scene.add(effect);

    let settled = false;
    let frame: number | null = null;
    let startedAt: number | null = null;
    let explosion: Mesh | null = null;
    const report = (event: TorpedoVisualEvent): void => {
      try {
        this.observe(identity, event, performance.now());
      } catch {
        // Visual instrumentation is not allowed to affect combat resolution.
      }
    };
    const disposeObject = (): void => {
      const geometries = new Set<BufferGeometry>();
      const materials = new Set<Material>();
      effect.traverse((object) => {
        const renderable = object as typeof object & {
          geometry?: BufferGeometry;
          material?: Material | Material[];
        };
        if (renderable.geometry) geometries.add(renderable.geometry);
        if (Array.isArray(renderable.material)) {
          for (const material of renderable.material) materials.add(material);
        } else if (renderable.material) {
          materials.add(renderable.material);
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      effect.removeFromParent();
      this.render();
    };
    const cleanup = (): void => {
      if (frame !== null) this.scheduler.cancel(frame);
      frame = null;
      this.activeEffects.delete(key);
      disposeObject();
    };
    const handle: TorpedoHandle = {
      identity,
      cancel: () => {
        if (settled) return;
        settled = true;
        cleanup();
      },
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      report('failure');
      onFailure(identity, error);
    };
    const createExplosion = (): void => {
      if (explosion) return;
      const material = new MeshBasicMaterial({
        color: 0xffa742,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      explosion = new Mesh(new SphereGeometry(0.28, 10, 8), material);
      explosion.name = 'torpedo-explosion';
      explosion.userData['torpedoExplosion'] = true;
      explosion.position.set(
        path.end.x - effect.position.x,
        path.end.y - effect.position.y,
        path.end.z - effect.position.z,
      );
      effect.add(explosion);
      report('contact');
    };
    const finish = (): void => {
      if (settled) return;
      settled = true;
      effect.position.set(path.end.x, path.end.y, path.end.z);
      cleanup();
      report('complete');
      onComplete(identity);
    };
    const step: FrameRequestCallback = (timestamp) => {
      frame = null;
      if (settled) return;
      if (!Number.isFinite(timestamp)) {
        fail(new Error('The renderer returned an invalid torpedo timestamp.'));
        return;
      }
      if (startedAt === null) startedAt = timestamp;
      const elapsed = Math.max(0, timestamp - startedAt);
      const duration =
        attack.outcome.kind === 'hit'
          ? ThreeTorpedoAnimator.hitTravelMilliseconds
          : ThreeTorpedoAnimator.totalMilliseconds;
      const progress = Math.max(0, Math.min(1, elapsed / duration));
      const point = path.pointAt(progress);
      effect.position.set(point.x, point.y, point.z);
      projectileMaterial.opacity = 0.5 + 0.5 * Math.sin((2 * Math.PI * 2 * elapsed) / 1000);
      if (attack.outcome.kind === 'hit' && elapsed >= ThreeTorpedoAnimator.hitTravelMilliseconds) {
        createExplosion();
        const explosionProgress = Math.max(
          0,
          Math.min(
            1,
            (elapsed - ThreeTorpedoAnimator.hitTravelMilliseconds) /
              ThreeTorpedoAnimator.hitExplosionMilliseconds,
          ),
        );
        explosion?.scale.setScalar(0.2 + 1.8 * explosionProgress);
        if (explosion?.material instanceof MeshBasicMaterial) {
          explosion.material.opacity = 1 - explosionProgress;
        }
      }
      this.render();
      if (elapsed >= ThreeTorpedoAnimator.totalMilliseconds) {
        finish();
        return;
      }
      try {
        frame = this.scheduler.request(step);
      } catch (error) {
        fail(error instanceof Error ? error : new Error('The torpedo effect could not continue.'));
      }
    };

    this.activeEffects.set(key, handle.cancel);
    report('launch');
    this.render();
    try {
      frame = this.scheduler.request(step);
    } catch (error) {
      fail(error instanceof Error ? error : new Error('The torpedo effect could not start.'));
    }
    return handle;
  }

  dispose(): void {
    for (const cancel of [...this.activeEffects.values()]) cancel();
    this.activeEffects.clear();
  }

  private randomMissPathChoice(): number {
    const sample = this.randomSource.next();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError('Torpedo path randomness must be a finite number in [0, 1).');
    }
    return Math.floor(sample * 52);
  }

  private static identityKey(identity: TorpedoIdentity): string {
    return `${identity.gameRevision}:${identity.turnToken}:${identity.attackId}`;
  }
}
