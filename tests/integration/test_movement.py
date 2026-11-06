import random
from dataclasses import replace

from kyle_trek.battle.contracts import ActionToken, Lifecycle
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.state import Stats
from kyle_trek.battle.types import Cell, Phase, Player
from kyle_trek.movement.controller import MovementController
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


class FakePresenter:
    def __init__(self, fail_on_start=False):
        self.fail_on_start = fail_on_start
        self.starts = []
        self.cleaned = []
        self.placements = []
        self.callback = None
        self.token = None

    def start_flight(self, player, plan, token, callback):
        self.starts.append((player, plan))
        self.token, self.callback = token, callback
        if self.fail_on_start:
            raise RuntimeError("flight could not start")

    def cleanup_flight(self, token):
        self.cleaned.append(token)

    def place_ship(self, player, cell):
        self.placements.append((player, cell))

    def finish(self, lifecycle=Lifecycle.COMPLETED):
        self.callback(self.token, lifecycle)


class GameplayScene:
    def __init__(self):
        self.hud = ""
        self.highlighted = frozenset()
        self.prompt = ""
        self.skip_callback = None
        self.errors = []
        self.layer = 1

    def show_axes(self, axes): pass
    def show_cells(self, cells): pass
    def show_ships(self, ships): pass
    def set_camera(self, yaw, pitch): pass
    def show_inspection(self, text): pass

    def show_hud(self, text):
        self.hud = text

    def show_layer(self, layer, cells, legal_destinations=frozenset()):
        self.layer = layer
        self.highlighted = frozenset(legal_destinations)

    def show_action_prompt(self, text, skip_callback=None):
        self.prompt = text
        self.skip_callback = skip_callback

    def show_error(self, message):
        self.errors.append(message)


def make_composed_game(*, agility=12, fail_on_start=False):
    battle = BattleSetup(random.Random(17)).create()
    first, second = battle.ships
    battle._ships = (
        replace(first, cell=Cell(3, 3, 3), stats=Stats(agility, 10, 10)),
        replace(second, cell=Cell(5, 5, 5)),
    )
    scene = GameplayScene()
    view = InitialView(battle, scene)
    clock = FakeClock()
    scheduler = FakeScheduler(clock)
    presenter = FakePresenter(fail_on_start=fail_on_start)
    controller = MovementController(
        battle,
        presenter,
        clock,
        scheduler,
        on_change=view.refresh_gameplay,
        on_error=view.show_move_error,
    )
    view.bind_movement(controller)
    return battle, scene, view, controller, presenter


def make_controller(*, fail_on_start=False):
    battle = BattleSetup(random.Random(3)).create()
    active = next(ship for ship in battle.ships if ship.player is Player.ONE)
    opponent = next(ship for ship in battle.ships if ship.player is Player.TWO)
    # Use a controlled configuration with one legal step in the interior.
    battle._ships = (
        active.__class__(Player.ONE, Cell(3, 3, 3), active.orientation, active.stats.__class__(12, 10, 10), 10, 10),
        opponent.__class__(Player.TWO, Cell(5, 5, 5), opponent.orientation, opponent.stats, opponent.hp, opponent.starting_hp),
    )
    clock = FakeClock()
    scheduler = FakeScheduler(clock)
    presenter = FakePresenter(fail_on_start=fail_on_start)
    errors, changes = [], []
    controller = MovementController(
        battle, presenter, clock, scheduler, on_change=lambda: changes.append(battle.phase), on_error=errors.append
    )
    return battle, controller, presenter, scheduler, errors, changes


def test_legal_destinations_are_presented_from_current_state():
    _, controller, _, _, _, _ = make_controller()
    assert controller.legal_destinations == frozenset(
        {Cell(2, 3, 3), Cell(4, 3, 3), Cell(3, 2, 3), Cell(3, 4, 3), Cell(3, 3, 2), Cell(3, 3, 4)}
    )


def test_left_click_commits_one_move_but_phase_changes_only_after_arrival():
    battle, controller, presenter, _, _, changes = make_controller()
    target = Cell(4, 3, 3)

    assert controller.select_cell(target, "left")
    assert battle.phase is Phase.MOVING
    assert next(ship for ship in battle.ships if ship.player is Player.ONE).cell == target
    assert len(presenter.starts) == 1
    assert controller.legal_destinations == frozenset()
    assert controller.select_cell(Cell(3, 4, 3), "left") is False
    assert changes == [Phase.MOVING]

    presenter.finish()
    presenter.finish()
    assert battle.phase is Phase.ATTACK_CHOICE
    assert changes == [Phase.MOVING, Phase.ATTACK_CHOICE]
    assert len(presenter.placements) == 1


def test_invalid_occupied_unreachable_and_non_left_selections_do_not_consume_move():
    battle, controller, presenter, _, _, _ = make_controller()
    opponent = next(ship for ship in battle.ships if ship.player is Player.TWO)

    assert controller.select_cell(Cell(4, 3, 3), "right") is False
    assert controller.select_cell(opponent.cell, "left") is False
    assert controller.select_cell(Cell(5, 1, 1), "left") is False
    assert controller.select_cell("not a cell", "left") is False
    assert battle.phase is Phase.MOVEMENT and not presenter.starts


