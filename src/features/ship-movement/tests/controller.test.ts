import { describe, expect, it, vi } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import { AgilityStat } from '../domain/AgilityStat.js';
import { MovementGame } from '../domain/MovementGame.js';
import { TurnSession, type TurnSnapshot } from '../domain/TurnSession.js';
import { MovementController } from '../presentation/MovementController.js';
import type { BoardView } from '../../board/presentation/BoardView.js';
import type { TurnControls } from '../presentation/TurnControls.js';
import type {
  FlightAnimator,
  FlightHandle,
  FlightIdentity,
  FlightProgressHandler,
  FlightCompletionHandler,
  FlightFailureHandler,
} from '../presentation/FlightAnimator.js';
import { ControlledFlightAnimator } from './fixtures/ControlledFlightAnimator.js';

function game(score1 = 14, score2 = 18): MovementGame {
  return new MovementGame(
    {
      identity: 'ship-1',
      owner: 'player-1',
      position: new BoardPosition(5, 5),
      agility: new AgilityStat(score1),
    },
    {
      identity: 'ship-2',
      owner: 'player-2',
      position: new BoardPosition(10, 10),
      agility: new AgilityStat(score2),
    },
  );
}

class DeferredFlightAnimator implements FlightAnimator {
  private identity: FlightIdentity | null = null;
  private onProgress: FlightProgressHandler | null = null;
  private onComplete: FlightCompletionHandler | null = null;
  private onFailure: FlightFailureHandler | null = null;
  cancelled = false;

  start(
    move: Parameters<FlightAnimator['start']>[0],
    onProgress: FlightProgressHandler,
    onComplete: FlightCompletionHandler,
    onFailure: FlightFailureHandler,
  ): FlightHandle {
    this.identity = Object.freeze({
      gameRevision: move.gameRevision,
      turnToken: move.turnToken,
      moveId: move.moveId,
    });
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onFailure = onFailure;
    return {
      identity: this.identity,
      cancel: () => {
        this.cancelled = true;
      },
    };
  }

  update(point: { readonly x: number; readonly y: number }): void {
    if (this.identity) {
      this.onProgress?.(point);
    }
  }

  complete(): void {
    if (this.identity) {
      this.onComplete?.(this.identity);
    }
  }

  fail(error: Error): void {
    if (this.identity) {
      this.onFailure?.(this.identity, error);
    }
  }
}

function liveSnapshot(session: TurnSession): Exclude<TurnSnapshot, { readonly phase: 'disposed' }> {
  const snapshot = session.snapshot;
  if (snapshot.phase === 'disposed') {
    throw new Error('Expected a live turn session.');
  }
  return snapshot;
}

function controllerHarness<TAnimator extends FlightAnimator = ControlledFlightAnimator>(
  animator?: TAnimator,
) {
  const session = new TurnSession(game());
  const boardView = {
    setHighlights: vi.fn(),
    setShipPosition: vi.fn(),
    setShipVisualPosition: vi.fn(),
  };
  const controls = { render: vi.fn() };
  const activeAnimator = animator ?? (new ControlledFlightAnimator() as unknown as TAnimator);
  const onMovementError = vi.fn();
  const controller = new MovementController(
    session,
    new BoardGeometry(600),
    boardView as unknown as BoardView,
    activeAnimator,
    controls as unknown as TurnControls,
    onMovementError,
  );
  controller.markReady(1);
  return { session, boardView, controls, animator: activeAnimator, onMovementError, controller };
}

