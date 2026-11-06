from types import SimpleNamespace
from inspect import getmembers, isfunction, signature
import random
import pytest
from dataclasses import replace
from typing import get_type_hints
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.contracts import ActionToken, Lifecycle
from kyle_trek.battle.state import Stats
from kyle_trek.battle.types import Cell, Orientation, Phase, Player, RotationAxis
from kyle_trek.combat.controller import CombatController
from kyle_trek.combat.outcome import AttackOutcome
from kyle_trek.movement.flight import FlightPlanner
from kyle_trek.movement.controller import MovementController
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


def test_scene_project_boundary_contracts_are_explicitly_typed():
    from kyle_trek.battle.contracts import PresentationCallback
    from kyle_trek.movement.flight import FlightPlan

    layer_types = get_type_hints(UrsinaScene.show_layer)
    flight_types = get_type_hints(UrsinaScene.start_flight)
    rotation_types = get_type_hints(UrsinaScene.start_rotation)
    attack_types = get_type_hints(UrsinaScene.start_attack)

    assert layer_types["layer"] is int
    assert layer_types["cells"] == tuple[Cell, ...] or "Iterable" in str(layer_types["cells"])
    assert flight_types["player"] is Player
    assert flight_types["plan"] is FlightPlan
    assert flight_types["token"] is ActionToken
    assert flight_types["callback"] is PresentationCallback
    assert rotation_types["orientation"] is Orientation
    assert rotation_types["callback"] is PresentationCallback
    assert attack_types["attacker"].__name__ == "Ship"
    assert attack_types["outcome"] is AttackOutcome
    assert attack_types["callback"] is PresentationCallback

    for _, method in getmembers(UrsinaScene, isfunction):
        method_signature = signature(method)
        assert all(
            parameter.annotation is not parameter.empty
            for name, parameter in method_signature.parameters.items()
            if name != "self"
        )
        assert method_signature.return_annotation is not method_signature.empty


def test_scene_integration_state_annotations_keep_engine_dynamics_at_adapter_edge():
    annotations = UrsinaScene.__annotations__

    assert "Any" in str(annotations["engine"])
    assert "Any" in str(annotations["cell_entities"])
    assert "ActionToken" in str(annotations["flights"])
    assert "Player" in str(annotations["ship_entities"])


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


def test_board_highlights_legal_destinations_at_every_depth():
    engine = Engine()
    scene = UrsinaScene(engine)
    cells = tuple(Cell(x, y, z) for z in range(1, 6) for y in range(1, 6) for x in range(1, 6))
    near = Cell(2, 2, 1)
    far = Cell(4, 4, 5)

    scene.show_cells(cells, frozenset({near, far}))

    assert scene.cell_entities[near].color == engine.color.green
    assert scene.cell_entities[far].color == engine.color.green
    assert scene.cell_entities[Cell(3, 3, 3)].color == engine.color.gray


def test_board_highlights_refresh_without_recreating_cell_entities():
    engine = Engine()
    scene = UrsinaScene(engine)
    cells = tuple(Cell(x, y, z) for z in range(1, 6) for y in range(1, 6) for x in range(1, 6))
    first = Cell(1, 1, 1)
    second = Cell(5, 5, 5)
    scene.show_cells(cells)
    original_entities = dict(scene.cell_entities)

    scene.show_cells(cells, frozenset({second}))

    assert scene.cell_entities == original_entities
    assert scene.cell_entities[first].color == engine.color.gray
    assert scene.cell_entities[second].color == engine.color.green


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


class PlaybackFault:
    """Compose a one-shot engine setter failure around an existing visual."""

    def __init__(self, visual):
        object.__setattr__(self, "visual", visual)
        object.__setattr__(self, "pending_fault", True)

    def __getattr__(self, name):
        return getattr(self.visual, name)

    def __setattr__(self, name, value):
        if name == "position" and self.pending_fault:
            object.__setattr__(self, "pending_fault", False)
            raise RuntimeError("injected engine playback failure")
        setattr(self.visual, name, value)


class SceneClock:
    def monotonic(self):
        return 10.1


class SceneScheduler:
    def call_later(self, delay, callback):
        return [delay, callback, False]

    def cancel(self, handle):
        handle[2] = True


