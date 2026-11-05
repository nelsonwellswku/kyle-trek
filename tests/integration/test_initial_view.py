import random
import copy
from kyle_trek.__main__ import InitialView
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.types import Cell


class FakeScene:
    def __init__(self):
        self.axes = []
        self.cells = []
        self.ships = []
        self.hud = ""
        self.camera = None
        self.layer = None
        self.layer_cells = ()

    def show_axes(self, axes): self.axes = axes
    def show_cells(self, cells): self.cells = cells
    def show_ships(self, ships): self.ships = ships
    def show_hud(self, text): self.hud = text
    def set_camera(self, yaw, pitch): self.camera = (yaw,pitch)
    def show_layer(self, layer, cells): self.layer, self.layer_cells = layer, cells
    def show_inspection(self, text): self.inspection = text


def test_initial_view_composes_board_and_stats():
    battle = BattleSetup(random.Random(5)).create()
    scene = FakeScene()
    InitialView(battle, scene).render()
    assert set(scene.axes) == {"X", "Y", "Z"}
    assert len(scene.cells) == 125 and len(scene.ships) == 2
    assert scene.camera == (45.0,30.0)
    assert "Player 1" in scene.hud and "movement" in scene.hud.lower()
    for ship in battle.ships:
        assert str(ship.cell.x) in scene.hud and str(ship.cell.y) in scene.hud and str(ship.cell.z) in scene.hud
        assert str(ship.hp) in scene.hud and "AC 12" in scene.hud
        for score in (ship.stats.agility, ship.stats.strength, ship.stats.constitution):
            assert str(score) in scene.hud and f"{(score-10)//2:+d}" in scene.hud


def test_all_cells_can_be_hovered_and_selected_without_state_changes():
    battle = BattleSetup(random.Random(8)).create()
    original = copy.deepcopy(battle)
    scene = FakeScene()
    view = InitialView(battle, scene)
    view.render()
    for z in range(1, 6):
        view.select_layer(z)
        assert scene.layer == z and len(scene.layer_cells) == 25
        for y in range(1, 6):
            for x in range(1, 6):
                cell = Cell(x, y, z)
                view.hover(cell)
                assert f"({x}, {y}, {z})" in scene.inspection
                view.select(cell)
                assert view.selected == cell
    view.orbit(10, 5)
    assert battle == original
    assert scene.camera == (55.0, 35.0)


def test_visible_keyboard_controls_orbit_and_choose_layer():
    battle = BattleSetup(random.Random(4)).create()
    original = copy.deepcopy(battle)
    scene = FakeScene()
    view = InitialView(battle, scene)
    view.render()
    assert "1–5" in scene.hud and "arrow" in scene.hud.lower()
    view.handle_key("5")
    assert scene.layer == 5
    view.handle_key("left arrow")
    assert scene.camera != (45.0, 30.0)
    view.handle_key("not a control")
    assert battle == original
