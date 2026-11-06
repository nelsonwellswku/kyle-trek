# Kyle Trek — Three-Dimensional Ship Battle

Kyle Trek is a local two-player Python game in development, played in a 5 × 5 × 5 cube. The [feature specification](specs/001-cube-ship-battle/spec.md) describes the planned complete rules.

## Project status

The current prototype creates a battle, supports inspection of its cells and ships, and implements movement with explicit skip when no destination is available. Combat, ship rotation and restart are not implemented yet. Movement reaches an attack-choice phase, but those combat choices are not wired until the combat story. See the [implementation plan](specs/001-cube-ship-battle/plan.md) and [validation guide](specs/001-cube-ship-battle/quickstart.md).

## Python setup

Use Python 3.12 or newer, [uv](https://docs.astral.sh/uv/), and a Linux graphical desktop with working 3D acceleration. Ursina and pytest are installed by uv. The current setup has been verified with Python 3.14; Python 3.12 has not yet been verified.

From the repository root:

```sh
uv sync --locked
uv run python -m kyle_trek
uv run pytest
```

## Inspection controls

- Press **1–5** to choose a Z layer; Z=1 is near and Z=5 is far.
- Hover a square in the layer grid to see its coordinates and occupancy; left-click to select it. Blue marks Player 1 and orange marks Player 2.
- During movement, bright green squares are legal destinations; left-click one to fly there. If no destination is available, use **Skip movement**.
- After movement, the game enters the attack-choice phase; attack and End turn actions are part of the later combat story.
- Use the **arrow keys** to orbit the camera without changing the battle.

Cell clicks inspect cells outside the movement phase. Automated tests do not replace the outstanding full-board graphical and real-display timing acceptance checks.
