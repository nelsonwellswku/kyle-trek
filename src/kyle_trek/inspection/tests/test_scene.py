from types import SimpleNamespace
import random
import pytest
from dataclasses import replace
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.contracts import ActionToken, Lifecycle
from kyle_trek.battle.state import Stats
from kyle_trek.battle.types import Cell, Orientation, Phase, Player, RotationAxis
from kyle_trek.combat.controller import CombatController
from kyle_trek.combat.outcome import AttackOutcome
from kyle_trek.movement.flight import FlightPlanner
from kyle_trek.inspection.scene import UrsinaScene


class Widget:
    def __init__(self, **kwargs):
        self.parent = None
        self.__dict__.update(kwargs)
        self.on_click = kwargs.get("on_click")
        self.on_mouse_enter = kwargs.get("on_mouse_enter")


class Engine:
    def __init__(self):
        self.buttons = []
        self.entities = []
        self.texts = []
        self.scene = object()
        self.camera = SimpleNamespace(ui=object(), aspect_ratio=.8, look_at=lambda target: None)
        self.color = SimpleNamespace(white="white", azure="blue", orange="orange", dark_gray="dark gray", light_gray="light gray", gray="gray", green="green", red="red")

    def Button(self, **kwargs):
        button = Widget(**kwargs)
        self.buttons.append(button)
        return button

    def destroy(self, widget):
        self.buttons.remove(widget)

    def Entity(self, **kwargs):
        widget = Widget(**kwargs)
        self.entities.append(widget)
        return widget

    def Text(self, **kwargs):
        widget = Widget(**kwargs)
        self.texts.append(widget)
        return widget


class ProjectionLens:
    def getProjectionMat(self):
        return self

    def xform(self, point):
        return point


class CombatEngine(Engine):
    def __init__(self):
        super().__init__()
        self.camera.projection_scale = .12
        self.camera.getRelativePoint = lambda scene, point: SimpleNamespace(
            x=point.x * self.camera.projection_scale,
            y=point.y * self.camera.projection_scale,
            z=point.z,
        )
        self.camera.lens = ProjectionLens()
        self.Vec3 = lambda x, y, z: SimpleNamespace(x=x, y=y, z=z)
        self.Vec4 = lambda x, y, z, w: (x, y, z, w)
        self.Mesh = lambda **kwargs: SimpleNamespace(**kwargs)

    def destroy(self, widget):
        for items in (self.buttons, self.entities, self.texts):
            if widget in items:
                items.remove(widget)


class View:
    def __init__(self):
        self.selected = self.hovered = None
        self.battle = SimpleNamespace(occupancy={Cell(1, 1, 1): 1})

    def select(self, cell): self.selected = cell
    def hover(self, cell): self.hovered = cell


@pytest.mark.parametrize("values", [(0,1,1), (1,6,1), (1,1,True), (1,1,1.0)])
def test_engine_coordinates_are_validated(values):
    with pytest.raises(ValueError):
        UrsinaScene.cell_from_layer(*values)


def test_layer_buttons_expose_each_cell_and_callbacks():
    engine = Engine()
    scene = UrsinaScene(engine)
    view = View()
    scene.bind(view)
    for z in range(1, 6):
        cells = tuple(Cell(x,y,z) for y in range(1,6) for x in range(1,6))
        scene.show_layer(z, cells)
        assert len(engine.buttons) == 25
        for button, cell in zip(engine.buttons, cells):
            button.on_mouse_enter()
            assert view.hovered == cell
            button.on_click()
            assert view.selected == cell


def test_board_and_ship_visuals_are_composed():
    engine = Engine()
    scene = UrsinaScene(engine)
    battle = BattleSetup(random.Random(9)).create()
    cells = tuple(Cell(x,y,z) for z in range(1,6) for y in range(1,6) for x in range(1,6))
    scene.show_cells(cells)
    assert len(engine.entities) == 125
    assert all(entity.model == "wireframe_cube" for entity in engine.entities)
    assert all(entity.color == engine.color.gray for entity in engine.entities)
    scene.show_ships(battle.ships)
    assert len(engine.entities) == 127
    assert {entity.color for entity in engine.entities[-2:]} == {"blue", "orange"}
    scene.show_axes(("X", "Y", "Z"))
    assert {text.text for text in engine.texts} >= {"X", "Y", "Z"}
    assert all(text.parent is engine.scene for text in engine.texts)
    scene.show_hud("Player 1")
    scene.show_inspection("empty")
    assert {text.text for text in engine.texts} >= {"Player 1", "empty"}
    scene.set_camera(45, 30)
    assert engine.camera.position != (0, 0, 0)


