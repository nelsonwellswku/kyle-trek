import type { RandomSource } from './RandomSource.js';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { GameSetup } from './GameSetup.js';

export class GameSetupFactory {
  constructor(private readonly randomSource: RandomSource) {}

  create(): GameSetup {
    const ship1Bucket = this.selectBucket();
    const ship2Bucket = this.selectBucket();

    const ship1Position = new BoardPosition(
      Math.floor(ship1Bucket / 10) + 1,
      (ship1Bucket % 10) + 1,
    );
    const ship2Position = new BoardPosition(
      Math.floor(ship2Bucket / 10) + 9,
      (ship2Bucket % 10) + 1,
    );

    return new GameSetup(
      { identity: 'ship-1', position: ship1Position },
      { identity: 'ship-2', position: ship2Position },
    );
  }

  private selectBucket(): number {
    const value = this.randomSource.next();

    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('RandomSource must return a finite number in [0, 1).');
    }

    return Math.floor(value * 20);
  }
}
