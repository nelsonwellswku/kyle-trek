import { describe, expect, it, vi } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import type { ShipIdentity } from '../../board/domain/BoardSnapshot.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';
import { BattleSession, type BattleSnapshot } from '../domain/BattleSession.js';
import { CombatGame, type CombatShip } from '../domain/CombatGame.js';
import type { AttackOutcome, AttackResolution } from '../domain/AttackResolver.js';
import type { PendingMove } from '../../ship-movement/domain/PendingMove.js';

function game(
  options: {
    readonly agility1?: number;
    readonly agility2?: number;
    readonly strength1?: number;
    readonly strength2?: number;
    readonly hitPoints1?: number;
    readonly hitPoints2?: number;
  } = {},
): CombatGame {
  const ship = (
    identity: ShipIdentity,
    position: BoardPosition,
    agilityScore: number,
    strengthScore: number,
    hitPoints: number,
  ): CombatShip => ({
    identity,
    owner: identity === 'ship-1' ? 'player-1' : 'player-2',
    position,
    agility: new AgilityStat(agilityScore),
    strength: new AbilityStat(strengthScore),
    constitution: new AbilityStat(10),
    armorClass: 12,
    startingHitPoints: hitPoints,
    hitPoints,
  });

  return new CombatGame(
    ship(
      'ship-1',
      new BoardPosition(1, 1),
      options.agility1 ?? 14,
      options.strength1 ?? 10,
      options.hitPoints1 ?? 10,
    ),
    ship(
      'ship-2',
      new BoardPosition(10, 10),
      options.agility2 ?? 14,
      options.strength2 ?? 10,
      options.hitPoints2 ?? 10,
    ),
  );
}

function attackOutcome(
  attacker: CombatShip,
  defender: CombatShip,
  damage: number | null = null,
): AttackOutcome {
  const attackDie = damage === null ? 1 : 10;
  const attackTotal = attackDie + attacker.strength.modifier;
  const common = {
    attacker: attacker.identity,
    defender: defender.identity,
    attackDie,
    strengthModifier: attacker.strength.modifier,
    attackTotal,
    armorClass: 12 as const,
    hitPointsBefore: defender.hitPoints,
    hitPointsAfter: damage === null ? defender.hitPoints : Math.max(0, defender.hitPoints - damage),
  };
  if (damage === null) return { ...common, kind: 'miss' };

  return {
    ...common,
    kind: 'hit',
    damageDie: damage - attacker.strength.modifier,
    damage,
  };
}

function resolution(
  resolver: (attacker: CombatShip, defender: CombatShip) => AttackOutcome = attackOutcome,
): AttackResolution {
  return { resolve: resolver };
}

function snapshot(session: BattleSession): Exclude<BattleSnapshot, { phase: 'disposed' }> {
  const current = session.snapshot;
  if (current.phase === 'disposed') throw new Error('Expected a live battle.');
  return current;
}

function moveOneCell(session: BattleSession): PendingMove {
  const current = snapshot(session);
  if (current.phase !== 'movement-ready') throw new Error('Expected movement-ready phase.');
  const destination = current.reachability.destinations[0]?.position;
  if (!destination) throw new Error('Expected a legal movement destination.');
  const move = session.selectDestination(current.gameRevision, current.turnToken, destination);
  if (!move) throw new Error('Expected a pending move.');
  return move;
}

function arrive(session: BattleSession, move: PendingMove): void {
  expect(session.completeMove(move.gameRevision, move.turnToken, move.moveId)).toBe(true);
}

function beginAttack(session: BattleSession, target: ShipIdentity = 'ship-2') {
  const current = snapshot(session);
  if (current.phase !== 'attack-ready') throw new Error('Expected attack-ready phase.');
  const attack = session.selectAttack(current.gameRevision, current.turnToken, target);
  if (!attack) throw new Error('Expected a pending attack.');
  return attack;
}

