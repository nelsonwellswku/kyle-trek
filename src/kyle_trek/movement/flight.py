from dataclasses import dataclass
from math import acos, atan2, cos, dist, isfinite, pi, sin, sqrt

from kyle_trek.battle.types import Cell


@dataclass(frozen=True)
class FlightArc:
    """The circular part of a tangent–arc–tangent route around full ship spheres."""

    center: tuple[float, float, float]
    first_axis: tuple[float, float, float]
    second_axis: tuple[float, float, float]
    radius: float
    start_angle: float
    end_angle: float

    @property
    def length(self) -> float:
        return self.radius * (self.end_angle - self.start_angle)

    def position_at(self, progress: float) -> tuple[float, float, float]:
        angle = self.start_angle + (self.end_angle - self.start_angle) * progress
        return tuple(
            center + self.radius * (a * cos(angle) + b * sin(angle))
            for center, a, b in zip(self.center, self.first_axis, self.second_axis)
        )

    def fits(self, envelope_radius: float) -> bool:
        """Check extrema analytically, including between rendered sample points."""
        for center, a, b in zip(self.center, self.first_axis, self.second_axis):
            extrema = [self.start_angle, self.end_angle]
            extrema.extend(
                angle for index in range(-1, 3)
                if self.start_angle <= (angle := atan2(b, a) + index * pi) <= self.end_angle
            )
            if any(
                abs(center + self.radius * (a * cos(angle) + b * sin(angle)))
                > 2.5 - envelope_radius + 1e-9
                for angle in extrema
            ):
                return False
        return True


@dataclass(frozen=True)
class FlightPlan:
    waypoints: tuple[Cell, ...]
    duration: float
    ship_size: float
    arc: FlightArc | None = None

    def __post_init__(self) -> None:
        if len(self.waypoints) < 2 or not all(isinstance(cell, Cell) for cell in self.waypoints):
            raise ValueError("a flight path requires at least two valid waypoints")
        if not isfinite(self.duration) or self.duration <= 0 or self.duration > 1.5:
            raise ValueError("flight duration must be positive and at most 1.5 seconds")
        if not isfinite(self.ship_size) or self.ship_size <= 0:
            raise ValueError("ship size must be positive and finite")

    @property
    def length(self) -> float:
        if self.arc is not None:
            return (
                dist(FlightPlanner.to_position(self.waypoints[0]), self.arc.position_at(0))
                + self.arc.length
                + dist(self.arc.position_at(1), FlightPlanner.to_position(self.waypoints[-1]))
            )
        return sum(dist(FlightPlanner.to_position(a), FlightPlanner.to_position(b)) for a, b in zip(self.waypoints, self.waypoints[1:]))

    def position_at(self, progress: float) -> tuple[float, float, float]:
        progress = min(1.0, max(0.0, progress))
        if progress == 0:
            return FlightPlanner.to_position(self.waypoints[0])
        if progress == 1:
            return FlightPlanner.to_position(self.waypoints[-1])
        distance = self.length * progress
        if self.arc is not None:
            start = FlightPlanner.to_position(self.waypoints[0])
            end = FlightPlanner.to_position(self.waypoints[-1])
            first_contact, second_contact = self.arc.position_at(0), self.arc.position_at(1)
            first_length = dist(start, first_contact)
            if distance < first_length:
                return self._interpolate(start, first_contact, distance / first_length)
            distance -= first_length
            if distance < self.arc.length:
                return self.arc.position_at(distance / self.arc.length)
            last_length = dist(second_contact, end)
            return self._interpolate(second_contact, end, (distance - self.arc.length) / last_length if last_length else 1.0)
        for first, second in zip(self.waypoints, self.waypoints[1:]):
            start, end = FlightPlanner.to_position(first), FlightPlanner.to_position(second)
            length = dist(start, end)
            if distance <= length:
                fraction = distance / length if length else 1.0
                return self._interpolate(start, end, fraction)
            distance -= length
        return FlightPlanner.to_position(self.waypoints[-1])

    @staticmethod
    def _interpolate(
        start: tuple[float, float, float], end: tuple[float, float, float], fraction: float,
    ) -> tuple[float, float, float]:
        return tuple(a + (b - a) * fraction for a, b in zip(start, end))


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
        arc = None if self._segment_clear(start, destination, opponent) else self._shortest_clear_arc(start, destination, opponent)
        return FlightPlan((start, destination), self.duration, self.ship_size, arc)

    @staticmethod
    def to_position(cell: Cell) -> tuple[float, float, float]:
        return (float(cell.x - 3), float(3 - cell.y), float(cell.z - 3))

    def _shortest_clear_arc(self, start: Cell, destination: Cell, opponent: Cell) -> FlightArc:
        # A single spherical forbidden envelope has an analytic shortest route:
        # two tangents joined by the minor great-circle arc in the endpoints' plane.
        # Collinear endpoints admit equally short planes; choose one inside the cube.
        center = self.to_position(opponent)
        first = tuple(a - b for a, b in zip(self.to_position(start), center))
        last = tuple(a - b for a, b in zip(self.to_position(destination), center))
        first_length, last_length = sqrt(self._dot(first, first)), sqrt(self._dot(last, last))
        first_axis = tuple(value / first_length for value in first)
        last_axis = tuple(value / last_length for value in last)
        cosine = max(-1.0, min(1.0, self._dot(first_axis, last_axis)))
        separation = acos(cosine)
        normal_component = tuple(b - cosine * a for a, b in zip(first_axis, last_axis))
        normal_length = sqrt(self._dot(normal_component, normal_component))
        if normal_length > 1e-9:
            candidates = (tuple(value / normal_length for value in normal_component),)
        else:
            candidates = tuple(
                self._perpendicular(first_axis, axis, sign)
                for axis in range(3) if abs(first_axis[axis]) < .9
                for sign in (1, -1)
            )
        radius = self.ship_size * sqrt(3)
        for second_axis in candidates:
            arc = FlightArc(
                center, first_axis, second_axis, radius,
                acos(min(1.0, radius / first_length)),
                separation - acos(min(1.0, radius / last_length)),
            )
            if arc.fits(radius / 2):
                return arc
        raise ValueError("no shortest collision-free arc fits inside the cube")

    @staticmethod
    def _dot(first: tuple[float, float, float], second: tuple[float, float, float]) -> float:
        return sum(a * b for a, b in zip(first, second))

    @staticmethod
    def _perpendicular(direction: tuple[float, float, float], axis: int, sign: int) -> tuple[float, float, float]:
        vector = tuple(sign * ((1 if index == axis else 0) - direction[axis] * value) for index, value in enumerate(direction))
        length = sqrt(sum(value * value for value in vector))
        return tuple(value / length for value in vector)

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
