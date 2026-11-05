from kyle_trek.battle.contracts import RandomSource
from uuid import uuid4
from kyle_trek.battle.state import Battle, Ship, Stats
from kyle_trek.battle.types import Cell, Orientation, Player


class BattleSetup:
    def __init__(self, rng: RandomSource):
        self.rng = rng

    def create(self) -> Battle:
        ships = []
        for player, y_range, orientation in ((Player.ONE, (1, 2), Orientation.POSITIVE_Y), (Player.TWO, (4, 5), Orientation.NEGATIVE_Y)):
            cell = Cell(self.rng.randint(1, 5), self.rng.randint(*y_range), self.rng.randint(1, 5))
            stats = Stats(*(self.rng.randint(8, 20) for _ in range(3)))
            hp = max(1, self.rng.randint(0, 20) + 2 * Stats.modifier(stats.constitution))
            ships.append(Ship(player, cell, orientation, stats, hp, hp))
        return Battle(uuid4().int, (ships[0], ships[1]))
