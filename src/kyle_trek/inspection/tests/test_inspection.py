import copy
import random
import pytest
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.state import Battle, Ship, Stats
from kyle_trek.battle.types import Cell, Orientation, Player
from kyle_trek.inspection.inspection import Inspection


def test_all_cells_and_layers():
    view = Inspection(BattleSetup(random.Random(1)).create())
    assert len(set(view.cells)) == 125
    for layer in range(1,6):
        view.select_layer(layer)
        assert view.layer == layer
        assert len([cell for cell in view.cells if cell.z == layer]) == 25
    for invalid in (0,6,True,1.5):
        with pytest.raises(ValueError):
            view.select_layer(invalid)


def test_hover_identifies_both_ships_and_empty_cells_before_selection():
    battle = BattleSetup(random.Random(2)).create()
    view = Inspection(battle)
    for ship in battle.ships:
        view.select_layer(ship.cell.z)
        text = view.hover(ship.cell)
        assert str(ship.cell.x) in text and str(ship.cell.y) in text and str(ship.cell.z) in text
        assert str(ship.player.value) in text
        assert view.hovered == ship.cell
    empty = next(c for c in view.cells if c not in battle.occupancy)
    assert "empty" in view.hover(empty).lower()


def test_orbit_does_not_mutate_battle():
    battle = BattleSetup(random.Random(3)).create()
    original = copy.deepcopy(battle)
    view = Inspection(battle)
    view.orbit(22, -5)
    assert (view.yaw, view.pitch) != (45.0,30.0)
    assert battle == original


@pytest.mark.parametrize("depth", range(1, 6))
def test_both_ships_are_identifiable_at_every_depth(depth):
    stats = Stats(10, 10, 10)
    ships = (Ship(Player.ONE, Cell(1, 1, depth), Orientation.POSITIVE_Y, stats, 1, 1),
             Ship(Player.TWO, Cell(5, 5, depth), Orientation.NEGATIVE_Y, stats, 1, 1))
    view = Inspection(Battle(depth, ships))
    view.select_layer(depth)
    for ship in ships:
        assert f"Player {ship.player.value}" in view.hover(ship.cell)
