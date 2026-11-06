from collections import Counter
from itertools import combinations
from math import exp, lgamma, log
import random

from kyle_trek.battle.contracts import RandomStreams
from kyle_trek.battle.setup import BattleSetup
from kyle_trek.battle.state import Battle, Ship, Stats
from kyle_trek.battle.types import Cell, Orientation, Player
from kyle_trek.combat.effects import CombatEffectPlanner, ScreenBounds, ScreenPoint
from kyle_trek.combat.rules import CombatRules


SAMPLE_SIZE = 20_000
FAMILY_ALPHA = 0.05


class RecordingRandom:
    def __init__(self, seed: int):
        self.source = random.Random(seed)
        self.draws: list[int] = []

    def randint(self, lower: int, upper: int) -> int:
        value = self.source.randint(lower, upper)
        self.draws.append(value)
        return value


class FixedProjection:
    def project(self, cell: Cell) -> ScreenPoint:
        return {
            Cell(1, 3, 3): ScreenPoint(-0.7, 0),
            Cell(5, 3, 3): ScreenPoint(0.35, 0),
        }[cell]


def _regularized_gamma_q(shape: float, value: float) -> float:
    """Return the regularized upper incomplete gamma for chi-square tails."""
    if value <= 0:
        return 1.0
    if value < shape + 1:
        term = total = 1.0 / shape
        current_shape = shape
        for _ in range(1000):
            current_shape += 1
            term *= value / current_shape
            total += term
            if abs(term) <= abs(total) * 1e-14:
                break
        lower = total * exp(-value + shape * log(value) - lgamma(shape))
        return max(0.0, min(1.0, 1.0 - lower))

    tiny = 1e-300
    b = value + 1 - shape
    c = 1 / tiny
    d = 1 / max(abs(b), tiny) * (1 if b >= 0 else -1)
    fraction = d
    for index in range(1, 1001):
        coefficient = -index * (index - shape)
        b += 2
        d = coefficient * d + b
        if abs(d) < tiny:
            d = tiny
        c = b + coefficient / c
        if abs(c) < tiny:
            c = tiny
        d = 1 / d
        change = d * c
        fraction *= change
        if abs(change - 1) <= 1e-14:
            break
    return max(0.0, min(1.0, fraction * exp(-value + shape * log(value) - lgamma(shape))))


def _chi_square_p_value(statistic: float, degrees_of_freedom: int) -> float:
    return _regularized_gamma_q(degrees_of_freedom / 2, statistic / 2)


def _uniformity_p_value(samples: list[object], support: list[object]) -> float:
    counts = Counter(samples)
    expected = len(samples) / len(support)
    statistic = sum((counts[value] - expected) ** 2 / expected for value in support)
    return _chi_square_p_value(statistic, len(support) - 1)


def _independence_p_value(
    first: list[object], second: list[object], first_support: list[object], second_support: list[object]
) -> float:
    rows = Counter(first)
    columns = Counter(second)
    observed = Counter(zip(first, second))
    size = len(first)
    statistic = sum(
        (observed[(row, column)] - rows[row] * columns[column] / size) ** 2
        / (rows[row] * columns[column] / size)
        for row in first_support
        for column in second_support
    )
    degrees = (len(first_support) - 1) * (len(second_support) - 1)
    return _chi_square_p_value(statistic, degrees)


def _holm_rejections(p_values: dict[str, float]) -> list[tuple[str, float, float]]:
    ordered = sorted(p_values.items(), key=lambda item: item[1])
    rejected = []
    for rank, (name, p_value) in enumerate(ordered):
        threshold = FAMILY_ALPHA / (len(ordered) - rank)
        if p_value > threshold:
            break
        rejected.append((name, p_value, threshold))
    return rejected


