import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';

export class AgilityStat {
  readonly ability: AbilityStat;
  readonly movementAllowance: number;

  constructor(score: number) {
    this.ability = new AbilityStat(score);
    this.movementAllowance = Math.max(0, this.ability.modifier);
    Object.freeze(this);
  }

  get score(): number {
    return this.ability.score;
  }

  get modifier(): number {
    return this.ability.modifier;
  }
}
