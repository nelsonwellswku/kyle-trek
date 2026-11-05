from dataclasses import dataclass, replace
from types import MappingProxyType
from typing import Mapping
from kyle_trek.battle.types import Cell, Orientation, Phase, Player


@dataclass(frozen=True)
class Stats:
    agility: int
    strength: int
    constitution: int

    def __post_init__(self) -> None:
        if any(type(score) is not int or not 8 <= score <= 20 for score in (self.agility, self.strength, self.constitution)):
            raise ValueError("scores must be integers in 8..20")

    @staticmethod
    def modifier(score: int) -> int:
        if type(score) is not int or not 8 <= score <= 20:
            raise ValueError("score must be an integer in 8..20")
        return (score - 10) // 2


@dataclass(frozen=True)
class Ship:
    player: Player
    cell: Cell
    orientation: Orientation
    stats: Stats
    hp: int
    starting_hp: int
    ac: int = 12

    def __post_init__(self) -> None:
        if not isinstance(self.player, Player) or not isinstance(self.cell, Cell) or not isinstance(self.orientation, Orientation) or not isinstance(self.stats, Stats):
            raise ValueError("invalid ship values")
        if type(self.hp) is not int or type(self.starting_hp) is not int or self.starting_hp < 1 or not 0 <= self.hp <= self.starting_hp or self.ac != 12:
            raise ValueError("invalid ship hit points or armor class")


@dataclass(init=False)
class Battle:
    generation: int
    _ships: tuple[Ship, Ship]
    active_player: Player = Player.ONE
    phase: Phase = Phase.MOVEMENT
    winner: Player | None = None
    last_outcome: str | None = None

    def __init__(self, generation: int, ships: tuple[Ship, Ship], active_player: Player = Player.ONE, phase: Phase = Phase.MOVEMENT, winner: Player | None = None, last_outcome: str | None = None):
        if type(generation) is not int or generation < 0:
            raise ValueError("invalid generation")
        if len(ships) != 2 or not all(isinstance(ship, Ship) for ship in ships) or {ship.player for ship in ships} != {Player.ONE, Player.TWO} or ships[0].cell == ships[1].cell:
            raise ValueError("battle requires two distinct ships")
        if not isinstance(active_player, Player) or not isinstance(phase, Phase) or (winner is not None and not isinstance(winner, Player)):
            raise ValueError("invalid battle values")
        self.generation = generation
        self._ships = tuple(sorted(ships, key=lambda ship: ship.player.value))
        self.active_player = active_player
        self.phase = phase
        self.winner = winner
        self.last_outcome = last_outcome

    @property
    def ships(self) -> tuple[Ship, Ship]:
        return self._ships

    @property
    def occupancy(self) -> Mapping[Cell, Player]:
        return MappingProxyType({ship.cell: ship.player for ship in self.ships})

    def move_ship(self, player: Player, cell: Cell) -> None:
        if not isinstance(player, Player) or not isinstance(cell, Cell):
            raise ValueError("invalid move")
        if cell in self.occupancy and self.occupancy[cell] != player:
            raise ValueError("cell is occupied")
        self._ships = tuple(replace(ship, cell=cell) if ship.player == player else ship for ship in self.ships)
