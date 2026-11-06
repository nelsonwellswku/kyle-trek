import itertools
from dataclasses import replace

from kyle_trek.battle.state import Battle, Ship, Stats
from kyle_trek.battle.types import Cell, Orientation, Phase, Player
from kyle_trek.movement.reachability import MovementReachability


def make_battle(start: Cell, opponent: Cell, agility: int = 14) -> Battle:
    first = Ship(Player.ONE, start, Orientation.POSITIVE_Y, Stats(agility, 10, 10), 10, 10)
    second = Ship(Player.TWO, opponent, Orientation.NEGATIVE_Y, Stats(14, 10, 10), 10, 10)
    return Battle(1, (first, second))


def reference_destinations(start: Cell, opponent: Cell, allowance: int) -> frozenset[Cell]:
    distances = {start: 0}
    pending = [start]
    while pending:
        cell = pending.pop(0)
        distance = distances[cell]
        if distance == allowance:
            continue
        for x, y, z in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            point = (cell.x + x, cell.y + y, cell.z + z)
            if any(not 1 <= coordinate <= 5 for coordinate in point):
                continue
            neighbor = Cell(*point)
            if neighbor != opponent and neighbor not in distances:
                distances[neighbor] = distance + 1
                pending.append(neighbor)
    return frozenset(cell for cell, distance in distances.items() if 0 < distance <= allowance)


def test_movement_respects_cube_boundaries_allowance_and_opponent_obstruction():
    reachable = MovementReachability()
    battle = make_battle(Cell(1, 1, 1), Cell(2, 1, 1), agility=14)

    assert reachable.destinations(battle, allowance=1) == frozenset(
        {Cell(1, 2, 1), Cell(1, 1, 2)}
    )
    assert reachable.destinations(battle, allowance=0) == frozenset()
    assert reachable.destinations(battle, allowance=-1) == frozenset()
    assert reachable.explanation(battle, allowance=0)
    assert reachable.explanation(battle, allowance=2) == ""


def test_destination_behind_opponent_is_legal_via_an_alternate_route():
    battle = make_battle(Cell(1, 1, 1), Cell(2, 1, 1))
    destinations = MovementReachability().destinations(battle, allowance=4)

    assert Cell(3, 1, 1) in destinations
    assert Cell(2, 1, 1) not in destinations


def test_allowance_defaults_to_active_ship_agility_modifier_and_updates_with_battle():
    battle = make_battle(Cell(3, 3, 3), Cell(5, 5, 5), agility=8)
    reachability = MovementReachability()
    assert reachability.destinations(battle) == frozenset()

    battle._ships = (
        replace(battle.ships[0], stats=Stats(14, 10, 10)),
        replace(battle.ships[1], stats=Stats(8, 10, 10)),
    )
    assert len(reachability.destinations(battle)) == 24

    battle.active_player = Player.TWO
    battle.phase = Phase.ATTACK_CHOICE
    assert reachability.destinations(battle) == frozenset()


def test_reachability_matches_reference_bfs_exhaustively_for_all_starts_and_allowances():
    reachability = MovementReachability()
    cells = tuple(Cell(x, y, z) for x, y, z in itertools.product(range(1, 6), repeat=3))
    for start in cells:
        opponent = Cell(1, 1, 1) if start == Cell(5, 5, 5) else Cell(5, 5, 5)
        battle = make_battle(start, opponent)
        for allowance in range(6):
            assert reachability.destinations(battle, allowance=allowance) == reference_destinations(
                start, opponent, allowance
            )


def test_eligibility_is_not_cached_across_ship_position_changes():
    battle = make_battle(Cell(1, 1, 1), Cell(5, 5, 5))
    reachability = MovementReachability()
    before = reachability.destinations(battle, allowance=1)
    active = next(ship for ship in battle.ships if ship.player is battle.active_player)
    destination = Cell(1, 2, 1)
    battle.move_ship(active.player, destination)
    after = reachability.destinations(battle, allowance=1)

    assert after != before
    assert Cell(1, 1, 1) in after
    assert destination not in after
