export class AgilityStat {
  readonly modifier: number;
  readonly movementAllowance: number;

  constructor(readonly score: number) {
    if (!Number.isInteger(score) || score < 8 || score > 20) {
      throw new RangeError('Agility score must be an integer between 8 and 20.');
    }

    this.modifier = Math.floor((score - 10) / 2);
    this.movementAllowance = Math.max(0, this.modifier);
    Object.freeze(this);
  }
}
