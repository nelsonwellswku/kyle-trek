import { describe, expect, it, vi } from 'vitest';
import { CubePosition } from '../../board/domain/CubePosition.js';
import type { PendingMove } from '../domain/PendingMove.js';
import {
  ThreeFlightAnimator,
  type FlightFrameScheduler,
} from '../presentation/ThreeFlightAnimator.js';

class ManualFrameScheduler implements FlightFrameScheduler {
  private currentTime = 0;
  private nextId = 1;
  private readonly pending = new Map<number, (timestamp: number) => void>();
  private readonly delivered: Array<(timestamp: number) => void> = [];

  now(): number {
    return this.currentTime;
  }

  request(callback: (timestamp: number) => void): number {
    const id = this.nextId++;
    this.pending.set(id, callback);
    return id;
  }

  cancel(frameId: number): void {
    this.pending.delete(frameId);
  }

  advance(milliseconds: number): void {
    this.currentTime += milliseconds;
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    this.delivered.push(...callbacks);
    callbacks.forEach((callback) => callback(this.currentTime));
  }

  deliverLastAgain(): void {
    this.delivered.at(-1)?.(this.currentTime);
  }
}

function move(steps: number): PendingMove {
  const origin = new CubePosition(1, 1, 1);
  const positions = Array.from(
    { length: steps + 1 },
    (_, index) => new CubePosition(Math.min(5, 1 + index), 1 + Math.max(0, index - 4), 1),
  );
  const destination = positions.at(-1);
  if (!destination) throw new Error('Expected a movement destination.');
  return Object.freeze({
    gameRevision: 3,
    turnToken: 5,
    moveId: 7,
    shipIdentity: 'ship-1',
    origin,
    destination,
    otherShipPosition: new CubePosition(5, 5, 5),
    route: Object.freeze({ positions: Object.freeze(positions), stepCount: steps }),
  });
}

describe('ThreeFlightAnimator', () => {
  it('animates a 3D route at 250 ms per logical step and completes exactly at arrival', () => {
    const scheduler = new ManualFrameScheduler();
    const animator = new ThreeFlightAnimator(scheduler);
    const progress = vi.fn();
    const complete = vi.fn();
    const failure = vi.fn();
    const pending = move(2);

    const handle = animator.start(pending, progress, complete, failure);
    expect(handle.identity).toEqual({ gameRevision: 3, turnToken: 5, moveId: 7 });
    scheduler.advance(250);
    expect(progress).toHaveBeenCalledWith({ x: -1, y: -2, z: -2 });
    expect(complete).not.toHaveBeenCalled();
    scheduler.advance(249);
    expect(complete).not.toHaveBeenCalled();
    scheduler.advance(1);

    expect(progress).toHaveBeenLastCalledWith({ x: 0, y: -2, z: -2 });
    expect(complete).toHaveBeenCalledExactlyOnceWith(handle.identity);
    expect(failure).not.toHaveBeenCalled();
  });

  it('cancels without a terminal callback and ignores late scheduled frames', () => {
    const scheduler = new ManualFrameScheduler();
    const animator = new ThreeFlightAnimator(scheduler);
    const complete = vi.fn();
    const failure = vi.fn();
    const handle = animator.start(move(3), vi.fn(), complete, failure);
    scheduler.advance(100);
    handle.cancel();
    handle.cancel();
    scheduler.advance(2_000);
    scheduler.deliverLastAgain();

    expect(complete).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
  });

  it('keeps maximum five-step movement below the 1.5 second deadline and settles once', () => {
    const scheduler = new ManualFrameScheduler();
    const animator = new ThreeFlightAnimator(scheduler);
    const complete = vi.fn();
    const failure = vi.fn();
    const handle = animator.start(move(5), vi.fn(), complete, failure);

    scheduler.advance(1_250);
    scheduler.deliverLastAgain();
    expect(scheduler.now()).toBeLessThanOrEqual(1_500);
    expect(complete).toHaveBeenCalledExactlyOnceWith(handle.identity);
    expect(failure).not.toHaveBeenCalled();
  });

  it('reports malformed paths once without leaving an active flight', () => {
    const scheduler = new ManualFrameScheduler();
    const animator = new ThreeFlightAnimator(scheduler);
    const malformed = {
      ...move(2),
      route: { positions: [new CubePosition(1, 1, 1), new CubePosition(3, 1, 1)], stepCount: 1 },
    } as PendingMove;
    const complete = vi.fn();
    const failure = vi.fn();
    animator.start(malformed, vi.fn(), complete, failure);
    scheduler.advance(1_000);

    expect(complete).not.toHaveBeenCalled();
    expect(failure).toHaveBeenCalledOnce();
  });
});