def test_repeated_game_render_reuses_axis_labels_instead_of_accumulating_them():
    engine = Engine()
    scene = UrsinaScene(engine)
    scene.show_axes(("X", "Y", "Z"))
    scene.show_axes(("X", "Y", "Z"))

    assert [text.text for text in engine.texts] == ["X", "Y", "Z"]


def test_ui_fits_narrow_window():
    engine = Engine()
    scene = UrsinaScene(engine)
    scene.bind(View())
    scene.show_hud("HUD")
    scene.show_inspection("Cell")
    scene.show_layer(1, tuple(Cell(x, y, 1) for y in range(1, 6) for x in range(1, 6)))
    assert scene.hud.position[0] >= -engine.camera.aspect_ratio / 2
    assert scene.inspection_text.position[0] >= -engine.camera.aspect_ratio / 2
    for button in engine.buttons:
        assert abs(button.position[0]) + button.scale[0] / 2 <= engine.camera.aspect_ratio / 2
    assert any(button.color == engine.color.light_gray for button in engine.buttons)


def test_legal_movement_cells_are_highlighted_separately_from_inspection_cells():
    engine = Engine()
    scene = UrsinaScene(engine)
    scene.bind(View())
    cells = tuple(Cell(x, y, 1) for y in range(1, 6) for x in range(1, 6))
    target = Cell(2, 3, 1)

    scene.show_layer(1, cells, frozenset({target}))

    button_colors = {cell: button.color for cell, button in zip(cells, engine.buttons)}
    assert button_colors[target] == engine.color.green
    empty = next(cell for cell in cells if cell not in scene.view.battle.occupancy and cell != target)
    assert button_colors[empty] == engine.color.light_gray


def test_scene_animates_and_resolves_flight_without_blocking():
    engine = Engine()
    scene = UrsinaScene(engine)
    battle = BattleSetup(random.Random(31)).create()
    scene.show_ships(battle.ships)
    start, destination, opponent = Cell(1, 3, 3), Cell(2, 3, 3), Cell(5, 5, 5)
    plan = FlightPlanner().plan(start, destination, opponent)
    token = ActionToken(1, 2)
    result = []

    scene.place_ship(Player.ONE, start)
    scene.start_flight(Player.ONE, plan, token, lambda action, lifecycle: result.append((action, lifecycle)))
    entity = scene.ship_entities[Player.ONE]
    scene.update(plan.duration / 2)
    assert entity.position not in (FlightPlanner.to_position(start), FlightPlanner.to_position(destination))
    scene.update(plan.duration / 2)

    assert entity.position == FlightPlanner.to_position(destination)
    assert result == [(token, Lifecycle.COMPLETED)]


def test_scene_can_clear_flight_and_show_readable_recovery_error():
    engine = Engine()
    scene = UrsinaScene(engine)
    scene.bind(View())
    triggered = []
    scene.show_action_prompt("No legal destination", lambda: triggered.append(True))
    assert scene.skip_button.text == "Skip movement"
    scene.skip_button.on_click()
    assert triggered == [True]
    scene.show_action_prompt("Movement complete")
    assert scene.skip_button is None

    scene.show_error("Movement presentation failed")
    assert scene.error_text.text == "Movement presentation failed"


def test_hit_explosion_is_presented_before_completion_callback_applies_damage():
    engine = CombatEngine()
    scene = UrsinaScene(engine, visual_rng=random.Random(7))
    battle = BattleSetup(random.Random(8)).create()
    first, second = battle.ships
    battle._ships = (
        replace(first, cell=Cell(1, 3, 3), stats=Stats(10, 10, 10)),
        replace(second, cell=Cell(5, 3, 3)),
    )
    scene.bind(SimpleNamespace(battle=battle))
    scene.show_ships(battle.ships)
    defender = next(ship for ship in battle.ships if ship.player is Player.TWO)
    outcome = AttackOutcome(Player.ONE, Player.TWO, 12, 12, True, 4, 4, defender.hp - 4)
    token = ActionToken(battle.generation, 1)
    completed = []

    def apply_after_presentation(action, lifecycle):
        completed.append((action, lifecycle))
        battle.set_ship_hp(Player.TWO, outcome.remaining_hp)

    scene.start_attack(first, second, outcome, token, apply_after_presentation)
    assert scene.validate_projection(token)
    attack = scene.attacks[token]
    scene.update(.7)

    assert not attack.torpedo_fill.enabled
    assert attack.explosion.enabled
    assert defender.hp == outcome.remaining_hp + outcome.damage
    assert not completed

    scene.update(.21)
    assert completed == [(token, Lifecycle.COMPLETED)]
    assert next(ship for ship in battle.ships if ship.player is Player.TWO).hp == outcome.remaining_hp


