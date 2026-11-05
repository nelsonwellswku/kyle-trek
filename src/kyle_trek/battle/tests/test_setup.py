import random
from dataclasses import FrozenInstanceError
import pytest
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.state import Battle, Ship, Stats
from kyle_trek.battle.types import Cell, Orientation, Phase, Player


@pytest.mark.parametrize("score,modifier", [(8,-1),(9,-1),(10,0),(11,0),(12,1),(13,1),(14,2),(15,2),(16,3),(17,3),(18,4),(19,4),(20,5)])
def test_modifier_boundaries(score, modifier):
    assert Stats.modifier(score) == modifier


@pytest.mark.parametrize("score", [7,21,True,10.0])
def test_invalid_stats(score):
    with pytest.raises(ValueError):
        Stats(score, 10, 10)


class ScriptedRandom:
    def __init__(self, values):
        self.values = iter(values)
        self.calls = []

    def randint(self, low, high):
        self.calls.append((low, high))
        value = next(self.values)
        assert low <= value <= high
        return value


def test_setup_independent_draws_and_hp_floor_without_reroll():
    rng = ScriptedRandom([1,1,1,8,10,8,0, 5,5,5,20,12,20,20])
    battle = BattleSetup(rng).create()
    first, second = battle.ships
    assert first.cell == Cell(1,1,1) and second.cell == Cell(5,5,5)
    assert first.stats == Stats(8,10,8) and second.stats == Stats(20,12,20)
    assert first.hp == first.starting_hp == 1
    assert second.hp == second.starting_hp == 30
    assert first.orientation is Orientation.POSITIVE_Y
    assert second.orientation is Orientation.NEGATIVE_Y
    assert rng.calls == [(1,5),(1,2),(1,5),(8,20),(8,20),(8,20),(0,20), (1,5),(4,5),(1,5),(8,20),(8,20),(8,20),(0,20)]
    assert battle.active_player is Player.ONE and battle.phase is Phase.MOVEMENT


def test_seeded_setup_zones_distinct_and_unique_generations():
    setup = BattleSetup(random.Random(123))
    games = [setup.create() for _ in range(100)]
    assert len({game.generation for game in games}) == len(games)
    for game in games:
        a, b = game.ships
        assert a.cell.y in (1,2) and b.cell.y in (4,5)
        assert a.cell != b.cell and len(game.occupancy) == 2


def test_occupancy_is_derived_and_cannot_overlap():
    battle = BattleSetup(random.Random(4)).create()
    ship, other = battle.ships
    with pytest.raises(TypeError):
        battle.occupancy[ship.cell] = other.player
    with pytest.raises((FrozenInstanceError, AttributeError)):
        ship.cell = other.cell
    with pytest.raises(ValueError):
        battle.move_ship(ship.player, other.cell)
    target = next(Cell(x,y,z) for x in range(1,6) for y in range(1,6) for z in range(1,6) if Cell(x,y,z) not in battle.occupancy)
    battle.move_ship(ship.player, target)
    assert ship.cell not in battle.occupancy and battle.occupancy[target] is ship.player


def test_invalid_ship_and_overlapping_battle():
    stats = Stats(10,10,10)
    with pytest.raises(ValueError):
        Ship(Player.ONE, Cell(1,1,1), Orientation.POSITIVE_Y, stats, 2, 1)
    a = Ship(Player.ONE, Cell(1,1,1), Orientation.POSITIVE_Y, stats, 1, 1)
    b = Ship(Player.TWO, Cell(1,1,1), Orientation.NEGATIVE_Y, stats, 1, 1)
    with pytest.raises(ValueError):
        Battle(1, (a,b))
