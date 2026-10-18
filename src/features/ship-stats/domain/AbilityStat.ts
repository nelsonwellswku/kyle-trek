/** Validated, immutable shared ability score. */
export class AbilityStat {
  readonly score: number;
  readonly modifier: number;

  constructor(score: number) {
    if (!Number.isInteger(score) || score < 8 || score > 20) {
      throw new RangeError('Ability score must be an integer between 8 and 20.');
    }
    this.score = score;
    this.modifier = Math.floor((score - 10) / 2);
    Object.freeze(this);
  }
}
