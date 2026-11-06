import random
from dataclasses import replace

from kyle_trek.__main__ import InitialView
from kyle_trek.battle.contracts import Lifecycle
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.state import Stats
from kyle_trek.battle.types import Cell, Phase, Player
from kyle_trek.combat.controller import CombatController


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
        handle = [self.clock.now + delay, callback, False]
        self.events.append(handle)
        return handle

    def cancel(self, handle):
        handle[2] = True

    def fire(self, handle):
        if not handle[2]:
            self.clock.now = handle[0]
            handle[1]()


class ScriptedRandom:
    def __init__(self, rolls):
        self.rolls = list(rolls)
        self.calls = []

    def randint(self, lower, upper):
        self.calls.append((lower, upper))
        value = self.rolls.pop(0)
        assert lower <= value <= upper
        return value


class FakePresenter:
    def __init__(self, *, fail_on_start=False, projection_valid=True):
        self.fail_on_start = fail_on_start
        self.projection_valid = projection_valid
        self.starts = []
        self.cleaned = []
        self.callback = None
        self.token = None
        self.revalidations = 0

    def start_attack(self, attacker, defender, outcome, token, callback):
        self.starts.append((attacker, defender, outcome))
        self.token, self.callback = token, callback
        if self.fail_on_start:
            raise RuntimeError("torpedo could not start")

    def cleanup_attack(self, token):
        self.cleaned.append(token)

    def validate_projection(self, token):
        self.revalidations += 1
        return self.projection_valid

    def finish(self, lifecycle=Lifecycle.COMPLETED):
        self.callback(self.token, lifecycle)


class GameplayScene:
    def __init__(self):
        self.hud = ""
        self.prompt = ""
        self.end_turn_callback = None
        self.errors = []
        self.camera = None

    def show_axes(self, axes): pass
    def show_cells(self, cells): pass
    def show_ships(self, ships): pass
    def show_layer(self, layer, cells, legal_destinations=frozenset()): pass
    def show_inspection(self, text): pass

    def show_hud(self, text):
        self.hud = text

    def set_camera(self, yaw, pitch):
        self.camera = (yaw, pitch)

    def show_action_prompt(self, text, skip_callback=None, end_turn_callback=None):
        self.prompt = text
        self.end_turn_callback = end_turn_callback

    def show_error(self, message):
        self.errors.append(message)


def make_game(*, strength=10, hp=8, rolls=(20, 4), fail_on_start=False):
    battle = BattleSetup(random.Random(3)).create()
    first, second = battle.ships
    battle._ships = (
        replace(first, cell=Cell(1, 3, 3), stats=Stats(10, strength, 10)),
        replace(second, cell=Cell(5, 3, 3), hp=hp, starting_hp=max(hp, second.starting_hp)),
    )
    battle.phase = Phase.ATTACK_CHOICE
    clock = FakeClock()
    scheduler = FakeScheduler(clock)
    rng = ScriptedRandom(rolls)
    presenter = FakePresenter(fail_on_start=fail_on_start)
    errors, changes = [], []
    controller = CombatController(
        battle,
        presenter,
        rng,
        clock,
        scheduler,
        on_change=lambda: changes.append(battle.phase),
        on_error=errors.append,
    )
    return battle, controller, presenter, rng, clock, scheduler, errors, changes


def test_invalid_target_and_busy_gameplay_input_do_not_consume_rolls():
    battle, controller, presenter, rng, _, _, _, _ = make_game()
    opponent = next(ship for ship in battle.ships if ship.player is Player.TWO)

    assert controller.attack(Cell(2, 2, 2)) is False
    assert not rng.calls and not presenter.starts
    assert controller.attack(opponent.cell)
    assert battle.phase is Phase.ATTACKING
    assert controller.end_turn() is False
    assert controller.attack(opponent.cell) is False
    assert len(rng.calls) == 2 and len(presenter.starts) == 1


def test_hit_is_prerolled_then_applied_once_after_explosion_presentation():
    battle, controller, presenter, rng, _, _, errors, changes = make_game(strength=14, rolls=(10, 4))
    defender = next(ship for ship in battle.ships if ship.player is Player.TWO)

    assert controller.attack(defender.cell)
    stored = presenter.starts[0][2]
    assert stored.total == 12 and stored.hit and stored.damage == 6
    assert defender.hp == 8
    presenter.finish()
    presenter.finish()

    assert next(ship for ship in battle.ships if ship.player is Player.TWO).hp == 2
    assert battle.active_player is Player.TWO and battle.phase is Phase.MOVEMENT
    assert len(rng.calls) == 2 and not errors
    assert changes == [Phase.ATTACKING, Phase.MOVEMENT]


def test_lethal_hit_declares_winner_and_blocks_further_turn_changes():
    battle, controller, presenter, _, _, _, _, _ = make_game(strength=20, hp=2, rolls=(20, 8))
    scene = GameplayScene()
    view = InitialView(battle, scene)
    view.bind_combat(controller)
    view.render()
    view.select_layer(3)
    assert controller.attack(Cell(5, 3, 3))
    presenter.finish()

    assert battle.phase is Phase.FINISHED and battle.winner is Player.ONE
    assert next(ship for ship in battle.ships if ship.player is Player.TWO).hp == 0
    assert "Player 1 wins" in scene.hud and "Player 1 wins" in scene.prompt
    assert not controller.end_turn()


