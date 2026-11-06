from dataclasses import replace
from dataclasses import FrozenInstanceError
import random

import pytest

from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.types import Cell, Player
from kyle_trek.combat.rules import CombatRules


class ScriptedRandom:
    def __init__(self, rolls):
        self.rolls = list(rolls)
        self.calls = []

    def randint(self, lower, upper):
        self.calls.append((lower, upper))
        value = self.rolls.pop(0)
        assert lower <= value <= upper
        return value


def battle_with_stats(*, strength=10, defender_hp=8):
    battle = BattleSetup(random.Random(1)).create()
    first, second = battle.ships
    battle._ships = (
        replace(first, cell=Cell(1, 1, 1), stats=replace(first.stats, strength=strength)),
        replace(second, cell=Cell(5, 5, 5), hp=defender_hp, starting_hp=max(defender_hp, second.starting_hp)),
    )
    return battle


def test_attack_total_equal_to_ac_hits_and_rolls_d8_after_d20():
    rng = ScriptedRandom([10, 4])
    battle = battle_with_stats(strength=14)

    outcome = CombatRules(rng).resolve(battle, Player.ONE)

    assert outcome.attacker is Player.ONE and outcome.defender is Player.TWO
    assert (outcome.d20, outcome.total, outcome.hit) == (10, 12, True)
    assert (outcome.d8, outcome.damage, outcome.remaining_hp) == (4, 6, 2)
    assert rng.calls == [(1, 20), (1, 8)]
    assert next(ship for ship in battle.ships if ship.player is Player.TWO).hp == 8


def test_miss_uses_only_d20_and_does_not_calculate_damage():
    rng = ScriptedRandom([12])
    battle = battle_with_stats(strength=8)

    outcome = CombatRules(rng).resolve(battle, Player.ONE)

    assert (outcome.d20, outcome.total, outcome.hit) == (12, 11, False)
    assert outcome.d8 is outcome.damage is outcome.remaining_hp is None
    assert rng.calls == [(1, 20)]


def test_negative_damage_is_floored_at_zero_and_hp_never_goes_below_zero():
    zero_damage_rng = ScriptedRandom([13, 1])
    battle = battle_with_stats(strength=8, defender_hp=3)
    zero_damage = CombatRules(zero_damage_rng).resolve(battle, Player.ONE)
    assert zero_damage.hit and zero_damage.damage == 0 and zero_damage.remaining_hp == 3

    lethal_rng = ScriptedRandom([20, 8])
    battle = battle_with_stats(strength=20, defender_hp=2)
    lethal = CombatRules(lethal_rng).resolve(battle, Player.ONE)
    assert lethal.damage == 13 and lethal.remaining_hp == 0


def test_attack_outcome_is_immutable():
    outcome = CombatRules(ScriptedRandom([20, 1])).resolve(battle_with_stats(), Player.ONE)
    with pytest.raises(FrozenInstanceError):
        outcome.total = 0


@pytest.mark.parametrize("attacker", ["not a player", 1])
def test_rejects_invalid_attacker_values(attacker):
    with pytest.raises(ValueError):
        CombatRules(ScriptedRandom([20])).resolve(battle_with_stats(), attacker)
