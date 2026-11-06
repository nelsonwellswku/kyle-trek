from dataclasses import dataclass
from math import isfinite
from typing import Callable, Protocol

from kyle_trek.battle.contracts import ActionToken, Clock, Lifecycle, PresentationCallback, RandomSource
from kyle_trek.battle.state import Battle, Ship
from kyle_trek.battle.types import Cell, Phase, Player
from kyle_trek.combat.outcome import AttackOutcome
from kyle_trek.combat.rules import CombatRules


class CombatPresenter(Protocol):
    def start_attack(
        self,
        attacker: Ship,
        defender: Ship,
        outcome: AttackOutcome,
        token: ActionToken,
        callback: PresentationCallback,
    ) -> None: ...

    def cleanup_attack(self, token: ActionToken) -> None: ...

    def validate_projection(self, token: ActionToken) -> bool: ...


class Scheduler(Protocol):
    def call_later(self, delay: float, callback: Callable[[], None]) -> object: ...

    def cancel(self, handle: object) -> None: ...


@dataclass
class _PendingAttack:
    token: ActionToken
    outcome: AttackOutcome
    deadline: float
    timeout_handle: object | None = None
    applied: bool = False


class CombatController:
    def __init__(
        self,
        battle: Battle,
        presenter: CombatPresenter,
        rng: RandomSource,
        clock: Clock,
        scheduler: Scheduler,
        on_change: Callable[[], None] = lambda: None,
        on_error: Callable[[str], None] = lambda message: None,
        timeout_seconds: float = 1.5,
        input_locked: Callable[[], bool] = lambda: False,
    ):
        if not isinstance(battle, Battle):
            raise ValueError("combat controller requires a battle")
        if not isfinite(timeout_seconds) or timeout_seconds <= 0 or timeout_seconds > 1.5:
            raise ValueError("combat deadline must be positive and at most 1.5 seconds")
        self.battle = battle
        self.presenter = presenter
        self.rules = CombatRules(rng)
        self.clock = clock
        self.scheduler = scheduler
        self.on_change = on_change
        self.on_error = on_error
        self.input_locked = input_locked
        self.timeout_seconds = timeout_seconds
        self._next_action = 0
        self._pending: _PendingAttack | None = None
        self._disposed = False

    def attack(self, target: Cell) -> bool:
        if (
            self._disposed
            or self.input_locked()
            or not isinstance(target, Cell)
            or self.battle.phase is not Phase.ATTACK_CHOICE
            or self.battle.winner is not None
        ):
            return False
        attacker = next(ship for ship in self.battle.ships if ship.player is self.battle.active_player)
        defender = next(ship for ship in self.battle.ships if ship.player is not self.battle.active_player)
        if target != defender.cell:
            return False

        started_at = self.clock.monotonic()
        outcome = self.rules.resolve(self.battle, attacker.player)
        self._next_action += 1
        token = ActionToken(self.battle.generation, self._next_action)
        deadline = started_at + self.timeout_seconds
        pending = _PendingAttack(token, outcome, deadline)
        self._pending = pending
        self.battle.phase = Phase.ATTACKING
        self._notify_change()

        try:
            reserve = min(0.1, self.timeout_seconds / 4)
            remaining = deadline - self.clock.monotonic()
            pending.timeout_handle = self.scheduler.call_later(
                max(0.0, remaining - reserve),
                lambda token=token: self._timed_out(token),
            )
            if remaining <= reserve:
                raise TimeoutError("attack presentation deadline reserve reached")
            self.presenter.start_attack(attacker, defender, outcome, token, self._presented)
        except Exception as error:
            self._recover(pending, f"Attack presentation failed: {error}")
        return True

    def end_turn(self) -> bool:
        if self._disposed or self.input_locked() or self.battle.phase is not Phase.ATTACK_CHOICE or self.battle.winner is not None:
            return False
        self.battle.active_player = Player.TWO if self.battle.active_player is Player.ONE else Player.ONE
        self.battle.phase = Phase.MOVEMENT
        self.battle.last_outcome = f"Player {self.battle.active_player.value} begins their turn."
        self._notify_change()
        return True

    def camera_changed(self) -> None:
        pending = self._pending
        if pending is None or not self._is_current(pending):
            return
        try:
            valid = self.presenter.validate_projection(pending.token)
        except Exception:
            valid = False
        if not valid:
            self._recover(pending, "Attack presentation could not adapt to the current camera view.")

    def dispose(self) -> None:
        if self._disposed:
            return
        self._disposed = True
        pending = self._pending
        self._pending = None
        if pending is not None:
            self._cancel_timeout(pending)
            self._safe_cleanup(pending.token)

    def _presented(self, token: ActionToken, lifecycle: Lifecycle) -> None:
        pending = self._pending
        if (
            pending is None
            or self._disposed
            or token != pending.token
            or token.generation != self.battle.generation
            or self.battle.phase is not Phase.ATTACKING
        ):
            return
        if lifecycle is Lifecycle.CANCELLED:
            self._discard(pending)
            return
        if not isinstance(lifecycle, Lifecycle):
            self._recover(pending, "Attack presentation returned an invalid lifecycle result.")
            return
        if self.clock.monotonic() >= pending.deadline:
            self._recover(pending, "Attack presentation timed out.")
            return
        if lifecycle is Lifecycle.FAILED:
            self._recover(pending, "Attack presentation failed during playback.")
            return
        self._complete(pending)

    def _timed_out(self, token: ActionToken) -> None:
        pending = self._pending
        if pending is not None and pending.token == token:
            self._recover(pending, "Attack presentation timed out.")

    def _recover(self, pending: _PendingAttack, message: str) -> None:
        if not self._is_current(pending):
            return
        self._safe_cleanup(pending.token)
        self._resolve(pending, message)

    def _complete(self, pending: _PendingAttack) -> None:
        if not self._is_current(pending):
            return
        self._resolve(pending, None)

    def _resolve(self, pending: _PendingAttack, error: str | None) -> None:
        if not self._is_current(pending) or pending.applied:
            return
        pending.applied = True
        self._pending = None
        self._cancel_timeout(pending)
        outcome = pending.outcome
        if outcome.hit:
            assert outcome.remaining_hp is not None
            self.battle.set_ship_hp(outcome.defender, outcome.remaining_hp)
        self.battle.last_outcome = self._format_outcome(outcome)
        if outcome.hit and outcome.remaining_hp == 0:
            self.battle.winner = outcome.attacker
            self.battle.phase = Phase.FINISHED
        else:
            self.battle.active_player = Player.TWO if outcome.attacker is Player.ONE else Player.ONE
            self.battle.phase = Phase.MOVEMENT
        if error is not None:
            try:
                self.on_error(error)
            except Exception:
                pass
        self._notify_change()

    def _discard(self, pending: _PendingAttack) -> None:
        if not self._is_current(pending):
            return
        self._pending = None
        self._cancel_timeout(pending)
        self._safe_cleanup(pending.token)

    def _is_current(self, pending: _PendingAttack) -> bool:
        return (
            self._pending is pending
            and not self._disposed
            and pending.token.generation == self.battle.generation
            and self.battle.phase is Phase.ATTACKING
        )

    def _cancel_timeout(self, pending: _PendingAttack) -> None:
        if pending.timeout_handle is not None:
            try:
                self.scheduler.cancel(pending.timeout_handle)
            except Exception:
                pass

    def _safe_cleanup(self, token: ActionToken) -> None:
        try:
            self.presenter.cleanup_attack(token)
        except Exception:
            pass

    def _notify_change(self) -> None:
        try:
            self.on_change()
        except Exception:
            pass

    @staticmethod
    def _format_outcome(outcome: AttackOutcome) -> str:
        if not outcome.hit:
            return f"Miss — attack total {outcome.total}."
        return (
            f"Hit — attack total {outcome.total}; damage {outcome.damage}; "
            f"Player {outcome.defender.value} HP {outcome.remaining_hp}."
        )
