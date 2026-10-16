export class BoardPosition {
  readonly row: number;
  readonly column: number;

  constructor(row: number, column: number) {
    BoardPosition.validateCoordinate(row, 'row');
    BoardPosition.validateCoordinate(column, 'column');

    this.row = row;
    this.column = column;
    Object.freeze(this);
  }

  equals(other: BoardPosition): boolean {
    return this.row === other.row && this.column === other.column;
  }

  private static validateCoordinate(value: number, name: string): void {
    if (!Number.isInteger(value) || value < 1 || value > 10) {
      throw new RangeError(`${name} must be an integer between 1 and 10.`);
    }
  }
}
