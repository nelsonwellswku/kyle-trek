from dataclasses import dataclass
from math import cos, hypot, isfinite, radians, sin
import random

from kyle_trek.battle.contracts import ActionToken, Lifecycle, PresentationCallback
from kyle_trek.battle.state import Ship
from kyle_trek.battle.types import Cell, Orientation, Player
from kyle_trek.combat.effects import CombatEffectPlanner, HitEffect, MissEffect, ScreenBounds, ScreenPoint
from kyle_trek.combat.outcome import AttackOutcome
from kyle_trek.movement.flight import FlightPlan, FlightPlanner


@dataclass
class _Flight:
    player: Player
    plan: FlightPlan
    token: ActionToken
    callback: PresentationCallback
    elapsed: float = 0.0


@dataclass
class _Rotation:
    player: Player
    before: Orientation
    target: Orientation
    token: ActionToken
    callback: PresentationCallback
    start_euler: tuple[float, float, float]
    elapsed: float = 0.0


@dataclass
class _Attack:
    attacker: Player
    defender: Player
    outcome: AttackOutcome
    token: ActionToken
    callback: PresentationCallback
    effect: HitEffect | MissEffect
    torpedo_fill: object
    torpedo_outline: object
    explosion: object
    elapsed: float = 0.0
    explosion_elapsed: float = 0.0
    explosion_visible: bool = False


