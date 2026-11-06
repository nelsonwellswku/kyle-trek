from collections import deque

from kyle_trek.battle.state import Battle
from kyle_trek.battle.types import Cell, Player


class MovementReachability:
    def destinations(
        self,
        battle: Battle,
        player: Player | None = None,
        allowance: int | None = None,
    ) -> frozenset[Cell]:
        if not isinstance(battle, Battle):
            raise ValueError("movement requires a battle")
        player = battle.active_player if player is None else player
        if not isinstance(player, Player):
            raise ValueError("movement requires a valid player")

        ship = next(ship for ship in battle.ships if ship.player is player)
        opponent = next(ship for ship in battle.ships if ship.player is not player)
        if allowance is None:
            allowance = max(0, (ship.stats.agility - 10) // 2)
        elif type(allowance) is not int:
            raise ValueError("movement allowance must be an integer")
        allowance = max(0, allowance)
        if allowance == 0:
            return frozenset()

        distances = {ship.cell: 0}
        pending = deque([ship.cell])
        while pending:
            cell = pending.popleft()
            distance = distances[cell]
            if distance == allowance:
                continue
            for neighbor in self._neighbors(cell):
                if neighbor == opponent.cell or neighbor in distances:
                    continue
                distances[neighbor] = distance + 1
                pending.append(neighbor)

        return frozenset(
            cell for cell, distance in distances.items() if 0 < distance <= allowance
        )

    def explanation(
        self,
        battle: Battle,
        player: Player | None = None,
        allowance: int | None = None,
    ) -> str:
        player = battle.active_player if player is None else player
        ship = next(ship for ship in battle.ships if ship.player is player)
        resolved_allowance = (
            max(0, (ship.stats.agility - 10) // 2)
            if allowance is None
            else max(0, allowance)
        )
        if self.destinations(battle, player, resolved_allowance):
            return ""
        if resolved_allowance == 0:
            modifier = (ship.stats.agility - 10) // 2
            return f"No movement allowance (Agility modifier {modifier:+d}); skip movement to continue."
        return "No unoccupied destination is reachable within the movement allowance; skip movement to continue."

    @staticmethod
    def _neighbors(cell: Cell) -> tuple[Cell, ...]:
        result = []
        for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            point = (cell.x + dx, cell.y + dy, cell.z + dz)
            if all(1 <= coordinate <= 5 for coordinate in point):
                result.append(Cell(*point))
        return tuple(result)
