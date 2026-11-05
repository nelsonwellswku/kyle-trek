# Quickstart and Validation

These are implementation targets, not commands verified against the current planning-only checkout. Run them after the Python application and `pyproject.toml` have been implemented.

## Prerequisites and setup

- Python 3.12, [uv](https://docs.astral.sh/uv/), and a Linux graphical desktop with working 3D acceleration.
- From the repository root, run `uv sync`, then `uv run python -m kyle_trek`.
- Run automated tests with `uv run pytest`. Commit `uv.lock` and use `uv sync --locked` to reproduce the resolved environment once the lockfile exists.

## Acceptance scenarios

1. Start a game: verify the perspective cube, axes, 125 cells, ship coordinates, stats, HP, AC and Player 1 movement phase. Orbit and use each depth layer; hover and directly select cells at every depth, including both ships. State must not change from inspection alone.
2. Using deterministic test setups, verify highlighted cells exactly match obstacle-aware breadth-first reachability, including detours, cube boundaries, zero allowance and blocked starts. Left-click a legal cell; flight stays in-bounds, visually avoids the other ship, arrives within 1.5 seconds and then enables attack. Non-left/invalid clicks do nothing. With no move available, skip explicitly without handing off.
3. Rotate the active ship ±90° about each axis and confirm persistence with no other state change; attempt opponent rotation and input during animations and after victory. Orbit must never rotate ships.
4. Force hit, miss, zero-damage and lethal outcomes. Confirm attack totals, torpedo, explosion-before-damage, miss clearance and exit, result, correct HP and exactly one handoff or victory. Measure the 1.5-second deadline, including injected start and mid-playback presentation failures; confirm failure displays the previously rolled result without rerolling.
5. Restart during flight and each combat presentation, then deliver stale callbacks and repeated input. New state must remain unchanged, with Player 1 active, default orientations and no stale effects. Exercise disposal similarly.
6. Run seeded boundary and distribution tests for setup, rolls, miss angle/side and stream independence with a predefined statistical sampling plan and 5% significance threshold. Record sample counts and test outcomes. Measure highlight latency (≤300 ms) and animation deadlines on a supported display; retain graphical and first-time-player usability results separately from unit tests. At least 90% of usability participants must complete the spec's listed actions unaided.

For each implementation increment, record the pytest command and expected behavioral failure before code changes, then the passing command after implementation and after refactoring. A dependency or setup failure is not a valid red test. Review feature ownership, types and composition before acceptance. See [UI contract](contracts/game-ui.md) and [data model](data-model.md).
