/** Supplies one independent value in the half-open interval [0, 1) for game creation. */
export interface RandomSource {
  next(): number;
}
