import type { RandomSource } from '../../game-setup/domain/RandomSource.js';
import { GameSetupFactory } from '../../game-setup/domain/GameSetupFactory.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';
import { DiceRoller } from './DiceRoller.js';
import { CombatGame, type CombatShip } from './CombatGame.js';

export class CombatGameFactory {
  private readonly setupFactory: GameSetupFactory;
  private readonly diceRoller: DiceRoller;

  constructor(randomSource: RandomSource) {
    this.setupFactory = new GameSetupFactory(randomSource);
    this.diceRoller = new DiceRoller(randomSource);
  }

  create(): CombatGame {
    const setup = this.setupFactory.create();
    const ship1 = this.createShip('ship-1', 'player-1', setup.ship1.position);
    const ship2 = this.createShip('ship-2', 'player-2', setup.ship2.position);
    return new CombatGame(ship1, ship2);
  }

  private createShip(
    identity: CombatShip['identity'],
    owner: CombatShip['owner'],
    position: CombatShip['position'],
  ): CombatShip {
    const agility = new AgilityStat(this.diceRoller.rollInclusive(8, 20));
    const strength = new AbilityStat(this.diceRoller.rollInclusive(8, 20));
    const constitution = new AbilityStat(this.diceRoller.rollInclusive(8, 20));
    const hitPointsRoll = this.diceRoller.rollInclusive(0, 20);
    const hitPoints = Math.max(1, hitPointsRoll + 2 * constitution.modifier);
    return {
      identity,
      owner,
      position,
      agility,
      strength,
      constitution,
      armorClass: 12,
      startingHitPoints: hitPoints,
      hitPoints,
    };
  }
}
