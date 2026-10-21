import { describe, expect, it, vi } from 'vitest';
import { CubePosition } from '../../board/domain/CubePosition.js';
import { AgilityStat } from '../domain/AgilityStat.js';
import { MovementGame } from '../domain/MovementGame.js';
import { Reachability } from '../domain/Reachability.js';
import { TurnSession } from '../domain/TurnSession.js';
import { MovementController } from '../presentation/MovementController.js';
import type { TurnControls } from '../presentation/TurnControls.js';
import type { BoardView } from '../../board/presentation/BoardView.js';
import { ControlledFlightAnimator } from './fixtures/ControlledFlightAnimator.js';

function positionKey(position: CubePosition): string {
  return `${position.x},${position.y},${position.z}`;
}

function createController(
  ship1Position: CubePosition,
  ship2Position: CubePosition,
  ship1Score: number,
  reachability = new Reachability(),
) {
  const game = new MovementGame(
    {
      identity: 'ship-1',
      owner: 'player-1',
      position: ship1Position,
      agility: new AgilityStat(ship1Score),
    },
    {
      identity: 'ship-2',
      owner: 'player-2',
      position: ship2Position,
      agility: new AgilityStat(20),
    },
  );
  const session = new TurnSession(game, reachability);
  const boardView = {
    setHighlights: vi.fn(),
    setShipPosition: vi.fn(),
    setShipVisualPosition: vi.fn(),
  };
  const controls = { render: vi.fn() };
  const animator = new ControlledFlightAnimator();
  const controller = new MovementController(
    session,
    { logicalSize: 600 } as never,
    boardView as unknown as BoardView,
    animator,
    controls as unknown as TurnControls,
  );
  controller.markReady(1);
  return { session, boardView, controls, animator, controller };
}

function expectHighlightsMatchSession(
  session: TurnSession,
  boardView: ReturnType<typeof createController>['boardView'],
): void {
  const snapshot = session.snapshot;
  const expected =
    snapshot.phase === 'ready'
      ? snapshot.reachability.destinations.map(({ position }) => positionKey(position)).sort()
      : [];
  const lastCall = boardView.setHighlights.mock.lastCall;
  expect(lastCall).toBeDefined();
  expect((lastCall?.[0] ?? []).map(positionKey).sort()).toEqual(expected);
}

