# Browser UI and Developer Command Contract

## Scope

The application exposes a browser page and npm development commands. There is no HTTP gameplay API, backend, import/export format, or persistent storage contract. Domain invariants are specified in [data-model.md](../data-model.md).

## Browser page

### Entry and ready state

- Visiting `/` initializes one game automatically and presents one Phaser canvas containing a 10 × 10 grid and two identifiable single-cell ships.
- Show a native button with accessible name **New Game**, a visible **10 × 10** board description, and an explanation that rows count top-to-bottom and columns left-to-right.
- Show exactly one visible position entry per ship: **Ship 1 — row R, column C** and **Ship 2 — row R, column C**. Their coordinates match the canvas and domain setup.
- Associate the canvas's accessible description with the board explanation and position summary. Ships use labels or distinct shapes in addition to color.
- A polite status announces **Game N ready**, beginning with revision 1. Readiness is announced only after that revision's layout has been rendered. Disable New Game until initial readiness; serialize later updates so every activation publishes one complete layout.

### New Game

- Pointer activation, Enter, or Space on the native button causes exactly one fresh selection for each ship, replaces both placements, and advances the revision once.
- Ship 1 stays in rows 1–2; Ship 2 stays in rows 9–10; all columns 1–10 remain eligible independently.
- Identical consecutive coordinates are valid. The revision/status still advances so successful activation is observable.
- Keep keyboard focus on the button; do not recreate the page or stack additional canvases/listeners.

### Stable observation and layout

- Redraw, resize, and repeated observations do not change coordinates or revision.
- At desktop and 360 CSS-pixel-wide viewports, the complete square board fits horizontally, retains square cells and top/bottom orientation, and leaves controls/summary reachable. Vertical scrolling is permitted.
- Use a fixed logical board with FIT scaling. Ship graphics must remain within their cell bounds, including corner squares.
- No per-cell selection, movement, combat, or turn controls are exposed by this feature.

### Loading and failure

- During boot, show **Preparing game…** rather than a misleading ready state.
- If WebGL or game initialization fails, show **Unable to start the game. Check that WebGL is available and reload the page.** Do not announce readiness or leave only a blank canvas.
- If replacing the setup fails, retain the previous complete layout/revision, announce **Unable to start a new game. Try again.**, and allow another explicit activation; do not retry random selection automatically.
- Dispose the owned Phaser Game, canvas, DOM handlers, and scene-lifetime subscriptions on application teardown/HMR. Remove scene subscriptions on shutdown when appropriate for restart.

## npm command contract

| Command | Required behavior |
|---------|-------------------|
| `npm run dev` | Start Vite on loopback port 5173 with strict port selection; print the visitable URL. |
| `npm run typecheck` | Type-check application, tests, and tool configuration without emitting JavaScript. |
| `npm run build` | Run type-check then create the static production bundle in `dist/`. |
| `npm run preview` | Serve the production bundle on loopback port 4173 with strict port selection. |
| `npm run lint` | Run ESLint and fail on warnings/errors. |
| `npm run format` | Apply Prettier formatting to maintained project files. |
| `npm run format:check` | Check formatting without changing files. |
| `npm test` | Run deterministic Vitest tests once. |
| `npm run test:watch` | Run Vitest watch mode for feature development. |

Browser-only behavior is checked during the manual local walkthrough documented in [quickstart.md](../quickstart.md).

The standard dev path remains `nvm use`, `npm ci`, `npm run dev`. The first dependency bootstrap generates the lockfile with `npm install`; subsequent installs use `npm ci`.
