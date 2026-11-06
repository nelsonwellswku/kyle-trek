from typing import Callable, Protocol
from kyle_trek.battle.session import BattleSession
from kyle_trek.battle.state import Battle, Ship, Stats
from kyle_trek.battle.types import Cell, Phase, RotationAxis
from kyle_trek.battle.orientation import OrientationController
from kyle_trek.combat.controller import CombatController
from kyle_trek.inspection.inspection import Inspection
from kyle_trek.movement.controller import MovementController


class Scene(Protocol):
    def show_axes(self, axes: tuple[str, ...]) -> None: ...
    def show_cells(self, cells: tuple[Cell, ...]) -> None: ...
    def show_ships(self, ships: tuple[Ship, Ship]) -> None: ...
    def show_hud(self, text: str) -> None: ...
    def set_camera(self, yaw: float, pitch: float) -> None: ...
    def show_layer(
        self,
        layer: int,
        cells: tuple[Cell, ...],
        legal_destinations: frozenset[Cell] = frozenset(),
    ) -> None: ...
    def show_inspection(self, text: str) -> None: ...
    def show_action_prompt(
        self,
        text: str,
        skip_callback: Callable[[], bool] | None = None,
        end_turn_callback: Callable[[], bool] | None = None,
    ) -> None: ...
    def show_error(self, message: str) -> None: ...
    def show_new_game(self, callback: Callable[[], bool]) -> None: ...


class InitialView:
    def __init__(self, battle: Battle, scene: Scene):
        self.battle = battle
        self.inspection = Inspection(battle)
        self.scene = scene
        self.selected: Cell | None = None
        self.movement_controller: MovementController | None = None
        self.combat_controller: CombatController | None = None
        self.orientation_controller: OrientationController | None = None
        self.session: BattleSession | None = None

    def render(self) -> None:
        self.scene.show_axes(("X", "Y", "Z"))
        self.scene.show_cells(self.inspection.cells)
        self.scene.show_ships(self.battle.ships)
        self.scene.show_hud(self._hud_text())
        self.scene.set_camera(self.inspection.yaw, self.inspection.pitch)
        self.select_layer(self.inspection.layer)
        if self.session is not None:
            show_new_game = getattr(self.scene, "show_new_game", None)
            if callable(show_new_game):
                show_new_game(self.new_game)
        if self.movement_controller is not None:
            self.refresh_gameplay()

    def bind_movement(self, controller: MovementController) -> None:
        self.movement_controller = controller
        controller.on_change = self.refresh_gameplay
        controller.on_error = self.show_move_error

    def bind_combat(self, controller: CombatController) -> None:
        self.combat_controller = controller
        controller.on_change = self.refresh_gameplay
        controller.on_error = self.show_move_error

    def bind_session(self, session: BattleSession) -> None:
        self.session = session
        session.bind_view(
            on_game_changed=self.install_game,
            on_change=self.refresh_gameplay,
            on_error=self.show_move_error,
        )

    def install_game(
        self,
        battle: Battle,
        movement_controller: MovementController,
        combat_controller: CombatController,
    ) -> None:
        changed_game = self.battle is not battle
        self.battle = battle
        self.inspection = Inspection(battle)
        self.selected = None
        self.movement_controller = movement_controller
        self.combat_controller = combat_controller
        self.orientation_controller = self.session.orientation_controller if self.session is not None else None
        if changed_game:
            reset = getattr(self.scene, "reset_game_state", None)
            if callable(reset):
                reset()
        self.render()

    def new_game(self) -> bool:
        if self.session is None:
            return False
        self.session.new_game()
        return True

    def _hud_text(self) -> str:
        lines = [f"Player {self.battle.active_player.value} — {self.battle.phase.value}"]
        for ship in self.battle.ships:
            scores = ", ".join(
                f"{name} {score} ({Stats.modifier(score):+d})"
                for name, score in (
                    ("AGI", ship.stats.agility),
                    ("STR", ship.stats.strength),
                    ("CON", ship.stats.constitution),
                )
            )
            lines.append(
                f"Player {ship.player.value}: ({ship.cell.x}, {ship.cell.y}, {ship.cell.z}) "
                f"HP {ship.hp}/{ship.starting_hp} AC {ship.ac}\n{scores}"
            )
        if self.battle.last_outcome is not None:
            lines.append(self.battle.last_outcome)
        if self.battle.winner is not None:
            lines.append(f"Player {self.battle.winner.value} wins!")
        lines.append(
            "1–5: Z layer | arrows: orbit\n"
            "x/y/z: +90° | Shift+x/y/z: −90°\n"
            "Hover/left-click: inspect/select | New game: button"
        )
        return "\n".join(lines)

    def select_layer(self, layer: int) -> None:
        self.inspection.select_layer(layer)
        legal = self.movement_controller.legal_destinations if self.movement_controller is not None else frozenset()
        self.scene.show_layer(
            layer,
            tuple(cell for cell in self.inspection.cells if cell.z == layer),
            legal,
        )
        self.scene.show_inspection(f"Layer Z={layer}; hover a cell to inspect")
        if self.movement_controller is not None or self.combat_controller is not None:
            self._refresh_action_prompt()

    def hover(self, cell: Cell) -> None:
        self.scene.show_inspection(self.inspection.hover(cell))

    def select(self, cell: Cell) -> None:
        if not isinstance(cell, Cell) or cell.z != self.inspection.layer:
            raise ValueError("selection must be in the current layer")
        if self.orientation_controller is not None and self.orientation_controller.busy:
            return
        if self.movement_controller is not None and self.battle.phase is Phase.MOVEMENT:
            if self.movement_controller.select_cell(cell, "left"):
                return
        if self.combat_controller is not None and self.battle.phase is Phase.ATTACK_CHOICE:
            if self.combat_controller.attack(cell):
                return
        self.selected = cell
        self.scene.show_inspection(f"Selected {self.inspection.hover(cell)}")

    def refresh_gameplay(self) -> None:
        self.scene.show_hud(self._hud_text())
        if self.battle.phase is not Phase.MOVING:
            self.scene.show_ships(self.battle.ships)
        legal = self.movement_controller.legal_destinations if self.movement_controller is not None else frozenset()
        self.scene.show_layer(
            self.inspection.layer,
            tuple(cell for cell in self.inspection.cells if cell.z == self.inspection.layer),
            legal,
        )
        self._refresh_action_prompt()

    def _refresh_action_prompt(self) -> None:
        if self.movement_controller is None and self.combat_controller is None:
            return
        phase = self.battle.phase
        skip_callback = None
        end_turn_callback = None
        if phase is Phase.MOVEMENT:
            legal_destinations = self.movement_controller.legal_destinations if self.movement_controller is not None else frozenset()
            if legal_destinations:
                text = "Select a highlighted destination to move."
            elif self.movement_controller is None:
                text = "Movement controls are unavailable."
            else:
                text = self.movement_controller.explanation
                skip_callback = self.skip_movement
        elif phase is Phase.MOVING:
            text = f"Player {self.battle.active_player.value} ship is moving…"
        elif phase is Phase.ATTACK_CHOICE:
            text = f"Player {self.battle.active_player.value}: select the opposing ship to attack or End turn."
            if self.combat_controller is not None:
                end_turn_callback = self.end_turn
        elif phase is Phase.FINISHED:
            text = (
                f"Player {self.battle.winner.value} wins! Battle finished."
                if self.battle.winner is not None
                else "Battle finished."
            )
        else:
            text = f"Player {self.battle.active_player.value}: action resolving…"
        if self.combat_controller is None:
            self.scene.show_action_prompt(text, skip_callback)
        else:
            self.scene.show_action_prompt(text, skip_callback, end_turn_callback)

    def skip_movement(self) -> bool:
        return (
            (self.orientation_controller is None or not self.orientation_controller.busy)
            and self.movement_controller is not None
            and self.movement_controller.skip_movement()
        )

    def end_turn(self) -> bool:
        return (
            (self.orientation_controller is None or not self.orientation_controller.busy)
            and self.combat_controller is not None
            and self.combat_controller.end_turn()
        )

    def rotate_ship(self, axis: RotationAxis, direction: int) -> bool:
        if self.orientation_controller is None:
            return False
        return self.orientation_controller.rotate(self.battle.active_player, axis, direction)

    def show_move_error(self, message: str) -> None:
        self.scene.show_error(message)

    def orbit(self, yaw: float, pitch: float) -> None:
        self.inspection.orbit(yaw, pitch)
        self.scene.set_camera(self.inspection.yaw, self.inspection.pitch)
        if self.combat_controller is not None:
            self.combat_controller.camera_changed()

    def handle_key(self, key: str) -> None:
        if key in ("1", "2", "3", "4", "5"):
            self.select_layer(int(key))
        elif key in ("left arrow", "right arrow", "up arrow", "down arrow"):
            delta = {"left arrow": (-10, 0), "right arrow": (10, 0), "up arrow": (0, 10), "down arrow": (0, -10)}[key]
            self.orbit(*delta)
        elif key in ("x", "shift+x", "y", "shift+y", "z", "shift+z"):
            axis = RotationAxis(key[-1].lower())
            self.rotate_ship(axis, -1 if key.startswith("shift+") else 1)


