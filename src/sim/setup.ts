import { rollShipAgility } from './agility.js';
import { createGrid } from './grid.js';
import { placeShips } from './spawn.js';
import type { BoardConfig, GameSetup, Rng, RngFactory } from './types.js';
import { validateSetup } from './validation.js';

/**
 * Compose one full game setup (pure): grid → spawn → agility → stamp
 * occupants → validate (FR-001–FR-008 plus agility rules 6–9). The RNG is
 * injected (production: ex.Random adapter; tests: deterministic stub) and
 * `seed` is recorded so the setup is reproducible — identical
 * (configVersion, seed) inputs MUST yield identical ship positions AND
 * agility values. RNG draw order is pinned (research.md R-02): spawn
 * ship-1, spawn ship-2, agility ship-1, agility ship-2 — so 001
 * seed→position mappings are preserved. Invalid results throw.
 */
export function setupGame(
  config: BoardConfig,
  seed: number,
  rng: Rng,
): GameSetup {
  const grid = createGrid(config);
  const placements = placeShips(config, rng);
  const [first, second] = placements.map((p) => {
    const { agility, agilityModifier } = rollShipAgility(config, p.id, rng);
    return { ...p, agility, agilityModifier };
  });
  if (first === undefined || second === undefined) {
    throw new Error('setup: expected exactly 2 ship placements');
  }
  const ships: GameSetup['ships'] = [first, second];

  const ownerByCell = new Map(
    ships.map((s) => [`${s.position.row}:${s.position.col}`, s.id] as const),
  );
  const cells = grid.cells.map((cell) => ({
    ...cell,
    occupant: ownerByCell.get(`${cell.row}:${cell.col}`) ?? null,
  }));

  const setup: GameSetup = {
    seed,
    configVersion: config.version,
    grid: { ...grid, cells },
    ships,
  };
  validateSetup(setup, config);
  return setup;
}

/**
 * Seed-handled entry point (US2): resolves the effective seed through the
 * injected factory, then delegates to setupGame. An explicit seed yields a
 * reproducible setup (SC-004); omitting it yields an independent draw with a
 * factory-supplied unique seed. The effective seed is always recorded on the
 * returned setup for replay. No player-facing seed UI (developer detail).
 */
export function setupNewGame(
  config: BoardConfig,
  factory: RngFactory,
  seed?: number,
): GameSetup {
  const { rng, seed: effectiveSeed } = factory.create(seed);
  return setupGame(config, effectiveSeed, rng);
}
