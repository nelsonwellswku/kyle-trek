from types import SimpleNamespace
import random
import pytest
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.contracts import ActionToken, Lifecycle
from kyle_trek.battle.types import Cell, Player
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
