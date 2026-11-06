from itertools import product
from math import cos, radians, sin, sqrt, tan
from types import SimpleNamespace

import pytest

from kyle_trek.inspection.scene import UrsinaScene


def assert_board_and_axes_fit(camera, yaw, pitch):
    yaw, pitch = radians(yaw), radians(pitch)
    outward = (sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch))
    right = (cos(yaw), 0, sin(yaw))
    up = (-sin(yaw) * sin(pitch), cos(pitch), cos(yaw) * sin(pitch))
    distance = sqrt(sum(value ** 2 for value in camera.position))
    horizontal = tan(radians(camera.fov / 2))
    vertical = horizontal / camera.aspect_ratio
    points = tuple(product((-2.5, 2.5), repeat=3)) + (
        (3.2, 2.7, -2.7), (-2.7, -3.2, -2.7), (-2.7, 2.7, 3.2),
    )
    for point in points:
        depth = distance - sum(a * b for a, b in zip(point, outward))
        assert depth > 0
        assert abs(sum(a * b for a, b in zip(point, right))) <= horizontal * depth * .95
        assert abs(sum(a * b for a, b in zip(point, up))) <= vertical * depth * .95


@pytest.mark.parametrize("aspect", [.5, .8, 16 / 9, 3.5])
@pytest.mark.parametrize("yaw,pitch", [(45, 30), (55, 35), (180, -85), (270, 85)])
def test_camera_frames_complete_cube_and_axis_anchors_in_narrow_and_wide_views(aspect, yaw, pitch):
    camera = SimpleNamespace(aspect_ratio=aspect, fov=40, look_at=lambda target: None)
    scene = UrsinaScene(SimpleNamespace(camera=camera))

    scene.set_camera(yaw, pitch)

    assert_board_and_axes_fit(camera, yaw, pitch)


def test_window_resize_reframes_before_projection_validation(monkeypatch):
    import kyle_trek.__main__ as application

    camera = SimpleNamespace(aspect_ratio=.8, fov=40, look_at=lambda target: None)
    scene = UrsinaScene(SimpleNamespace(camera=camera, time=SimpleNamespace(dt=0)))
    scene.set_camera(45, 30)
    monkeypatch.setattr(application, "_scene", scene)
    monkeypatch.setattr(application, "_view", SimpleNamespace(
        inspection=SimpleNamespace(yaw=45, pitch=30), combat_controller=None,
    ))
    camera.aspect_ratio = 3.5

    application.update()

    assert_board_and_axes_fit(camera, 45, 30)
