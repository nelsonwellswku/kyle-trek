# Kyle Trek — Spaceship Starting Positions

A browser-based setup screen for a small game: one 10 × 10 board, two identifiable single-square ships, and randomized starting positions in opposing zones. This feature covers initial placement only; it does not include movement, combat, turns, or persistence.

## Requirements

- [nvm](https://github.com/nvm-sh/nvm)
- Node.js 24.22.0 and npm 11.19.1 (selected by the project `.nvmrc`)
- A WebGL-capable browser

## Run locally

From the repository root:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open <http://127.0.0.1:5173/>. The browser initializes a game on entry. Ship 1 starts in row 1 or 2, Ship 2 in row 9 or 10, and each may occupy any column. The position summary and **New Game** button are provided alongside the board.

To build and serve the production bundle:

```sh
npm run build
npm run preview
```

Open <http://127.0.0.1:4173/>. Both servers bind to loopback and use strict ports.

## Quality checks

```sh
npm run typecheck
npm run lint
npm run format
npm run format:check
npm test
npm run build
```

Use `npm run test:watch` for iterative unit-test development. `npm run format` applies Prettier; `npm run format:check` is read-only. Vitest runs deterministic domain, geometry, and presentation tests in Node. Use the [feature quickstart](specs/001-spaceship-grid-setup/quickstart.md) for manual browser walkthroughs.
