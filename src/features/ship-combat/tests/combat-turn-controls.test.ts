import { describe, expect, it, vi } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';
import { BattleSession, type BattleSnapshot } from '../domain/BattleSession.js';
import { CombatGame, type CombatShip } from '../domain/CombatGame.js';
import type { AttackResolution } from '../domain/AttackResolver.js';
import { CombatControls } from '../presentation/CombatControls.js';
import { FakeElement } from './fixtures/FakeDom.js';

function combatGame(agilityScore: number): CombatGame {
  const ship = (identity: 'ship-1' | 'ship-2', row: number): CombatShip => ({
    identity,
    owner: identity === 'ship-1' ? 'player-1' : 'player-2',
    position: new BoardPosition(row, 4),
    agility: new AgilityStat(agilityScore),
    strength: new AbilityStat(12),
    constitution: new AbilityStat(12),
    armorClass: 12,
    startingHitPoints: 10,
    hitPoints: 10,
  });
  return new CombatGame(ship('ship-1', 1), ship('ship-2', 10));
}

function immobileSnapshot(): { session: BattleSession; snapshot: BattleSnapshot } {
  const session = new BattleSession(combatGame(8), { resolve: vi.fn() } as AttackResolution);
  return { session, snapshot: session.snapshot };
}

function attackReady(session: BattleSession): Exclude<BattleSnapshot, { phase: 'disposed' }> {
  const current = session.snapshot;
  if (current.phase !== 'awaiting-movement-skip') {
    throw new Error('Expected an immobile ship.');
  }
  session.acknowledgeMovementSkip(current.gameRevision, current.turnToken);
  return session.snapshot as Exclude<BattleSnapshot, { phase: 'disposed' }>;
}

describe('CombatControls battle phases', () => {
  it('offers Skip movement only when immobile and End turn only after movement resolves', () => {
    const { session, snapshot } = immobileSnapshot();
    const root = new FakeElement();
    const skip = vi.fn();
    const end = vi.fn();
    const controls = new CombatControls(root as unknown as HTMLElement);
    controls.setActionHandlers(skip, end);
    controls.renderBattle(snapshot);

    const skipButton = root.querySelector<HTMLButtonElement>('button.skip-movement-button');
    const endButton = root.querySelector<HTMLButtonElement>('button.end-turn-button');
    expect(skipButton?.hidden).toBe(false);
    expect(skipButton?.disabled).toBe(false);
    expect(endButton?.hidden).toBe(true);
    expect(endButton?.disabled).toBe(true);
    skipButton?.click();
    expect(skip).toHaveBeenCalledWith(snapshot.gameRevision, snapshot.turnToken);
    expect(end).not.toHaveBeenCalled();

    const ready = attackReady(session);
    controls.renderBattle(ready);
    expect(skipButton?.hidden).toBe(true);
    expect(skipButton?.disabled).toBe(true);
    expect(endButton?.hidden).toBe(false);
    expect(endButton?.disabled).toBe(false);
    endButton?.click();
    expect(end).toHaveBeenCalledWith(ready.gameRevision, ready.turnToken);
  });

  it('renders active-player instructions and phase-specific live status text', () => {
    const session = new BattleSession(combatGame(14), {
      resolve: (attacker, defender) => ({
        kind: 'miss',
        attacker: attacker.identity,
        defender: defender.identity,
        attackDie: 1,
        strengthModifier: attacker.strength.modifier,
        attackTotal: 1 + attacker.strength.modifier,
        armorClass: 12,
        hitPointsBefore: defender.hitPoints,
        hitPointsAfter: defender.hitPoints,
      }),
    });
    const root = new FakeElement();
    const controls = new CombatControls(root as unknown as HTMLElement);
    const movement = session.snapshot;
    controls.renderBattle(movement);
    expect(root.querySelector('#active-turn')?.textContent).toContain('Player 1');
    expect(root.querySelector('#turn-status')?.textContent).toMatch(/move/i);
    expect(
      (root.querySelector('#turn-status') as unknown as FakeElement).attributes.get('role'),
    ).toBe('status');
    expect(
      (root.querySelector('#turn-status') as unknown as FakeElement).attributes.get('aria-live'),
    ).toBe('polite');

    if (movement.phase !== 'movement-ready') throw new Error('Expected movement-ready phase.');
    const destination = movement.reachability.destinations[0]?.position;
    if (!destination) throw new Error('Expected a legal destination.');
    const move = session.selectDestination(movement.gameRevision, movement.turnToken, destination);
    if (!move) throw new Error('Expected a pending move.');
    controls.renderBattle(session.snapshot);
    expect(root.querySelector('#turn-status')?.textContent).toMatch(/moving/i);
    session.completeMove(move.gameRevision, move.turnToken, move.moveId);

    const ready = session.snapshot;
    if (ready.phase !== 'attack-ready') throw new Error('Expected attack-ready phase.');
    controls.renderBattle(ready);
    expect(root.querySelector('#turn-status')?.textContent).toMatch(/opposing ship.*end turn/i);
    const attack = session.selectAttack(ready.gameRevision, ready.turnToken, 'ship-2');
    if (!attack) throw new Error('Expected a pending injected attack.');
    controls.renderBattle(session.snapshot);
    expect(root.querySelector('#turn-status')?.textContent).toMatch(/attack.*progress|resolving/i);
    session.completeAttack(attack.gameRevision, attack.turnToken, attack.attackId);
    controls.renderBattle(session.snapshot);
    expect(root.querySelector('#active-turn')?.textContent).toContain('Player 2');
    expect(root.querySelector('#turn-status')?.textContent).toMatch(/move/i);

    session.dispose();
    controls.renderBattle(session.snapshot);
    expect(root.querySelector('#turn-status')?.textContent).toMatch(/closed|disposed/i);
  });

  it('uses native buttons and replaces obsolete listeners on render and dispose', () => {
    const { session, snapshot } = immobileSnapshot();
    const root = new FakeElement();
    const skip = vi.fn();
    const end = vi.fn();
    const controls = new CombatControls(root as unknown as HTMLElement);
    controls.setActionHandlers(skip, end);
    controls.renderBattle(snapshot);
    expect(root.innerHTML).toContain('<button class="skip-movement-button" type="button"');
    expect(root.innerHTML).toContain('<button class="end-turn-button" type="button"');

    const skipButton = root.querySelector<HTMLButtonElement>('button.skip-movement-button');
    const firstRevision = snapshot.gameRevision;
    const firstToken = snapshot.turnToken;
    session.acknowledgeMovementSkip(firstRevision, firstToken);
    const ready = session.snapshot;
    controls.renderBattle(ready);
    skipButton?.click();
    expect(skip).not.toHaveBeenCalled();

    session.endTurn(ready.gameRevision, ready.turnToken);
    const next = session.snapshot;
    session.acknowledgeMovementSkip(next.gameRevision, next.turnToken);
    const nextReady = session.snapshot;
    controls.renderBattle(nextReady);
    root.querySelector<HTMLButtonElement>('button.end-turn-button')?.click();
    expect(end).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenLastCalledWith(nextReady.gameRevision, nextReady.turnToken);

    controls.dispose();
    controls.dispose();
    root.querySelector<HTMLButtonElement>('button.end-turn-button')?.click();
    expect(end).toHaveBeenCalledTimes(1);
  });
});
