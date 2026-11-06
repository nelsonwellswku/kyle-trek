from math import hypot

import pytest

from kyle_trek.battle.types import Cell
from kyle_trek.combat.effects import (
    CombatEffectPlanner,
    PresentationGeometryError,
    ScreenBounds,
    ScreenPoint,
)


class ScriptedRandom:
    def __init__(self, values):
        self.values = list(values)
        self.calls = []

    def randint(self, lower, upper):
        self.calls.append((lower, upper))
        value = self.values.pop(0)
        assert lower <= value <= upper
        return value


class Projection:
    def __init__(self, points):
        self.points = points

    def project(self, cell):
        return self.points[cell]


def distance_to_segment(point, start, end):
    dx, dy = end.x - start.x, end.y - start.y
    length_squared = dx * dx + dy * dy
    t = max(0.0, min(1.0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length_squared))
    return hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))


def test_hit_effect_is_a_blinking_five_point_star_with_contact_explosion():
    attacker, defender = Cell(1, 1, 1), Cell(5, 5, 5)
    projection = Projection({attacker: ScreenPoint(-0.4, 0), defender: ScreenPoint(0.4, 0)})
    planner = CombatEffectPlanner(ScriptedRandom([]), projection, cell_diameter=0.2)

    effect = planner.plan_hit(attacker, defender)

    assert effect.sequence == ("torpedo", "explosion")
    assert len(effect.star_vertices) == 10
    assert all((radius := hypot(point.x, point.y)) > 0 for point in effect.star_vertices)
    assert effect.star_radius >= 0.2 * effect.cell_diameter
    assert effect.blink_hz > 0
    assert effect.start == projection.project(attacker)
    assert effect.contact == projection.project(defender)


def test_miss_samples_angle_and_side_independently_and_clears_then_exits_viewport():
    attacker, defender = Cell(1, 3, 3), Cell(5, 3, 3)
    projection = Projection({attacker: ScreenPoint(-0.7, 0), defender: ScreenPoint(0.35, 0)})
    rng = ScriptedRandom([20, 1])
    bounds = ScreenBounds(-1, 1, -1, 1)
    planner = CombatEffectPlanner(rng, projection, bounds=bounds, cell_diameter=0.1)

    effect = planner.plan_miss(attacker, defender)

    assert effect.launch_angle_degrees == 20
    assert effect.side == 1
    assert rng.calls == [(10, 35), (0, 1)]
    assert effect.defender_clearance >= effect.star_radius + effect.defender_radius
    for start, end in zip(effect.route, effect.route[1:]):
        assert distance_to_segment(projection.project(defender), start, end) >= effect.defender_radius + effect.star_radius
    closest = min(effect.closest_approach, key=lambda p: hypot(p.x - 0.35, p.y))
    assert bounds.contains_circle(closest, effect.star_radius)
    assert bounds.fully_outside(effect.route[-1], effect.star_radius)


def test_camera_reprojection_preserves_sampled_miss_parameters_without_rerolling():
    attacker, defender = Cell(1, 2, 3), Cell(5, 4, 3)
    first = Projection({attacker: ScreenPoint(-0.7, -0.3), defender: ScreenPoint(0.3, 0.2)})
    rng = ScriptedRandom([25, 0])
    planner = CombatEffectPlanner(rng, first, bounds=ScreenBounds(-1, 1, -1, 1), cell_diameter=0.08)
    effect = planner.plan_miss(attacker, defender)
    moved_camera = Projection({attacker: ScreenPoint(-0.55, 0.25), defender: ScreenPoint(0.45, -0.15)})

    reprojected = planner.reproject_miss(effect, attacker, defender, moved_camera)

    assert reprojected.launch_angle_degrees == effect.launch_angle_degrees == 25
    assert reprojected.side == effect.side == -1
    assert rng.calls == [(10, 35), (0, 1)]
    assert reprojected.route != effect.route
    assert all(
        distance_to_segment(moved_camera.project(defender), start, end) >= reprojected.defender_clearance
        for start, end in zip(reprojected.route, reprojected.route[1:])
    )


def test_miss_effect_clears_the_defender_and_exits_when_ships_project_near_screen_edges():
    attacker, defender = Cell(1, 3, 3), Cell(5, 3, 3)
    for start, target, side in (
        (ScreenPoint(-0.78, 0), ScreenPoint(0.70, 0), 1),
        (ScreenPoint(-0.70, -0.70), ScreenPoint(0.70, 0.70), 0),
    ):
        rng = ScriptedRandom([20, side])
        projection = Projection({attacker: start, defender: target})
        planner = CombatEffectPlanner(rng, projection, ScreenBounds(-1, 1, -1, 1), cell_diameter=0.06)

        effect = planner.plan_miss(attacker, defender)

        assert all(
            distance_to_segment(target, first, second) >= effect.defender_clearance - 1e-9
            for first, second in zip(effect.route, effect.route[1:])
        )
        assert planner.bounds.fully_outside(effect.route[-1], effect.star_radius)


def test_depth_aligned_miss_reports_infeasible_projection_for_failure_recovery():
    attacker, defender = Cell(2, 2, 2), Cell(4, 4, 4)
    projection = Projection({attacker: ScreenPoint(0, 0), defender: ScreenPoint(0, 0)})
    planner = CombatEffectPlanner(ScriptedRandom([20, 1]), projection)

    with pytest.raises(PresentationGeometryError):
        planner.plan_miss(attacker, defender)
