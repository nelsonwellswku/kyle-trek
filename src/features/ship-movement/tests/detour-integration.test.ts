import { describe, expect, it, vi } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import type { BoardView } from '../../board/presentation/BoardView.js';
import { AgilityStat } from '../domain/AgilityStat.js';
import { MovementGame } from '../domain/MovementGame.js';
import { Reachability } from '../domain/Reachability.js';
import { TurnSession } from '../domain/TurnSession.js';
import { MovementController } from '../presentation/MovementController.js';
import type { TurnControls } from '../presentation/TurnControls.js';
import { ControlledFlightAnimator } from './fixtures/ControlledFlightAnimator.js';

function positionKey(position: BoardPosition): string {
  return `${position.row},${position.column}`;
}

function cellCenter(row: number, column: number): { readonly x: number; readonly y: number } {
  return { x: column * 60 - 30, y: row * 60 - 30 };
}

function pointerAt(row: number, column: number) {
  const point = cellCenter(row, column);
  return { button: 0, worldX: point.x, worldY: point.y };
}

function createController(
  ship1Position: BoardPosition,
  ship2Position: BoardPosition,
  ship1Score: number,
  ship2Score = 20,
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
      agility: new AgilityStat(ship2Score),
    },
  );
  const session = new TurnSession(game);
  const boardView = {
    setHighlights: vi.fn(),
    setShipPosition: vi.fn(),
    setShipVisualPosition: vi.fn(),
  };
  const controls = { render: vi.fn() };
  const animator = new ControlledFlightAnimator();
  const controller = new MovementController(
    session,
    new BoardGeometry(600),
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

describe('enemy detour controller integration', () => {
  it('rejects the blocked direct destination below the four-step detour allowance', () => {
    const { session, animator, controller, boardView } = createController(
      new BoardPosition(5, 4),
      new BoardPosition(5, 5),
      14,
    );
    const initial = session.snapshot;
    expect(initial.phase).toBe('ready');
    if (initial.phase !== 'ready') {
      throw new Error('Expected Player 1 to have a ready movement turn.');
    }
    expectHighlightsMatchSession(session, boardView);

    controller.handlePointerDown(pointerAt(5, 6));
    controller.handlePointerDown(pointerAt(5, 5));

    expect(animator.startedFlights).toHaveLength(0);
    const unchanged = session.snapshot;
    expect(unchanged.phase).toBe('ready');
    if (unchanged.phase !== 'ready') {
      throw new Error('Invalid input must leave Player 1 in the ready phase.');
    }
    expect(unchanged.turnToken).toBe(initial.turnToken);
    expect(unchanged.game.ship1.position).toEqual(new BoardPosition(5, 4));
  });

  it('selects the highlighted four-step detour and refreshes occupancy and highlights after each arrival', () => {
    const { session, animator, controller, boardView } = createController(
      new BoardPosition(5, 4),
      new BoardPosition(5, 5),
      18,
    );
    const initial = session.snapshot;
    expect(initial.phase).toBe('ready');
    if (initial.phase !== 'ready') {
      throw new Error('Expected Player 1 to have a ready movement turn.');
    }

    const destination = new BoardPosition(5, 6);
    expectHighlightsMatchSession(session, boardView);
    expect(initial.reachability.routeTo(destination)?.stepCount).toBe(4);
    expect(new BoardGeometry(600).positionAt(cellCenter(5, 6))).toEqual(destination);
    controller.handlePointerDown(pointerAt(5, 6));

    expect(session.snapshot.phase).toBe('moving');
    expect(animator.startedFlights).toHaveLength(1);
    const firstFlight = animator.startedFlights[0];
    expect(firstFlight?.move.route.positions.map(positionKey)).toEqual(
      initial.reachability.routeTo(destination)?.positions.map(positionKey),
    );
    expect(firstFlight?.move.route.positions.map(positionKey)).toEqual([
      '5,4',
      '4,4',
      '4,5',
      '4,6',
      '5,6',
    ]);
    firstFlight?.complete();

    const afterFirstArrival = session.snapshot;
    expect(afterFirstArrival.phase).toBe('ready');
    if (afterFirstArrival.phase !== 'ready') {
      throw new Error('Expected Player 2 to have a ready turn after Player 1 arrives.');
    }
    expect(afterFirstArrival.activePlayer).toBe('player-2');
    expect(afterFirstArrival.game.ship1.position).toEqual(destination);
    expectHighlightsMatchSession(session, boardView);

    const playerTwoTurnToken = afterFirstArrival.turnToken;
    controller.handlePointerDown(pointerAt(5, 6));
    expect(animator.startedFlights).toHaveLength(1);
    expect(session.snapshot.turnToken).toBe(playerTwoTurnToken);

    controller.handlePointerDown(pointerAt(4, 5));
    animator.startedFlights[1]?.complete();

    const afterSecondArrival = session.snapshot;
    expect(afterSecondArrival.phase).toBe('ready');
    if (afterSecondArrival.phase !== 'ready') {
      throw new Error('Expected Player 1 to have a ready turn after Player 2 arrives.');
    }
    expect(afterSecondArrival.activePlayer).toBe('player-1');
    expect(afterSecondArrival.game.ship2.position).toEqual(new BoardPosition(4, 5));
    expectHighlightsMatchSession(session, boardView);
    const finalHighlights = boardView.setHighlights.mock.lastCall?.[0] ?? [];
    expect(finalHighlights.map(positionKey)).not.toContain('4,5');
    expect(finalHighlights.map(positionKey)).not.toContain('5,6');
  });

  it('keeps edge detours in bounds and rejects a destination only reachable by leaving the board', () => {
    const { session, animator, controller, boardView } = createController(
      new BoardPosition(1, 1),
      new BoardPosition(1, 2),
      20,
    );
    const initial = session.snapshot;
    expect(initial.phase).toBe('ready');
    if (initial.phase !== 'ready') {
      throw new Error('Expected the corner ship to have legal destinations.');
    }
    expectHighlightsMatchSession(session, boardView);
    expect(initial.reachability.routeTo(new BoardPosition(1, 2))).toBeNull();
    expect(initial.reachability.routeTo(new BoardPosition(1, 5))).toBeNull();

    const edgeDestination = new BoardPosition(1, 4);
    const edgeRoute = initial.reachability.routeTo(edgeDestination);
    expect(edgeRoute?.stepCount).toBe(5);
    expect(edgeRoute?.positions.map(positionKey)).toEqual([
      '1,1',
      '2,1',
      '2,2',
      '2,3',
      '1,3',
      '1,4',
    ]);
    expect(
      edgeRoute?.positions.every(
        (position) =>
          position.row >= 1 && position.row <= 10 && position.column >= 1 && position.column <= 10,
      ),
    ).toBe(true);

    controller.handlePointerDown(pointerAt(1, 5));
    expect(animator.startedFlights).toHaveLength(0);
    controller.handlePointerDown(pointerAt(1, 4));
    animator.startedFlights[0]?.complete();

    const afterArrival = session.snapshot;
    expect(afterArrival.phase).toBe('ready');
    if (afterArrival.phase !== 'ready') {
      throw new Error('Expected Player 2 to have a ready turn after the edge move.');
    }
    expect(afterArrival.activePlayer).toBe('player-2');
    expectHighlightsMatchSession(session, boardView);
    for (const highlight of boardView.setHighlights.mock.lastCall?.[0] ?? []) {
      expect(highlight.row).toBeGreaterThanOrEqual(1);
      expect(highlight.row).toBeLessThanOrEqual(10);
      expect(highlight.column).toBeGreaterThanOrEqual(1);
      expect(highlight.column).toBeLessThanOrEqual(10);
    }
  });

  it('requires one explicit pass acknowledgment per surrounded player turn', () => {
    const game = new MovementGame(
      {
        identity: 'ship-1',
        owner: 'player-1',
        position: new BoardPosition(5, 5),
        agility: new AgilityStat(18),
      },
      {
        identity: 'ship-2',
        owner: 'player-2',
        position: new BoardPosition(9, 9),
        agility: new AgilityStat(18),
      },
    );
    const fixtureBlockers = [
      new BoardPosition(4, 5),
      new BoardPosition(5, 6),
      new BoardPosition(6, 5),
      new BoardPosition(5, 4),
      new BoardPosition(8, 9),
      new BoardPosition(9, 10),
      new BoardPosition(10, 9),
      new BoardPosition(9, 8),
    ];
    const reachability = new Reachability();
    const find = reachability.find.bind(reachability);
    vi.spyOn(reachability, 'find').mockImplementation((snapshot, activeShip, allowance) =>
      find(snapshot, activeShip, allowance, fixtureBlockers),
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
      new BoardGeometry(600),
      boardView as unknown as BoardView,
      animator,
      controls as unknown as TurnControls,
    );
    controller.markReady(1);

    const playerOne = session.snapshot;
    expect(playerOne.phase).toBe('awaiting-pass');
    expectHighlightsMatchSession(session, boardView);
    expect(animator.startedFlights).toHaveLength(0);
    controller.handlePointerDown(pointerAt(4, 5));
    expect(animator.startedFlights).toHaveLength(0);
    if (playerOne.phase !== 'awaiting-pass') {
      throw new Error('Expected Player 1 to wait for an explicit pass.');
    }
    expect(controller.acknowledgePass(playerOne.gameRevision, playerOne.turnToken)).toBe(true);

    const playerTwo = session.snapshot;
    expect(playerTwo.phase).toBe('awaiting-pass');
    if (playerTwo.phase !== 'awaiting-pass') {
      throw new Error('Expected Player 2 to await a separate pass acknowledgment.');
    }
    expect(playerTwo.activePlayer).toBe('player-2');
    expect(controller.acknowledgePass(playerOne.gameRevision, playerOne.turnToken)).toBe(false);
    expectHighlightsMatchSession(session, boardView);
    if (playerTwo.phase !== 'awaiting-pass') {
      throw new Error('Expected Player 2 to wait for a separate explicit pass.');
    }
    expect(controller.acknowledgePass(playerTwo.gameRevision, playerTwo.turnToken)).toBe(true);

    const playerOneAgain = session.snapshot;
    expect(playerOneAgain.phase).toBe('awaiting-pass');
    if (playerOneAgain.phase !== 'awaiting-pass') {
      throw new Error('Expected the pass cycle to return to Player 1.');
    }
    expect(playerOneAgain.activePlayer).toBe('player-1');
    expect(animator.startedFlights).toHaveLength(0);
  });
});