describe('BattleSession', () => {
  it('starts Player 1 in movement-ready and retains player/token after legal arrival', () => {
    const session = new BattleSession(game(), resolution());
    const initial = snapshot(session);
    expect(initial.phase).toBe('movement-ready');
    expect(initial.activePlayer).toBe('player-1');
    expect(initial.activeShip).toBe('ship-1');
    expect(initial.lastCompletedAttack).toBeNull();
    expect(Object.isFrozen(initial)).toBe(true);

    const move = moveOneCell(session);
    expect(snapshot(session)).toMatchObject({ phase: 'moving', activePlayer: 'player-1' });
    expect(snapshot(session).turnToken).toBe(initial.turnToken);
    expect(snapshot(session).game.ship1.position).toEqual(new BoardPosition(1, 1));
    arrive(session, move);

    const arrived = snapshot(session);
    expect(arrived.phase).toBe('attack-ready');
    expect(arrived.activePlayer).toBe('player-1');
    expect(arrived.turnToken).toBe(initial.turnToken);
    expect(arrived.game.ship1.position).toEqual(move.destination);
  });

  it('requires explicit movement skip when immobile and only ends an attack-ready turn', () => {
    const attackResolution = {
      resolve: vi.fn((attacker, defender) => attackOutcome(attacker, defender)),
    };
    const session = new BattleSession(game({ agility1: 8, agility2: 8 }), attackResolution);
    const initial = snapshot(session);
    expect(initial.phase).toBe('awaiting-movement-skip');
    expect(session.endTurn(initial.gameRevision, initial.turnToken)).toBe(false);
    expect(session.acknowledgeMovementSkip(initial.gameRevision, initial.turnToken)).toBe(true);
    const ready = snapshot(session);
    expect(ready.phase).toBe('attack-ready');
    expect(ready.activePlayer).toBe('player-1');
    expect(ready.turnToken).toBe(initial.turnToken);

    const gameBefore = ready.game;
    expect(session.endTurn(ready.gameRevision, ready.turnToken)).toBe(true);
    const next = snapshot(session);
    expect(next.activePlayer).toBe('player-2');
    expect(next.turnToken).toBe(ready.turnToken + 1);
    expect(next.game).toBe(gameBefore);
    expect(next.lastCompletedAttack).toBeNull();
    expect(attackResolution.resolve).not.toHaveBeenCalled();
  });

  it('keeps HP unchanged while an injected hit is pending, then commits once on matching completion', () => {
    const session = new BattleSession(
      game({ strength1: 14, hitPoints2: 10 }),
      resolution((attacker, defender) => attackOutcome(attacker, defender, 5)),
    );
    arrive(session, moveOneCell(session));
    const before = snapshot(session);
    const pending = beginAttack(session);
    expect(Object.isFrozen(pending)).toBe(true);
    expect(pending.outcome).toMatchObject({ kind: 'hit', damage: 5, hitPointsBefore: 10 });
    expect(snapshot(session).phase).toBe('attacking');
    expect(snapshot(session).game.ship2.hitPoints).toBe(10);
    expect(session.completeAttack(pending.gameRevision, pending.turnToken, pending.attackId)).toBe(
      true,
    );

    const completed = snapshot(session);
    expect(completed.phase).toBe('movement-ready');
    expect(completed.activePlayer).toBe('player-2');
    expect(completed.turnToken).toBe(before.turnToken + 1);
    expect(completed.game.ship2.hitPoints).toBe(5);
    expect(completed.lastCompletedAttack).toEqual(pending.outcome);
    expect(session.completeAttack(pending.gameRevision, pending.turnToken, pending.attackId)).toBe(
      false,
    );
    expect(snapshot(session).game.ship2.hitPoints).toBe(5);
  });

  it.each([5, 9])(
    'declares the attacker winner after matching lethal completion with damage %i',
    (damage) => {
      const session = new BattleSession(
        game({ strength1: 14, hitPoints2: 5 }),
        resolution((attacker, defender) => attackOutcome(attacker, defender, damage)),
      );
      arrive(session, moveOneCell(session));
      const pending = beginAttack(session);
      expect(pending.outcome.hitPointsAfter).toBe(0);
      expect(snapshot(session).game.ship2.hitPoints).toBe(5);
      expect(
        session.completeAttack(pending.gameRevision, pending.turnToken, pending.attackId),
      ).toBe(true);

      const final = snapshot(session);
      expect(final.phase).toBe('finished');
      if (final.phase !== 'finished') throw new Error('Expected a finished battle.');
      expect(final.winner).toBe('player-1');
      expect(final.defeatedShip).toBe('ship-2');
      expect(final.game.ship2.hitPoints).toBe(0);
      expect(
        session.completeAttack(pending.gameRevision, pending.turnToken, pending.attackId),
      ).toBe(false);
      expect(session.endTurn(final.gameRevision, final.turnToken)).toBe(false);
      expect(session.selectAttack(final.gameRevision, final.turnToken, 'ship-2')).toBeNull();
      expect(snapshot(session)).toEqual(final);
    },
  );

  it('ignores self-targets, stale identities, and repeated attack starts without resolving', () => {
    const attackResolution = { resolve: vi.fn(attackOutcome) };
    const session = new BattleSession(game(), attackResolution);
    arrive(session, moveOneCell(session));
    const ready = snapshot(session);
    expect(session.selectAttack(ready.gameRevision, ready.turnToken, 'ship-1')).toBeNull();
    expect(attackResolution.resolve).not.toHaveBeenCalled();

    const pending = beginAttack(session);
    expect(session.selectAttack(pending.gameRevision, pending.turnToken, 'ship-2')).toBeNull();
    expect(
      session.completeAttack(pending.gameRevision, pending.turnToken + 1, pending.attackId),
    ).toBe(false);
    expect(attackResolution.resolve).toHaveBeenCalledTimes(1);
  });

  it.each([
    'attack die',
    'strength modifier',
    'armor class',
    'miss damage fields',
    'hit damage',
    'hit HP after',
  ])('rejects an invalid injected %s outcome before publishing attacking state', (invalidField) => {
    const attackResolution: AttackResolution = {
      resolve: (attacker, defender) => {
        const validMiss = attackOutcome(attacker, defender);
        switch (invalidField) {
          case 'attack die':
            return { ...validMiss, attackDie: 0 } as AttackOutcome;
          case 'strength modifier':
            return { ...validMiss, strengthModifier: 1, attackTotal: 2 } as AttackOutcome;
          case 'armor class':
            return { ...validMiss, armorClass: 13 } as unknown as AttackOutcome;
          case 'miss damage fields':
            return { ...validMiss, damage: undefined } as unknown as AttackOutcome;
          case 'hit damage':
            return {
              ...validMiss,
              kind: 'hit',
              attackDie: 12,
              attackTotal: 12,
              damageDie: 4,
              damage: 5,
              hitPointsAfter: defender.hitPoints - 5,
            } as AttackOutcome;
          case 'hit HP after':
            return {
              ...validMiss,
              kind: 'hit',
              attackDie: 12,
              attackTotal: 12,
              damageDie: 4,
              damage: 4,
              hitPointsAfter: defender.hitPoints,
            } as AttackOutcome;
        }
        throw new Error(`Unsupported invalid field: ${invalidField}`);
      },
    };
    const session = new BattleSession(game({ agility1: 8 }), attackResolution);
    const immobile = snapshot(session);
    expect(immobile.phase).toBe('awaiting-movement-skip');
    session.acknowledgeMovementSkip(immobile.gameRevision, immobile.turnToken);
    const ready = snapshot(session);
    expect(ready.phase).toBe('attack-ready');
    expect(() => session.selectAttack(ready.gameRevision, ready.turnToken, 'ship-2')).toThrow(
      RangeError,
    );
    expect(snapshot(session).phase).toBe('attack-ready');
    expect(snapshot(session).game.ship2.hitPoints).toBe(10);
  });

  it('supports 50 alternating move-and-attack turns with one handoff each', () => {
    const session = new BattleSession(game(), resolution());
    for (let turn = 0; turn < 50; turn += 1) {
      const current = snapshot(session);
      expect(current.activePlayer).toBe(turn % 2 === 0 ? 'player-1' : 'player-2');
      const move = moveOneCell(session);
      arrive(session, move);
      const target: ShipIdentity = current.activePlayer === 'player-1' ? 'ship-2' : 'ship-1';
      const pending = beginAttack(session, target);
      expect(
        session.completeAttack(pending.gameRevision, pending.turnToken, pending.attackId),
      ).toBe(true);
    }
    expect(snapshot(session).activePlayer).toBe('player-1');
    expect(snapshot(session).turnToken).toBe(51);
  });

  it('rejects invalid initial identities and counter overflow before publishing a transition', () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(() => new BattleSession(game(), resolution(), undefined, { gameRevision: 0 })).toThrow(
      RangeError,
    );
    expect(
      () => new BattleSession(game(), resolution(), undefined, { turnToken: max + 1 }),
    ).toThrow(RangeError);

    const moveOverflow = new BattleSession(game(), resolution(), undefined, { moveId: max });
    const moveInitial = snapshot(moveOverflow);
    expect(() => moveOneCell(moveOverflow)).toThrow(RangeError);
    expect(snapshot(moveOverflow)).toEqual(moveInitial);

    const tokenOverflow = new BattleSession(game({ agility1: 8 }), resolution(), undefined, {
      turnToken: max,
    });
    const immobile = snapshot(tokenOverflow);
    expect(tokenOverflow.acknowledgeMovementSkip(immobile.gameRevision, immobile.turnToken)).toBe(
      true,
    );
    const attackReady = snapshot(tokenOverflow);
    expect(() => tokenOverflow.endTurn(attackReady.gameRevision, attackReady.turnToken)).toThrow(
      RangeError,
    );
    expect(snapshot(tokenOverflow)).toEqual(attackReady);

    const attackOverflow = new BattleSession(game({ agility1: 8 }), resolution(), undefined, {
      attackId: max,
    });
    const awaiting = snapshot(attackOverflow);
    attackOverflow.acknowledgeMovementSkip(awaiting.gameRevision, awaiting.turnToken);
    const ready = snapshot(attackOverflow);
    expect(() =>
      attackOverflow.selectAttack(ready.gameRevision, ready.turnToken, 'ship-2'),
    ).toThrow(RangeError);
    expect(snapshot(attackOverflow)).toEqual(ready);

    const revisionOverflow = new BattleSession(game(), resolution(), undefined, {
      gameRevision: max,
    });
    const beforeReplacement = snapshot(revisionOverflow);
    expect(() => revisionOverflow.newGame(game())).toThrow(RangeError);
    expect(snapshot(revisionOverflow)).toEqual(beforeReplacement);
  });

  it('recovers failed movement without handing off and clears pending work on replacement/disposal', () => {
    const session = new BattleSession(game(), resolution());
    const move = moveOneCell(session);
    expect(session.recoverFailedMove(move.gameRevision, move.turnToken, move.moveId)).toBe(true);
    expect(snapshot(session)).toMatchObject({ phase: 'movement-ready', activePlayer: 'player-1' });
    expect(session.completeMove(move.gameRevision, move.turnToken, move.moveId)).toBe(false);

    const revision = session.newGame(game({ agility1: 8 }));
    const replacement = snapshot(session);
    expect(revision).toBe(2);
    expect(replacement.phase).toBe('awaiting-movement-skip');
    expect(replacement.activePlayer).toBe('player-1');
    expect(replacement.lastCompletedAttack).toBeNull();
    session.dispose();
    session.dispose();
    expect(session.snapshot.phase).toBe('disposed');
    expect(session.selectAttack(revision, replacement.turnToken, 'ship-2')).toBeNull();
  });
});
