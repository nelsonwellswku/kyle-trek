from typing import Callable, get_type_hints

from kyle_trek.__main__ import UrsinaScheduler
from kyle_trek.combat.effects import CombatEffectPlanner, ScreenBounds, ScreenPoint


def test_geometry_contracts_expose_project_values_without_implicit_dynamic_arguments():
    assert get_type_hints(CombatEffectPlanner._distance_to_segment) == {
        "point": ScreenPoint,
        "start": ScreenPoint,
        "end": ScreenPoint,
        "return": float,
    }
    assert get_type_hints(CombatEffectPlanner._ray_exit) == {
        "start": ScreenPoint,
        "direction": tuple[float, float],
        "bounds": ScreenBounds,
        "radius": float,
        "return": ScreenPoint,
    }


def test_scheduler_contract_accepts_typed_delays_and_callbacks_with_opaque_handles():
    assert get_type_hints(UrsinaScheduler.call_later) == {
        "delay": float,
        "callback": Callable[[], None],
        "return": object,
    }
    assert get_type_hints(UrsinaScheduler.cancel) == {"handle": object, "return": type(None)}