def test_scene_flight_playback_failure_recovers_visible_destination_and_keeps_updating_other_actions():
    engine = Engine()
    scene = UrsinaScene(engine)
    battle = BattleSetup(random.Random(8)).create()
    battle._ships = (
        replace(battle.ships[0], cell=Cell(2, 3, 3), stats=Stats(14, 10, 10)),
        replace(battle.ships[1], cell=Cell(5, 5, 5)),
    )
    scene.show_ships(battle.ships)
    errors, changes = [], []
    controller = MovementController(
        battle, scene, SceneClock(), SceneScheduler(), on_error=errors.append,
        on_change=lambda: changes.append(battle.phase),
    )
    target = Cell(3, 3, 3)
    assert controller.select_cell(target)
    scene.ship_entities[Player.ONE] = PlaybackFault(scene.ship_entities[Player.ONE])
    other_plan = FlightPlanner().plan(Cell(5, 5, 5), Cell(4, 5, 5), Cell(1, 1, 1))
    other_token = ActionToken(battle.generation, 99)
    scene.start_flight(Player.TWO, other_plan, other_token, lambda *_: None)

    scene.update(.1)

    assert battle.phase is Phase.ATTACK_CHOICE
    assert scene.ship_entities[Player.ONE].position == FlightPlanner.to_position(target)
    assert len(errors) == 1 and "playback" in errors[0]
    assert changes == [Phase.MOVING, Phase.ATTACK_CHOICE]
    assert set(scene.flights) == {other_token}
    assert scene.ship_entities[Player.TWO].position != FlightPlanner.to_position(Cell(5, 5, 5))
    scene.update(.8)
    assert not scene.flights and len(errors) == 1


def test_scene_renders_the_continuous_detour_instead_of_the_obstructed_endpoint_chord():
    from math import dist, sqrt

    scene = UrsinaScene(Engine())
    battle = BattleSetup(random.Random(8)).create()
    scene.show_ships(battle.ships)
    start, end, obstacle = Cell(1, 3, 3), Cell(3, 3, 3), Cell(2, 3, 3)
    plan = FlightPlanner().plan(start, end, obstacle)
    completed = []
    scene.start_flight(Player.ONE, plan, ActionToken(1, 9), lambda *args: completed.append(args))
    for _ in range(101):
        scene.update(plan.duration / 100)
        position = scene.ship_entities[Player.ONE].position
        assert dist(position, FlightPlanner.to_position(obstacle)) >= plan.ship_size * sqrt(3) - 1e-9
    assert len(completed) == 1
    assert scene.ship_entities[Player.ONE].position == FlightPlanner.to_position(end)


@pytest.mark.parametrize("rolls,hp,expected_hp", [((20, 4), 8, 4), ((20, 8), 2, 0), ((1,), 8, 8)])
def test_scene_combat_playback_failure_resolves_stored_outcome_once(rolls, hp, expected_hp):
    class Dice:
        def __init__(self):
            self.rolls = iter(rolls)
            self.calls = []

        def randint(self, lower, upper):
            self.calls.append((lower, upper))
            return next(self.rolls)

    engine = CombatEngine()
    scene = UrsinaScene(engine, visual_rng=random.Random(12))
    battle = BattleSetup(random.Random(8)).create()
    battle._ships = (
        replace(battle.ships[0], cell=Cell(1, 3, 3), stats=Stats(10, 10, 10)),
        replace(battle.ships[1], cell=Cell(5, 3, 3), hp=hp, starting_hp=max(hp, battle.ships[1].starting_hp)),
    )
    battle.phase = Phase.ATTACK_CHOICE
    scene.bind(SimpleNamespace(battle=battle))
    scene.show_ships(battle.ships)
    dice, errors, changes = Dice(), [], []
    controller = CombatController(
        battle, scene, dice, SceneClock(), SceneScheduler(), on_error=errors.append,
        on_change=lambda: changes.append(battle.phase),
    )
    assert controller.attack(battle.ships[1].cell)
    token, attack = next(iter(scene.attacks.items()))
    old_fill = attack.torpedo_fill
    attack.torpedo_fill = PlaybackFault(old_fill)
    engine.entities[engine.entities.index(old_fill)] = attack.torpedo_fill

    scene.update(.1)
    scene.update(1.0)
    controller._timed_out(token)

    assert battle.ships[1].hp == expected_hp
    assert battle.phase is (Phase.FINISHED if expected_hp == 0 else Phase.MOVEMENT)
    assert battle.winner is (Player.ONE if expected_hp == 0 else None)
    assert battle.last_outcome is not None
    assert len(dice.calls) == len(rolls)
    assert len(errors) == 1 and "playback" in errors[0]
    assert len(changes) == 2
    assert not scene.attacks
    assert all(visual not in engine.entities for visual in (attack.torpedo_fill, attack.torpedo_outline, attack.explosion))


def make_projected_attack(hit):
    from kyle_trek.__main__ import InitialView

    class Dice:
        def __init__(self, values):
            self.values = iter(values)
            self.calls = []

        def randint(self, low, high):
            self.calls.append((low, high))
            return next(self.values)

    engine = CombatEngine()
    engine.time = SimpleNamespace(dt=.01)
    visuals = Dice((20, 1))
    scene = UrsinaScene(engine, visual_rng=visuals)
    battle = BattleSetup(random.Random(8)).create()
    battle._ships = (
        replace(battle.ships[0], cell=Cell(1, 3, 3), stats=Stats(10, 10, 10)),
        replace(battle.ships[1], cell=Cell(5, 3, 3), hp=8, starting_hp=8),
    )
    battle.phase = Phase.ATTACK_CHOICE
    view = InitialView(battle, scene)
    scene.bind(view)
    dice = Dice((20, 4) if hit else (1,))
    controller = CombatController(battle, scene, dice, SceneClock(), SceneScheduler())
    view.bind_combat(controller)
    view.render()
    assert controller.attack(battle.ships[1].cell)
    return engine, scene, controller, view, dice, visuals


