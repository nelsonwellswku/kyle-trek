from dataclasses import dataclass
from enum import Enum
from math import isfinite
from typing import Protocol


class RandomSource(Protocol):
    def randint(self, a: int, b: int) -> int: ...


class Clock(Protocol):
    def monotonic(self) -> float: ...


class PresentationCallback(Protocol):
    def __call__(self, token: "ActionToken", lifecycle: "Lifecycle") -> None: ...


@dataclass(frozen=True)
class ActionToken:
    generation: int
    action: int

    def __post_init__(self) -> None:
        if any(type(value) is not int or value < 0 for value in (self.generation, self.action)):
            raise ValueError("generation and action must be nonnegative integers")


class Lifecycle(Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PresentationKind(Enum):
    MOVEMENT = "movement"
    ROTATION = "rotation"
    ATTACK = "attack"


@dataclass(frozen=True)
class Presentation:
    token: ActionToken
    kind: PresentationKind
    lifecycle: Lifecycle
    started_at: float
    deadline: float
    handles: tuple[str, ...]

    def __post_init__(self) -> None:
        if not isinstance(self.token, ActionToken) or not isinstance(self.kind, PresentationKind) or not isinstance(self.lifecycle, Lifecycle):
            raise ValueError("invalid presentation identity, kind or lifecycle")
        if not isfinite(self.started_at) or not isfinite(self.deadline) or self.deadline < self.started_at:
            raise ValueError("presentation timing must be finite and ordered")


@dataclass(frozen=True)
class RandomStreams:
    gameplay: RandomSource
    visual: RandomSource

    def __post_init__(self) -> None:
        if self.gameplay is self.visual:
            raise ValueError("gameplay and visual random sources must be distinct")