def test_miss_does_not_roll_damage_and_end_turn_hands_off_once():
    battle, controller, presenter, rng, _, _, _, _ = make_game(strength=8, rolls=(12,))
    original_hp = tuple(ship.hp for ship in battle.ships)
    assert controller.attack(Cell(5, 3, 3))
    presenter.finish()
    assert tuple(ship.hp for ship in battle.ships) == original_hp
    assert rng.calls == [(1, 20)]

    battle.phase = Phase.ATTACK_CHOICE
    assert controller.end_turn()
    assert battle.phase is Phase.MOVEMENT and battle.active_player is Player.ONE
    assert not controller.end_turn()


def test_start_and_playback_failures_clean_effects_and_apply_stored_result():
    battle, controller, presenter, rng, _, _, errors, _ = make_game(fail_on_start=True)
    assert controller.attack(Cell(5, 3, 3))
    assert battle.phase is Phase.MOVEMENT and battle.active_player is Player.TWO
    assert len(presenter.cleaned) == 1 and len(errors) == 1
    assert len(rng.calls) == 2
    assert next(ship for ship in battle.ships if ship.player is Player.TWO).hp == 4

    battle, controller, presenter, _, _, _, errors, _ = make_game()
    controller.attack(Cell(5, 3, 3))
    presenter.finish(Lifecycle.FAILED)
    presenter.finish(Lifecycle.COMPLETED)
    assert battle.phase is Phase.MOVEMENT and battle.active_player is Player.TWO
    assert len(presenter.cleaned) == 1 and len(errors) == 1
    assert next(ship for ship in battle.ships if ship.player is Player.TWO).hp == 4


def test_timeout_uses_original_deadline_and_ignores_late_duplicate_callback():
    battle, controller, presenter, rng, clock, scheduler, errors, changes = make_game()
    controller.attack(Cell(5, 3, 3))
    timeout = scheduler.events[0]
    assert timeout[0] <= 11.5
    scheduler.fire(timeout)
    presenter.finish()
    assert battle.phase is Phase.MOVEMENT and battle.active_player is Player.TWO
    assert len(rng.calls) == 2 and len(errors) == 1
    assert changes == [Phase.ATTACKING, Phase.MOVEMENT]
    assert clock.now <= 11.5


def test_end_turn_does_not_damage_either_ship_or_roll_dice():
    battle, controller, _, rng, _, _, _, changes = make_game()
    hp = tuple(ship.hp for ship in battle.ships)
    assert controller.end_turn()
    assert battle.active_player is Player.TWO and battle.phase is Phase.MOVEMENT
    assert tuple(ship.hp for ship in battle.ships) == hp and not rng.calls
    assert changes == [Phase.MOVEMENT]


def test_camera_orbit_stays_available_and_infeasible_reprojection_uses_prerolled_result():
    battle, controller, presenter, rng, _, scheduler, errors, changes = make_game(strength=14, rolls=(10, 4))
    scene = GameplayScene()
    view = InitialView(battle, scene)
    view.bind_combat(controller)
    view.render()
    view.select_layer(3)
    controller.attack(Cell(5, 3, 3))
    timeout = scheduler.events[0]
    presenter.projection_valid = False

    view.orbit(10, 0)

    assert scene.camera == (55.0, 30.0)
    assert battle.phase is Phase.MOVEMENT and battle.active_player is Player.TWO
    assert next(ship for ship in battle.ships if ship.player is Player.TWO).hp == 2
    assert len(rng.calls) == 2 and len(scene.errors) == 1
    assert presenter.revalidations == 1 and len(presenter.cleaned) == 1
    assert battle.last_outcome is not None
    scheduler.fire(timeout)
    assert len(rng.calls) == 2 and len(scene.errors) == 1


def test_view_routes_target_and_end_turn_controls_to_combat_controller():
    battle, controller, presenter, _, _, _, _, _ = make_game()
    scene = GameplayScene()
    view = InitialView(battle, scene)
    view.bind_combat(controller)
    view.render()
    view.select_layer(3)
    view.select(Cell(2, 2, 3))
    assert not presenter.starts

    view.select(Cell(5, 3, 3))
    assert len(presenter.starts) == 1
    presenter.finish()
    battle.phase = Phase.ATTACK_CHOICE
    view.refresh_gameplay()
    assert callable(scene.end_turn_callback)
    scene.end_turn_callback()
    assert battle.active_player is Player.ONE and battle.phase is Phase.MOVEMENT


def test_cancelled_presentation_discards_prerolled_outcome():
    battle, controller, presenter, _, _, _, errors, changes = make_game()
    original_hp = tuple(ship.hp for ship in battle.ships)
    controller.attack(Cell(5, 3, 3))
    presenter.finish(Lifecycle.CANCELLED)

    assert tuple(ship.hp for ship in battle.ships) == original_hp
    assert battle.active_player is Player.ONE and battle.phase is Phase.ATTACKING
    assert not errors and changes == [Phase.ATTACKING]
