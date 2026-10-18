import type { RandomSource } from '../domain/RandomSource.js';

export class MathRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}
