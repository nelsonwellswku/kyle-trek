from math import acos, dist, pi, sqrt
import pytest

from kyle_trek.battle.types import Cell
from kyle_trek.movement.flight import FlightPlanner


def point_segment_distance(point, start, end):
    delta = tuple(b - a for a, b in zip(start, end))
    denominator = sum(value * value for value in delta)
    if denominator == 0:
        return sqrt(sum((a - b) ** 2 for a, b in zip(point, start)))
    parameter = sum((p - a) * d for p, a, d in zip(point, start, delta)) / denominator
    parameter = min(1.0, max(0.0, parameter))
    closest = tuple(a + parameter * d for a, d in zip(start, delta))
    return sqrt(sum((a - b) ** 2 for a, b in zip(point, closest)))


def test_clear_route_uses_a_direct_smooth_path():
    plan = FlightPlanner().plan(Cell(1, 1, 1), Cell(3, 1, 1), Cell(5, 5, 5))
    assert plan.waypoints == (Cell(1, 1, 1), Cell(3, 1, 1))


def test_obstructed_direct_route_uses_a_shortest_feasible_detour():
    start, destination, opponent = Cell(1, 3, 3), Cell(5, 3, 3), Cell(3, 3, 3)
    plan = FlightPlanner().plan(start, destination, opponent)

    assert plan.waypoints[0] == start and plan.waypoints[-1] == destination
    assert opponent not in plan.waypoints
    radius = plan.ship_size * sqrt(3)
    expected = 2 * sqrt(4 - radius ** 2) + radius * (pi - 2 * acos(radius / 2))
    assert plan.length == pytest.approx(expected)


def test_swept_ship_envelopes_stay_separate_and_inside_board_bounds():
    opponent = Cell(3, 3, 3)
    plan = FlightPlanner().plan(Cell(1, 3, 3), Cell(5, 3, 3), opponent)
    blocker = FlightPlanner.to_position(opponent)
    safe_center_distance = plan.ship_size * sqrt(3)

    for index in range(1001):
        point = plan.position_at(index / 1000)
        assert dist(point, blocker) >= safe_center_distance - 1e-9
        radius = safe_center_distance / 2
        assert all(-2.5 + radius <= coordinate <= 2.5 - radius for coordinate in point)


def test_flight_duration_is_bounded_and_independent_of_cell_distance():
    planner = FlightPlanner(duration=0.8)
    short = planner.plan(Cell(1, 1, 1), Cell(2, 1, 1), Cell(5, 5, 5))
    long = planner.plan(Cell(1, 1, 1), Cell(5, 1, 1), Cell(5, 5, 5))
    assert short.duration == long.duration == 0.8
    assert short.duration <= 1.5


def test_visual_detour_beats_shorter_diagonal_alternative_without_changing_grid_cost():
    planner = FlightPlanner()
    start, destination, opponent = Cell(1, 3, 3), Cell(3, 3, 3), Cell(2, 3, 3)
    plan = planner.plan(start, destination, opponent)
    radius = planner.ship_size * sqrt(3)
    theoretical = 2 * sqrt(1 - radius ** 2) + radius * (pi - 2 * acos(radius))

    assert plan.length == pytest.approx(theoretical)
    assert plan.length < 2 * sqrt(3)
    assert plan.position_at(0) == planner.to_position(start)
    assert plan.position_at(1) == planner.to_position(destination)


@pytest.mark.parametrize("start,end,opponent", [
    (Cell(1, 1, 1), Cell(3, 1, 1), Cell(2, 1, 1)),
    (Cell(5, 5, 3), Cell(5, 5, 5), Cell(5, 5, 4)),
    (Cell(1, 2, 1), Cell(3, 1, 1), Cell(2, 1, 1)),
    (Cell(1, 2, 3), Cell(5, 3, 3), Cell(3, 3, 3)),
])
def test_continuous_detours_are_collision_safe_and_in_bounds_at_edges(start, end, opponent):
    planner = FlightPlanner()
    plan = planner.plan(start, end, opponent)
    radius = planner.ship_size * sqrt(3) / 2
    obstacle = planner.to_position(opponent)
    for index in range(1001):
        position = plan.position_at(index / 1000)
        assert dist(position, obstacle) >= 2 * radius - 1e-9
        assert all(-2.5 + radius <= value <= 2.5 - radius for value in position)
