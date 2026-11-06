import random
from dataclasses import replace

from kyle_trek.battle.contracts import Lifecycle
from kyle_trek.battle.session import BattleSession
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.state import Stats
from kyle_trek.battle.types import Cell, Phase, Player
from kyle_trek.__main__ import InitialView


class FakeClock:
    def __init__(self):
        self.now = 10.0

    def monotonic(self):
        return self.now


class FakeScheduler:
    def __init__(self, clock):
        self.clock = clock
        self.events = []

    def call_later(self, delay, callback):
        event = [self.clock.now + delay, callback, False]
        self.events.append(event)
        return event

    def cancel(self, handle):
        handle[2] = True

    def fire(self, handle):
        if not handle[2]:
            self.clock.now = handle[0]
            handle[1]()


class ScriptedRandom:
    def __init__(self, values):
        self.values = list(values)
        self.calls = []

    def randint(self, lower, upper):
        self.calls.append((lower, upper))
        value = self.values.pop(0)
        assert lower <= value <= upper
        return value


class FakePresenter:
    def __init__(self):
        self.flight_callback = None
        self.flight_token = None
        self.attack_callback = None
        self.attack_token = None
        self.cleaned_flights = []
        self.cleaned_attacks = []
        self.placements = []
        self.on_cleanup = None

    def start_flight(self, player, plan, token, callback):
        self.flight_token, self.flight_callback = token, callback

    def cleanup_flight(self, token):
        self.cleaned_flights.append(token)
        if self.on_cleanup is not None:
            self.on_cleanup()

    def place_ship(self, player, cell):
        self.placements.append((player, cell))

    def start_attack(self, attacker, defender, outcome, token, callback):
        self.attack_token, self.attack_callback = token, callback

    def cleanup_attack(self, token):
        self.cleaned_attacks.append(token)
        if self.on_cleanup is not None:
            self.on_cleanup()

    def validate_projection(self, token):
        return True


class SessionScene:
    def __init__(self):
        self.hud = ""
        self.prompt = ""
        self.new_game_callback = None
        self.errors = []
        self.resets = 0

    def show_axes(self, axes): pass
    def show_cells(self, cells, legal_destinations=frozenset()): pass
    def show_ships(self, ships): pass
    def set_camera(self, yaw, pitch): pass
    def show_layer(self, layer, cells, legal_destinations=frozenset()): pass
    def show_inspection(self, text): pass

    def show_hud(self, text):
        self.hud = text

    def show_action_prompt(self, text, skip_callback=None, end_turn_callback=None):
        self.prompt = text

    def show_error(self, message):
        self.errors.append(message)

    def show_new_game(self, callback):
        self.new_game_callback = callback

    def reset_game_state(self):
        self.resets += 1


def make_session():
    clock = FakeClock()
    scheduler = FakeScheduler(clock)
    presenter = FakePresenter()
    combat_rng = ScriptedRandom((20, 4, 20, 4))
    session = BattleSession(
        BattleSetup(random.Random(31)), presenter, presenter, combat_rng, clock, scheduler
    )
    session.new_game()
    errors, changes = [], []
    session.bind_view(
        on_game_changed=lambda battle, movement, combat: None,
        on_change=lambda: changes.append(session.battle.phase),
        on_error=errors.append,
    )
    return session, presenter, combat_rng, scheduler, errors, changes


def prepare_movable(session):
    battle = session.battle
    first, second = battle.ships
    battle._ships = (
        replace(first, cell=Cell(3, 3, 3), stats=Stats(12, 10, 10)),
        replace(second, cell=Cell(5, 5, 5)),
    )
    return Cell(4, 3, 3)


def prepare_attackable(session):
    battle = session.battle
    first, second = battle.ships
    battle._ships = (
        replace(first, cell=Cell(1, 3, 3), stats=Stats(10, 14, 10)),
        replace(second, cell=Cell(5, 3, 3), hp=8, starting_hp=max(8, second.starting_hp)),
    )
    battle.phase = Phase.ATTACK_CHOICE
    return Cell(5, 3, 3)


def test_restart_during_flight_invalidates_generation_before_cleanup_and_stale_callbacks():
    session, presenter, _, _, errors, changes = make_session()
    target = prepare_movable(session)
    old_battle = session.battle
    old_controller = session.movement_controller
    assert old_controller.select_cell(target)
    old_generation = old_battle.generation
    stale_callback, stale_token = presenter.flight_callback, presenter.flight_token

    def deliver_completion_during_cleanup():
        assert old_battle.generation != old_generation
        stale_callback(stale_token, Lifecycle.FAILED)

    presenter.on_cleanup = deliver_completion_during_cleanup
    fresh = session.new_game()
    presenter.on_cleanup = None
    stale_callback(stale_token, Lifecycle.COMPLETED)
    stale_callback(stale_token, Lifecycle.FAILED)
    session.movement_controller._timed_out(stale_token)

    assert fresh is session.battle and fresh.phase is Phase.MOVEMENT
    assert fresh.active_player is Player.ONE and fresh.last_outcome is None
    assert not presenter.placements and not errors
    assert changes == [Phase.MOVING]
    assert presenter.cleaned_flights == [stale_token]


