from typing import Protocol
from kyle_trek.battle.state import Battle, Ship, Stats
from kyle_trek.battle.types import Cell
from kyle_trek.inspection.inspection import Inspection


class Scene(Protocol):
    def show_axes(self, axes: tuple[str, ...]) -> None: ...
    def show_cells(self, cells: tuple[Cell, ...]) -> None: ...
    def show_ships(self, ships: tuple[Ship, Ship]) -> None: ...
    def show_hud(self, text: str) -> None: ...
    def set_camera(self, yaw: float, pitch: float) -> None: ...
    def show_layer(self, layer: int, cells: tuple[Cell, ...]) -> None: ...
    def show_inspection(self, text: str) -> None: ...


class InitialView:
    def __init__(self, battle: Battle, scene: Scene):
        self.battle = battle
        self.inspection = Inspection(battle)
        self.scene = scene
        self.selected: Cell | None = None

    def render(self) -> None:
        self.scene.show_axes(("X", "Y", "Z"))
        self.scene.show_cells(self.inspection.cells)
        self.scene.show_ships(self.battle.ships)
        lines = [f"Player {self.battle.active_player.value} — {self.battle.phase.value}"]
        for ship in self.battle.ships:
            scores = ", ".join(f"{name} {score} ({Stats.modifier(score):+d})" for name, score in (("AGI", ship.stats.agility), ("STR", ship.stats.strength), ("CON", ship.stats.constitution)))
            lines.append(f"Player {ship.player.value}: ({ship.cell.x}, {ship.cell.y}, {ship.cell.z}) HP {ship.hp}/{ship.starting_hp} AC {ship.ac}\n{scores}")
        lines.append("1–5: select Z layer | Arrow keys: orbit\nHover a square to inspect; left click to select")
        self.scene.show_hud("\n".join(lines))
        self.scene.set_camera(self.inspection.yaw, self.inspection.pitch)
        self.select_layer(self.inspection.layer)

    def select_layer(self, layer: int) -> None:
        self.inspection.select_layer(layer)
        self.scene.show_layer(layer, tuple(cell for cell in self.inspection.cells if cell.z == layer))
        self.scene.show_inspection(f"Layer Z={layer}; hover a cell to inspect")

    def hover(self, cell: Cell) -> None:
        self.scene.show_inspection(self.inspection.hover(cell))

    def select(self, cell: Cell) -> None:
        if not isinstance(cell, Cell) or cell.z != self.inspection.layer:
            raise ValueError("selection must be in the current layer")
        self.selected = cell
        self.scene.show_inspection(f"Selected {self.inspection.hover(cell)}")

    def orbit(self, yaw: float, pitch: float) -> None:
        self.inspection.orbit(yaw, pitch)
        self.scene.set_camera(self.inspection.yaw, self.inspection.pitch)

    def handle_key(self, key: str) -> None:
        if key in ("1", "2", "3", "4", "5"):
            self.select_layer(int(key))
        elif key in ("left arrow", "right arrow", "up arrow", "down arrow"):
            delta = {"left arrow": (-10, 0), "right arrow": (10, 0), "up arrow": (0, 10), "down arrow": (0, -10)}[key]
            self.orbit(*delta)


_view: InitialView | None = None
_scene = None


def input(key: str) -> None:
    if _view is not None:
        _view.handle_key(key)


def update() -> None:
    if _scene is not None and _scene.aspect != _scene.engine.camera.aspect_ratio:
        _scene.refresh_layout()


def main() -> None:
    import random
    import ursina
    from kyle_trek.battle.setup import BattleSetup
    from kyle_trek.inspection.scene import UrsinaScene

    global _view, _scene
    app = ursina.Ursina()
    ursina.window.title = "Kyle Trek — Battle Inspection"
    ursina.window.fps_counter.enabled = False
    ursina.window.entity_counter.enabled = False
    ursina.window.collider_counter.enabled = False
    scene = UrsinaScene(ursina)
    _scene = scene
    _view = InitialView(BattleSetup(random.Random()).create(), scene)
    scene.bind(_view)
    _view.render()
    app.run()


if __name__ == "__main__":
    main()
