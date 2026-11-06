import random
from dataclasses import replace

from kyle_trek.battle.contracts import Lifecycle
from kyle_trek.battle.orientation import OrientationController
from kyle_trek.battle.session import BattleSession
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.state import Stats
from kyle_trek.battle.types import Cell, Orientation, Phase, Player, RotationAxis
from kyle_trek.__main__ import InitialView


class FakeClock:
    def monotonic(self):
        return 10.0


class FakeScheduler:
    def call_later(self, delay, callback):
        return [callback, False]

    def cancel(self, handle):
        handle[1] = True


class RotationPresenter:
    def __init__(self):
        self.rotations = []
        self.cleaned = []
        self.ship_orientations = []
        self.on_cleanup = None

    def start_rotation(self, player, target, token, callback):
        self.rotations.append([player, target, token, callback])

    def cleanup_rotation(self, token):
        self.cleaned.append(token)
        if self.on_cleanup:
            self.on_cleanup()

    def set_orientation(self, player, orientation):
        self.ship_orientations.append((player, orientation))

    def finish(self, lifecycle=Lifecycle.COMPLETED):
        _, _, token, callback = self.rotations[-1]
        callback(token, lifecycle)


class OtherPresenter:
    def start_flight(self, *args): pass
    def cleanup_flight(self, token): pass
    def place_ship(self, player, cell): pass
    def start_attack(self, *args): pass
    def cleanup_attack(self, token): pass
    def validate_projection(self, token): return True


class Scene:
    def __init__(self):
        self.hud = ""
        self.prompt = ""
        self.new_game_callback = None
        self.camera = None
        self.ships = ()
        self.resets = 0

    def show_axes(self, axes): pass
    def show_cells(self, cells, legal_destinations=frozenset()): pass
    def show_layer(self, layer, cells, legal_destinations=frozenset()): pass
    def show_inspection(self, text): pass
    def show_hud(self, text): self.hud = text
    def set_camera(self, yaw, pitch): self.camera = (yaw, pitch)
    def show_ships(self, ships): self.ships = ships
    def show_action_prompt(self, text, skip_callback=None, end_turn_callback=None): self.prompt = text
    def show_error(self, message): pass
    def show_new_game(self, callback): self.new_game_callback = callback
    def reset_game_state(self): self.resets += 1


def make_session():
    battle_rng = random.Random(17)
    battle = BattleSetup(battle_rng).create()
    first, second = battle.ships
    battle._ships = (
        replace(first, cell=Cell(3, 3, 3), stats=Stats(12, 10, 10)),
        replace(second, cell=Cell(5, 5, 5)),
    )
    presenter = RotationPresenter()
    session = BattleSession(
        BattleSetup(random.Random(18)), OtherPresenter(), OtherPresenter(), random.Random(19),
        FakeClock(), FakeScheduler(), orientation_presenter=presenter,
    )
    session.new_game()
    # Keep deterministic turn state for the view tests while retaining the session's controllers.
    session.battle._ships = battle._ships
    scene = Scene()
    view = InitialView(session.battle, scene)
    view.bind_session(session)
    return session, presenter, view, scene


def test_rotation_updates_ship_visual_without_rotating_camera_or_spending_turn():
    session, presenter, view, scene = make_session()
    before_orientation = session.battle.ships[0].orientation
    before_camera = scene.camera
    phase = session.battle.phase

    assert view.rotate_ship(RotationAxis.Z, 1)
    assert session.orientation_controller.busy
    presenter.finish()

    assert session.battle.ships[0].orientation != before_orientation
    assert presenter.ship_orientations[-1] == (Player.ONE, session.battle.ships[0].orientation)
    assert scene.camera == before_camera
    assert session.battle.phase is phase and session.battle.active_player is Player.ONE

    view.orbit(10, 0)
    assert scene.camera == (55.0, 30.0)
    assert session.battle.ships[0].orientation != before_orientation


def test_rotation_presentation_locks_other_actions_and_duplicate_rotation_input():
    session, presenter, view, _ = make_session()
    target = Cell(4, 3, 3)
    view.select_layer(3)
    old_phase = session.battle.phase

    assert view.rotate_ship(RotationAxis.X, 1)
    assert view.rotate_ship(RotationAxis.Y, 1) is False
    view.select(target)
    assert session.movement_controller.select_cell(target) is False
    assert session.battle.phase is old_phase
    assert not presenter.ship_orientations

    presenter.finish(Lifecycle.COMPLETED)
    assert not session.orientation_controller.busy
    assert session.movement_controller.select_cell(target)


def test_rotation_busy_lock_rejects_attack_and_end_turn_input():
    session, presenter, view, _ = make_session()
    session.battle.phase = Phase.ATTACK_CHOICE
    target = next(ship.cell for ship in session.battle.ships if ship.player is Player.TWO)

    assert view.rotate_ship(RotationAxis.Y, -1)
    assert session.combat_controller.attack(target) is False
    assert session.combat_controller.end_turn() is False
    presenter.finish()
    assert session.battle.phase is Phase.ATTACK_CHOICE
    assert session.battle.active_player is Player.ONE


def test_restart_and_disposal_during_rotation_ignore_old_callbacks():
    session, presenter, view, scene = make_session()
    old_battle = session.battle
    original_orientation = old_battle.ships[0].orientation
    assert view.rotate_ship(RotationAxis.Y, -1)
    stale = presenter.rotations[-1]
    token, callback = stale[2], stale[3]

    def finish_while_cleaning():
        callback(token, Lifecycle.COMPLETED)

    presenter.on_cleanup = finish_while_cleaning
    fresh = session.new_game()
    presenter.on_cleanup = None
    callback(token, Lifecycle.FAILED)
    assert old_battle.ships[0].orientation is original_orientation
    assert fresh.phase is Phase.MOVEMENT and fresh.ships[0].orientation is Orientation.POSITIVE_Y
    assert presenter.cleaned == [token] and scene.resets == 1

    assert view.rotate_ship(RotationAxis.Z, 1)
    stale_token, stale_callback = presenter.rotations[-1][2:]
    session.dispose()
    stale_callback(stale_token, Lifecycle.COMPLETED)
    assert fresh.ships[0].orientation is Orientation.POSITIVE_Y
    assert presenter.cleaned[-1] == stale_token