def test_restart_during_attack_discards_prerolled_outcome_and_all_late_callbacks():
    session, presenter, rng, scheduler, errors, changes = make_session()
    target = prepare_attackable(session)
    old_battle = session.battle
    old_hp = tuple(ship.hp for ship in old_battle.ships)
    old_controller = session.combat_controller
    assert old_controller.attack(target)
    assert rng.calls == [(1, 20), (1, 8)]
    stale_callback, stale_token = presenter.attack_callback, presenter.attack_token

    def deliver_failure_during_cleanup():
        stale_callback(stale_token, Lifecycle.FAILED)

    presenter.on_cleanup = deliver_failure_during_cleanup
    fresh = session.new_game()
    presenter.on_cleanup = None
    stale_callback(stale_token, Lifecycle.COMPLETED)
    stale_callback(stale_token, Lifecycle.FAILED)
    old_controller._timed_out(stale_token)
    scheduler.fire(scheduler.events[-1])

    assert fresh is session.battle and fresh.phase is Phase.MOVEMENT
    assert fresh.active_player is Player.ONE and fresh.last_outcome is None
    assert tuple(ship.hp for ship in old_battle.ships) == old_hp
    assert not errors and changes == [Phase.ATTACKING]
    assert presenter.cleaned_attacks == [stale_token]
    assert rng.calls == [(1, 20), (1, 8)]


def test_disposal_cancels_pending_movement_without_recovery_or_phase_transition():
    session, presenter, _, scheduler, errors, changes = make_session()
    target = prepare_movable(session)
    battle = session.battle
    assert session.movement_controller.select_cell(target)
    callback, token = presenter.flight_callback, presenter.flight_token

    session.dispose()
    callback(token, Lifecycle.FAILED)
    callback(token, Lifecycle.COMPLETED)
    scheduler.fire(scheduler.events[-1])

    assert battle.phase is Phase.MOVING and battle.active_player is Player.ONE
    assert not presenter.placements and not errors
    assert changes == [Phase.MOVING]


def test_disposal_cancels_pending_attack_without_applying_outcome():
    session, presenter, rng, scheduler, errors, changes = make_session()
    target = prepare_attackable(session)
    battle = session.battle
    old_hp = tuple(ship.hp for ship in battle.ships)
    assert session.combat_controller.attack(target)
    callback, token = presenter.attack_callback, presenter.attack_token

    session.dispose()
    callback(token, Lifecycle.FAILED)
    callback(token, Lifecycle.COMPLETED)
    scheduler.fire(scheduler.events[-1])

    assert battle.phase is Phase.ATTACKING and battle.active_player is Player.ONE
    assert tuple(ship.hp for ship in battle.ships) == old_hp
    assert rng.calls == [(1, 20), (1, 8)]
    assert not errors and changes == [Phase.ATTACKING]


def test_explicit_presentation_cancellation_discards_move_and_attack_without_error():
    session, presenter, rng, _, errors, changes = make_session()
    target = prepare_movable(session)
    battle = session.battle
    session.movement_controller.select_cell(target)
    presenter.flight_callback(presenter.flight_token, Lifecycle.CANCELLED)
    assert battle.phase is Phase.MOVING
    assert not presenter.placements

    # A fresh session isolates the combat cancellation path from the pending move.
    session2, presenter2, rng2, _, errors2, changes2 = make_session()
    target2 = prepare_attackable(session2)
    battle2 = session2.battle
    old_hp = tuple(ship.hp for ship in battle2.ships)
    session2.combat_controller.attack(target2)
    presenter2.attack_callback(presenter2.attack_token, Lifecycle.CANCELLED)

    assert battle2.phase is Phase.ATTACKING
    assert tuple(ship.hp for ship in battle2.ships) == old_hp
    assert len(rng.calls) == 0 and rng2.calls == [(1, 20), (1, 8)]
    assert not errors and not errors2
    assert changes == [Phase.MOVING] and changes2 == [Phase.ATTACKING]


def test_new_game_control_is_available_after_victory_and_rebuilds_the_view():
    session, _, _, _, _, _ = make_session()
    scene = SessionScene()
    view = InitialView(session.battle, scene)
    view.bind_session(session)
    old_battle = session.battle
    old_battle.phase = Phase.FINISHED
    old_battle.winner = Player.TWO
    view.selected = Cell(2, 2, 2)
    view.refresh_gameplay()

    assert callable(scene.new_game_callback)
    scene.new_game_callback()

    assert session.battle is view.battle and view.battle is not old_battle
    assert view.battle.phase is Phase.MOVEMENT and view.battle.active_player is Player.ONE
    assert view.battle.winner is None and view.battle.last_outcome is None
    assert view.selected is None
    assert scene.resets == 1
    assert "Player 1" in scene.hud and "movement" in scene.hud.lower()


def test_new_game_control_cancels_pending_flight_and_attack_presentations():
    session, presenter, _, _, errors, _ = make_session()
    scene = SessionScene()
    view = InitialView(session.battle, scene)
    view.bind_session(session)
    target = prepare_movable(session)
    view.select_layer(3)
    view.select(target)
    old_flight = session.battle
    assert old_flight.phase is Phase.MOVING
    scene.new_game_callback()
    assert session.battle is not old_flight and session.battle.phase is Phase.MOVEMENT
    assert presenter.cleaned_flights

    session.battle.phase = Phase.ATTACK_CHOICE
    defender = next(ship for ship in session.battle.ships if ship.player is Player.TWO)
    old_attack = session.battle
    old_hp = tuple(ship.hp for ship in old_attack.ships)
    assert session.combat_controller.attack(defender.cell)
    assert old_attack.phase is Phase.ATTACKING
    scene.new_game_callback()

    assert session.battle is not old_attack and session.battle.phase is Phase.MOVEMENT
    assert tuple(ship.hp for ship in old_attack.ships) == old_hp
    assert presenter.cleaned_attacks and callable(scene.new_game_callback)
    assert not errors
