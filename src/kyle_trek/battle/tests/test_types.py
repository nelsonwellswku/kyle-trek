import pytest
from kyle_trek.battle.types import Cell, Phase, Player, Orientation


@pytest.mark.parametrize("coords", [(0, 1, 1), (1, 6, 1), (1, 1, True), (1.0, 1, 1)])
def test_cell_rejects_invalid_coordinates(coords):
    with pytest.raises(ValueError):
        Cell(*coords)


def test_valid_domain_values():
    assert Cell(1, 5, 3).z == 3
    assert Player(1) is Player.ONE
    with pytest.raises(ValueError):
        Player(3)
    assert Orientation.POSITIVE_Y != Orientation.NEGATIVE_Y
    assert Phase.MOVEMENT != Phase.FINISHED
