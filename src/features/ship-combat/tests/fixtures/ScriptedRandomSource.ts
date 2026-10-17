import type { RandomSource } from '../../../game-setup/domain/RandomSource.js';

export class ScriptedRandomSource implements RandomSource {
  private index = 0;

  constructor(private readonly samples: readonly number[]) {}

  get consumedDraws(): number {
    return this.index;
  }

  next(): number {
    const value = this.samples[this.index];
    if (value === undefined) {
      throw new Error(`ScriptedRandomSource exhausted after ${this.index} draws.`);
    }
    this.index += 1;
    return value;
  }
}
