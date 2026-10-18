import { describe, expect, it } from 'vitest';
import { AgilityStat } from '../domain/AgilityStat.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';

describe('AgilityStat', () => {
  it.each([
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [13, 1],
    [14, 2],
    [15, 2],
    [16, 3],
    [17, 3],
    [18, 4],
    [19, 4],
    [20, 5],
  ])('maps agility %s to modifier %s and nonnegative allowance', (score, modifier) => {
    const agility = new AgilityStat(score);

    expect(agility.score).toBe(score);
    expect(agility.modifier).toBe(modifier);
    expect(agility.movementAllowance).toBe(Math.max(0, modifier));
    expect(Object.isFrozen(agility)).toBe(true);
  });

  it.each([7, 21, 8.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid agility score %s',
    (score) => {
      expect(() => new AgilityStat(score)).toThrow(RangeError);
    },
  );

  it('composes the shared AbilityStat while retaining the public movement interface', () => {
    const agility = new AgilityStat(8);
    expect(agility.ability).toBeInstanceOf(AbilityStat);
    expect(agility.score).toBe(8);
    expect(agility.modifier).toBe(-1);
    expect(agility.movementAllowance).toBe(0);
    expect(agility).toBeInstanceOf(AgilityStat);
  });
});
