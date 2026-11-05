from types import SimpleNamespace
import random
import pytest
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.types import Cell
from kyle_trek.inspection.scene import UrsinaScene


class Widget:
    def __init__(self, **kwargs):
        self.parent = None
        self.__dict__.update(kwargs)
        self.on_click = None
        self.on_mouse_enter = None


class Engine:
    def __init__(self):
        self.buttons = []
        self.entities = []
        self.texts = []
        self.scene = object()
        self.camera = SimpleNamespace(ui=object(), aspect_ratio=.8, look_at=lambda target: None)
        self.color = SimpleNamespace(white="white", azure="blue", orange="orange", dark_gray="dark gray", light_gray="light gray", gray="gray")

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
