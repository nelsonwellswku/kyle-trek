import { describe, expect, it } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';
import { BattleSession, type BattleSnapshot } from '../domain/BattleSession.js';
import { CombatGame, type CombatShip } from '../domain/CombatGame.js';
import type { AttackOutcome } from '../domain/AttackResolver.js';
import { CombatControls } from '../presentation/CombatControls.js';
import { FakeElement } from './fixtures/FakeDom.js';

function combatGame(ship2HitPoints = 10): CombatGame {
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
    ship('ship-2', new BoardPosition(10, 10), ship2HitPoints),
  );
}

function hitOutcome(attacker: CombatShip, defender: CombatShip, damage = 3): AttackOutcome {
  return {
    kind: 'hit',
    attacker: attacker.identity,
    defender: defender.identity,
    attackDie: 12,
    strengthModifier: attacker.strength.modifier,
    attackTotal: 12 + attacker.strength.modifier,
    armorClass: 12,
    damageDie: damage,
    damage,
    hitPointsBefore: defender.hitPoints,
    hitPointsAfter: Math.max(0, defender.hitPoints - damage),
  };
}

function missOutcome(attacker: CombatShip, defender: CombatShip): AttackOutcome {
  return {
    kind: 'miss',
    attacker: attacker.identity,
    defender: defender.identity,
    attackDie: 1,
    strengthModifier: attacker.strength.modifier,
    attackTotal: 1 + attacker.strength.modifier,
    armorClass: 12,
    hitPointsBefore: defender.hitPoints,
    hitPointsAfter: defender.hitPoints,
  };
}

function controlsFor(root = new FakeElement()) {
  return {
    root,
    controls: new CombatControls(root as unknown as HTMLElement),
  };
}

function launchAttack(session: BattleSession, controls: CombatControls) {
  const initial = session.snapshot;
  if (initial.phase !== 'awaiting-movement-skip') {
    throw new Error('Expected an immobile ship to require movement skip.');
  }
  controls.renderBattle(initial);
  session.acknowledgeMovementSkip(initial.gameRevision, initial.turnToken);

  const ready = session.snapshot;
  if (ready.phase !== 'attack-ready') throw new Error('Expected attack-ready phase.');
  controls.renderBattle(ready);
  const pending = session.selectAttack(ready.gameRevision, ready.turnToken, 'ship-2');
  if (!pending) throw new Error('Expected the opposing ship attack to start.');
  controls.renderBattle(session.snapshot);
  return pending;
}

function text(root: FakeElement, selector: string): string {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Expected ${selector} in combat controls.`);
  return element.textContent ?? '';
}

function liveSnapshot(session: BattleSession): Exclude<BattleSnapshot, { phase: 'disposed' }> {
  const snapshot = session.snapshot;
  if (snapshot.phase === 'disposed') throw new Error('Expected a live battle.');
  return snapshot;
}

describe('CombatControls completed attack results', () => {
  it('withholds a pending hit, then shows its total, damage and remaining HP through the next turn', () => {
    const session = new BattleSession(combatGame(), {
      resolve: (attacker, defender) => hitOutcome(attacker, defender),
    });
    const { root, controls } = controlsFor();
    const pending = launchAttack(session, controls);

    expect(session.snapshot.phase).toBe('attacking');
    expect(text(root, '#battle-result')).toBe('');

    expect(session.completeAttack(pending.gameRevision, pending.turnToken, pending.attackId)).toBe(
      true,
    );
    controls.renderBattle(session.snapshot);

    const completedResult = text(root, '#battle-result');
    expect(completedResult).toMatch(/ship-1/i);
    expect(completedResult).toMatch(/ship-2/i);
    expect(completedResult).toMatch(/hit/i);
    expect(completedResult).toMatch(/total/i);
    expect(completedResult).toContain('12');
    expect(completedResult).toMatch(/damage/i);
    expect(completedResult).toMatch(/remaining|HP/i);
    expect(completedResult).toContain('3');
    expect(completedResult).toContain('7');
    expect(text(root, '#ship-2-hit-points')).toBe('7 / 10');

    const nextTurn = liveSnapshot(session);
    if (nextTurn.phase !== 'awaiting-movement-skip') {
      throw new Error('Expected Player 2 to begin the next turn immobile.');
    }
    session.acknowledgeMovementSkip(nextTurn.gameRevision, nextTurn.turnToken);
    const nextPlayerReady = liveSnapshot(session);
    if (nextPlayerReady.phase !== 'attack-ready') {
      throw new Error('Expected Player 2 to reach attack-ready.');
    }
    session.endTurn(nextPlayerReady.gameRevision, nextPlayerReady.turnToken);
    controls.renderBattle(session.snapshot);

    expect(text(root, '#battle-result')).toBe(completedResult);
    expect(liveSnapshot(session).activePlayer).toBe('player-1');
  });

  it('shows a completed miss and attack total without changing either ship HP', () => {
    const session = new BattleSession(combatGame(), {
      resolve: (attacker, defender) => missOutcome(attacker, defender),
    });
    const { root, controls } = controlsFor();
    const pending = launchAttack(session, controls);

    expect(text(root, '#battle-result')).toBe('');
    expect(session.completeAttack(pending.gameRevision, pending.turnToken, pending.attackId)).toBe(
      true,
    );
    controls.renderBattle(session.snapshot);

    const result = text(root, '#battle-result');
    expect(result).toMatch(/miss/i);
    expect(result).toMatch(/total/i);
    expect(result).toContain('1');
    expect(result).toContain('12');
    expect(text(root, '#ship-2-hit-points')).toBe('10 / 10');
  });

  it('shows lethal victory with zero HP and no actionable turn controls, then clears it on New Game', () => {
    const session = new BattleSession(combatGame(2), {
      resolve: (attacker, defender) => hitOutcome(attacker, defender),
    });
    const { root, controls } = controlsFor();
    const pending = launchAttack(session, controls);

    expect(text(root, '#battle-result')).toBe('');
    expect(session.completeAttack(pending.gameRevision, pending.turnToken, pending.attackId)).toBe(
      true,
    );
    controls.renderBattle(session.snapshot);

    const finished = liveSnapshot(session);
    expect(finished.phase).toBe('finished');
    if (finished.phase !== 'finished') throw new Error('Expected a finished battle.');
    expect(text(root, '#battle-winner')).toMatch(/player 1/i);
    expect(text(root, '#ship-2-hit-points')).toBe('0 / 2');
    for (const selector of ['button.skip-movement-button', 'button.end-turn-button']) {
      const button = root.querySelector<HTMLButtonElement>(selector);
      expect(button?.hidden).toBe(true);
      expect(button?.disabled).toBe(true);
    }
    expect(text(root, '#battle-result')).toMatch(/hit/i);

    session.newGame(combatGame());
    controls.renderBattle(session.snapshot);

    expect(liveSnapshot(session).lastCompletedAttack).toBeNull();
    expect(text(root, '#battle-result')).toBe('');
    expect(text(root, '#battle-winner')).toBe('');
  });
});
