import { rollShipAgility } from './agility.js';
import {
  computeHitPoints,
  rollConstitution,
  rollStrength,
} from './combat.js';
import { createGrid } from './grid.js';
import { placeShips } from './spawn.js';
import type { BoardConfig, GameSetup, Rng, RngFactory } from './types.js';
import { validateSetup } from './validation.js';

/**
 * Compose one full game setup (pure): grid → spawn → agility → combat stats
 * → hit points → stamp occupants → validate (FR-001–FR-008 plus agility
 * rules 6–9 plus combat rules 10–15). The RNG is injected (production:
 * ex.Random adapter; tests: deterministic stub) and `seed` is recorded so
 * the setup is reproducible — identical (configVersion, seed) inputs MUST
 * yield identical ship positions, agility, strength, constitution, AND hit
 * points. RNG draw order is pinned (research.md R-02): spawn ship-1, spawn
 * ship-2, agility ship-1, agility ship-2, strength ship-1, strength ship-2,
 * constitution ship-1, constitution ship-2, HP-base ship-1, HP-base ship-2 —
 * so 001/002 seed→position/agility mappings are preserved. Invalid results
 * throw.
 */
export function setupGame(
  config: BoardConfig,
  seed: number,
  rng: Rng,
): GameSetup {
  const grid = createGrid(config);
  const placements = placeShips(config, rng);
  const withAgility = placements.map((p) => {
    const { agility, agilityModifier } = rollShipAgility(config, p.id, rng);
    return { ...p, agility, agilityModifier };
  });
  // Strength rolls come before constitution rolls (pinned order), so the two
  // stat families are drawn in separate passes, not per ship.
  const withStrength = withAgility.map((p) => {
    const { strength, strengthModifier } = rollStrength(config, p.id, rng);
    return { ...p, strength, strengthModifier };
  });
  const withStats = withStrength.map((p) => {
    const { constitution, constitutionModifier } = rollConstitution(
      config,
      p.id,
      rng,
    );
    return { ...p, constitution, constitutionModifier };
  });
  const [first, second] = withStats.map((p) => {
    const maxHitPoints = computeHitPoints(
      config,
      p.constitutionModifier,
      rng,
    );
    return {
      ...p,
      hitPoints: maxHitPoints,
      maxHitPoints,
      armorClass: config.combat.armorClass,
    };
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
