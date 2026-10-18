/** Supplies one independently sampled value in the half-open interval [0, 1). */
export interface RandomSource {
  next(): number;
}
