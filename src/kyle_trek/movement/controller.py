from dataclasses import dataclass, replace
from math import isfinite
from typing import Callable, Protocol

from kyle_trek.battle.contracts import ActionToken, Clock, Lifecycle, PresentationCallback
from kyle_trek.battle.state import Battle
from kyle_trek.battle.types import Cell, Phase, Player
from kyle_trek.movement.flight import FlightPlan
from kyle_trek.movement.flight import FlightPlanner
from kyle_trek.movement.reachability import MovementReachability


class MovementPresenter(Protocol):
    def start_flight(
        self,
        player: Player,
        plan: FlightPlan,
        token: ActionToken,
        callback: PresentationCallback,
    ) -> None: ...

    def cleanup_flight(self, token: ActionToken) -> None: ...

    def place_ship(self, player: Player, cell: Cell) -> None: ...


class Scheduler(Protocol):
    def call_later(self, delay: float, callback: Callable[[], None]) -> object: ...

    def cancel(self, handle: object) -> None: ...


@dataclass
class _PendingMove:
    token: ActionToken
    player: Player
    destination: Cell
    deadline: float
    timeout_handle: object | None = None


class MovementController:
    def __init__(
        self,
        battle: Battle,
        presenter: MovementPresenter,
        clock: Clock,
        scheduler: Scheduler,
        on_change: Callable[[], None] = lambda: None,
        on_error: Callable[[str], None] = lambda message: None,
        timeout_seconds: float = 1.5,
        planner: FlightPlanner | None = None,
    ) -> None:
        if not isinstance(battle, Battle):
            raise ValueError("movement controller requires a battle")
        if not isfinite(timeout_seconds) or timeout_seconds <= 0 or timeout_seconds > 1.5:
            raise ValueError("movement deadline must be positive and at most 1.5 seconds")
        self.battle = battle
        self.presenter = presenter
        self.clock = clock
        self.scheduler = scheduler
        self.on_change = on_change
        self.on_error = on_error
        self.timeout_seconds = timeout_seconds
        self.planner = planner or FlightPlanner(duration=min(0.8, timeout_seconds * 0.7))
        self.reachability = MovementReachability()
        self._next_action = 0
        self._pending: _PendingMove | None = None
        self._disposed = False

    @property
    def legal_destinations(self) -> frozenset[Cell]:
        if self._disposed or self.battle.phase is not Phase.MOVEMENT:
            return frozenset()
        return self.reachability.destinations(self.battle)

    @property
    def explanation(self) -> str:
        if self._disposed or self.battle.phase is not Phase.MOVEMENT:
            return ""
        return self.reachability.explanation(self.battle)

    def select_cell(self, cell: Cell, button: str = "left") -> bool:
        if (
            self._disposed
            or button != "left"
            or not isinstance(cell, Cell)
            or self.battle.phase is not Phase.MOVEMENT
            or cell not in self.legal_destinations
        ):
            return False

        player = self.battle.active_player
        ship = next(ship for ship in self.battle.ships if ship.player is player)
        opponent = next(ship for ship in self.battle.ships if ship.player is not player)
        start = ship.cell
        self._next_action += 1
        token = ActionToken(self.battle.generation, self._next_action)
        deadline = self.clock.monotonic() + self.timeout_seconds
        pending = _PendingMove(token, player, cell, deadline)
        self._pending = pending

        self.battle.move_ship(player, cell)
        self.battle.phase = Phase.MOVING
        self._notify_change()

        try:
            reserve = min(0.1, self.timeout_seconds / 4)
            remaining = deadline - self.clock.monotonic()
            pending.timeout_handle = self.scheduler.call_later(
                max(0.0, remaining - reserve),
                lambda token=token: self._timed_out(token),
            )
            if remaining <= reserve:
                raise TimeoutError("movement presentation deadline reserve reached")
            plan = self.planner.plan(start, cell, opponent.cell)
            remaining = deadline - self.clock.monotonic()
            flight_budget = remaining - reserve
            if flight_budget <= 0:
                raise TimeoutError("movement presentation deadline reserve reached")
            if plan.duration > flight_budget:
                plan = replace(plan, duration=flight_budget)
            self.presenter.start_flight(player, plan, token, self._presented)
        except Exception as error:
            self._recover(pending, f"Movement presentation failed: {error}")
        return True

    def skip_movement(self) -> bool:
        if self._disposed or self.battle.phase is not Phase.MOVEMENT or self.legal_destinations:
            return False
        self.battle.phase = Phase.ATTACK_CHOICE
        self._notify_change()
        return True

    def dispose(self) -> None:
        if self._disposed:
            return
        self._disposed = True
        pending = self._pending
        self._pending = None
        if pending is None:
            return
        self._cancel_timeout(pending)
        self._safe_cleanup(pending.token)

    def _presented(self, token: ActionToken, lifecycle: Lifecycle) -> None:
        pending = self._pending
        if (
            pending is None
            or self._disposed
            or token != pending.token
            or token.generation != self.battle.generation
            or self.battle.phase is not Phase.MOVING
        ):
            return
        if lifecycle is Lifecycle.CANCELLED:
            self._discard(pending)
            return
        if not isinstance(lifecycle, Lifecycle):
            self._recover(pending, "Movement presentation returned an invalid lifecycle result.")
            return
        if self.clock.monotonic() >= pending.deadline:
            self._recover(pending, "Movement presentation timed out.")
            return
        if lifecycle is Lifecycle.FAILED:
            self._recover(pending, "Movement presentation failed during playback.")
            return
        try:
            self.presenter.place_ship(pending.player, pending.destination)
        except Exception as error:
            self._recover(pending, f"Movement arrival recovery required: {error}")
            return
        self._complete(pending)

    def _timed_out(self, token: ActionToken) -> None:
        pending = self._pending
        if pending is not None and pending.token == token:
            self._recover(pending, "Movement presentation timed out.")

    def _recover(self, pending: _PendingMove, message: str) -> None:
        if not self._is_current(pending):
            return
        self._pending = None
        self._cancel_timeout(pending)
        self._safe_cleanup(pending.token)
        try:
            self.presenter.place_ship(pending.player, pending.destination)
        except Exception:
            # The committed domain position remains authoritative if visual placement fails.
            pass
        self.battle.phase = Phase.ATTACK_CHOICE
        try:
            self.on_error(message)
        except Exception:
            pass
        self._notify_change()

    def _complete(self, pending: _PendingMove) -> None:
        if not self._is_current(pending):
            return
        self._pending = None
        self._cancel_timeout(pending)
        self.battle.phase = Phase.ATTACK_CHOICE
        self._notify_change()

    def _discard(self, pending: _PendingMove) -> None:
        if not self._is_current(pending):
            return
        self._pending = None
        self._cancel_timeout(pending)
        self._safe_cleanup(pending.token)

    def _is_current(self, pending: _PendingMove) -> bool:
        return (
            self._pending is pending
            and not self._disposed
            and pending.token.generation == self.battle.generation
            and self.battle.phase is Phase.MOVING
        )

    def _cancel_timeout(self, pending: _PendingMove) -> None:
        if pending.timeout_handle is not None:
            try:
                self.scheduler.cancel(pending.timeout_handle)
            except Exception:
                pass

    def _safe_cleanup(self, token: ActionToken) -> None:
        try:
            self.presenter.cleanup_flight(token)
        except Exception:
            pass

    def _notify_change(self) -> None:
        try:
            self.on_change()
        except Exception:
            pass
