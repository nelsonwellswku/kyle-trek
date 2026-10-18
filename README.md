# Kyle Trek — Ship Torpedo Combat

A local two-player browser battle on a 10 × 10 board. Each player moves their ship, then chooses to attack the opponent with a photo torpedo or end the turn.

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

Open <http://127.0.0.1:5173/>. Player 1 starts each battle and controls Ship 1; Player 2 controls Ship 2. Each ship receives independent agility, strength, and constitution scores from 8 through 20, with their modifiers, current/starting hit points, and armor class 12 shown in the controls. Starting hit points equal a 0–20 roll plus twice the constitution modifier, with a minimum of 1.

## Turn controls

- Move first by left-clicking a highlighted empty destination within the ship's nonnegative agility modifier. Existing collision-safe flight moves directly when possible and detours around the other ship when needed.
- If no legal destination exists, choose **Skip movement** to continue to the attack choice without moving.
- After movement or a skip, click the opposing ship to attack or choose **End turn** to pass without attacking. An attack rolls d20 + strength against AC 12; a hit rolls d8 + strength damage, with damage floored at 0. The result and remaining HP appear after the torpedo animation.
- A hit travels to the defender and explodes on contact. A miss passes nearby and exits the board. Attacks resolve within the designed 1.5-second deadline; a lethal hit reduces HP to 0 and declares the attacker the winner.
- **New Game** creates fresh ships and stats, returns control to Player 1, and cancels any move or torpedo effect in progress.

See the [ship torpedo combat quickstart and validation guide](specs/003-ship-torpedo-combat/quickstart.md) for automated checks, deterministic presets, and acceptance scenarios. The implementation evidence in `specs/003-ship-torpedo-combat/development.md` distinguishes automated verification from pending browser and usability acceptance.

## Build and preview

```sh
npm run build
npm run preview
```

Open <http://127.0.0.1:4173/>. Both servers bind to loopback and use strict ports. The test-only deterministic combat fixture is available during development at <http://127.0.0.1:5173/src/features/ship-combat/tests/browser/fixture.html>; it is not imported by the production entry.

## Quality checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Use `npm run test:watch` for iterative unit-test development. Vitest runs deterministic domain, geometry, and presentation tests in Node. Real-browser visual, timing, and first-time-player usability acceptance is described in the quickstart and must be recorded separately from automated test results.
