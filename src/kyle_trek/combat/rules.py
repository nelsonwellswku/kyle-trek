from kyle_trek.battle.contracts import RandomSource
from kyle_trek.battle.state import Battle
from kyle_trek.battle.types import Player
from kyle_trek.combat.outcome import AttackOutcome


class CombatRules:
    def __init__(self, rng: RandomSource):
        self.rng = rng

    def resolve(self, battle: Battle, attacker: Player) -> AttackOutcome:
        if not isinstance(battle, Battle) or not isinstance(attacker, Player):
            raise ValueError("combat resolution requires a battle and valid attacker")
        attacker_ship = next(ship for ship in battle.ships if ship.player is attacker)
        defender_ship = next(ship for ship in battle.ships if ship.player is not attacker)
        d20 = self.rng.randint(1, 20)
        total = d20 + attacker_ship.stats.modifier(attacker_ship.stats.strength)
        if total < defender_ship.ac:
            return AttackOutcome(attacker, defender_ship.player, d20, total, False)
        d8 = self.rng.randint(1, 8)
        damage = max(0, d8 + attacker_ship.stats.modifier(attacker_ship.stats.strength))
        remaining_hp = max(0, defender_ship.hp - damage)
        return AttackOutcome(attacker, defender_ship.player, d20, total, True, d8, damage, remaining_hp)