class UrsinaScene:
    """Adapter for engine UI and scene objects."""

    def __init__(self, engine, visual_rng=None):
        self.engine = engine
        self.visual_rng = visual_rng or random.Random()
        self.layer_buttons = []
        self.layer_cells = []
        self.cell_entities = []
        self.axis_labels = {}
        self.ship_entities = {}
        self.flights = {}
        self.rotations = {}
        self.attacks = {}
        self.hud = None
        self.inspection_text = None
        self.action_text = None
        self.error_text = None
        self.skip_button = None
        self.end_turn_button = None
        self.new_game_button = None
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
        if self.end_turn_button is not None:
            self.end_turn_button.position = (left + .11, -.43)
        if self.new_game_button is not None:
            self.new_game_button.position = (self.aspect / 2 - .09, .47)
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
                entity = self.engine.Entity(
                    model="cube",
                    position=FlightPlanner.to_position(ship.cell),
                    scale=(.25, .58, .36),
                    rotation=ship.orientation.euler_degrees,
                    color=color,
                )
                self.ship_entities[ship.player] = entity
            elif not any(flight.player is ship.player for flight in self.flights.values()):
                entity.position = FlightPlanner.to_position(ship.cell)
                entity.color = color
                if not any(rotation.player is ship.player for rotation in self.rotations.values()):
                    entity.rotation = ship.orientation.euler_degrees

    def show_axes(self, axes):
        positions = ((3.2, 2.7, -2.7), (-2.7, -3.2, -2.7), (-2.7, 2.7, 3.2))
        for label, position in zip(axes, positions):
            if label not in self.axis_labels:
                self.axis_labels[label] = self.engine.Text(
                    parent=self.engine.scene,
                    text=label,
                    position=position,
                    scale=10,
                    billboard=True,
                    color=self.engine.color.white,
                )

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

    def show_action_prompt(self, text, skip_callback=None, end_turn_callback=None):
        if self.action_text is None:
            self.action_text = self.engine.Text(parent=self.engine.camera.ui, text=text, scale=.8, color=self.engine.color.white)
        else:
            self.action_text.text = text
        if self.skip_button is not None:
            self.engine.destroy(self.skip_button)
            self.skip_button = None
        if self.end_turn_button is not None:
            self.engine.destroy(self.end_turn_button)
            self.end_turn_button = None
        if skip_callback is not None:
            self.skip_button = self.engine.Button(
                parent=self.engine.camera.ui,
                text="Skip movement",
                color=self.engine.color.azure,
                scale=(.17, .05),
            )
            self.skip_button.on_click = skip_callback
        if end_turn_callback is not None:
            self.end_turn_button = self.engine.Button(
                parent=self.engine.camera.ui,
                text="End turn",
                color=self.engine.color.azure,
                scale=(.15, .05),
            )
            self.end_turn_button.on_click = end_turn_callback
        self.refresh_layout()

    def show_error(self, message):
        if self.error_text is None:
            self.error_text = self.engine.Text(parent=self.engine.camera.ui, text=message, scale=.8, color=self.engine.color.red)
        else:
            self.error_text.text = message
        self.error_text.enabled = bool(message)
        self.refresh_layout()

    def show_new_game(self, callback):
        if self.new_game_button is None:
            self.new_game_button = self.engine.Button(
                parent=self.engine.camera.ui,
                text="New game",
                color=self.engine.color.azure,
                scale=(.16, .05),
            )
        self.new_game_button.on_click = callback
        self.refresh_layout()

    def reset_game_state(self):
        if self.error_text is not None:
            self.error_text.text = ""
            self.error_text.enabled = False
        if self.action_text is not None:
            self.action_text.text = ""
        if self.skip_button is not None:
            self.engine.destroy(self.skip_button)
            self.skip_button = None
        if self.end_turn_button is not None:
            self.engine.destroy(self.end_turn_button)
            self.end_turn_button = None

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
        for token, rotation in tuple(self.rotations.items()):
            rotation.elapsed = min(.3, rotation.elapsed + delta_time)
            progress = rotation.elapsed / .3
            eased = progress * progress * (3 - 2 * progress)
            target = rotation.target.euler_degrees
            delta = tuple((end - start + 180) % 360 - 180 for start, end in zip(rotation.start_euler, target))
            self.ship_entities[rotation.player].rotation = tuple(
                start + change * eased for start, change in zip(rotation.start_euler, delta)
            )
            if rotation.elapsed >= .3:
                self.ship_entities[rotation.player].rotation = target
                del self.rotations[token]
                try:
                    rotation.callback(token, Lifecycle.COMPLETED)
                except Exception:
                    pass
        for token, attack in tuple(self.attacks.items()):
            attack.elapsed += delta_time
            if isinstance(attack.effect, HitEffect):
                completed = self._update_hit_attack(attack, delta_time)
            else:
                self._update_miss_attack(attack)
                completed = attack.elapsed >= .9
            if completed:
                del self.attacks[token]
                self._destroy_attack_visuals(attack)
                try:
                    attack.callback(token, Lifecycle.COMPLETED)
                except Exception:
                    pass

    def cleanup_flight(self, token):
        self.flights.pop(token, None)

    def start_rotation(self, player, orientation, token, callback):
        if (
            not isinstance(player, Player)
            or not isinstance(orientation, Orientation)
            or not isinstance(token, ActionToken)
            or not callable(callback)
        ):
            raise ValueError("invalid ship rotation presentation values")
        if token in self.rotations or player not in self.ship_entities:
            raise RuntimeError("ship or rotation action is unavailable")
        current = next(ship for ship in self.view.battle.ships if ship.player is player)
        start_euler = self.ship_entities[player].rotation
        self.rotations[token] = _Rotation(player, current.orientation, orientation, token, callback, start_euler)

    def cleanup_rotation(self, token):
        rotation = self.rotations.pop(token, None)
        if rotation is not None and rotation.player in self.ship_entities:
            self.ship_entities[rotation.player].rotation = rotation.before.euler_degrees

    def set_orientation(self, player, orientation):
        if not isinstance(player, Player) or not isinstance(orientation, Orientation):
            raise ValueError("ship orientation requires a player and discrete orientation")
        if any(rotation.player is player for rotation in self.rotations.values()):
            raise RuntimeError("ship orientation cannot change during its rotation presentation")
        entity = self.ship_entities.get(player)
        if entity is None:
            raise RuntimeError("ship visual is unavailable")
        entity.rotation = orientation.euler_degrees

    def start_attack(self, attacker: Ship, defender: Ship, outcome: AttackOutcome, token: ActionToken, callback: PresentationCallback) -> None:
        if (
            not isinstance(attacker, Ship)
            or not isinstance(defender, Ship)
            or attacker.player is defender.player
            or outcome.attacker is not attacker.player
            or outcome.defender is not defender.player
            or not callable(callback)
        ):
            raise ValueError("invalid attack presentation values")
        if token in self.attacks or attacker.player not in self.ship_entities or defender.player not in self.ship_entities:
            raise RuntimeError("ships or attack action are unavailable")
        attacker_cell = attacker.cell
        defender_cell = defender.cell
        projection = self._camera_projection()
        effect_planner = self._effect_planner(projection, defender_cell)
        effect = (
            effect_planner.plan_hit(attacker_cell, defender_cell)
            if outcome.hit
            else effect_planner.plan_miss(attacker_cell, defender_cell)
        )
        visuals = []
        try:
            fill, outline = self._create_torpedo(effect.star_radius)
            visuals.extend((fill, outline))
            explosion = self.engine.Entity(
                parent=self.engine.camera.ui,
                model="sphere",
                color=getattr(self.engine.color, "yellow", self.engine.color.white),
                scale=effect.star_radius * 2,
                enabled=False,
            )
            visuals.append(explosion)
            attack = _Attack(attacker.player, defender.player, outcome, token, callback, effect, fill, outline, explosion)
            self.attacks[token] = attack
            initial_point = effect.start if isinstance(effect, HitEffect) else effect.route[0]
            self._set_attack_position(attack, initial_point)
        except Exception:
            self.attacks.pop(token, None)
            for entity in visuals:
                try:
                    self.engine.destroy(entity)
                except Exception:
                    pass
            raise

    def validate_projection(self, token):
        attack = self.attacks.get(token)
        if attack is None:
            return False
        try:
            projection = self._camera_projection()
            attacker = self._ship_cell(attack.attacker)
            defender = self._ship_cell(attack.defender)
            effect_planner = self._effect_planner(projection, defender)
            if isinstance(attack.effect, HitEffect):
                attack.effect = effect_planner.plan_hit(attacker, defender)
            else:
                attack.effect = effect_planner.reproject_miss(
                    attack.effect,
                    attacker,
                    defender,
                    projection,
                )
            return True
        except Exception:
            return False

    def cleanup_attack(self, token):
        attack = self.attacks.pop(token, None)
        if attack is not None:
            self._destroy_attack_visuals(attack)

    def _camera_projection(self):
        scene = self

        class Projection:
            def project(self, cell):
                camera = scene.engine.camera
                world = scene.engine.Vec3(*FlightPlanner.to_position(cell))
                relative = camera.getRelativePoint(scene.engine.scene, world)
                projected = camera.lens.getProjectionMat().xform(
                    scene.engine.Vec4(relative.x, relative.y, relative.z, 1)
                )
                reciprocal_w = 1 / projected[3] if projected[3] > 0 else 1
                return ScreenPoint(
                    projected[0] * reciprocal_w * camera.aspect_ratio / 2,
                    projected[1] * reciprocal_w / 2,
                )

        return Projection()

    def _effect_planner(self, projection, reference_cell):
        aspect = self.engine.camera.aspect_ratio
        bounds = ScreenBounds(-aspect / 2, aspect / 2, -.5, .5)
        neighbors = []
        center = projection.project(reference_cell)
        for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            coordinates = (reference_cell.x + dx, reference_cell.y + dy, reference_cell.z + dz)
            if all(1 <= coordinate <= 5 for coordinate in coordinates):
                neighbor = projection.project(Cell(*coordinates))
                distance = hypot(neighbor.x - center.x, neighbor.y - center.y)
                if distance > 0:
                    neighbors.append(distance)
        if not neighbors:
            raise ValueError("current view does not expose a measurable board cell")
        return CombatEffectPlanner(self.visual_rng, projection, bounds=bounds, cell_diameter=max(neighbors))

    def _ship_cell(self, player):
        return next(ship.cell for ship in self.view.battle.ships if ship.player is player)

    def _create_torpedo(self, radius):
        engine = self.engine
        vertices = CombatEffectPlanner.star_vertices()

        def star_mesh(scale):
            mesh_vertices = [engine.Vec3(0, 0, 0)] + [
                engine.Vec3(point.x * radius * scale, point.y * radius * scale, 0)
                for point in vertices
            ]
            triangles = [(0, index + 1, (index + 1) % len(vertices) + 1) for index in range(len(vertices))]
            return engine.Mesh(vertices=mesh_vertices, triangles=triangles, mode="triangle", static=True)

        outline = engine.Entity(
            parent=engine.camera.ui,
            model=star_mesh(1.16),
            color=getattr(engine.color, "black", engine.color.dark_gray),
            enabled=True,
        )
        try:
            fill = engine.Entity(
                parent=engine.camera.ui,
                model=star_mesh(1.0),
                color=getattr(engine.color, "yellow", engine.color.white),
                enabled=True,
            )
        except Exception:
            try:
                engine.destroy(outline)
            except Exception:
                pass
            raise
        return fill, outline

    @staticmethod
    def _set_attack_position(attack, point):
        position = (point.x, point.y, 0)
        attack.torpedo_fill.position = position
        attack.torpedo_outline.position = position

    def _update_hit_attack(self, attack, delta_time):
        effect = attack.effect
        if attack.elapsed < .65:
            progress = attack.elapsed / .65
            point = ScreenPoint(
                effect.start.x + (effect.contact.x - effect.start.x) * progress,
                effect.start.y + (effect.contact.y - effect.start.y) * progress,
            )
            self._set_attack_position(attack, point)
            visible = int(attack.elapsed * effect.blink_hz * 2) % 2 == 0
            attack.torpedo_fill.enabled = visible
            attack.torpedo_outline.enabled = visible
            attack.explosion.enabled = False
            return False
        else:
            attack.torpedo_fill.enabled = False
            attack.torpedo_outline.enabled = False
            attack.explosion.enabled = True
            attack.explosion.position = (effect.contact.x, effect.contact.y, 0)
            attack.explosion.scale = effect.star_radius * 2 * (1 + attack.elapsed - .65)
            if not attack.explosion_visible:
                attack.explosion_visible = True
                return False
            attack.explosion_elapsed += delta_time
            return attack.explosion_elapsed >= .18

    def _update_miss_attack(self, attack):
        route = attack.effect.route
        lengths = [hypot(b.x - a.x, b.y - a.y) for a, b in zip(route, route[1:])]
        distance = sum(lengths) * min(1.0, attack.elapsed / .9)
        for start, end, length in zip(route, route[1:], lengths):
            if distance <= length:
                fraction = distance / length if length else 1.0
                point = ScreenPoint(
                    start.x + (end.x - start.x) * fraction,
                    start.y + (end.y - start.y) * fraction,
                )
                self._set_attack_position(attack, point)
                break
            distance -= length
        visible = int(attack.elapsed * 12) % 2 == 0
        attack.torpedo_fill.enabled = visible
        attack.torpedo_outline.enabled = visible
        attack.explosion.enabled = False

    def _destroy_attack_visuals(self, attack):
        for entity in (attack.torpedo_fill, attack.torpedo_outline, attack.explosion):
            try:
                self.engine.destroy(entity)
            except Exception:
                pass

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
