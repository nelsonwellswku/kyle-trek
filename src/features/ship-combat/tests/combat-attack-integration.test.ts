import { describe, expect, it, vi } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import type { BoardView } from '../../board/presentation/BoardView.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { ControlledFlightAnimator } from '../../ship-movement/tests/fixtures/ControlledFlightAnimator.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';
import { BattleSession, type BattleSnapshot } from '../domain/BattleSession.js';
import { AttackResolver } from '../domain/AttackResolver.js';
import { CombatGame, type CombatShip } from '../domain/CombatGame.js';
import { DiceRoller } from '../domain/DiceRoller.js';
import { ControlledTorpedoAnimator } from './fixtures/ControlledTorpedoAnimator.js';
import { CombatController } from '../presentation/CombatController.js';
import { CombatControls } from '../presentation/CombatControls.js';
import { FakeElement } from './fixtures/FakeDom.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';

function combatGame(defenderHitPoints = 10): CombatGame {
  const ship = (
    identity: 'ship-1' | 'ship-2',
    position: BoardPosition,
    hitPoints: number,
  ): CombatShip => ({
    identity,
    owner: identity === 'ship-1' ? 'player-1' : 'player-2',
    position,
    agility: new AgilityStat(8),
    strength: new AbilityStat(10),
    constitution: new AbilityStat(10),
    armorClass: 12,
    startingHitPoints: hitPoints,
    hitPoints,
  });

  return new CombatGame(
    ship('ship-1', new BoardPosition(1, 1), 10),
    ship('ship-2', new BoardPosition(10, 10), defenderHitPoints),
  );
}

function liveSnapshot(session: BattleSession): Exclude<BattleSnapshot, { phase: 'disposed' }> {
  const snapshot = session.snapshot;
  if (snapshot.phase === 'disposed') throw new Error('Expected a live battle.');
  return snapshot;
}

