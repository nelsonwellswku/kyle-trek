/** Immutable one-based coordinate in the 10 × 10 × 10 battle cube. */
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
    return (this.x - 1) * 100 + (this.y - 1) * 10 + this.z - 1;
  }

  static fromPresentationIndex(index: number): CubePosition {
    if (!Number.isInteger(index) || index < 0 || index >= 1_000) {
      throw new RangeError('A cube presentation index must be an integer between 0 and 999.');
    }
    const x = Math.floor(index / 100) + 1;
    const y = Math.floor((index % 100) / 10) + 1;
    const z = (index % 10) + 1;
    return new CubePosition(x, y, z);
  }

  private static validateCubeCoordinate(value: number, name: string): void {
    if (!Number.isInteger(value) || value < 1 || value > 10) {
      throw new RangeError(`${name} must be an integer between 1 and 10.`);
    }
  }
}
