import type { RandomSource } from '../../game-setup/domain/RandomSource.js';
import { GameSetupFactory } from '../../game-setup/domain/GameSetupFactory.js';
import { AgilityStat } from './AgilityStat.js';
import { MovementGame } from './MovementGame.js';

export class MovementGameFactory {
  constructor(private readonly randomSource: RandomSource) {}

  create(): MovementGame {
    const setup = new GameSetupFactory(this.randomSource).create();
    const ship1Agility = this.selectAgility();
    const ship2Agility = this.selectAgility();

    return new MovementGame(
      {
        identity: 'ship-1',
        owner: 'player-1',
        position: setup.ship1.position,
        agility: ship1Agility,
      },
      {
        identity: 'ship-2',
        owner: 'player-2',
        position: setup.ship2.position,
        agility: ship2Agility,
      },
    );
  }

  private selectAgility(): AgilityStat {
    const value = this.randomSource.next();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('RandomSource must return a finite number in [0, 1).');
    }

    return new AgilityStat(8 + Math.floor(value * 13));
  }
}
