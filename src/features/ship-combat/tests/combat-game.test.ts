import { describe, expect, it } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import type { BoardSnapshot } from '../../board/domain/BoardSnapshot.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';
import { CombatGame, type CombatShip } from '../domain/CombatGame.js';

function ship(identity: 'ship-1' | 'ship-2', row: number): CombatShip {
  return {
    identity,
    owner: identity === 'ship-1' ? 'player-1' : 'player-2',
    position: new BoardPosition(row, 2),
    agility: new AgilityStat(14),
    strength: new AbilityStat(16),
    constitution: new AbilityStat(12),
    armorClass: 12,
    startingHitPoints: 12,
    hitPoints: 12,
  };
}

function game(): CombatGame {
  return new CombatGame(ship('ship-1', 1), ship('ship-2', 10));
}

describe('CombatGame', () => {
  it('is a frozen BoardSnapshot-compatible pair of complete, frozen ship records', () => {
    const value = game();
    const snapshot: BoardSnapshot = value;
    expect(snapshot.rows).toBe(10);
    expect(snapshot.columns).toBe(10);
    expect(value.ship1.identity).toBe('ship-1');
    expect(value.ship1.owner).toBe('player-1');
    expect(value.ship2.identity).toBe('ship-2');
    expect(value.ship2.owner).toBe('player-2');
    expect(value.ship1.armorClass).toBe(12);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.ship1)).toBe(true);
    expect(Object.isFrozen(value.ship2)).toBe(true);
  });

  it.each([
    ['startingHitPoints', 0, 12],
    ['startingHitPoints', 31, 12],
    ['startingHitPoints', 1.5, 12],
    ['hitPoints', -1, 12],
    ['hitPoints', 13, 12],
    ['hitPoints', 1.5, 12],
  ])('rejects %s=%s', (field, invalid, starting) => {
    const broken = { ...ship('ship-1', 1), startingHitPoints: starting, [field]: invalid };
    expect(() => new CombatGame(broken as CombatShip, ship('ship-2', 10))).toThrow(RangeError);
  });

  it('rejects mismatched identity/owner, overlapping ships, and non-12 armor class', () => {
    expect(() => new CombatGame(ship('ship-2', 1), ship('ship-1', 10))).toThrow(RangeError);
    expect(
      () => new CombatGame({ ...ship('ship-1', 1), owner: 'player-2' }, ship('ship-2', 10)),
    ).toThrow(RangeError);
    expect(() => new CombatGame(ship('ship-1', 1), ship('ship-2', 1))).toThrow(RangeError);
    expect(
      () =>
        new CombatGame(
          { ...ship('ship-1', 1), armorClass: 11 } as unknown as CombatShip,
          ship('ship-2', 10),
        ),
    ).toThrow(RangeError);
  });

  it('returns complete immutable snapshots for position and damage updates', () => {
    const original = game();
    const moved = original.withPosition('ship-1', new BoardPosition(2, 3));
    const damaged = moved.withDamage('ship-2', 5);

    expect(original.ship1.position).toEqual(new BoardPosition(1, 2));
    expect(moved.ship1.position).toEqual(new BoardPosition(2, 3));
    expect(moved.ship1).toEqual({ ...original.ship1, position: new BoardPosition(2, 3) });
    expect(moved.ship1.strength).toBe(original.ship1.strength);
    expect(moved.ship1.constitution).toBe(original.ship1.constitution);
    expect(moved.ship1.hitPoints).toBe(12);
    expect(damaged.ship2.hitPoints).toBe(7);
    expect(damaged.ship2).toEqual({ ...moved.ship2, hitPoints: 7 });
    expect(damaged.ship2.startingHitPoints).toBe(12);
    expect(damaged.ship2.agility).toBe(original.ship2.agility);
    expect(damaged.ship1).toEqual(moved.ship1);
    expect(Object.isFrozen(damaged.ship2)).toBe(true);
  });

  it('requires safe nonnegative damage and clamps overkill at zero', () => {
    expect(() => game().withDamage('ship-1', -1)).toThrow(RangeError);
    expect(() => game().withDamage('ship-1', 1.5)).toThrow(RangeError);
    expect(game().withDamage('ship-1', 99).ship1.hitPoints).toBe(0);
  });

  it('accepts nonnegative integer overkill and clamps it to zero hit points', () => {
    expect(game().withDamage('ship-1', 1e30).ship1.hitPoints).toBe(0);
  });
});
