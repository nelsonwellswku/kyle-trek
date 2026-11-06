from dataclasses import dataclass
from typing import Callable, Protocol

from kyle_trek.battle.contracts import ActionToken, Lifecycle, PresentationCallback
from kyle_trek.battle.state import Battle
from kyle_trek.battle.types import Orientation, Phase, Player, RotationAxis


class RotationPresenter(Protocol):
    def start_rotation(
        self,
        player: Player,
        orientation: Orientation,
        token: ActionToken,
        callback: PresentationCallback,
    ) -> None: ...

    def cleanup_rotation(self, token: ActionToken) -> None: ...

    def set_orientation(self, player: Player, orientation: Orientation) -> None: ...


@dataclass
class _PendingRotation:
    player: Player
    orientation: Orientation
    token: ActionToken


class OrientationController:
    def __init__(
        self,
        battle: Battle,
        presenter: RotationPresenter,
        on_change: Callable[[], None] = lambda: None,
        on_error: Callable[[str], None] = lambda message: None,
    ) -> None:
        self.battle = battle
        self.presenter = presenter
        self.on_change = on_change
        self.on_error = on_error
        self._next_action = 0
        self._pending: _PendingRotation | None = None
        self._disposed = False

    @property
    def busy(self) -> bool:
        return self._pending is not None

    def rotate(self, player: Player, axis: RotationAxis, direction: int) -> bool:
        if (
            self._disposed
            or self._pending is not None
            or not isinstance(player, Player)
            or player is not self.battle.active_player
            or self.battle.phase not in (Phase.MOVEMENT, Phase.ATTACK_CHOICE)
            or self.battle.winner is not None
        ):
            return False
        ship = next(ship for ship in self.battle.ships if ship.player is player)
        try:
            orientation = ship.orientation.rotated(axis, direction)
        except ValueError:
            return False

        self._next_action += 1
        token = ActionToken(self.battle.generation, self._next_action)
        pending = _PendingRotation(player, orientation, token)
        self._pending = pending
        self._notify_change()
        try:
            self.presenter.start_rotation(player, orientation, token, self._presented)
        except Exception as error:
            self._recover(pending, f"Ship rotation presentation failed: {error}")
        return True

    def dispose(self) -> None:
        if self._disposed:
            return
        self._disposed = True
        pending = self._pending
        self._pending = None
        if pending is not None:
            self._safe_cleanup(pending.token)

    def _presented(self, token: ActionToken, lifecycle: Lifecycle) -> None:
        pending = self._pending
        if (
            pending is None
            or self._disposed
            or token != pending.token
            or token.generation != self.battle.generation
        ):
            return
        if not self._can_rotate(pending.player):
            self._discard(pending)
            return
        if lifecycle is Lifecycle.CANCELLED:
            self._discard(pending)
            return
        if lifecycle is not Lifecycle.COMPLETED:
            message = (
                "Ship rotation presentation returned an invalid lifecycle result."
                if not isinstance(lifecycle, Lifecycle)
                else "Ship rotation presentation failed during playback."
            )
            self._recover(pending, message)
            return
        try:
            self.presenter.set_orientation(pending.player, pending.orientation)
        except Exception as error:
            self._recover(pending, f"Ship rotation presentation failed: {error}")
            return
        self.battle.set_ship_orientation(pending.player, pending.orientation)
        self._pending = None
        self._notify_change()

    def _can_rotate(self, player: Player) -> bool:
        return (
            not self._disposed
            and self.battle.active_player is player
            and self.battle.phase in (Phase.MOVEMENT, Phase.ATTACK_CHOICE)
            and self.battle.winner is None
        )

    def _recover(self, pending: _PendingRotation, message: str) -> None:
        if not self._is_current(pending):
            return
        self._pending = None
        self._safe_cleanup(pending.token)
        try:
            self.presenter.set_orientation(
                pending.player,
                next(ship.orientation for ship in self.battle.ships if ship.player is pending.player),
            )
        except Exception:
            pass
        try:
            self.on_error(message)
        except Exception:
            pass
        self._notify_change()

    def _discard(self, pending: _PendingRotation) -> None:
        if not self._is_current(pending):
            return
        self._pending = None
        self._safe_cleanup(pending.token)
        self._notify_change()

    def _is_current(self, pending: _PendingRotation) -> bool:
        return (
            self._pending is pending
            and not self._disposed
            and pending.token.generation == self.battle.generation
        )

    def _safe_cleanup(self, token: ActionToken) -> None:
        try:
            self.presenter.cleanup_rotation(token)
        except Exception:
            pass

    def _notify_change(self) -> None:
        try:
            self.on_change()
        except Exception:
            pass
