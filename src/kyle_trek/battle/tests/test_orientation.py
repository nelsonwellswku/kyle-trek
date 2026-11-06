import random
from dataclasses import replace

import pytest

from kyle_trek.battle.contracts import Lifecycle
from kyle_trek.battle.orientation import OrientationController
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.state import Stats
from kyle_trek.battle.types import Cell, Orientation, Phase, Player, RotationAxis


class ImmediateRotationPresenter:
    def __init__(self):
        self.starts = []
        self.cleaned = []
        self.orientations = []

    def start_rotation(self, player, target, token, callback):
        self.starts.append((player, target, token))
        callback(token, Lifecycle.COMPLETED)

    def cleanup_rotation(self, token):
        self.cleaned.append(token)

    def set_orientation(self, player, orientation):
        self.orientations.append((player, orientation))


def make_battle():
    battle = BattleSetup(random.Random(3)).create()
    first, second = battle.ships
    battle._ships = (
        replace(first, cell=Cell(3, 3, 3), stats=Stats(12, 14, 16)),
        replace(second, cell=Cell(5, 5, 5)),
    )
    return battle


def test_six_quarter_turns_compose_and_each_axis_has_four_distinct_steps():
    for axis in RotationAxis:
        for direction in (-1, 1):
            orientation = Orientation.POSITIVE_Y
            steps = {orientation}
            for _ in range(3):
                orientation = orientation.rotated(axis, direction)
                steps.add(orientation)
            assert len(steps) == 4
            assert orientation.rotated(axis, direction) == Orientation.POSITIVE_Y
            assert Orientation.POSITIVE_Y.rotated(axis, direction).rotated(axis, -direction) == Orientation.POSITIVE_Y

    orientations = {Orientation.POSITIVE_Y}
    frontier = [Orientation.POSITIVE_Y]
    while frontier:
        current = frontier.pop()
        for axis in RotationAxis:
            for direction in (-1, 1):
                turned = current.rotated(axis, direction)
                if turned not in orientations:
                    orientations.add(turned)
                    frontier.append(turned)
    assert len(orientations) == 24
    assert len({orientation.euler_degrees for orientation in orientations}) == 24


def test_active_ship_rotates_in_both_idle_phases_without_changing_other_state():
    battle = make_battle()
    presenter = ImmediateRotationPresenter()
    errors, changes = [], []
    controller = OrientationController(battle, presenter, lambda: changes.append(battle.phase), errors.append)
    original = battle.ships

    for phase in (Phase.MOVEMENT, Phase.ATTACK_CHOICE):
        battle.phase = phase
        for axis in RotationAxis:
            for direction in (-1, 1):
                before = battle.ships
                assert controller.rotate(Player.ONE, axis, direction)
                after = battle.ships
                assert after[0].orientation != before[0].orientation
                assert after[1] == before[1]
                assert (after[0].cell, after[0].stats, after[0].hp, after[0].ac) == (
                    before[0].cell, before[0].stats, before[0].hp, before[0].ac
                )
                assert battle.phase is phase and battle.active_player is Player.ONE

    assert len(presenter.starts) == 12
    assert len(changes) == 24
    assert len(errors) == 0
    assert original[0].orientation is Orientation.POSITIVE_Y


@pytest.mark.parametrize("phase", [Phase.MOVING, Phase.ATTACKING, Phase.FINISHED])
def test_rotation_is_rejected_outside_idle_playable_phases(phase):
    battle = make_battle()
    battle.phase = phase
    presenter = ImmediateRotationPresenter()
    controller = OrientationController(battle, presenter)

    assert controller.rotate(Player.ONE, RotationAxis.X, 1) is False
    assert not presenter.starts


def test_rotation_rejects_non_active_owner_and_invalid_direction():
    battle = make_battle()
    presenter = ImmediateRotationPresenter()
    controller = OrientationController(battle, presenter)

    assert controller.rotate(Player.TWO, RotationAxis.X, 1) is False
    assert controller.rotate(Player.ONE, RotationAxis.X, 0) is False
    assert controller.rotate(Player.ONE, "x", 1) is False
    assert not presenter.starts
