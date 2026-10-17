# Kyle Trek — Ship Turn Movement

A local two-player browser game on a 10 × 10 board. Players alternate moving their own ship through highlighted orthogonal destinations, then watch it fly the shortest continuous path to its destination.

## Requirements

- [nvm](https://github.com/nvm-sh/nvm)
- Node.js 24 and npm 11 (selected by the project `.nvmrc`)
- A WebGL-capable browser

## Run locally

From the repository root:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open <http://127.0.0.1:5173/>. Player 1 starts each game and controls Ship 1; Player 2 controls Ship 2. Each ship independently receives a random agility score from 8 through 20 when a game starts. Its separate modifier is displayed and determines its maximum orthogonal movement allowance for that game.

## Turn controls

- Left-click one of the active ship's highlighted squares to move. A move can use a shorter legal route than the allowance; unused steps do not carry over.
- Flight moves directly, including diagonally, when the path is clear. If another ship blocks the direct line, the shortest tangent-and-circular-arc path avoids its visual envelope. The other player takes control after arrival.
- When the active ship has no legal destination, click **Pass turn** to hand over control. Passing is never automatic, including when both ships are immobile.
- Click **New Game** to generate fresh starting positions and independent agility scores, return to Player 1, and cancel any flight in progress.

See the [ship movement quickstart and validation guide](specs/002-ship-turn-movement/quickstart.md) for automated checks, deterministic browser presets, and acceptance scenarios.

## Build and preview

```sh
npm run build
npm run preview
```

Open <http://127.0.0.1:4173/>. Both servers bind to loopback and use strict ports. The test-only Phaser fixture is available during development at <http://127.0.0.1:5173/src/features/ship-movement/tests/browser/fixture.html> and is not part of the production entry.

## Quality checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Use `npm run test:watch` for iterative unit-test development. Vitest runs deterministic domain, geometry, and presentation tests in Node; visual and timing acceptance requires manually operating the browser fixture.
