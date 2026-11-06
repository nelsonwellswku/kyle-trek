from dataclasses import dataclass
from math import isfinite, sqrt
from collections import deque

from kyle_trek.battle.types import Cell


@dataclass(frozen=True)
class FlightPlan:
    waypoints: tuple[Cell, ...]
    duration: float
    ship_size: float

    def __post_init__(self) -> None:
        if len(self.waypoints) < 2 or not all(isinstance(cell, Cell) for cell in self.waypoints):
            raise ValueError("a flight path requires at least two valid waypoints")
        if not isfinite(self.duration) or self.duration <= 0 or self.duration > 1.5:
            raise ValueError("flight duration must be positive and at most 1.5 seconds")
        if not isfinite(self.ship_size) or self.ship_size <= 0:
            raise ValueError("ship size must be positive and finite")


class FlightPlanner:
    def __init__(self, duration: float = 0.8, ship_size: float = 0.46):
        if not isfinite(duration) or duration <= 0 or duration > 1.5:
            raise ValueError("flight duration must be positive and at most 1.5 seconds")
        if not isfinite(ship_size) or ship_size <= 0 or ship_size * sqrt(3) / 2 > 0.5:
            raise ValueError("the full ship envelope must fit within one board cell")
        self.duration = duration
        self.ship_size = ship_size

    def plan(self, start: Cell, destination: Cell, opponent: Cell) -> FlightPlan:
        if not all(isinstance(cell, Cell) for cell in (start, destination, opponent)):
            raise ValueError("flight planning requires valid cells")
        if start == destination or start == opponent or destination == opponent:
            raise ValueError("flight endpoints must be distinct and unoccupied")
        if self._segment_clear(start, destination, opponent):
            waypoints = (start, destination)
        else:
            waypoints = self._shortest_clear_route(start, destination, opponent)
        return FlightPlan(waypoints, self.duration, self.ship_size)

    @staticmethod
    def to_position(cell: Cell) -> tuple[float, float, float]:
        return (float(cell.x - 3), float(3 - cell.y), float(cell.z - 3))

    def _shortest_clear_route(self, start: Cell, destination: Cell, opponent: Cell) -> tuple[Cell, ...]:
        pending = deque([start])
        previous: dict[Cell, Cell | None] = {start: None}
        while pending:
            cell = pending.popleft()
            if cell == destination:
                break
            for neighbor in self._neighbors(cell):
                if neighbor == opponent or neighbor in previous:
                    continue
                if not self._segment_clear(cell, neighbor, opponent):
                    continue
                previous[neighbor] = cell
                pending.append(neighbor)

        if destination not in previous:
            raise ValueError("no collision-free in-cube flight route exists")
        route = []
        current: Cell | None = destination
        while current is not None:
            route.append(current)
            current = previous[current]
        return tuple(reversed(route))

    def _segment_clear(self, start: Cell, end: Cell, opponent: Cell) -> bool:
        a, b, obstacle = map(self.to_position, (start, end, opponent))
        delta = tuple(target - source for source, target in zip(a, b))
        length_squared = sum(value * value for value in delta)
        if length_squared == 0:
            return False
        parameter = sum((point - source) * step for point, source, step in zip(obstacle, a, delta)) / length_squared
        parameter = min(1.0, max(0.0, parameter))
        closest = tuple(source + parameter * step for source, step in zip(a, delta))
        distance_squared = sum((point - near) ** 2 for point, near in zip(obstacle, closest))
        # The ship's bounding sphere encloses its complete rendered cube. The two
        # spheres' radii sum to ship_size * sqrt(3), protecting full envelopes.
        clearance = self.ship_size * sqrt(3)
        return distance_squared >= clearance * clearance

    @staticmethod
    def _neighbors(cell: Cell) -> tuple[Cell, ...]:
        result = []
        for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            point = (cell.x + dx, cell.y + dy, cell.z + dz)
            if all(1 <= coordinate <= 5 for coordinate in point):
                result.append(Cell(*point))
        return tuple(result)
