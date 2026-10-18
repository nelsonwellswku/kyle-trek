import { describe, expect, it } from 'vitest';
import { AbilityStat } from '../domain/AbilityStat.js';

describe('AbilityStat', () => {
  it.each(Array.from({ length: 13 }, (_, index) => 8 + index))(
    'validates score %i and derives its modifier',
    (score) => {
      const stat = new AbilityStat(score);
      expect(stat.score).toBe(score);
      expect(stat.modifier).toBe(Math.floor((score - 10) / 2));
      expect(Object.isFrozen(stat)).toBe(true);
    },
  );

  it.each([7, 21, 8.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid score %s', (score) =>
    expect(() => new AbilityStat(score)).toThrow(RangeError),
  );
});
