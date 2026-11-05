from math import cos, radians, sin
from kyle_trek.battle.types import Cell, Player


class UrsinaScene:
    """Adapter for engine UI and scene objects."""

    def __init__(self, engine):
        self.engine = engine
        self.layer_buttons = []
        self.hud = None
        self.inspection_text = None
        self.aspect = engine.camera.aspect_ratio

    def refresh_layout(self):
        self.aspect = self.engine.camera.aspect_ratio
        left = -self.aspect / 2 + .02
        if self.hud is not None:
            self.hud.position = (left, .47)
        if self.inspection_text is not None:
            self.inspection_text.position = (left, -.47)
        for index, button in enumerate(self.layer_buttons):
            x, y = index % 5, index // 5
            button.position = (self.aspect / 2 - .04 - (4 - x) * .055, -.18 - y * .055)

    def bind(self, view):
        self.view = view

    @staticmethod
    def cell_from_layer(x, y, z):
        return Cell(x, y, z)

    def show_layer(self, layer, cells):
        for button in self.layer_buttons:
            self.engine.destroy(button)
        self.layer_buttons.clear()
        for cell in cells:
            cell = self.cell_from_layer(cell.x, cell.y, layer)
            player = self.view.battle.occupancy.get(cell)
            number = getattr(player, "value", player)
            color = self.engine.color.azure if number == 1 else self.engine.color.orange if number == 2 else self.engine.color.light_gray
            button = self.engine.Button(parent=self.engine.camera.ui, text=str(number) if number else "", color=color, scale=(.052, .052))
            button.on_mouse_enter = lambda cell=cell: self.view.hover(cell)
            button.on_click = lambda cell=cell: self.view.select(cell)
            self.layer_buttons.append(button)
        self.refresh_layout()

    def show_cells(self, cells):
        for cell in cells:
            cell = self.cell_from_layer(cell.x, cell.y, cell.z)
            self.engine.Entity(model="wireframe_cube", position=(cell.x - 3, 3 - cell.y, cell.z - 3), scale=.98, color=self.engine.color.gray)

    def show_ships(self, ships):
        for ship in ships:
            cell = ship.cell
            self.engine.Entity(model="cube", position=(cell.x - 3, 3 - cell.y, cell.z - 3), scale=.46, color=self.engine.color.azure if ship.player is Player.ONE else self.engine.color.orange)

    def show_axes(self, axes):
        positions = ((3.2, 2.7, -2.7), (-2.7, -3.2, -2.7), (-2.7, 2.7, 3.2))
        for label, position in zip(axes, positions):
            self.engine.Text(parent=self.engine.scene, text=label, position=position, scale=10, billboard=True, color=self.engine.color.white)

    def show_hud(self, text):
        if self.hud is None:
            self.hud = self.engine.Text(parent=self.engine.camera.ui, text=text, scale=.8, color=self.engine.color.white)
        else:
            self.hud.text = text
        self.refresh_layout()

    def show_inspection(self, text):
        if self.inspection_text is None:
            self.inspection_text = self.engine.Text(parent=self.engine.camera.ui, text=text, scale=.8, color=self.engine.color.white)
        else:
            self.inspection_text.text = text
        self.refresh_layout()

    def set_camera(self, yaw, pitch):
        yaw, pitch = radians(yaw), radians(pitch)
        radius = 13
        self.engine.camera.position = (radius * sin(yaw) * cos(pitch), radius * sin(pitch), -radius * cos(yaw) * cos(pitch))
        self.engine.camera.look_at((0, 0, 0))