describe('combat attack integration result timing', () => {
  it('keeps HP and result unchanged during a controlled torpedo, then commits and retains the result', () => {
    const session = new BattleSession(combatGame(), {
      resolve: (attacker, defender) => ({
        kind: 'hit',
        attacker: attacker.identity,
        defender: defender.identity,
        attackDie: 12,
        strengthModifier: attacker.strength.modifier,
        attackTotal: 12 + attacker.strength.modifier,
        armorClass: 12,
        damageDie: 3,
        damage: 3,
        hitPointsBefore: defender.hitPoints,
        hitPointsAfter: defender.hitPoints - 3,
      }),
    });
    const geometry = new BoardGeometry(600);
    const boardView = {
      setHighlights: vi.fn(),
      setShipPosition: vi.fn(),
      setShipVisualPosition: vi.fn(),
    };
    const torpedoes = new ControlledTorpedoAnimator();
    const root = new FakeElement();
    const controls = new CombatControls(root as unknown as HTMLElement);
    const controller = new CombatController(
      session,
      geometry,
      boardView as unknown as BoardView,
      new ControlledFlightAnimator(),
      torpedoes,
      controls,
    );

    const initial = liveSnapshot(session);
    expect(initial.phase).toBe('awaiting-movement-skip');
    controller.markReady(initial.gameRevision);
    expect(controller.acknowledgeMovementSkip(initial.gameRevision, initial.turnToken)).toBe(true);

    const ready = liveSnapshot(session);
    expect(ready.phase).toBe('attack-ready');
    const targetCenter = geometry.cellCenter(ready.game.ship2.position);
    controller.handlePointerDown({
      button: 0,
      worldX: targetCenter.x,
      worldY: targetCenter.y,
    });

    const pending = session.snapshot;
    expect(pending.phase).toBe('attacking');
    if (pending.phase !== 'attacking') throw new Error('Expected an in-progress attack.');
    expect(torpedoes.startedAttacks).toHaveLength(1);
    expect(pending.game.ship2.hitPoints).toBe(10);
    expect(pending.lastCompletedAttack).toBeNull();
    expect(root.querySelector<HTMLElement>('#battle-result')?.textContent).toBe('');

    const torpedo = torpedoes.startedAttacks[0];
    if (!torpedo) throw new Error('Expected the controlled torpedo to start.');
    torpedo.complete();

    const completed = liveSnapshot(session);
    expect(completed.phase).toBe('awaiting-movement-skip');
    expect(completed.game.ship2.hitPoints).toBe(7);
    expect(completed.lastCompletedAttack).toEqual(torpedo.attack.outcome);
    const visibleResult = root.querySelector<HTMLElement>('#battle-result')?.textContent ?? '';
    expect(visibleResult).toMatch(/hit/i);
    expect(visibleResult).toMatch(/total/i);
    expect(visibleResult).toMatch(/damage/i);
    expect(visibleResult).toMatch(/remaining|HP/i);
    expect(visibleResult).toContain('12');
    expect(visibleResult).toContain('3');
    expect(visibleResult).toContain('7');
    expect(root.querySelector<HTMLElement>('#ship-2-hit-points')?.textContent).toBe('7 / 10');

    expect(controller.acknowledgeMovementSkip(completed.gameRevision, completed.turnToken)).toBe(
      true,
    );
    const nextPlayerReady = liveSnapshot(session);
    expect(nextPlayerReady.phase).toBe('attack-ready');
    expect(controller.endTurn(nextPlayerReady.gameRevision, nextPlayerReady.turnToken)).toBe(true);
    expect(root.querySelector<HTMLElement>('#battle-result')?.textContent).toBe(visibleResult);
    expect(liveSnapshot(session).lastCompletedAttack).toEqual(torpedo.attack.outcome);
  });

  it('discards pending damage when reset cancels a projectile and rejects late callbacks', () => {
    const session = new BattleSession(combatGame(), {
      resolve: (attacker, defender) => ({
        kind: 'hit',
        attacker: attacker.identity,
        defender: defender.identity,
        attackDie: 12,
        strengthModifier: attacker.strength.modifier,
        attackTotal: 12 + attacker.strength.modifier,
        armorClass: 12,
        damageDie: 3,
        damage: 3,
        hitPointsBefore: defender.hitPoints,
        hitPointsAfter: defender.hitPoints - 3,
      }),
    });
    const geometry = new BoardGeometry(600);
    const torpedoes = new ControlledTorpedoAnimator();
    const boardView = {
      setHighlights: vi.fn(),
      setShipPosition: vi.fn(),
      setShipVisualPosition: vi.fn(),
    };
    const controls = new CombatControls(new FakeElement() as unknown as HTMLElement);
    const controller = new CombatController(
      session,
      geometry,
      boardView as unknown as BoardView,
      new ControlledFlightAnimator(),
      torpedoes,
      controls,
    );
    const immobile = liveSnapshot(session);
    controller.markReady(immobile.gameRevision);
    controller.acknowledgeMovementSkip(immobile.gameRevision, immobile.turnToken);
    const ready = liveSnapshot(session);
    if (ready.phase !== 'attack-ready') throw new Error('Expected attack-ready.');
    const targetCenter = geometry.cellCenter(ready.game.ship2.position);
    controller.handlePointerDown({ button: 0, worldX: targetCenter.x, worldY: targetCenter.y });

    const pending = liveSnapshot(session);
    if (pending.phase !== 'attacking') throw new Error('Expected a pending torpedo.');
    const oldAttack = torpedoes.startedAttacks[0];
    if (!oldAttack) throw new Error('Expected the controlled attack.');
    expect(pending.game.ship2.hitPoints).toBe(10);

    const revision = session.newGame(combatGame());
    controller.prepareForReplacement();
    controller.markReady(revision);
    oldAttack.deliverLateCompletion();
    oldAttack.deliverLateFailure(new Error('late cancelled failure'));

    const replacement = liveSnapshot(session);
    expect(oldAttack.cancelled).toBe(true);
    expect(replacement.gameRevision).toBe(revision);
    expect(replacement.lastCompletedAttack).toBeNull();
    expect(replacement.game.ship2.hitPoints).toBe(10);
    expect(replacement.activePlayer).toBe('player-1');
    controller.dispose();
  });

  it('keeps a lethal outcome pending through impact and locks all later gameplay input', () => {
    const session = new BattleSession(combatGame(1), {
      resolve: (attacker, defender) => ({
        kind: 'hit',
        attacker: attacker.identity,
        defender: defender.identity,
        attackDie: 12,
        strengthModifier: attacker.strength.modifier,
        attackTotal: 12 + attacker.strength.modifier,
        armorClass: 12,
        damageDie: 3,
        damage: 3,
        hitPointsBefore: defender.hitPoints,
        hitPointsAfter: 0,
      }),
    });
    const geometry = new BoardGeometry(600);
    const torpedoes = new ControlledTorpedoAnimator();
    const boardView = {
      setHighlights: vi.fn(),
      setShipPosition: vi.fn(),
      setShipVisualPosition: vi.fn(),
    };
    const controls = new CombatControls(new FakeElement() as unknown as HTMLElement);
    const controller = new CombatController(
      session,
      geometry,
      boardView as unknown as BoardView,
      new ControlledFlightAnimator(),
      torpedoes,
      controls,
    );
    const immobile = liveSnapshot(session);
    controller.markReady(immobile.gameRevision);
    controller.acknowledgeMovementSkip(immobile.gameRevision, immobile.turnToken);
    const ready = liveSnapshot(session);
    if (ready.phase !== 'attack-ready') throw new Error('Expected attack-ready.');
    const targetCenter = geometry.cellCenter(ready.game.ship2.position);
    controller.handlePointerDown({ button: 0, worldX: targetCenter.x, worldY: targetCenter.y });

    const attacking = liveSnapshot(session);
    if (attacking.phase !== 'attacking') throw new Error('Expected a pending attack.');
    expect(attacking.game.ship2.hitPoints).toBe(1);
    controller.handlePointerDown({ button: 0, worldX: targetCenter.x, worldY: targetCenter.y });
    expect(torpedoes.startedAttacks).toHaveLength(1);

    const attack = torpedoes.startedAttacks[0];
    if (!attack) throw new Error('Expected one controlled torpedo.');
    attack.complete();
    const final = liveSnapshot(session);
    expect(final.phase).toBe('finished');
    expect(final.game.ship2.hitPoints).toBe(0);
    expect(final.lastCompletedAttack).toEqual(attack.attack.outcome);
    attack.deliverLateCompletion();
    controller.handlePointerDown({ button: 0, worldX: targetCenter.x, worldY: targetCenter.y });
    expect(liveSnapshot(session)).toEqual(final);
    expect(torpedoes.startedAttacks).toHaveLength(1);
    expect(boardView.setHighlights).toHaveBeenLastCalledWith([]);
    controller.dispose();
  });

  it('does not reroll a production attack after animation failure and explicitly advances two immobile turns', () => {
    const source = new ScriptedRandomSource([(12 - 1) / 20, (4 - 1) / 8]);
    const resolution = new AttackResolver(new DiceRoller(source));
    const session = new BattleSession(combatGame(), resolution);
    const geometry = new BoardGeometry(600);
    const error = new Error('effect playback failed');
    const torpedoes = new ControlledTorpedoAnimator();
    const boardView = {
      setHighlights: vi.fn(),
      setShipPosition: vi.fn(),
      setShipVisualPosition: vi.fn(),
    };
    const controls = new CombatControls(new FakeElement() as unknown as HTMLElement);
    const onAttackError = vi.fn();
    const controller = new CombatController(
      session,
      geometry,
      boardView as unknown as BoardView,
      new ControlledFlightAnimator(),
      torpedoes,
      controls,
      undefined,
      onAttackError,
    );

    const firstImmobile = liveSnapshot(session);
    expect(firstImmobile.phase).toBe('awaiting-movement-skip');
    controller.markReady(firstImmobile.gameRevision);
    controller.acknowledgeMovementSkip(firstImmobile.gameRevision, firstImmobile.turnToken);
    const firstReady = liveSnapshot(session);
    if (firstReady.phase !== 'attack-ready') throw new Error('Expected Player 1 attack-ready.');
    const target = geometry.cellCenter(firstReady.game.ship2.position);
    controller.handlePointerDown({ button: 0, worldX: target.x, worldY: target.y });
    const pending = liveSnapshot(session);
    if (pending.phase !== 'attacking') throw new Error('Expected a pending attack.');
    expect(source.consumedDraws).toBe(2);
    expect(pending.game.ship2.hitPoints).toBe(10);

    const attack = torpedoes.startedAttacks[0];
    if (!attack) throw new Error('Expected the production-resolved attack.');
    attack.fail(error);
    const afterFailure = liveSnapshot(session);
    expect(afterFailure.activePlayer).toBe('player-2');
    expect(afterFailure.phase).toBe('awaiting-movement-skip');
    expect(afterFailure.game.ship2.hitPoints).toBe(6);
    expect(afterFailure.lastCompletedAttack).toEqual(attack.attack.outcome);
    expect(source.consumedDraws).toBe(2);
    expect(onAttackError).toHaveBeenCalledWith(`Attack animation failed: ${error.message}`);

    controller.acknowledgeMovementSkip(afterFailure.gameRevision, afterFailure.turnToken);
    const secondReady = liveSnapshot(session);
    if (secondReady.phase !== 'attack-ready') throw new Error('Expected Player 2 attack-ready.');
    expect(controller.endTurn(secondReady.gameRevision, secondReady.turnToken)).toBe(true);
    const playerOneAgain = liveSnapshot(session);
    expect(playerOneAgain.activePlayer).toBe('player-1');
    expect(playerOneAgain.phase).toBe('awaiting-movement-skip');
    expect(source.consumedDraws).toBe(2);
    controller.dispose();
  });
});
