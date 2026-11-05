from dataclasses import dataclass
from enum import Enum


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


class Orientation(Enum):
    POSITIVE_Y = "+Y"
    NEGATIVE_Y = "-Y"


class Phase(Enum):
    MOVEMENT = "movement"
    MOVING = "moving"
    ATTACK_CHOICE = "attack choice"
    ATTACKING = "attacking"
    FINISHED = "finished"