def rendered_star_radius(visual):
    from math import hypot

    return max(hypot(vertex.x, vertex.y) for vertex in visual.model.vertices) * getattr(visual, "scale", 1.0)


@pytest.mark.parametrize("hit", [True, False])
@pytest.mark.parametrize("projection_scale", [.06, .18])
def test_reprojection_resizes_the_actual_whole_star_and_repositions_without_advancing_time(hit, projection_scale):
    engine, scene, controller, _, dice, visuals = make_projected_attack(hit)
    token, attack = next(iter(scene.attacks.items()))
    scene.update(.08)
    before_position = attack.torpedo_fill.position
    elapsed, deadline, timer = attack.elapsed, controller._pending.deadline, controller._pending.timeout_handle
    original_draws = (list(dice.calls), list(visuals.calls))
    engine.camera.projection_scale = projection_scale

    assert scene.validate_projection(token)

    assert rendered_star_radius(attack.torpedo_outline) == pytest.approx(attack.effect.star_radius)
    assert 0 < rendered_star_radius(attack.torpedo_fill) < rendered_star_radius(attack.torpedo_outline)
    assert rendered_star_radius(attack.torpedo_outline) >= .2 * attack.effect.cell_diameter - 1e-9
    assert attack.torpedo_fill.position != before_position
    assert attack.elapsed == elapsed
    assert controller._pending.deadline == deadline and controller._pending.timeout_handle is timer
    assert (dice.calls, visuals.calls) == original_draws
    if not hit:
        target = scene._camera_projection().project(controller.battle.ships[1].cell)
        for first, second in zip(attack.effect.route, attack.effect.route[1:]):
            assert scene._effect_planner(scene._camera_projection(), controller.battle.ships[1].cell)._distance_to_segment(target, first, second) >= rendered_star_radius(attack.torpedo_outline) + attack.effect.defender_radius - 1e-9


def test_hit_reprojection_repositions_and_rescales_visible_explosion_without_restarting_it():
    engine, scene, controller, _, _, _ = make_projected_attack(True)
    token, attack = next(iter(scene.attacks.items()))
    scene.update(.7)
    assert attack.explosion.enabled
    elapsed = attack.explosion_elapsed
    old_position = attack.explosion.position
    engine.camera.projection_scale = .18

    assert scene.validate_projection(token)

    assert attack.explosion.position != old_position
    assert attack.explosion.position[:2] == (attack.effect.contact.x, attack.effect.contact.y)
    assert attack.explosion.scale == pytest.approx(attack.effect.star_radius * 2 * (1 + attack.elapsed - .65))
    assert attack.explosion_elapsed == elapsed
    assert controller.battle.ships[1].hp == 8


@pytest.mark.parametrize("hit", [True, False])
@pytest.mark.parametrize("aspect", [.9, .01])
@pytest.mark.parametrize("layout_already_refreshed", [False, True])
def test_application_resize_revalidates_effects_and_recovers_infeasible_projection_once(monkeypatch, hit, aspect, layout_already_refreshed):
    import kyle_trek.__main__ as application

    engine, scene, controller, view, dice, visuals = make_projected_attack(hit)
    token, attack = next(iter(scene.attacks.items()))
    old_start = attack.effect.start if hit else attack.effect.route[0]
    old_deadline, timer = controller._pending.deadline, controller._pending.timeout_handle
    draws = (list(dice.calls), list(visuals.calls))
    monkeypatch.setattr(application, "_scene", scene)
    monkeypatch.setattr(application, "_view", view)
    engine.camera.aspect_ratio = aspect
    if layout_already_refreshed:
        # Changing a depth layer can refresh layout before the next engine tick.
        view.select_layer(2)

    application.update()

    if aspect == .9:
        assert token in scene.attacks
        new_start = attack.effect.start if hit else attack.effect.route[0]
        assert new_start != old_start
        assert controller._pending.deadline == old_deadline
        assert controller._pending.timeout_handle is timer
    else:
        assert not scene.attacks
        assert controller.battle.phase is Phase.MOVEMENT
        assert controller.battle.ships[1].hp == (4 if hit else 8)
        assert controller.battle.last_outcome is not None
        assert "camera" in scene.error_text.text
        outcome = controller.battle.last_outcome
        controller._timed_out(token)
        application.update()
        assert controller.battle.last_outcome == outcome
    assert (dice.calls, visuals.calls) == draws
