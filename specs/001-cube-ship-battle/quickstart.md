# Quickstart and Validation

Setup, inspection and movement are implemented. Combat, ship rotation and restart remain implementation targets; manual full-board inspection and real-display movement/timing acceptance are still outstanding. See `tasks.md` for progress.

## Prerequisites and setup

- Python 3.12, [uv](https://docs.astral.sh/uv/), and a Linux graphical desktop with working 3D acceleration.
- From the repository root, run `uv sync`, then `uv run python -m kyle_trek`.
- Run automated tests with `uv run pytest`. Commit `uv.lock` and use `uv sync --locked` to reproduce the resolved environment once the lockfile exists.

## Performance acceptance protocol

Before timing acceptance, record the Linux reference environment and maintainer approval in `development.md`: CPU, GPU, graphics driver, OS, display resolution, scaling and application window dimensions. Missing values or approval block performance acceptance; do not substitute invented hardware values.

Keep the application visible and unpaused. Use monotonic elapsed wall-clock time and record the measurement method and each observed duration, not only averages. Measure highlights from initial setup or prior-action resolution with input available through the rendered/selectable legal-destination set (≤300 ms); movement from accepted selection through visible arrival and attack-choice availability (≤1.5 s); and attacks from launch through displayed results and next-turn availability or victory (≤1.5 s). Include failure recovery and camera changes without restarting deadlines. Fake-clock tests supplement, but do not establish, real-display timing acceptance. See [plan.md](plan.md#presentation-recovery-and-performance-acceptance).

## Acceptance scenarios

1. Start a game: verify the perspective cube, axes, 125 cells, ship coordinates, stats, HP, AC and Player 1 movement phase. Orbit and use each depth layer; hover and directly select cells at every depth, including both ships. State must not change from inspection alone.
2. Using deterministic test setups, verify highlighted cells exactly match obstacle-aware breadth-first reachability, including detours, cube boundaries, zero allowance and blocked starts. Left-click a legal cell; normal flight stays in-bounds, visually avoids the other ship, arrives within 1.5 seconds and then enables attack. Inject launch failure, mid-flight failure and timeout: transient effects clear, the ship visibly appears at the committed destination without unsafe intermediate flight, a readable error appears and attack-choice becomes available once within the original deadline. Deliver duplicate/late callbacks and verify no second resolution. Non-left/invalid clicks do nothing. With no move available, skip explicitly without handing off.
3. Rotate the active ship ±90° about each axis and confirm persistence with no other state change; attempt opponent rotation and input during animations and after victory. Orbit must never rotate ships.
4. Force hit, miss, zero-damage and lethal outcomes. Confirm attack totals, torpedo, explosion-before-damage, miss clearance and exit, result, correct HP and exactly one handoff or victory. Orbit the camera immediately after launch and before closest approach, including depth-aligned ships and screen-edge defenders; verify current-projection constraints without resampling the miss angle/side. Measure the 1.5-second deadline, including injected start/mid-playback failures and infeasible reprojection; failure must display the previously rolled result and resolve once without rerolling or restarting the deadline.
5. Restart during flight and each combat presentation, including before pending movement-failure recovery runs, then deliver stale completion, failure and timeout callbacks and repeated input. New state must remain unchanged, with Player 1 active, default orientations and no stale placement, errors or effects. Exercise disposal similarly; cancellation must discard the pending action rather than resolve it.
6. Run seeded boundary and distribution tests for setup, rolls, miss angle/side and stream independence with a predefined statistical sampling plan and 5% significance threshold. Record sample counts and test outcomes. Apply the performance protocol above; retain graphical and first-time-player usability results separately from unit tests. At least 90% of usability participants must complete the spec's listed actions unaided.

For each implementation increment, record the pytest command and expected behavioral failure before code changes, then the passing command after implementation and after refactoring. A dependency or setup failure is not a valid red test. Review feature ownership, types and composition before acceptance. See [UI contract](contracts/game-ui.md) and [data model](data-model.md).
