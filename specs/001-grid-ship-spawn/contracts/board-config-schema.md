# Contract: Board Config Schema (`src/config/board.json`)

**Feature**: `specs/001-grid-ship-spawn/spec.md` · **Date**: 2026-10-14

All game tuning is data (Constitution Principle IV). Both `src/sim/` and `src/scenes/` read this file; neither may hard-code the values it holds. Config revision is recorded as `configVersion` on every `GameSetup` (see `data-model.md`).

## Schema (JSON)

```json
{
  "$schema": "board-config-v1",
  "version": "string (required, e.g. \"1.0.0\" — recorded as configVersion)",
  "grid": {
    "rows": "integer, required, == 10",
    "cols": "integer, required, == 10"
  },
  "spawnZones": [
    {
      "name": "string, required, unique (e.g. \"top\")",
      "shipId": "\"ship-1\" | \"ship-2\", required, unique across zones",
      "rows": "[integer, integer], required, inclusive 1-based range, e.g. [1, 2]",
      "cols": "[integer, integer], required, inclusive 1-based range, e.g. [1, 10]"
    }
  ],
  "ships": [
    {
      "id": "\"ship-1\" | \"ship-2\", required, matches a spawnZones[].shipId",
      "shape": "string, required (e.g. \"triangle\" | \"pentagon\" — procedural graphic key)",
      "color": "string, required (CSS color, e.g. \"#22d3ee\")"
    }
  ]
}
```

## Rules

1. Exactly 2 spawn zones and 2 ship entries; every `shipId` appears exactly once in each list.
2. `grid.rows`/`grid.cols` are 10 (this feature fixes the board at 10×10; changing them is a future-feature decision, not a silent edit).
3. The two zones' row ranges MUST be disjoint; each zone MUST contain ≥ 1 cell within the grid. (Validator rule 5 in `data-model.md` enforces this at setup time.)
4. The two ships' (`shape`, `color`) pairs MUST differ in BOTH shape and color.
5. Unknown fields are ignored; missing/invalid required fields fail fast at load with an explicit error naming the field.

## Example (initial values)

```json
{
  "$schema": "board-config-v1",
  "version": "1.0.0",
  "grid": { "rows": 10, "cols": 10 },
  "spawnZones": [
    { "name": "top", "shipId": "ship-1", "rows": [1, 2], "cols": [1, 10] },
    { "name": "bottom", "shipId": "ship-2", "rows": [9, 10], "cols": [1, 10] }
  ],
  "ships": [
    { "id": "ship-1", "shape": "triangle", "color": "#22d3ee" },
    { "id": "ship-2", "shape": "pentagon", "color": "#fb9233" }
  ]
}
```

Shape keys resolve to Excalibur procedural graphics (`Polygon`/`Circle`/`Rectangle`) in the scene layer; adding new shapes MUST NOT require sim changes.
