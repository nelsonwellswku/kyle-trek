# kyle-trek
A proof of concept to see how far I can take gamedev with a free model

A local-only 2D browser game built with [ExcaliburJS](https://excaliburjs.com/).
Open the page and you get a 10×10 board with two spaceships spawned at random
starting positions — one in the top two rows, one in the bottom two rows.

## Getting started

Prerequisites: Node.js 20+ LTS and npm 10+ (`node --version`, `npm --version`).
No network access is needed at runtime — only `npm install` fetches packages,
after which the game runs fully offline.

```sh
git clone <repo-url> && cd kyle-trek
npm install      # fetch dependencies (only network step)
npm run dev      # serve with hot reload, then open the printed localhost URL
```

Each visit draws fresh random starting positions. The devtools console logs
`[kyle-trek] game seed: N` — re-running with that seed replays the setup.

## Scripts

| Command          | What it does                              |
|------------------|-------------------------------------------|
| `npm run dev`    | Start the Vite dev server (default `http://localhost:5173`) |
| `npm test`       | Run the Vitest rule suite (grid, spawn, validation, seeds) |
| `npm run build`  | Typecheck + production bundle into `dist/` |
| `npm run preview`| Serve the production bundle locally       |
| `npm run typecheck` | Strict TypeScript check with no output |

## Layout

- `src/main.ts` — engine boot: loads tuning, builds the setup, starts the scene
- `src/sim/` — pure game-logic core (grid, spawn, validation, setup, seeded RNG);
  imports nothing from the engine, covered by `tests/unit/`
- `src/scenes/battle-scene.ts` — presentation only: TileMap board + ship actors
- `src/config/board.json` — all tuning data (grid size, spawn zones, ship visuals)
