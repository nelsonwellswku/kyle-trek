from collections.abc import Callable
from typing import Protocol, cast

from kyle_trek.battle.contracts import Clock, RandomSource
from kyle_trek.battle.orientation import OrientationController, RotationPresenter
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.state import Battle
from kyle_trek.combat.controller import CombatController, CombatPresenter
from kyle_trek.movement.controller import MovementController, MovementPresenter


class SessionScheduler(Protocol):
    def call_later(self, delay: float, callback: Callable[[], None]) -> object: ...

    def cancel(self, handle: object) -> None: ...


class BattleSession:
    def __init__(
        self,
        setup: BattleSetup,
        movement_presenter: MovementPresenter,
        combat_presenter: CombatPresenter,
        combat_rng: RandomSource,
        clock: Clock,
        scheduler: SessionScheduler,
        orientation_presenter: RotationPresenter | None = None,
    ) -> None:
        self.setup = setup
        self.movement_presenter = movement_presenter
        self.combat_presenter = combat_presenter
        self.combat_rng = combat_rng
        self.clock = clock
        self.scheduler = scheduler
        self.orientation_presenter = (
            orientation_presenter
            if orientation_presenter is not None
            else cast(RotationPresenter, movement_presenter)
        )
        self.battle: Battle | None = None
        self.movement_controller: MovementController | None = None
        self.combat_controller: CombatController | None = None
        self.orientation_controller: OrientationController | None = None
        self._disposed = False
        self._on_game_changed: Callable[[Battle, MovementController, CombatController], None] = (
            lambda battle, movement, combat: None
        )
        self._on_change: Callable[[], None] = lambda: None
        self._on_error: Callable[[str], None] = lambda message: None

    def bind_view(
        self,
        *,
        on_game_changed: Callable[[Battle, MovementController, CombatController], None],
        on_change: Callable[[], None],
        on_error: Callable[[str], None],
    ) -> None:
        self._on_game_changed = on_game_changed
        self._on_change = on_change
        self._on_error = on_error
        if self.battle is not None and self.movement_controller is not None and self.combat_controller is not None:
            self._on_game_changed(self.battle, self.movement_controller, self.combat_controller)

    def new_game(self) -> Battle:
        if self._disposed:
            raise RuntimeError("a disposed battle session cannot start another game")

        previous_battle = self.battle
        previous_movement = self.movement_controller
        previous_combat = self.combat_controller
        previous_orientation = self.orientation_controller
        if previous_battle is not None:
            # Invalidate every outstanding token before cleanup can dispatch callbacks.
            previous_battle.generation += 1
            self.battle = None
            self.movement_controller = None
            self.combat_controller = None
            self.orientation_controller = None
            if previous_movement is not None:
                previous_movement.dispose()
            if previous_combat is not None:
                previous_combat.dispose()
            if previous_orientation is not None:
                previous_orientation.dispose()

        battle = self.setup.create()
        self.battle = battle
        orientation_controller = OrientationController(
            battle,
            self.orientation_presenter,
            on_change=lambda battle=battle: self._notify_change(battle),
            on_error=lambda message, battle=battle: self._report_error(battle, message),
        )
        self.orientation_controller = orientation_controller
        input_locked = lambda: orientation_controller.busy
        movement_controller = MovementController(
            battle,
            self.movement_presenter,
            self.clock,
            self.scheduler,
            on_change=lambda battle=battle: self._notify_change(battle),
            on_error=lambda message, battle=battle: self._report_error(battle, message),
            input_locked=input_locked,
        )
        combat_controller = CombatController(
            battle,
            self.combat_presenter,
            self.combat_rng,
            self.clock,
            self.scheduler,
            on_change=lambda battle=battle: self._notify_change(battle),
            on_error=lambda message, battle=battle: self._report_error(battle, message),
            input_locked=input_locked,
        )
        self.movement_controller = movement_controller
        self.combat_controller = combat_controller
        self._on_game_changed(battle, movement_controller, combat_controller)
        return battle

    def dispose(self) -> None:
        if self._disposed:
            return
        self._disposed = True
        battle = self.battle
        movement = self.movement_controller
        combat = self.combat_controller
        orientation = self.orientation_controller
        if battle is not None:
            battle.generation += 1
        self.battle = None
        self.movement_controller = None
        self.combat_controller = None
        self.orientation_controller = None
        if movement is not None:
            movement.dispose()
        if combat is not None:
            combat.dispose()
        if orientation is not None:
            orientation.dispose()

    def _notify_change(self, battle: Battle) -> None:
        if self._is_current(battle):
            self._on_change()

    def _report_error(self, battle: Battle, message: str) -> None:
        if self._is_current(battle):
            self._on_error(message)

    def _is_current(self, battle: Battle) -> bool:
        return not self._disposed and self.battle is battle