def test_combat_controller_can_start_an_attack_on_the_ursina_scene_presenter():
    class Clock:
        def monotonic(self):
            return 10.0

    class Scheduler:
        def call_later(self, delay, callback):
            return (delay, callback)

        def cancel(self, handle):
            pass

    class Dice:
        def __init__(self):
            self.rolls = iter((20, 4))

        def randint(self, lower, upper):
            return next(self.rolls)

    engine = CombatEngine()
    scene = UrsinaScene(engine, visual_rng=random.Random(12))
    battle = BattleSetup(random.Random(13)).create()
    first, second = battle.ships
    battle._ships = (replace(first, cell=Cell(2, 3, 3)), replace(second, cell=Cell(4, 3, 3)))
    battle.phase = Phase.ATTACK_CHOICE
    scene.bind(SimpleNamespace(battle=battle))
    scene.set_camera(45, 30)
    scene.show_ships(battle.ships)
    errors = []
    controller = CombatController(battle, scene, Dice(), Clock(), Scheduler(), on_error=errors.append)
    defender = next(ship for ship in battle.ships if ship.player is Player.TWO)

    assert controller.attack(defender.cell)

    assert battle.phase is Phase.ATTACKING
    assert len(scene.attacks) == 1
    assert not errors


def test_miss_scene_reprojects_during_flight_without_resampling_angle_or_side():
    class VisualRandom:
        def __init__(self):
            self.calls = []

        def randint(self, lower, upper):
            self.calls.append((lower, upper))
            return 20 if lower == 10 else 1

    engine = CombatEngine()
    visual_rng = VisualRandom()
    scene = UrsinaScene(engine, visual_rng=visual_rng)
    battle = BattleSetup(random.Random(10)).create()
    first, second = battle.ships
    battle._ships = (replace(first, cell=Cell(1, 3, 3)), replace(second, cell=Cell(5, 3, 3)))
    scene.bind(SimpleNamespace(battle=battle))
    scene.set_camera(45, 30)
    scene.show_ships(battle.ships)
    outcome = AttackOutcome(Player.ONE, Player.TWO, 5, 5, False)
    token = ActionToken(battle.generation, 2)
    scene.start_attack(first, second, outcome, token, lambda *_: None)
    original = scene.attacks[token].effect
    scene.update(.05)
    engine.camera.projection_scale = .118

    assert scene.validate_projection(token)
    reprojected = scene.attacks[token].effect

    assert reprojected.route != original.route
    assert reprojected.launch_angle_degrees == original.launch_angle_degrees == 20
    assert reprojected.side == original.side == 1
    assert visual_rng.calls == [(10, 35), (0, 1)]


def test_end_turn_control_is_displayed_and_calls_its_action():
    engine = Engine()
    scene = UrsinaScene(engine)
    called = []
    scene.show_action_prompt("Attack or End turn", end_turn_callback=lambda: called.append(True))

    assert scene.end_turn_button.text == "End turn"
    scene.end_turn_button.on_click()
    assert called == [True]


def test_new_game_control_remains_available_and_clears_old_feedback():
    engine = Engine()
    scene = UrsinaScene(engine)
    called = []
    scene.show_new_game(lambda: called.append(True))
    button = scene.new_game_button
    scene.show_action_prompt("Battle finished")
    scene.show_error("old presentation error")

    assert button.text == "New game"
    button.on_click()
    assert called == [True]
    scene.reset_game_state()
    assert scene.new_game_button is button
    assert scene.error_text.text == "" and not scene.error_text.enabled


def test_scene_presents_persistent_discrete_ship_rotation_and_cancels_cleanly():
    engine = Engine()
    scene = UrsinaScene(engine)
    battle = BattleSetup(random.Random(22)).create()
    scene.bind(SimpleNamespace(battle=battle))
    scene.show_ships(battle.ships)
    token = ActionToken(battle.generation, 7)
    target = battle.ships[0].orientation.rotated(RotationAxis.Z, 1)
    callbacks = []
    entity = scene.ship_entities[Player.ONE]
    original_visual = entity.rotation

    scene.start_rotation(
        Player.ONE,
        target,
        token,
        lambda action, lifecycle: callbacks.append((action, lifecycle)),
    )
    scene.update(.15)
    assert entity.rotation != original_visual
    scene.update(.15)
    assert entity.rotation == target.euler_degrees
    assert callbacks == [(token, Lifecycle.COMPLETED)]

    alternate = target.rotated(RotationAxis.X, 1)
    scene.start_rotation(Player.ONE, alternate, ActionToken(battle.generation, 8), lambda *_: None)
    scene.cleanup_rotation(ActionToken(battle.generation, 8))
    assert entity.rotation == original_visual
    assert isinstance(battle.ships[0].orientation, Orientation)
