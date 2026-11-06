from math import sqrt

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
    assert len(plan.waypoints) == 7
    assert all(
        sum(abs(a - b) for a, b in zip((left.x, left.y, left.z), (right.x, right.y, right.z))) == 1
        for left, right in zip(plan.waypoints, plan.waypoints[1:])
    )


def test_swept_ship_envelopes_stay_separate_and_inside_board_bounds():
    opponent = Cell(3, 3, 3)
    plan = FlightPlanner().plan(Cell(1, 3, 3), Cell(5, 3, 3), opponent)
    blocker = FlightPlanner.to_position(opponent)
    safe_center_distance = plan.ship_size * sqrt(3)

    for start, end in zip(plan.waypoints, plan.waypoints[1:]):
        a, b = FlightPlanner.to_position(start), FlightPlanner.to_position(end)
        assert point_segment_distance(blocker, a, b) >= safe_center_distance
        assert all(-2.5 + plan.ship_size / 2 <= coordinate <= 2.5 - plan.ship_size / 2 for coordinate in a)
        assert all(-2.5 + plan.ship_size / 2 <= coordinate <= 2.5 - plan.ship_size / 2 for coordinate in b)


def test_flight_duration_is_bounded_and_independent_of_cell_distance():
    planner = FlightPlanner(duration=0.8)
    short = planner.plan(Cell(1, 1, 1), Cell(2, 1, 1), Cell(5, 5, 5))
    long = planner.plan(Cell(1, 1, 1), Cell(5, 1, 1), Cell(5, 5, 5))
    assert short.duration == long.duration == 0.8
    assert short.duration <= 1.5
