import type { RandomSource } from '../../game-setup/domain/RandomSource.js';

export class DiceRoller {
  constructor(private readonly randomSource: RandomSource) {}

  rollInclusive(min: number, max: number): number {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
      throw new RangeError('Dice bounds must be ordered safe integers.');
    }

    const sample = this.randomSource.next();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError('RandomSource must return a finite number in [0, 1).');
    }

    return min + Math.floor(sample * (max - min + 1));
  }

  rollD20(): number {
    return this.rollInclusive(1, 20);
  }

  rollD8(): number {
    return this.rollInclusive(1, 8);
  }
}
