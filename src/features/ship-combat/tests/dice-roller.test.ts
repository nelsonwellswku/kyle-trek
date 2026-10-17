import { describe, expect, it } from 'vitest';
import { DiceRoller } from '../domain/DiceRoller.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';

describe('DiceRoller', () => {
  it.each([
    [0, 8],
    [0.07692307692307693, 9],
    [0.5, 14],
    [0.999999999999, 20],
  ])('maps sample %s to the inclusive 8–20 bucket %s', (sample, expected) => {
    const random = new ScriptedRandomSource([sample]);
    expect(new DiceRoller(random).rollInclusive(8, 20)).toBe(expected);
    expect(random.consumedDraws).toBe(1);
  });

  it.each([
    [0, 0, 20, 0],
    [0.999999999999, 0, 20, 20],
    [0, 1, 20, 1],
    [0.999999999999, 1, 20, 20],
    [0, 1, 8, 1],
    [0.999999999999, 1, 8, 8],
  ])('rolls sample %s over %s–%s as %s', (sample, min, max, expected) => {
    expect(new DiceRoller(new ScriptedRandomSource([sample])).rollInclusive(min, max)).toBe(
      expected,
    );
  });

  it.each([
    [Number.NaN, 1, 20, 1],
    [Number.POSITIVE_INFINITY, 1, 20, 1],
    [-0.01, 1, 20, 1],
    [1, 1, 20, 1],
    [0, 20, 19, 0],
    [0, 2, 1, 0],
    [0, 1.5, 8, 0],
  ])('rejects invalid sample or bounds %s/%s/%s', (sample, min, max, consumed) => {
    const random = new ScriptedRandomSource([sample]);
    const roller = new DiceRoller(random);
    expect(() => roller.rollInclusive(min, max)).toThrow(RangeError);
    expect(random.consumedDraws).toBe(consumed);
  });
});
