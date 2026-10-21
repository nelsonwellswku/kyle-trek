export type CubeAxis = 'x' | 'y' | 'z';
export type QuarterTurn = -1 | 1;

export interface SignedAxis {
  readonly axis: CubeAxis;
  readonly sign: QuarterTurn;
}

type Vector = readonly [x: number, y: number, z: number];

const AXIS_VECTOR: Readonly<Record<CubeAxis, Vector>> = Object.freeze({
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
});

/** A right-handed orthonormal signed-axis basis, independent of any renderer. */
export class CubeOrientation {
  readonly right: SignedAxis;
  readonly up: SignedAxis;
  readonly forward: SignedAxis;

  constructor(right: SignedAxis, up: SignedAxis, forward: SignedAxis) {
    const basis = [right, up, forward].map((vector) => CubeOrientation.toVector(vector));
    const [rightVector, upVector, forwardVector] = basis;
    if (
      !rightVector ||
      !upVector ||
      !forwardVector ||
      CubeOrientation.dot(rightVector, upVector) !== 0 ||
      CubeOrientation.dot(rightVector, forwardVector) !== 0 ||
      CubeOrientation.dot(upVector, forwardVector) !== 0 ||
      !CubeOrientation.vectorsEqual(CubeOrientation.cross(rightVector, upVector), forwardVector)
    ) {
      throw new RangeError('CubeOrientation requires a right-handed signed-axis basis.');
    }

    this.right = CubeOrientation.toSignedAxis(rightVector);
    this.up = CubeOrientation.toSignedAxis(upVector);
    this.forward = CubeOrientation.toSignedAxis(forwardVector);
    Object.freeze(this);
  }

  static ship1Default(): CubeOrientation {
    return new CubeOrientation(
      { axis: 'x', sign: -1 },
      { axis: 'z', sign: 1 },
      { axis: 'y', sign: 1 },
    );
  }

  static ship2Default(): CubeOrientation {
    return new CubeOrientation(
      { axis: 'x', sign: 1 },
      { axis: 'z', sign: 1 },
      { axis: 'y', sign: -1 },
    );
  }

  get isRightHanded(): boolean {
    return CubeOrientation.vectorsEqual(
      CubeOrientation.cross(
        CubeOrientation.toVector(this.right),
        CubeOrientation.toVector(this.up),
      ),
      CubeOrientation.toVector(this.forward),
    );
  }

  get key(): string {
    return `${CubeOrientation.vectorKey(this.right)}|${CubeOrientation.vectorKey(this.up)}|${CubeOrientation.vectorKey(this.forward)}`;
  }

  equals(other: CubeOrientation): boolean {
    return other instanceof CubeOrientation && this.key === other.key;
  }

  /** Compose a signed 90-degree turn around a global cube axis. */
  rotate(axis: CubeAxis, direction: QuarterTurn): CubeOrientation {
    if (!(axis in AXIS_VECTOR) || (direction !== -1 && direction !== 1)) {
      throw new RangeError('A cube turn requires a global axis and a signed quarter-turn.');
    }
    return new CubeOrientation(
      CubeOrientation.toSignedAxis(
        CubeOrientation.rotateVector(CubeOrientation.toVector(this.right), axis, direction),
      ),
      CubeOrientation.toSignedAxis(
        CubeOrientation.rotateVector(CubeOrientation.toVector(this.up), axis, direction),
      ),
      CubeOrientation.toSignedAxis(
        CubeOrientation.rotateVector(CubeOrientation.toVector(this.forward), axis, direction),
      ),
    );
  }

  private static toVector(value: SignedAxis): Vector {
    if (
      value === null ||
      typeof value !== 'object' ||
      !(value.axis in AXIS_VECTOR) ||
      (value.sign !== -1 && value.sign !== 1)
    ) {
      throw new RangeError('An orientation basis must contain signed unit axes.');
    }
    const [x, y, z] = AXIS_VECTOR[value.axis];
    return [x * value.sign, y * value.sign, z * value.sign];
  }

  private static toSignedAxis([x, y, z]: Vector): SignedAxis {
    if (x !== 0) return Object.freeze({ axis: 'x', sign: x as QuarterTurn });
    if (y !== 0) return Object.freeze({ axis: 'y', sign: y as QuarterTurn });
    return Object.freeze({ axis: 'z', sign: z as QuarterTurn });
  }

  private static rotateVector([x, y, z]: Vector, axis: CubeAxis, direction: QuarterTurn): Vector {
    if (axis === 'x') return [x, -direction * z, direction * y];
    if (axis === 'y') return [direction * z, y, -direction * x];
    return [-direction * y, direction * x, z];
  }

  private static cross([ax, ay, az]: Vector, [bx, by, bz]: Vector): Vector {
    return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
  }

  private static dot([ax, ay, az]: Vector, [bx, by, bz]: Vector): number {
    return ax * bx + ay * by + az * bz;
  }

  private static vectorsEqual(left: Vector, right: Vector): boolean {
    return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
  }

  private static vectorKey(vector: SignedAxis): string {
    return `${vector.sign}${vector.axis}`;
  }
}
