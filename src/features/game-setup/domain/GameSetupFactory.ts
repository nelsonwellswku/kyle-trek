import type { RandomSource } from './RandomSource.js';
import { CubePosition } from '../../board/domain/CubePosition.js';
import { GameSetup } from './GameSetup.js';

export class GameSetupFactory {
  constructor(private readonly randomSource: RandomSource) {}

  create(): GameSetup {
    const ship1Position = this.selectPosition(1);
    const ship2Position = this.selectPosition(9);

    return new GameSetup(
      { identity: 'ship-1', position: ship1Position },
      { identity: 'ship-2', position: ship2Position },
    );
  }

  private selectPosition(firstLayer: 1 | 9): CubePosition {
    const value = this.randomSource.next();

    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('RandomSource must return a finite number in [0, 1).');
    }

    const index = Math.floor(value * 200);
    const x = Math.floor(index / 20) + 1;
    const y = firstLayer + Math.floor((index % 20) / 10);
    const z = (index % 10) + 1;
    return new CubePosition(x, y, z);
  }
}
