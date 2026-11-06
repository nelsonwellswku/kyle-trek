from itertools import product
from math import cos, isfinite, radians, sin, tan
from typing import ClassVar

from kyle_trek.battle.state import Battle
from kyle_trek.battle.types import Cell


class CameraFraming:
    """Fit the cube and axis anchors within a perspective view, with label margin."""

    AXIS_POSITIONS: ClassVar[tuple[tuple[float, float, float], ...]] = (
        (3.2, 2.7, -2.7), (-2.7, -3.2, -2.7), (-2.7, 2.7, 3.2),
    )

    @staticmethod
    def distance(yaw: float, pitch: float, aspect: float, horizontal_fov: float) -> float:
        if not all(isfinite(value) for value in (yaw, pitch, aspect, horizontal_fov)) or aspect <= 0 or not 0 < horizontal_fov < 180:
            raise ValueError("camera framing requires finite angles and a positive perspective viewport")
        yaw, pitch = radians(yaw), radians(pitch)
        outward = (sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch))
        right = (cos(yaw), 0.0, sin(yaw))
        up = (-sin(yaw) * sin(pitch), cos(pitch), cos(yaw) * sin(pitch))
        horizontal = tan(radians(horizontal_fov / 2)) * .9
        vertical = horizontal / aspect
        points = tuple(product((-2.5, 2.5), repeat=3)) + CameraFraming.AXIS_POSITIONS
        return max(13.0, max(
            sum(a * b for a, b in zip(point, outward)) + max(
                abs(sum(a * b for a, b in zip(point, right))) / horizontal,
                abs(sum(a * b for a, b in zip(point, up))) / vertical,
            )
            for point in points
        ))


class Inspection:
    def __init__(self, battle: Battle):
        self.battle = battle
        self.layer = 1
        self.hovered = None
        self.yaw = 45.0
        self.pitch = 30.0

    @property
    def cells(self) -> tuple[Cell, ...]:
        return tuple(Cell(x, y, z) for z in range(1, 6) for y in range(1, 6) for x in range(1, 6))

    def select_layer(self, layer: int) -> None:
        if type(layer) is not int or not 1 <= layer <= 5:
            raise ValueError("layer must be an integer in 1..5")
        self.layer = layer
        self.hovered = None

    def hover(self, cell: Cell) -> str:
        if not isinstance(cell, Cell):
            raise ValueError("hover requires a cell")
        self.hovered = cell
        player = self.battle.occupancy.get(cell)
        occupant = f"Player {player.value}" if player is not None else "empty"
        return f"({cell.x}, {cell.y}, {cell.z}): {occupant}"

    def orbit(self, yaw: float, pitch: float) -> None:
        self.yaw = (self.yaw + yaw) % 360
        self.pitch = max(-85.0, min(85.0, self.pitch + pitch))
