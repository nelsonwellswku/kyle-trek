import random
import pytest
from kyle_trek.battle.contracts import ActionToken, RandomStreams, Presentation, Lifecycle, PresentationKind


@pytest.mark.parametrize("generation,action", [(-1, 1), (1, -1), (True, 1), (1, 1.5)])
def test_token_validates_identity(generation, action):
    with pytest.raises(ValueError):
        ActionToken(generation, action)


def test_random_streams_are_distinct():
    rng = random.Random(1)
    with pytest.raises(ValueError):
        RandomStreams(rng, rng)
    assert RandomStreams(rng, random.Random(1)).gameplay is rng


def test_token_identity_distinguishes_callbacks():
    assert ActionToken(1, 2) != ActionToken(2, 2)
    assert ActionToken(1, 2) != ActionToken(1, 3)


def test_presentation_tracks_origin_and_lifecycle():
    token = ActionToken(2, 3)
    p = Presentation(token, PresentationKind.MOVEMENT, Lifecycle.RUNNING, 1.0, 2.5, ())
    assert p.token == token
    assert p.lifecycle is Lifecycle.RUNNING
    with pytest.raises(ValueError):
        Presentation(token, PresentationKind.MOVEMENT, Lifecycle.RUNNING, 2.0, 1.0, ())


@pytest.mark.parametrize("deadline", [float("nan"), float("inf"), -1.0])
def test_presentation_rejects_invalid_timing(deadline):
    with pytest.raises(ValueError):
        Presentation(ActionToken(1, 2), PresentationKind.ATTACK, Lifecycle.RUNNING, 0.0, deadline, ())


@pytest.mark.parametrize("token,kind,lifecycle", [
    (None, PresentationKind.ATTACK, Lifecycle.RUNNING),
    (ActionToken(1, 2), "attack", Lifecycle.RUNNING),
    (ActionToken(1, 2), PresentationKind.ATTACK, "running"),
])
def test_presentation_rejects_invalid_contract_values(token, kind, lifecycle):
    with pytest.raises(ValueError):
        Presentation(token, kind, lifecycle, 0.0, 1.0, ())
