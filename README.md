# Kyle Trek — Three-Dimensional Ship Battle

Kyle Trek is planned as a local two-player Python game played in a 5 × 5 × 5 cube. Players move their ships, then attack with a photo torpedo or end their turn. The [feature specification](specs/001-cube-ship-battle/spec.md) describes the complete rules.

## Project status

The Python application is **not yet implemented** in this checkout. The previous browser-based documentation does not describe the planned application. See the [implementation plan](specs/001-cube-ship-battle/plan.md) and [validation guide](specs/001-cube-ship-battle/quickstart.md).

## Planned Python setup

The implementation will use Python 3.12, [uv](https://docs.astral.sh/uv/) for the virtual environment and package management, [Ursina](https://www.ursinaengine.org/) for 3D rendering and game mechanics, and [pytest](https://docs.pytest.org/) for tests. A Linux graphical desktop with working 3D acceleration is the initial target.

Once the project configuration and application are implemented, the intended commands from the repository root are:

```sh
uv sync
uv run python -m kyle_trek
uv run pytest
```

These commands are not yet runnable in this planning-only checkout. The implementation will document the final controls and any additional setup requirements here.
