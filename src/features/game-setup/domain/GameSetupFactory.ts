import type { RandomSource } from './RandomSource.js';
import { CUBE_SIZE, CubePosition } from '../../board/domain/CubePosition.js';
import { GameSetup } from './GameSetup.js';

export class GameSetupFactory {
  constructor(private readonly randomSource: RandomSource) {}

  create(): GameSetup {
    const ship1Position = this.selectPosition(1);
    const ship2Position = this.selectPosition(4);

    return new GameSetup(
      { identity: 'ship-1', position: ship1Position },
      { identity: 'ship-2', position: ship2Position },
    );
  }

  private selectPosition(firstLayer: 1 | 4): CubePosition {
    const value = this.randomSource.next();

    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('RandomSource must return a finite number in [0, 1).');
    }

    const cellsAcrossTwoLayers = 2 * CUBE_SIZE;
    const index = Math.floor(value * 2 * CUBE_SIZE ** 2);
    const x = Math.floor(index / cellsAcrossTwoLayers) + 1;
    const y = firstLayer + Math.floor((index % cellsAcrossTwoLayers) / CUBE_SIZE);
    const z = (index % CUBE_SIZE) + 1;
    return new CubePosition(x, y, z);
  }
}