def collect_sampling_results() -> dict[str, float]:
    setup_rng = RecordingRandom(46061)
    setup = BattleSetup(setup_rng)
    setup_samples: dict[str, list[object]] = {
        "p1_cell": [],
        "p2_cell": [],
        "p1_agility": [],
        "p1_strength": [],
        "p1_constitution": [],
        "p2_agility": [],
        "p2_strength": [],
        "p2_constitution": [],
        "p1_hp_roll": [],
        "p2_hp_roll": [],
    }

    for _ in range(SAMPLE_SIZE):
        draw_start = len(setup_rng.draws)
        battle = setup.create()
        first, second = battle.ships
        setup_samples["p1_cell"].append((first.cell.x, first.cell.y, first.cell.z))
        setup_samples["p2_cell"].append((second.cell.x, second.cell.y, second.cell.z))
        for prefix, ship in (("p1", first), ("p2", second)):
            setup_samples[f"{prefix}_agility"].append(ship.stats.agility)
            setup_samples[f"{prefix}_strength"].append(ship.stats.strength)
            setup_samples[f"{prefix}_constitution"].append(ship.stats.constitution)
        setup_samples["p1_hp_roll"].append(setup_rng.draws[draw_start + 6])
        setup_samples["p2_hp_roll"].append(setup_rng.draws[draw_start + 13])

    eligible_cells = [
        (x, y, z)
        for y_values in ((1, 2), (4, 5))
        for x in range(1, 6)
        for y in y_values
        for z in range(1, 6)
    ]
    uniform_supports: dict[str, list[object]] = {
        "p1_cell": [cell for cell in eligible_cells if cell[1] in (1, 2)],
        "p2_cell": [cell for cell in eligible_cells if cell[1] in (4, 5)],
        **{key: list(range(8, 21)) for key in setup_samples if "_agility" in key or "_strength" in key or "_constitution" in key},
        "p1_hp_roll": list(range(21)),
        "p2_hp_roll": list(range(21)),
    }
    p_values = {
        f"uniform:{name}": _uniformity_p_value(setup_samples[name], support)
        for name, support in uniform_supports.items()
    }

    setup_variables = list(setup_samples)
    for first_name, second_name in combinations(setup_variables, 2):
        p_values[f"independent:{first_name}:{second_name}"] = _independence_p_value(
            setup_samples[first_name],
            setup_samples[second_name],
            uniform_supports[first_name],
            uniform_supports[second_name],
        )

    attacker_cell, defender_cell = Cell(1, 3, 3), Cell(5, 3, 3)
    dice_battle = Battle(
        1,
        (
            Ship(Player.ONE, attacker_cell, Orientation.POSITIVE_Y, Stats(10, 10, 10), 100_000, 100_000),
            Ship(Player.TWO, defender_cell, Orientation.NEGATIVE_Y, Stats(10, 10, 10), 100_000, 100_000),
        ),
    )
    gameplay_rng = RecordingRandom(47048)
    visual_rng = RecordingRandom(47047)
    RandomStreams(gameplay_rng, visual_rng)
    combat = CombatRules(gameplay_rng)
    effects = CombatEffectPlanner(
        visual_rng,
        FixedProjection(),
        bounds=ScreenBounds(-1, 1, -1, 1),
        cell_diameter=0.04,
    )
    angles: list[int] = []
    sides: list[int] = []
    d20_rolls: list[int] = []
    d8_rolls: list[int] = []
    for _ in range(SAMPLE_SIZE):
        miss = effects.plan_miss(attacker_cell, defender_cell)
        outcome = combat.resolve(dice_battle, Player.ONE)
        angles.append(miss.launch_angle_degrees)
        sides.append(miss.side)
        d20_rolls.append(outcome.d20)
        if outcome.d8 is not None:
            d8_rolls.append(outcome.d8)

    p_values.update(
        {
            "uniform:miss_angle": _uniformity_p_value(angles, list(range(10, 36))),
            "uniform:miss_side": _uniformity_p_value(sides, [-1, 1]),
            "uniform:gameplay_d20": _uniformity_p_value(d20_rolls, list(range(1, 21))),
            "uniform:gameplay_d8_on_hit": _uniformity_p_value(d8_rolls, list(range(1, 9))),
            "independent:miss_angle:miss_side": _independence_p_value(
                angles, sides, list(range(10, 36)), [-1, 1]
            ),
            "independent:miss_angle:gameplay_d20": _independence_p_value(
                angles, d20_rolls, list(range(10, 36)), list(range(1, 21))
            ),
            "independent:miss_side:gameplay_d20": _independence_p_value(
                sides, d20_rolls, [-1, 1], list(range(1, 21))
            ),
        }
    )
    return p_values


def test_seeded_random_streams_match_predeclared_uniformity_and_independence_plan():
    p_values = collect_sampling_results()
    rejected = _holm_rejections(p_values)

    assert len(p_values) == 62
    assert not rejected, (
        "predeclared Holm-Bonferroni test rejected hypotheses: "
        f"{rejected}; family={len(p_values)}, alpha={FAMILY_ALPHA}, n={SAMPLE_SIZE}"
    )