describe('3D movement controller integration', () => {
  it('rejects an occupied cell and a blocked destination below its detour allowance', () => {
    const { session, animator, controller, boardView } = createController(
      new CubePosition(5, 5, 5),
      new CubePosition(6, 5, 5),
      14,
    );
    const initial = session.snapshot;
    if (initial.phase !== 'ready') throw new Error('Expected a playable movement turn.');
    expectHighlightsMatchSession(session, boardView);

    controller.handlePickTarget({ type: 'cell', position: new CubePosition(6, 5, 5) });
    controller.handlePickTarget({ type: 'cell', position: new CubePosition(7, 5, 5) });

    expect(animator.startedFlights).toHaveLength(0);
    const unchanged = session.snapshot;
    expect(unchanged.phase).toBe('ready');
    if (unchanged.phase === 'disposed') throw new Error('The movement session was disposed.');
    expect(unchanged.turnToken).toBe(initial.turnToken);
    expect(unchanged.game.ship1.position).toEqual(new CubePosition(5, 5, 5));
  });

  it('selects the highlighted affordable detour and commits the exact cube destination once', () => {
    const { session, animator, controller, boardView } = createController(
      new CubePosition(5, 5, 5),
      new CubePosition(6, 5, 5),
      18,
    );
    const initial = session.snapshot;
    if (initial.phase !== 'ready') throw new Error('Expected a playable movement turn.');
    const destination = new CubePosition(7, 5, 5);
    const expectedRoute = initial.reachability.routeTo(destination);
    expectHighlightsMatchSession(session, boardView);
    expect(expectedRoute?.stepCount).toBe(4);

    controller.handlePickTarget({ type: 'cell', position: destination });
    expect(session.snapshot.phase).toBe('moving');
    expect(animator.startedFlights).toHaveLength(1);
    const flight = animator.startedFlights[0];
    expect(flight?.move.route.positions.map(positionKey)).toEqual(
      expectedRoute?.positions.map(positionKey),
    );
    expect(flight?.move.route.positions.map(positionKey)).toEqual([
      '5,5,5',
      '5,4,5',
      '6,4,5',
      '7,4,5',
      '7,5,5',
    ]);
    flight?.complete();

    const arrived = session.snapshot;
    expect(arrived.phase).toBe('ready');
    if (arrived.phase !== 'ready') throw new Error('Expected the next player to be ready.');
    expect(arrived.activePlayer).toBe('player-2');
    expect(arrived.game.ship1.position).toEqual(destination);
    expectHighlightsMatchSession(session, boardView);
    expect(animator.completedFlights).toHaveLength(1);
  });

  it('keeps five-step routes at cube boundaries and moves through depth coordinates', () => {
    const { session, animator, controller } = createController(
      new CubePosition(1, 1, 1),
      new CubePosition(10, 10, 10),
      20,
    );
    const initial = session.snapshot;
    if (initial.phase !== 'ready') throw new Error('Expected a playable corner turn.');
    const destination = new CubePosition(1, 1, 6);
    const route = initial.reachability.routeTo(destination);
    expect(route?.stepCount).toBe(5);
    expect(
      route?.positions.every(
        ({ x, y, z }) => x >= 1 && x <= 10 && y >= 1 && y <= 10 && z >= 1 && z <= 10,
      ),
    ).toBe(true);

    controller.handlePickTarget({ type: 'cell', position: destination });
    expect(animator.startedFlights).toHaveLength(1);
    animator.startedFlights[0]?.complete();
    const arrived = session.snapshot;
    if (arrived.phase === 'disposed') throw new Error('The movement session was disposed.');
    expect(arrived.game.ship1.position).toEqual(destination);
  });

  it('requires one explicit pass acknowledgment when all six neighboring cells are blocked', () => {
    const blockers = [
      new CubePosition(4, 5, 5),
      new CubePosition(6, 5, 5),
      new CubePosition(5, 4, 5),
      new CubePosition(5, 6, 5),
      new CubePosition(5, 5, 4),
      new CubePosition(5, 5, 6),
      new CubePosition(8, 9, 9),
      new CubePosition(10, 9, 9),
      new CubePosition(9, 8, 9),
      new CubePosition(9, 10, 9),
      new CubePosition(9, 9, 8),
      new CubePosition(9, 9, 10),
    ];
    const reachability = new Reachability();
    const find = reachability.find.bind(reachability);
    vi.spyOn(reachability, 'find').mockImplementation((snapshot, activeShip, allowance) =>
      find(snapshot, activeShip, allowance, blockers),
    );
    const { session, animator, controller } = createController(
      new CubePosition(5, 5, 5),
      new CubePosition(9, 9, 9),
      18,
      reachability,
    );

    const playerOne = session.snapshot;
    expect(playerOne.phase).toBe('awaiting-pass');
    expect(animator.startedFlights).toHaveLength(0);
    if (playerOne.phase !== 'awaiting-pass') throw new Error('Expected movement to be skipped.');
    controller.handlePickTarget({ type: 'cell', position: new CubePosition(4, 5, 5) });
    expect(animator.startedFlights).toHaveLength(0);
    expect(controller.acknowledgePass(playerOne.gameRevision, playerOne.turnToken)).toBe(true);

    const playerTwo = session.snapshot;
    expect(playerTwo.phase).toBe('awaiting-pass');
    if (playerTwo.phase !== 'awaiting-pass') throw new Error('Expected a separate pass action.');
    expect(playerTwo.activePlayer).toBe('player-2');
    expect(controller.acknowledgePass(playerOne.gameRevision, playerOne.turnToken)).toBe(false);
    expect(controller.acknowledgePass(playerTwo.gameRevision, playerTwo.turnToken)).toBe(true);
    const next = session.snapshot;
    if (next.phase === 'disposed') throw new Error('The movement session was disposed.');
    expect(next.activePlayer).toBe('player-1');
  });
});