def test_launch_failure_recovers_at_committed_destination_once():
    battle, controller, presenter, _, errors, changes = make_controller(fail_on_start=True)
    target = Cell(4, 3, 3)

    assert controller.select_cell(target)
    assert battle.phase is Phase.ATTACK_CHOICE
    assert presenter.cleaned == [ActionToken(battle.generation, 1)]
    assert presenter.placements == [(Player.ONE, target)]
    assert len(errors) == 1 and "could not start" in errors[0]
    assert changes == [Phase.MOVING, Phase.ATTACK_CHOICE]


def test_playback_failure_cleans_effects_and_resolves_without_duplicate_transition():
    battle, controller, presenter, _, errors, changes = make_controller()
    target = Cell(4, 3, 3)

    controller.select_cell(target)
    presenter.finish(Lifecycle.FAILED)
    presenter.finish(Lifecycle.COMPLETED)

    assert battle.phase is Phase.ATTACK_CHOICE
    assert presenter.cleaned == [presenter.token]
    assert presenter.placements == [(Player.ONE, target)]
    assert len(errors) == 1
    assert changes == [Phase.MOVING, Phase.ATTACK_CHOICE]


def test_invalid_presentation_lifecycle_recovers_instead_of_leaving_move_pending():
    battle, controller, presenter, _, errors, _ = make_controller()
    target = Cell(4, 3, 3)
    controller.select_cell(target)

    presenter.callback(presenter.token, "unknown lifecycle")

    assert battle.phase is Phase.ATTACK_CHOICE
    assert len(errors) == 1 and "invalid" in errors[0].lower()
    assert presenter.placements == [(Player.ONE, target)]


def test_timeout_resolves_before_original_deadline_and_ignores_late_completion():
    battle, controller, presenter, scheduler, errors, changes = make_controller()
    target = Cell(4, 3, 3)
    controller.select_cell(target)
    timeout = scheduler.events[0]

    assert timeout[0] <= 11.5
    scheduler.fire(timeout)
    presenter.finish(Lifecycle.COMPLETED)

    assert battle.phase is Phase.ATTACK_CHOICE
    assert presenter.placements == [(Player.ONE, target)]
    assert len(errors) == 1 and "timed out" in errors[0].lower()
    assert changes == [Phase.MOVING, Phase.ATTACK_CHOICE]


def test_startup_work_does_not_extend_original_deadline_or_flight_budget():
    battle = BattleSetup(random.Random(3)).create()
    first, second = battle.ships
    battle._ships = (
        replace(first, cell=Cell(3, 3, 3), stats=Stats(12, 10, 10)),
        replace(second, cell=Cell(5, 5, 5)),
    )
    clock = FakeClock()
    scheduler = FakeScheduler(clock)
    presenter = FakePresenter()

    def slow_change():
        clock.now += 0.9

    controller = MovementController(battle, presenter, clock, scheduler, on_change=slow_change)
    assert controller.select_cell(Cell(4, 3, 3))

    assert scheduler.events[0][0] <= 11.5
    assert presenter.starts[0][1].duration <= 0.5


def test_skip_requires_no_legal_destination_and_keeps_current_player():
    battle, controller, _, _, _, changes = make_controller()
    assert controller.skip_movement() is False

    battle._ships = (
        battle.ships[0].__class__(Player.ONE, Cell(1, 1, 1), battle.ships[0].orientation, battle.ships[0].stats.__class__(8, 10, 10), 10, 10),
        battle.ships[1].__class__(Player.TWO, Cell(5, 5, 5), battle.ships[1].orientation, battle.ships[1].stats, battle.ships[1].hp, battle.ships[1].starting_hp),
    )
    current = next(ship.cell for ship in battle.ships if ship.player is Player.ONE)
    assert controller.legal_destinations == frozenset()
    assert controller.explanation

    assert controller.skip_movement()
    assert battle.phase is Phase.ATTACK_CHOICE and battle.active_player is Player.ONE
    assert next(ship.cell for ship in battle.ships if ship.player is Player.ONE) == current
    assert changes[-1] is Phase.ATTACK_CHOICE


def test_initial_view_highlights_legal_destinations_and_refreshes_after_arrival():
    battle, scene, view, controller, presenter = make_composed_game()
    view.render()
    view.select_layer(3)
    target = Cell(4, 3, 3)

    assert scene.highlighted == controller.legal_destinations
    assert target in scene.highlighted
    view.select(target)
    assert battle.phase is Phase.MOVING
    assert "moving" in scene.hud.lower()
    presenter.finish()
    assert battle.phase is Phase.ATTACK_CHOICE
    assert "attack" in scene.prompt.lower() and "end turn" in scene.prompt.lower()


def test_initial_view_shows_failure_and_recovered_attack_choice():
    battle, scene, view, _, _ = make_composed_game(fail_on_start=True)
    view.render()
    view.select_layer(3)
    target = Cell(4, 3, 3)

    view.select(target)
    assert battle.phase is Phase.ATTACK_CHOICE
    assert scene.errors and "could not start" in scene.errors[0]
    assert "attack" in scene.prompt.lower()


def test_initial_view_offers_skip_when_no_destination_exists():
    battle, scene, view, _, _ = make_composed_game(agility=8)
    view.render()

    assert scene.highlighted == frozenset()
    assert "no movement allowance" in scene.prompt.lower()
    assert callable(scene.skip_callback)
    scene.skip_callback()
    assert battle.phase is Phase.ATTACK_CHOICE
    assert scene.skip_callback is None
