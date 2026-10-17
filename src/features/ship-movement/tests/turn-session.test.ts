import { describe, expect, it } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { AgilityStat } from '../domain/AgilityStat.js';
import { MovementGame } from '../domain/MovementGame.js';
import { TurnSession } from '../domain/TurnSession.js';

function game(score1 = 20, score2 = 20): MovementGame {
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

describe('TurnSession', () => {
  it('starts with Player 1 and exposes immutable ready snapshots', () => {
    const session = new TurnSession(game());
    const snapshot = session.snapshot;

    expect(snapshot.phase).toBe('ready');
    if (snapshot.phase !== 'ready') {
      return;
    }
    expect(snapshot.activePlayer).toBe('player-1');
    expect(snapshot.activeShip).toBe('ship-1');
    expect(snapshot.gameRevision).toBe(1);
    expect(snapshot.turnToken).toBe(1);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.reachability.destinations)).toBe(true);
  });

  it('locks a valid shorter move, commits only matching arrival and retains stats', () => {
    const session = new TurnSession(game(18, 16));
    const ready = session.snapshot;
    if (ready.phase !== 'ready') {
      throw new Error('Expected a playable initial turn.');
    }
    const origin = ready.game.ship1.position;
    expect(session.selectDestination(ready.turnToken + 1, new BoardPosition(5, 6))).toBeNull();
    expect(session.selectDestination(ready.turnToken, origin)).toBeNull();
    expect(session.selectDestination(ready.turnToken, new BoardPosition(10, 10))).toBeNull();
    expect(session.snapshot.phase).toBe('ready');
    const pending = session.selectDestination(ready.turnToken, new BoardPosition(5, 6));

    expect(pending?.route.stepCount).toBe(1);
    expect(pending?.otherShipPosition).toEqual(new BoardPosition(10, 10));
    const moving = session.snapshot;
    expect(moving.phase).toBe('moving');
    if (moving.phase !== 'moving') {
      throw new Error('Expected a moving turn after accepting the destination.');
    }
    expect(Object.isFrozen(moving.pendingMove)).toBe(true);
    expect(Object.isFrozen(moving.pendingMove.route.positions)).toBe(true);
    expect(moving.game.ship1.position).toEqual(origin);
    expect(session.selectDestination(ready.turnToken, new BoardPosition(5, 7))).toBeNull();
    expect(
      session.completeMove(ready.gameRevision, ready.turnToken + 1, pending?.moveId ?? 0),
    ).toBe(false);
    expect(session.completeMove(ready.gameRevision, ready.turnToken, pending?.moveId ?? 0)).toBe(
      true,
    );

    const next = session.snapshot;
    expect(next.phase).toBe('ready');
    if (next.phase !== 'ready') {
      throw new Error('Expected the next player to receive a playable turn.');
    }
    expect(next.activePlayer).toBe('player-2');
    expect(next.activeShip).toBe('ship-2');
    expect(next.game.ship1.position).toEqual(new BoardPosition(5, 6));
    expect(next.game.ship1.agility.score).toBe(18);
    expect(session.completeMove(ready.gameRevision, ready.turnToken, pending?.moveId ?? 0)).toBe(
      false,
    );
  });

  it('leaves invalid destinations unchanged and creates a pass phase for no-moves turns', () => {
    const session = new TurnSession(game(8, 11));
    const awaiting = session.snapshot;

    expect(awaiting.phase).toBe('awaiting-pass');
    if (awaiting.phase !== 'awaiting-pass') {
      throw new Error('Expected a pass-required initial turn.');
    }
    expect(awaiting.reachability.destinations).toEqual([]);
    expect(session.selectDestination(awaiting.turnToken, new BoardPosition(5, 6))).toBeNull();
    expect(session.snapshot).toMatchObject({
      phase: 'awaiting-pass',
      turnToken: awaiting.turnToken,
    });
    expect(session.acknowledgePass(awaiting.gameRevision, awaiting.turnToken + 1)).toBe(false);
    expect(session.acknowledgePass(awaiting.gameRevision, awaiting.turnToken)).toBe(true);
    expect(session.acknowledgePass(awaiting.gameRevision, awaiting.turnToken)).toBe(false);
    expect(session.snapshot).toMatchObject({ phase: 'awaiting-pass', activePlayer: 'player-2' });
  });

  it('alternates 50 completed moves and requires 20 separate pass acknowledgements', () => {
    const movement = new TurnSession(game());
    for (let move = 0; move < 50; move += 1) {
      const ready = movement.snapshot;
      if (ready.phase !== 'ready') {
        throw new Error(`Expected move ${move + 1} to be playable.`);
      }
      const destination = ready.reachability.destinations[0]?.position;
      if (!destination) {
        throw new Error(`Expected a reachable destination for move ${move + 1}.`);
      }
      const pending = movement.selectDestination(ready.turnToken, destination);
      if (!pending) {
        throw new Error(`Expected move ${move + 1} to be accepted.`);
      }
      expect(movement.completeMove(ready.gameRevision, ready.turnToken, pending.moveId)).toBe(true);
      const next = movement.snapshot;
      if (next.phase === 'disposed') {
        throw new Error('A live session must not be disposed.');
      }
      expect(next.activePlayer).toBe(move % 2 === 0 ? 'player-2' : 'player-1');
    }

    const passes = new TurnSession(game(8, 9));
    for (let pass = 0; pass < 20; pass += 1) {
      const awaiting = passes.snapshot;
      if (awaiting.phase !== 'awaiting-pass') {
        throw new Error(`Expected pass ${pass + 1} to require acknowledgment.`);
      }
      expect(passes.acknowledgePass(awaiting.gameRevision, awaiting.turnToken)).toBe(true);
      expect(passes.acknowledgePass(awaiting.gameRevision, awaiting.turnToken)).toBe(false);
      const next = passes.snapshot;
      if (next.phase === 'disposed') {
        throw new Error('A live session must not be disposed.');
      }
      expect(next.activePlayer).toBe(pass % 2 === 0 ? 'player-2' : 'player-1');
    }
  });

  it('rejects identity-counter overflow without wrapping or partially committing', () => {
    const moveOverflow = new TurnSession(game(), undefined, { moveId: Number.MAX_SAFE_INTEGER });
    const moveReady = moveOverflow.snapshot;
    expect(() =>
      moveOverflow.selectDestination(moveReady.turnToken, new BoardPosition(5, 6)),
    ).toThrow(RangeError);

    const turnOverflow = new TurnSession(game(), undefined, {
      turnToken: Number.MAX_SAFE_INTEGER,
    });
    const turnReady = turnOverflow.snapshot;
    const pending = turnOverflow.selectDestination(turnReady.turnToken, new BoardPosition(5, 6));
    expect(pending).not.toBeNull();
    expect(() =>
      turnOverflow.completeMove(turnReady.gameRevision, turnReady.turnToken, pending?.moveId ?? 0),
    ).toThrow(RangeError);
    const stillMoving = turnOverflow.snapshot;
    expect(stillMoving.phase).toBe('moving');
    if (stillMoving.phase !== 'moving') {
      throw new Error('Counter overflow must preserve the pending movement.');
    }
    expect(stillMoving.game.ship1.position).toEqual(new BoardPosition(5, 5));

    const revisionOverflow = new TurnSession(game(), undefined, {
      gameRevision: Number.MAX_SAFE_INTEGER,
    });
    expect(() => revisionOverflow.newGame(game())).toThrow(RangeError);
  });

  it('invalidates all gameplay commands after disposal', () => {
    const session = new TurnSession(game());
    const ready = session.snapshot;
    session.dispose();

    expect(session.snapshot.phase).toBe('disposed');
    expect(session.selectDestination(ready.turnToken, new BoardPosition(5, 6))).toBeNull();
    expect(session.completeMove(ready.gameRevision, ready.turnToken, 1)).toBe(false);
    expect(session.acknowledgePass(ready.gameRevision, ready.turnToken)).toBe(false);
    expect(() => session.newGame(game())).toThrow(Error);
  });
});