describe('MovementController', () => {
  it('ignores non-left and invalid board input without consuming the turn', () => {
    const { session, animator, controller } = controllerHarness();
    const initial = liveSnapshot(session);

    controller.handlePointerDown({ button: 2, worldX: 330, worldY: 270 });
    controller.handlePointerDown({ button: 0, worldX: 600, worldY: 270 });
    controller.handlePointerDown({ button: 0, worldX: 270, worldY: 270 });
    controller.handlePointerDown({ button: 0, worldX: 570, worldY: 570 });
    controller.handlePointerDown({ button: 0, worldX: 30, worldY: 30 });

    expect(animator.startedFlights).toHaveLength(0);
    const unchanged = liveSnapshot(session);
    expect(unchanged.phase).toBe('ready');
    expect(unchanged.turnToken).toBe(initial.turnToken);
    expect(unchanged.game.ship1.position).toEqual(new BoardPosition(5, 5));
  });

  it('locks before flight, clears highlights, then commits one arrival and refreshes the next turn', () => {
    const { session, boardView, controls, animator, controller } = controllerHarness();

    controller.handlePointerDown({ button: 0, worldX: 330, worldY: 270 });

    const moving = liveSnapshot(session);
    expect(moving.phase).toBe('moving');
    expect(animator.startedFlights).toHaveLength(1);
    expect(boardView.setHighlights).toHaveBeenLastCalledWith([]);
    expect(controls.render).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'moving' }));
    expect(moving.game.ship1.position).toEqual(new BoardPosition(5, 5));

    animator.startedFlights[0]?.complete();

    const arrived = liveSnapshot(session);
    expect(arrived.phase).toBe('ready');
    expect(arrived.activePlayer).toBe('player-2');
    expect(arrived.game.ship1.position).toEqual(new BoardPosition(5, 6));
    expect(boardView.setShipPosition).toHaveBeenCalledWith('ship-1', new BoardPosition(5, 6));
    expect(boardView.setHighlights).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.any(BoardPosition)]),
    );
    animator.startedFlights[0]?.complete();
    expect(liveSnapshot(session).activePlayer).toBe('player-2');
  });

  it('recovers from animator startup failure and allows the same player to retry', () => {
    const controlled = new ControlledFlightAnimator();
    let starts = 0;
    const animator: FlightAnimator = {
      start: (...args: Parameters<FlightAnimator['start']>) => {
        starts += 1;
        if (starts === 1) {
          throw new Error('startup error');
        }
        return controlled.start(...args);
      },
    };
    const {
      session,
      animator: activeAnimator,
      onMovementError,
      controller,
    } = controllerHarness(animator);
    const initial = liveSnapshot(session);

    controller.handlePointerDown({ button: 0, worldX: 330, worldY: 270 });

    const recovered = liveSnapshot(session);
    expect(recovered.phase).toBe('ready');
    expect(recovered.activePlayer).toBe('player-1');
    expect(recovered.turnToken).toBeGreaterThan(initial.turnToken);
    expect(recovered.game.ship1.position).toEqual(new BoardPosition(5, 5));
    expect(onMovementError).toHaveBeenCalledWith('Movement failed: startup error');

    controller.handlePointerDown({ button: 0, worldX: 330, worldY: 270 });
    expect(controlled.startedFlights).toHaveLength(1);
    expect(activeAnimator).toBe(animator);
  });

  it('restores the origin and refreshes the same player after a mid-flight failure', () => {
    const { session, boardView, animator, onMovementError, controller } = controllerHarness();
    const initial = liveSnapshot(session);

    controller.handlePointerDown({ button: 0, worldX: 330, worldY: 270 });
    const controlled = animator as ControlledFlightAnimator;
    const flight = controlled.startedFlights[0];
    if (!flight) {
      throw new Error('Expected an active controlled flight.');
    }
    flight.update({ x: 300, y: 270 });
    flight.fail(new Error('mid-flight error'));

    const recovered = liveSnapshot(session);
    expect(recovered.phase).toBe('ready');
    expect(recovered.activePlayer).toBe('player-1');
    expect(recovered.turnToken).toBeGreaterThan(initial.turnToken);
    expect(recovered.game.ship1.position).toEqual(new BoardPosition(5, 5));
    expect(boardView.setShipPosition).toHaveBeenLastCalledWith('ship-1', new BoardPosition(5, 5));
    expect(onMovementError).toHaveBeenCalledWith('Movement failed: mid-flight error');

    controller.handlePointerDown({ button: 0, worldX: 330, worldY: 270 });
    expect(controlled.startedFlights).toHaveLength(2);
  });

  it('rejects duplicate arrivals and delayed pass activations from an earlier turn', () => {
    const deferred = new DeferredFlightAnimator();
    const movement = controllerHarness(deferred);
    movement.controller.handlePointerDown({ button: 0, worldX: 330, worldY: 270 });
    deferred.complete();
    const afterArrival = liveSnapshot(movement.session);
    deferred.complete();
    expect(liveSnapshot(movement.session).activePlayer).toBe('player-2');
    expect(movement.boardView.setShipPosition).toHaveBeenCalledTimes(1);
    expect(afterArrival.phase).toBe('ready');

    const immobileSession = new TurnSession(game(8, 8));
    const controls = { render: vi.fn() };
    const view = {
      setHighlights: vi.fn(),
      setShipPosition: vi.fn(),
      setShipVisualPosition: vi.fn(),
    };
    const immobileController = new MovementController(
      immobileSession,
      new BoardGeometry(600),
      view as unknown as BoardView,
      new ControlledFlightAnimator(),
      controls as unknown as TurnControls,
    );
    const pass = liveSnapshot(immobileSession);
    expect(immobileController.acknowledgePass(pass.gameRevision, pass.turnToken)).toBe(true);
    expect(immobileController.acknowledgePass(pass.gameRevision, pass.turnToken)).toBe(false);
    expect(liveSnapshot(immobileSession).activePlayer).toBe('player-2');
  });

  it('ignores deferred success/failure callbacks after replacement, recovery, and disposal', () => {
    const replacementAnimator = new DeferredFlightAnimator();
    const replacementHarness = controllerHarness(replacementAnimator);
    replacementHarness.controller.handlePointerDown({ button: 0, worldX: 330, worldY: 270 });
    const revision = replacementHarness.session.newGame(game());
    replacementHarness.controller.prepareForReplacement();
    replacementHarness.controller.markReady(revision);
    replacementAnimator.complete();
    replacementAnimator.fail(new Error('stale failure'));
    const replacement = liveSnapshot(replacementHarness.session);
    expect(replacement.gameRevision).toBe(revision);
    expect(replacement.activePlayer).toBe('player-1');
    expect(replacement.game.ship1.position).toEqual(new BoardPosition(5, 5));
    expect(replacementHarness.boardView.setShipPosition).not.toHaveBeenCalled();

    const recoveryAnimator = new DeferredFlightAnimator();
    const recoveryHarness = controllerHarness(recoveryAnimator);
    recoveryHarness.controller.handlePointerDown({ button: 0, worldX: 330, worldY: 270 });
    recoveryAnimator.fail(new Error('recover this move'));
    const recovered = liveSnapshot(recoveryHarness.session);
    recoveryAnimator.complete();
    recoveryAnimator.fail(new Error('duplicate failure'));
    expect(liveSnapshot(recoveryHarness.session).turnToken).toBe(recovered.turnToken);
    expect(liveSnapshot(recoveryHarness.session).activePlayer).toBe('player-1');

    const disposedAnimator = new DeferredFlightAnimator();
    const disposedHarness = controllerHarness(disposedAnimator);
    disposedHarness.controller.handlePointerDown({ button: 0, worldX: 330, worldY: 270 });
    disposedHarness.controller.dispose();
    disposedAnimator.complete();
    disposedAnimator.fail(new Error('after dispose'));
    expect(liveSnapshot(disposedHarness.session).phase).toBe('moving');
    expect(disposedHarness.boardView.setShipPosition).not.toHaveBeenCalled();
    expect(disposedAnimator.cancelled).toBe(true);
  });
});
