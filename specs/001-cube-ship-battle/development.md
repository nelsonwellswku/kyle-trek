# Development evidence

## Red / green / refactor

- Foundation validation increment: `uv run pytest src/kyle_trek/battle/tests/test_types.py src/kyle_trek/battle/tests/test_contracts.py -q` produced the expected behavioral red (9 missing validation failures, 2 passed). Invalid coordinates, action IDs and shared RNG streams were accepted.
- Green: the same command passed 11 tests. Presentation timing increment red: `uv run pytest src/kyle_trek/battle/tests/test_contracts.py -q` failed because a deadline before its start was accepted (1 failed, 6 passed).
- Green: `uv run pytest src/kyle_trek/battle/tests -q` passed 12 tests. No refactor was necessary; the same command is the post-change regression run. Foundation coverage and interfaces remain incomplete.
- Timing finiteness increment red: `uv run pytest src/kyle_trek/battle/tests/test_contracts.py -q` failed because NaN and infinity were accepted (2 failed, 8 passed).
- Green and regression: `uv run pytest src/kyle_trek/battle/tests -q` passed 15 tests. No additional refactor performed.
- Presentation contract red: `uv run pytest src/kyle_trek/battle/tests/test_contracts.py -q` failed three assertions because invalid token, kind and lifecycle values were accepted.
- Green and regression: `uv run pytest src/kyle_trek/battle/tests -q` passed 18 tests. The interfaces are kept separate from engine values; no refactor was needed.
- US1 initial red: `uv run pytest src/kyle_trek/battle/tests/test_setup.py src/kyle_trek/inspection/tests/test_inspection.py tests/integration/test_initial_view.py -q --tb=line` had 23 failures and 2 passes. Modifier/validation, 125 cells, orbit and initial view had behavioral failures; setup-dependent tests also failed because setup is still a stub. Re-run those tests once setup exists to distinguish their independent behavioral failures.
- Setup green: `uv run pytest src/kyle_trek/battle/tests/test_setup.py -q` passed 21 tests. With real setup in place, `uv run pytest src/kyle_trek/inspection/tests/test_inspection.py tests/integration/test_initial_view.py -q --tb=line` produced four expected behavioral failures: missing cells, hover information, orbit, and composed scene.
- Inspection green: `uv run pytest src/kyle_trek/inspection/tests/test_inspection.py -q` passed 3 tests. Composition/layer selection red: `uv run pytest tests/integration/test_initial_view.py -q --tb=line` produced two expected assertions (empty axes and absent layer); `uv run pytest -q` then passed 44 tests.
- Engine adapter red: `uv run pytest src/kyle_trek/inspection/tests/test_scene.py -q --tb=line` failed because no selectable layer buttons were created (1 failed, 4 passed).
- Layer buttons green: `uv run pytest src/kyle_trek/inspection/tests/test_scene.py -q` passed 5 tests. Rendering red: the same file with an added board/ship visual test failed because zero of 125 cell entities were created (1 failed, 5 passed).
- Rendering green: `uv run pytest src/kyle_trek/inspection/tests/test_scene.py -q` passed 6 tests. Keyboard controls red: `uv run pytest tests/integration/test_initial_view.py -q --tb=line` failed because the HUD did not show controls (1 failed, 2 passed).
- Controls green: `uv run pytest -q` passed 51 tests. Runtime inspection revealed that Ursina Text defaults to the UI parent; axis-parent regression red: `uv run pytest src/kyle_trek/inspection/tests/test_scene.py -q --tb=short` failed because axis labels were not attached to the 3D scene.
- Axis fix green: `uv run pytest -q` passed 51 tests. A live 466×568 window revealed clipped HUD and layer grid; narrow-layout regression red: `uv run pytest src/kyle_trek/inspection/tests/test_scene.py -q --tb=short` failed because the HUD was outside the visible aspect ratio.
- Layout green: `uv run pytest -q` passed 52 tests. A second live view showed the empty-cell buttons were indistinguishable from the background; contrast regression red: `uv run pytest src/kyle_trek/inspection/tests/test_scene.py -q --tb=short` failed because no empty button used the contrasting color.
- Contrast green: `uv run pytest -q` passed 52 tests. The live view also showed white lattice lines overpowering ships; subdued-grid regression red: `uv run pytest src/kyle_trek/inspection/tests/test_scene.py -q --tb=short` failed because cells used white rather than gray.
- Grid green and regression: `uv run pytest -q` passed 57 tests, including all 125 cells in fake-scene selection and each ship at each depth. A subsequent `timeout 6s uv run python -m kyle_trek` remained running until timeout (exit 124), with no application traceback; the runtime emitted optional Blender/audio and PNG profile warnings.

## Graphical acceptance

Partial: opened the actual Ursina application on a Linux desktop in a 466×568 tiled window. A captured view showed the board, HUD, ship colors and the layer grid after layout/contrast corrections. Full manual hover and click verification of all 125 cells, both ships at each depth, and camera interaction has not been performed. T018 remains open; fake-scene tests and a startup smoke check do not substitute for that acceptance.

## Timing and reference environment

Proposed reference: Linux desktop; CPU, GPU, driver, OS version, display resolution, scaling, and window dimensions not yet specified. Maintainer approval: pending. Missing details and approval block performance acceptance.

Measure monotonic wall-clock time with the application visible and unpaused, recording each individual duration through rendered selectable highlights, visible arrival and attack-choice availability, and displayed outcome and next-turn availability or victory, including recovery paths. See plan.md.

## Statistical sampling

Not yet performed; a predefined sampling plan is required.

## Architecture review

Pending.
