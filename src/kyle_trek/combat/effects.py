from dataclasses import dataclass
from math import cos, hypot, isfinite, radians, sin, tan
from typing import Protocol

from kyle_trek.battle.contracts import RandomSource
from kyle_trek.battle.types import Cell


@dataclass(frozen=True)
class ScreenPoint:
    x: float
    y: float

    def __post_init__(self):
        if not isfinite(self.x) or not isfinite(self.y):
            raise ValueError("screen coordinates must be finite")


@dataclass(frozen=True)
class ScreenBounds:
    left: float
    right: float
    bottom: float
    top: float

    def __post_init__(self):
        if not all(isfinite(value) for value in (self.left, self.right, self.bottom, self.top)):
            raise ValueError("screen bounds must be finite")
        if self.left >= self.right or self.bottom >= self.top:
            raise ValueError("screen bounds must have positive area")

    def contains_circle(self, point: ScreenPoint, radius: float) -> bool:
        return (
            point.x - radius >= self.left
            and point.x + radius <= self.right
            and point.y - radius >= self.bottom
            and point.y + radius <= self.top
        )

    def fully_outside(self, point: ScreenPoint, radius: float) -> bool:
        return (
            point.x + radius < self.left
            or point.x - radius > self.right
            or point.y + radius < self.bottom
            or point.y - radius > self.top
        )


class ScreenProjection(Protocol):
    def project(self, cell: Cell) -> ScreenPoint: ...


@dataclass(frozen=True)
class HitEffect:
    start: ScreenPoint
    contact: ScreenPoint
    star_vertices: tuple[ScreenPoint, ...]
    star_radius: float
    cell_diameter: float
    blink_hz: float
    sequence: tuple[str, str] = ("torpedo", "explosion")


@dataclass(frozen=True)
class MissEffect:
    route: tuple[ScreenPoint, ...]
    closest_approach: tuple[ScreenPoint, ...]
    launch_angle_degrees: int
    side: int
    star_radius: float
    defender_radius: float
    defender_clearance: float
    cell_diameter: float


class PresentationGeometryError(ValueError):
    """The effect cannot satisfy its on-screen constraints in the current view."""


