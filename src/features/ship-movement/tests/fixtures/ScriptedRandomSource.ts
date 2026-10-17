import type { RandomSource } from '../../../game-setup/domain/RandomSource.js';

export class ScriptedRandomSource implements RandomSource {
  private nextIndex = 0;

  constructor(private readonly values: readonly number[]) {}

  get consumedDraws(): number {
    return this.nextIndex;
  }

  next(): number {
    const value = this.values[this.nextIndex];

    if (value === undefined) {
      throw new Error(`ScriptedRandomSource exhausted after ${this.nextIndex} draws.`);
    }

    this.nextIndex += 1;
    return value;
  }
}
