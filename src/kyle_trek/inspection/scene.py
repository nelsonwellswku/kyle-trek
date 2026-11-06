from dataclasses import dataclass
from math import cos, isfinite, radians, sin

from kyle_trek.battle.contracts import ActionToken, Lifecycle, PresentationCallback
from kyle_trek.battle.types import Cell, Player
from kyle_trek.movement.flight import FlightPlan, FlightPlanner


@dataclass
class _Flight:
    player: Player
    plan: FlightPlan
    token: ActionToken
    callback: PresentationCallback
    elapsed: float = 0.0


class UrsinaScene:
    """Adapter for engine UI and scene objects."""

    def __init__(self, engine):
        self.engine = engine
        self.layer_buttons = []
        self.layer_cells = []
        self.cell_entities = []
        self.ship_entities = {}
        self.flights = {}
        self.hud = None
        self.inspection_text = None
        self.action_text = None
        self.error_text = None
        self.skip_button = None
        self.aspect = engine.camera.aspect_ratio

    def refresh_layout(self):
        self.aspect = self.engine.camera.aspect_ratio
        left = -self.aspect / 2 + .02
        if self.hud is not None:
            self.hud.position = (left, .47)
        if self.inspection_text is not None:
            self.inspection_text.position = (left, -.47)
        if self.action_text is not None:
            self.action_text.position = (left, -.35)
        if self.error_text is not None:
            self.error_text.position = (left, -.40)
        if self.skip_button is not None:
            self.skip_button.position = (left + .11, -.43)
        for index, button in enumerate(self.layer_buttons):
            x, y = index % 5, index // 5
            button.position = (self.aspect / 2 - .04 - (4 - x) * .055, -.18 - y * .055)

    def bind(self, view):
        self.view = view

    @staticmethod
    def cell_from_layer(x, y, z):
        return Cell(x, y, z)

    def show_layer(self, layer, cells, legal_destinations=frozenset()):
        for button in self.layer_buttons:
            self.engine.destroy(button)
        self.layer_buttons.clear()
        self.layer_cells.clear()
        legal_destinations = frozenset(legal_destinations)
        for cell in cells:
            cell = self.cell_from_layer(cell.x, cell.y, layer)
            player = self.view.battle.occupancy.get(cell)
            number = getattr(player, "value", player)
            if cell in legal_destinations:
                color = self.engine.color.green
            else:
                color = self.engine.color.azure if number == 1 else self.engine.color.orange if number == 2 else self.engine.color.light_gray
            scale = (.058, .058) if cell in legal_destinations else (.052, .052)
            button = self.engine.Button(parent=self.engine.camera.ui, text=str(number) if number else "", color=color, scale=scale)
            button.on_mouse_enter = lambda cell=cell: self.view.hover(cell)
            button.on_click = lambda cell=cell: self.view.select(cell)
            self.layer_buttons.append(button)
            self.layer_cells.append(cell)
        self.refresh_layout()

    def show_cells(self, cells):
        if self.cell_entities:
            return
        for cell in cells:
            cell = self.cell_from_layer(cell.x, cell.y, cell.z)
            entity = self.engine.Entity(model="wireframe_cube", position=FlightPlanner.to_position(cell), scale=.98, color=self.engine.color.gray)
            self.cell_entities.append(entity)

    def show_ships(self, ships):
        for ship in ships:
            entity = self.ship_entities.get(ship.player)
            color = self.engine.color.azure if ship.player is Player.ONE else self.engine.color.orange
            if entity is None:
                entity = self.engine.Entity(model="cube", position=FlightPlanner.to_position(ship.cell), scale=.46, color=color)
                self.ship_entities[ship.player] = entity
            elif not any(flight.player is ship.player for flight in self.flights.values()):
                entity.position = FlightPlanner.to_position(ship.cell)
                entity.color = color

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

    def show_action_prompt(self, text, skip_callback=None):
        if self.action_text is None:
            self.action_text = self.engine.Text(parent=self.engine.camera.ui, text=text, scale=.8, color=self.engine.color.white)
        else:
            self.action_text.text = text
        if self.skip_button is not None:
            self.engine.destroy(self.skip_button)
            self.skip_button = None
        if skip_callback is not None:
            self.skip_button = self.engine.Button(
                parent=self.engine.camera.ui,
                text="Skip movement",
                color=self.engine.color.azure,
                scale=(.17, .05),
            )
            self.skip_button.on_click = skip_callback
        self.refresh_layout()

    def show_error(self, message):
        if self.error_text is None:
            self.error_text = self.engine.Text(parent=self.engine.camera.ui, text=message, scale=.8, color=self.engine.color.red)
        else:
            self.error_text.text = message
        self.refresh_layout()

    def start_flight(self, player, plan, token, callback):
        if not isinstance(player, Player) or not isinstance(plan, FlightPlan) or not isinstance(token, ActionToken):
            raise ValueError("invalid flight presentation values")
        if token in self.flights or player not in self.ship_entities or not callable(callback):
            raise RuntimeError("ship or flight action is unavailable")
        self.ship_entities[player].position = FlightPlanner.to_position(plan.waypoints[0])
        self.flights[token] = _Flight(player, plan, token, callback)

    def update(self, delta_time):
        if not isfinite(delta_time) or delta_time < 0:
            raise ValueError("frame time must be finite and nonnegative")
        for token, flight in tuple(self.flights.items()):
            flight.elapsed = min(flight.plan.duration, flight.elapsed + delta_time)
            segment_count = len(flight.plan.waypoints) - 1
            progress = flight.elapsed / flight.plan.duration * segment_count
            segment = min(int(progress), segment_count - 1)
            fraction = min(1.0, max(0.0, progress - segment))
            eased = fraction * fraction * (3 - 2 * fraction)
            start = FlightPlanner.to_position(flight.plan.waypoints[segment])
            end = FlightPlanner.to_position(flight.plan.waypoints[segment + 1])
            self.ship_entities[flight.player].position = tuple(a + (b - a) * eased for a, b in zip(start, end))
            if flight.elapsed >= flight.plan.duration:
                self.ship_entities[flight.player].position = FlightPlanner.to_position(flight.plan.waypoints[-1])
                del self.flights[token]
                try:
                    flight.callback(token, Lifecycle.COMPLETED)
                except Exception:
                    pass

    def cleanup_flight(self, token):
        self.flights.pop(token, None)

    def place_ship(self, player, cell):
        if not isinstance(player, Player) or not isinstance(cell, Cell):
            raise ValueError("ship placement requires a player and cell")
        entity = self.ship_entities.get(player)
        if entity is None:
            raise RuntimeError("ship visual is unavailable")
        entity.position = FlightPlanner.to_position(cell)

    def set_camera(self, yaw, pitch):
        yaw, pitch = radians(yaw), radians(pitch)
        radius = 13
        self.engine.camera.position = (radius * sin(yaw) * cos(pitch), radius * sin(pitch), -radius * cos(yaw) * cos(pitch))
        self.engine.camera.look_at((0, 0, 0))
