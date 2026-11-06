from dataclasses import dataclass
from enum import Enum
from math import atan2, degrees, hypot
from typing import ClassVar


@dataclass(frozen=True)
class Cell:
    x: int
    y: int
    z: int

    def __post_init__(self) -> None:
        if any(type(value) is not int or not 1 <= value <= 5 for value in (self.x, self.y, self.z)):
            raise ValueError("cell coordinates must be integers in 1..5")


class Player(Enum):
    ONE = 1
    TWO = 2


class RotationAxis(Enum):
    X = "x"
    Y = "y"
    Z = "z"


@dataclass(frozen=True)
class Orientation:
    """A discrete, right-handed orientation of the ship's local axes."""

    matrix: tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]] = (
        (1, 0, 0),
        (0, 1, 0),
        (0, 0, 1),
    )
    POSITIVE_Y: ClassVar["Orientation"]
    NEGATIVE_Y: ClassVar["Orientation"]

    def __post_init__(self) -> None:
        if (
            not isinstance(self.matrix, tuple)
            or len(self.matrix) != 3
            or any(not isinstance(row, tuple) or len(row) != 3 for row in self.matrix)
            or any(type(value) is not int or value not in (-1, 0, 1) for row in self.matrix for value in row)
        ):
            raise ValueError("orientation must be a discrete 3 by 3 matrix")
        rows = self.matrix
        for index in range(3):
            for other in range(3):
                dot = sum(rows[index][axis] * rows[other][axis] for axis in range(3))
                if dot != (1 if index == other else 0):
                    raise ValueError("orientation axes must be perpendicular unit directions")
        determinant = (
            rows[0][0] * (rows[1][1] * rows[2][2] - rows[1][2] * rows[2][1])
            - rows[0][1] * (rows[1][0] * rows[2][2] - rows[1][2] * rows[2][0])
            + rows[0][2] * (rows[1][0] * rows[2][1] - rows[1][1] * rows[2][0])
        )
        if determinant != 1:
            raise ValueError("orientation must preserve handedness")

    def rotated(self, axis: RotationAxis, direction: int) -> "Orientation":
        if not isinstance(axis, RotationAxis) or type(direction) is not int or direction not in (-1, 1):
            raise ValueError("rotation requires an axis and a quarter-turn direction of -1 or 1")
        quarter = {
            RotationAxis.X: ((1, 0, 0), (0, 0, -direction), (0, direction, 0)),
            RotationAxis.Y: ((0, 0, direction), (0, 1, 0), (-direction, 0, 0)),
            RotationAxis.Z: ((0, -direction, 0), (direction, 0, 0), (0, 0, 1)),
        }[axis]
        matrix = tuple(
            tuple(sum(quarter[row][index] * self.matrix[index][column] for index in range(3)) for column in range(3))
            for row in range(3)
        )
        return Orientation(matrix)

    @property
    def euler_degrees(self) -> tuple[float, float, float]:
        rows = self.matrix
        horizontal = hypot(rows[0][0], rows[1][0])
        if horizontal > 1e-9:
            x = atan2(rows[2][1], rows[2][2])
            y = atan2(-rows[2][0], horizontal)
            z = atan2(rows[1][0], rows[0][0])
        else:
            x = atan2(-rows[1][2], rows[1][1])
            y = atan2(-rows[2][0], horizontal)
            z = 0.0
        return (degrees(x), degrees(y), degrees(z))


Orientation.POSITIVE_Y = Orientation()
Orientation.NEGATIVE_Y = Orientation(((1, 0, 0), (0, -1, 0), (0, 0, -1)))


class Phase(Enum):
    MOVEMENT = "movement"
    MOVING = "moving"
    ATTACK_CHOICE = "attack choice"
    ATTACKING = "attacking"
    FINISHED = "finished"
