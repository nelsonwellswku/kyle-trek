# Game and UI Contract

This is a local graphical application, not a network API. Coordinates and domain invariants are defined in [data-model.md](../data-model.md).

## Application and controls

The planned entry point is `uv run python -m kyle_trek`. A fresh game shows a three-quarter cube, labeled axes, both ships' coordinates, all scores and modifiers, HP and AC, active player and phase. Camera orbit is independent of gameplay. A selectable Z-layer inspection mode exposes all 25 cells in each layer without occlusion; hovering a cell identifies its coordinates and occupancy before a left-click. Ship selection remains available at every depth. The precise bindings must be visible in the UI and README.

During movement all and only legal cells are highlighted within 300 ms; left-clicking one commits the entire move. Invalid selections and non-left clicks do nothing. When no legal destination exists, show its reason and an explicit Skip movement control. On arrival within 1.5 seconds, offer an opposing-ship attack or End turn. Active-ship 90-degree rotations around each axis in both directions are available in idle playable phases only and consume no action. New game is always available, including during effects and after victory.

An attack commits exactly one outcome at launch. A hit shows a blinking outlined five-point photo torpedo, then an explosion before displaying damage; at 60 logical pixels per cell its outer radius is at least 12 pixels and scales with the board. A miss uses an independently sampled 10–35° integer angle and side, clears the defender, stays on-screen through closest approach, and then fully exits; its trajectory deviation never exceeds 35°. Results, handoff or victory occur within 1.5 seconds. Presentation failure cleans up and reports the error and existing outcome within that same deadline; restart/disposal cancels instead of resolving. Repeated input and stale completions have no effect.

## Internal boundary

Typed commands (`select_cell`, `skip_movement`, `rotate_ship`, `attack`, `end_turn`, `new_game`) are checked against battle phase and ownership before mutation. The UI converts third-party engine values to validated project types at the adapter boundary. A presentation completion includes generation and action IDs; the battle controller rejects stale or duplicate completions. Gameplay RNG and visual RNG are injected independently; presentation failure never rerolls. See [quickstart.md](../quickstart.md) for validation.
