from kyle_trek.battle.state import Battle
from kyle_trek.battle.types import Cell


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
