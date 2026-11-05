export const CUBE_SIZE = 5;
export const CUBE_CELL_COUNT = CUBE_SIZE ** 3;

/** Immutable one-based coordinate in the 5 × 5 × 5 battle cube. */
export class CubePosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;

  constructor(x: number, y: number, z: number) {
    CubePosition.validateCubeCoordinate(x, 'x');
    CubePosition.validateCubeCoordinate(y, 'y');
    CubePosition.validateCubeCoordinate(z, 'z');
    this.x = x;
    this.y = y;
    this.z = z;
    Object.freeze(this);
  }

  equals(other: CubePosition): boolean {
    return (
      other instanceof CubePosition &&
      this.x === other.x &&
      this.y === other.y &&
      this.z === other.z
    );
  }

  get presentationIndex(): number {
    return (this.x - 1) * CUBE_SIZE ** 2 + (this.y - 1) * CUBE_SIZE + this.z - 1;
  }

  static fromPresentationIndex(index: number): CubePosition {
    if (!Number.isInteger(index) || index < 0 || index >= CUBE_CELL_COUNT) {
      throw new RangeError(
        `A cube presentation index must be an integer between 0 and ${CUBE_CELL_COUNT - 1}.`,
      );
    }
    const x = Math.floor(index / CUBE_SIZE ** 2) + 1;
    const y = Math.floor((index % CUBE_SIZE ** 2) / CUBE_SIZE) + 1;
    const z = (index % CUBE_SIZE) + 1;
    return new CubePosition(x, y, z);
  }

  private static validateCubeCoordinate(value: number, name: string): void {
    if (!Number.isInteger(value) || value < 1 || value > CUBE_SIZE) {
      throw new RangeError(`${name} must be an integer between 1 and ${CUBE_SIZE}.`);
    }
  }
}