_view: InitialView | None = None
_scene = None


def input(key: str) -> None:
    if _view is not None:
        _view.handle_key(key)


def update() -> None:
    if _scene is not None and _scene.aspect != _scene.engine.camera.aspect_ratio:
        _scene.refresh_layout()
    if _scene is not None:
        _scene.update(_scene.engine.time.dt)


def main() -> None:
    import random
    import ursina
    from kyle_trek.battle.setup import BattleSetup
    from kyle_trek.inspection.scene import UrsinaScene

    class MonotonicClock:
        @staticmethod
        def monotonic() -> float:
            import time
            return time.monotonic()

    class UrsinaScheduler:
        def __init__(self, engine):
            self.engine = engine

        def call_later(self, delay, callback):
            return self.engine.invoke(callback, delay=delay)

        def cancel(self, handle):
            cancel = getattr(handle, "kill", None) or getattr(handle, "pause", None)
            if cancel is not None:
                cancel()

    global _view, _scene
    app = ursina.Ursina()
    ursina.window.title = "Kyle Trek — Battle Inspection"
    ursina.window.fps_counter.enabled = False
    ursina.window.entity_counter.enabled = False
    ursina.window.collider_counter.enabled = False
    visual_rng = random.Random()
    scene = UrsinaScene(ursina, visual_rng=visual_rng)
    _scene = scene
    clock = MonotonicClock()
    scheduler = UrsinaScheduler(ursina)
    session = BattleSession(
        BattleSetup(random.Random()), scene, scene, random.Random(), clock, scheduler
    )
    battle = session.new_game()
    _view = InitialView(battle, scene)
    scene.bind(_view)
    _view.bind_session(session)
    try:
        app.run()
    finally:
        session.dispose()


if __name__ == "__main__":
    main()