class CombatEffectPlanner:
    def __init__(
        self,
        rng: RandomSource,
        projection: ScreenProjection,
        bounds: ScreenBounds | None = None,
        cell_diameter: float = 0.2,
    ):
        if not isfinite(cell_diameter) or cell_diameter <= 0:
            raise ValueError("cell diameter must be positive and finite")
        self.rng = rng
        self.projection = projection
        self.bounds = bounds or ScreenBounds(-1, 1, -1, 1)
        self.cell_diameter = cell_diameter
        self.star_radius = 0.2 * cell_diameter
        self.defender_radius = 0.5 * cell_diameter

    def plan_hit(self, attacker: Cell, defender: Cell) -> HitEffect:
        start, contact = self._project_pair(attacker, defender, self.projection)
        if not self.bounds.contains_circle(start, self.star_radius) or not self.bounds.contains_circle(contact, self.star_radius):
            raise PresentationGeometryError("hit effect does not fit in the current view")
        return HitEffect(
            start,
            contact,
            self.star_vertices(),
            self.star_radius,
            self.cell_diameter,
            blink_hz=6.0,
        )

    def plan_miss(self, attacker: Cell, defender: Cell) -> MissEffect:
        angle = self.rng.randint(10, 35)
        side = 1 if self.rng.randint(0, 1) else -1
        return self._build_miss(attacker, defender, self.projection, angle, side)

    def reproject_miss(
        self,
        effect: MissEffect,
        attacker: Cell,
        defender: Cell,
        projection: ScreenProjection,
    ) -> MissEffect:
        if not isinstance(effect, MissEffect):
            raise ValueError("reprojection requires a miss effect")
        return self._build_miss(attacker, defender, projection, effect.launch_angle_degrees, effect.side)

    def _build_miss(
        self,
        attacker: Cell,
        defender: Cell,
        projection: ScreenProjection,
        angle: int,
        side: int,
    ) -> MissEffect:
        start, target = self._project_pair(attacker, defender, projection)
        dx, dy = target.x - start.x, target.y - start.y
        distance = hypot(dx, dy)
        if distance <= 2 * (self.star_radius + self.defender_radius):
            raise PresentationGeometryError("ships are too close for a screen-space miss")
        along = dx / distance, dy / distance
        normal = -along[1] * side, along[0] * side
        angle_radians = radians(angle)
        direction = (
            along[0] * cos(angle_radians) + normal[0] * sin(angle_radians),
            along[1] * cos(angle_radians) + normal[1] * sin(angle_radians),
        )
        clearance = self.star_radius + self.defender_radius
        launch_distance = min(distance * 0.45, max(distance * 0.3, clearance * 0.75))
        launch_length = launch_distance / cos(angle_radians)
        launch = ScreenPoint(start.x + direction[0] * launch_length, start.y + direction[1] * launch_length)
        approach = ScreenPoint(
            target.x - along[0] * clearance + normal[0] * clearance,
            target.y - along[1] * clearance + normal[1] * clearance,
        )
        near = ScreenPoint(target.x + normal[0] * clearance, target.y + normal[1] * clearance)
        exit_point = self._ray_exit(near, along, self.bounds, self.star_radius)
        route = (start, launch, approach, near, exit_point)

        if not all(self.bounds.contains_circle(point, self.star_radius) for point in route[:-1]):
            raise PresentationGeometryError("miss effect leaves the view before clearing the defender")
        if not self.bounds.fully_outside(exit_point, self.star_radius):
            raise PresentationGeometryError("miss effect cannot exit the current view")
        for first, second in zip(route, route[1:]):
            if self._distance_to_segment(target, first, second) + 1e-9 < clearance:
                raise PresentationGeometryError("miss trajectory intersects the defender envelope")
        max_deviation = tan(radians(35))
        for point in route[1:-1]:
            point_dx, point_dy = point.x - start.x, point.y - start.y
            forward = point_dx * along[0] + point_dy * along[1]
            lateral = abs(point_dx * normal[0] + point_dy * normal[1])
            if forward <= 0 or lateral > forward * max_deviation + 1e-9:
                raise PresentationGeometryError("miss trajectory exceeds the 35-degree deviation limit")
        return MissEffect(
            route,
            (near,),
            angle,
            side,
            self.star_radius,
            self.defender_radius,
            clearance,
            self.cell_diameter,
        )

    @staticmethod
    def _project_pair(attacker: Cell, defender: Cell, projection: ScreenProjection) -> tuple[ScreenPoint, ScreenPoint]:
        if not isinstance(attacker, Cell) or not isinstance(defender, Cell) or attacker == defender:
            raise ValueError("effect endpoints must be distinct cells")
        start, target = projection.project(attacker), projection.project(defender)
        if not isinstance(start, ScreenPoint) or not isinstance(target, ScreenPoint):
            raise ValueError("projection must return screen points")
        return start, target

    @staticmethod
    def star_vertices() -> tuple[ScreenPoint, ...]:
        from math import pi

        return tuple(
            ScreenPoint(
                cos(-pi / 2 + index * pi / 5) * (1.0 if index % 2 == 0 else 0.42),
                sin(-pi / 2 + index * pi / 5) * (1.0 if index % 2 == 0 else 0.42),
            )
            for index in range(10)
        )

    @staticmethod
    def _distance_to_segment(point, start, end):
        dx, dy = end.x - start.x, end.y - start.y
        length_squared = dx * dx + dy * dy
        if length_squared == 0:
            return hypot(point.x - start.x, point.y - start.y)
        t = max(0.0, min(1.0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length_squared))
        return hypot(point.x - start.x - t * dx, point.y - start.y - t * dy)

    @staticmethod
    def _ray_exit(start, direction, bounds, radius):
        distances = []
        if direction[0] > 1e-9:
            distances.append((bounds.right + radius - start.x) / direction[0])
        elif direction[0] < -1e-9:
            distances.append((bounds.left - radius - start.x) / direction[0])
        if direction[1] > 1e-9:
            distances.append((bounds.top + radius - start.y) / direction[1])
        elif direction[1] < -1e-9:
            distances.append((bounds.bottom - radius - start.y) / direction[1])
        positive = [distance for distance in distances if distance >= 0]
        if not positive:
            raise PresentationGeometryError("miss trajectory has no visible exit direction")
        distance = min(positive) + radius
        return ScreenPoint(start.x + direction[0] * distance, start.y + direction[1] * distance)
