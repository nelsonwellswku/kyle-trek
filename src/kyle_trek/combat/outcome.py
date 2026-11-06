from dataclasses import dataclass

from kyle_trek.battle.types import Player


@dataclass(frozen=True)
class AttackOutcome:
    attacker: Player
    defender: Player
    d20: int
    total: int
    hit: bool
    d8: int | None = None
    damage: int | None = None
    remaining_hp: int | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.attacker, Player) or not isinstance(self.defender, Player) or self.attacker is self.defender:
            raise ValueError("attack outcome requires distinct valid players")
        if type(self.d20) is not int or not 1 <= self.d20 <= 20 or type(self.total) is not int:
            raise ValueError("attack outcome requires a valid d20 and total")
        if not 0 <= self.total <= 25 or self.hit != (self.total >= 12):
            raise ValueError("attack outcome must match the fixed armor-class threshold")
        if type(self.hit) is not bool:
            raise ValueError("attack hit state must be boolean")
        if self.hit:
            if (
                type(self.d8) is not int
                or not 1 <= self.d8 <= 8
                or type(self.damage) is not int
                or self.damage < 0
                or type(self.remaining_hp) is not int
                or self.remaining_hp < 0
            ):
                raise ValueError("hit outcomes require valid damage and remaining hit points")
        elif any(value is not None for value in (self.d8, self.damage, self.remaining_hp)):
            raise ValueError("miss outcomes cannot contain damage values")
