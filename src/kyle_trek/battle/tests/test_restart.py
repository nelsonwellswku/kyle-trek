import random
from dataclasses import replace

from kyle_trek.battle.contracts import Lifecycle
from kyle_trek.battle.session import BattleSession
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.state import Stats
from kyle_trek.battle.types import Cell, Orientation, Phase, Player


class FakeClock:
    def monotonic(self):
        return 10.0


class FakeScheduler:
    def call_later(self, delay, callback):
        return [callback, False]

    def cancel(self, handle):
        handle[1] = True


class FakePresenter:
    def __init__(self):
        self.flight_callback = None
        self.flight_token = None
        self.cleaned_flights = []
        self.placements = []

    def start_flight(self, player, plan, token, callback):
        self.flight_token, self.flight_callback = token, callback

    def cleanup_flight(self, token):
        self.cleaned_flights.append(token)

    def place_ship(self, player, cell):
        self.placements.append((player, cell))

    def start_attack(self, attacker, defender, outcome, token, callback):
        raise AssertionError("restart-state test does not present combat")

    def cleanup_attack(self, token):
        pass

    def validate_projection(self, token):
        return True


class CountingRandom:
    def __init__(self):
        self.calls = []

    def randint(self, lower, upper):
        self.calls.append((lower, upper))
        return lower + ((len(self.calls) - 1) % (upper - lower + 1))


def make_session():
    setup_rng = CountingRandom()
    presenter = FakePresenter()
    session = BattleSession(
        BattleSetup(setup_rng), presenter, presenter, random.Random(3), FakeClock(), FakeScheduler()
    )
    return session, setup_rng, presenter


def test_new_game_samples_fresh_default_state_and_view_binding_does_not_reroll():
    session, setup_rng, _ = make_session()
    changes = []
    errors = []
    installations = []
    session.bind_view(
        on_game_changed=lambda battle, movement, combat: installations.append((battle, movement, combat)),
        on_change=lambda: changes.append(session.battle.phase),
        on_error=errors.append,
    )
    original = session.new_game()
    assert len(setup_rng.calls) == 14
    original_setup = tuple((ship.cell, ship.stats, ship.hp) for ship in original.ships)

    # Rebinding the view is a presentation operation, not a request for new rolls.
    session.bind_view(
        on_game_changed=lambda battle, movement, combat: installations.append((battle, movement, combat)),
        on_change=lambda: changes.append(session.battle.phase),
        on_error=errors.append,
    )
    assert len(setup_rng.calls) == 14

    original.last_outcome = "stale outcome"
    original.winner = Player.TWO
    original.phase = Phase.FINISHED
    original_generation = original.generation
    fresh = session.new_game()

    assert fresh is not original and fresh.generation != original_generation
    assert fresh.active_player is Player.ONE and fresh.phase is Phase.MOVEMENT
    assert fresh.winner is None and fresh.last_outcome is None
    assert [ship.orientation for ship in fresh.ships] == [Orientation.POSITIVE_Y, Orientation.NEGATIVE_Y]
    assert tuple((ship.cell, ship.stats, ship.hp) for ship in fresh.ships) != original_setup
    assert len(setup_rng.calls) == 28
    assert installations[-1][0] is fresh
    assert installations[-1][1] is session.movement_controller
    assert installations[-1][2] is session.combat_controller
    assert not errors and not changes


def test_restarting_a_game_replaces_legal_highlights_and_action_controllers():
    session, _, presenter = make_session()
    battle = session.new_game()
    active, opponent = battle.ships
    battle._ships = (
        replace(active, cell=Cell(3, 3, 3), stats=Stats(12, 10, 10)),
        replace(opponent, cell=Cell(5, 5, 5)),
    )
    old_controller = session.movement_controller
    assert old_controller.legal_destinations
    target = next(iter(old_controller.legal_destinations))
    assert old_controller.select_cell(target)
    old_callback, old_token = presenter.flight_callback, presenter.flight_token
    assert old_controller.legal_destinations == frozenset()

    fresh = session.new_game()
    old_callback(old_token, Lifecycle.COMPLETED)
    old_callback(old_token, Lifecycle.FAILED)

    assert session.movement_controller is not old_controller
    assert session.movement_controller.battle is fresh
    assert fresh.phase is Phase.MOVEMENT and fresh.active_player is Player.ONE
    assert fresh.last_outcome is None and fresh.winner is None
    assert not presenter.placements
