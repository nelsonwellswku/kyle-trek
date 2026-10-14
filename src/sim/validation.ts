import type { BoardConfig, GameSetup } from './types.js';

/** Explicit rejection of an invalid setup (FR-008) — never silent. */
export class SetupValidationError extends Error {
  constructor(
    public readonly rule: string,
    detail: string,
  ) {
    super(`setup validation (${rule}): ${detail}`);
    this.name = 'SetupValidationError';
  }
}

/**
 * Validate a GameSetup against the data-model rules (FR-008):
 * 1. grid dimensions match the declared rows×cols with unique in-range cells
 * 2. exactly the two expected ships, each on an in-range cell
 * 3. each ship inside its own spawn zone
 * 4. ships on distinct squares with bidirectional occupant agreement
 * 5. spawn zones disjoint and non-empty
 * 6. each ship's agility is an integer within the config roll range
 * 7. each ship's agility falls in exactly one table band with a matching modifier
 * 8. (config load) agility table ordered, non-overlapping, gapless — enforced
 *    by loadBoardConfig; re-asserted here defensively via rule 7's exact-band
 *    requirement
 * 9. post-move invariant: ships occupy distinct in-bounds cells (rule 4,
 *    re-checked after every accepted move — never silently corrected)
 * 10. each ship's strength is an integer within the combat roll range
 * 11. each ship's constitution is an integer within the combat roll range
 * 12. each ship's strength/constitution falls in exactly one shared-table
 *    band with a matching modifier
 * 13. each ship's maxHitPoints is at least minStart and — unless floored —
 *    implies a d20 base roll consistent with its constitution modifier
 * 14. each ship's armorClass equals the configured value and current
 *    hitPoints lies within 0…maxHitPoints
 */
export function validateSetup(setup: GameSetup, config: BoardConfig): void {
  const { grid, ships } = setup;

  const expectedCells = grid.rows * grid.cols;
  if (grid.cells.length !== expectedCells) {
    throw new SetupValidationError(
      'dimensions',
      `grid declares ${grid.rows}x${grid.cols} but holds ${grid.cells.length} cells`,
    );
  }
  const seen = new Set<string>();
  for (const cell of grid.cells) {
    if (
      !Number.isInteger(cell.row) ||
      !Number.isInteger(cell.col) ||
      cell.row < 1 ||
      cell.row > grid.rows ||
      cell.col < 1 ||
      cell.col > grid.cols
    ) {
      throw new SetupValidationError(
        'dimensions',
        `cell (${cell.row},${cell.col}) is outside the ${grid.rows}x${grid.cols} grid`,
      );
    }
    const key = `${cell.row}:${cell.col}`;
    if (seen.has(key)) {
      throw new SetupValidationError(
        'dimensions',
        `duplicate cell at (${cell.row},${cell.col})`,
      );
    }
    seen.add(key);
  }

  if (ships.length !== 2) {
    throw new SetupValidationError(
      'ships',
      `expected exactly 2 ships, got ${ships.length}`,
    );
  }
  const [ship1, ship2] = ships as [GameSetup['ships'][0], GameSetup['ships'][0]];
  if (ship1.id !== 'ship-1' || ship2.id !== 'ship-2') {
    throw new SetupValidationError(
      'ships',
      `expected ship ids [ship-1, ship-2], got [${ships.map((s) => s.id).join(', ')}]`,
    );
  }

  const zoneByShip = new Map(config.spawnZones.map((z) => [z.shipId, z]));
  for (const ship of ships) {
    const zone = zoneByShip.get(ship.id);
    if (zone === undefined) {
      throw new SetupValidationError(
        'zone',
        `no spawn zone serves ${ship.id}`,
      );
    }
    const { row, col } = ship.position;
    if (
      row < zone.rows[0] ||
      row > zone.rows[1] ||
      col < zone.cols[0] ||
      col > zone.cols[1]
    ) {
      throw new SetupValidationError(
        'zone',
        `${ship.id} at (${row},${col}) is outside spawn zone "${zone.name}" ` +
          `(rows ${zone.rows[0]}-${zone.rows[1]}, cols ${zone.cols[0]}-${zone.cols[1]})`,
      );
    }
  }

  const key1 = `${ship1.position.row}:${ship1.position.col}`;
  const key2 = `${ship2.position.row}:${ship2.position.col}`;
  if (key1 === key2) {
    throw new SetupValidationError(
      'distinct',
      `ship-1 and ship-2 share square (${ship1.position.row},${ship1.position.col}) — squares must be distinct`,
    );
  }

  const [rollMin, rollMax] = config.agility.rollRange;
  for (const ship of ships) {
    if (!Number.isInteger(ship.agility) || ship.agility < rollMin || ship.agility > rollMax) {
      throw new SetupValidationError(
        'agility',
        `${ship.id} agility ${String(ship.agility)} is outside the roll range ${rollMin}-${rollMax} (agility out of range)`,
      );
    }
    const bands = config.agility.table.filter(
      (b) => ship.agility >= b.min && ship.agility <= b.max,
    );
    if (bands.length !== 1 || bands[0]!.modifier !== ship.agilityModifier) {
      throw new SetupValidationError(
        'agility',
        `${ship.id} agility ${ship.agility} maps to no single table band with modifier ${String(ship.agilityModifier)} (agility unmapped)`,
      );
    }
  }

  // Rules 10–12: combat stats are integers in range with matching modifiers.
  const [strMin, strMax] = config.combat.strength.rollRange;
  const [conMin, conMax] = config.combat.constitution.rollRange;
  for (const ship of ships) {
    if (
      !Number.isInteger(ship.strength) ||
      ship.strength < strMin ||
      ship.strength > strMax
    ) {
      throw new SetupValidationError(
        'strength',
        `${ship.id} strength ${String(ship.strength)} is outside the roll range ${strMin}-${strMax} (strength out of range)`,
      );
    }
    if (
      !Number.isInteger(ship.constitution) ||
      ship.constitution < conMin ||
      ship.constitution > conMax
    ) {
      throw new SetupValidationError(
        'constitution',
        `${ship.id} constitution ${String(ship.constitution)} is outside the roll range ${conMin}-${conMax} (constitution out of range)`,
      );
    }
    const strBands = config.combat.statTable.filter(
      (b) => ship.strength >= b.min && ship.strength <= b.max,
    );
    if (
      strBands.length !== 1 ||
      strBands[0]!.modifier !== ship.strengthModifier
    ) {
      throw new SetupValidationError(
        'strength',
        `${ship.id} strength ${ship.strength} maps to no single table band with modifier ${String(ship.strengthModifier)} (strength unmapped)`,
      );
    }
    const conBands = config.combat.statTable.filter(
      (b) => ship.constitution >= b.min && ship.constitution <= b.max,
    );
    if (
      conBands.length !== 1 ||
      conBands[0]!.modifier !== ship.constitutionModifier
    ) {
      throw new SetupValidationError(
        'constitution',
        `${ship.id} constitution ${ship.constitution} maps to no single table band with modifier ${String(ship.constitutionModifier)} (constitution unmapped)`,
      );
    }
  }

  // Rules 13–14: hit points consistent and bounded; armor class exact.
  // The HP base roll is not stored, so rule 13 is checked as: maxHitPoints is
  // at least minStart, and — unless floored at minStart — implies a base roll
  // within 1..die via maxHitPoints − constitutionModifier × perModifierBonus.
  const { die, perModifierBonus, minStart } = config.combat.hitPoints;
  for (const ship of ships) {
    if (!Number.isInteger(ship.maxHitPoints) || ship.maxHitPoints < minStart) {
      throw new SetupValidationError(
        'hitPoints',
        `${ship.id} max hit points ${String(ship.maxHitPoints)} is below the minimum ${minStart} (hit points below minimum)`,
      );
    }
    if (ship.maxHitPoints > minStart) {
      const impliedBase =
        ship.maxHitPoints - ship.constitutionModifier * perModifierBonus;
      if (
        !Number.isInteger(impliedBase) ||
        impliedBase < 1 ||
        impliedBase > die
      ) {
        throw new SetupValidationError(
          'hitPoints',
          `${ship.id} max hit points ${ship.maxHitPoints} implies base roll ${String(impliedBase)}, outside d${die} 1–${die} (hit points inconsistent with constitution modifier ${ship.constitutionModifier})`,
        );
      }
    }
    if (
      !Number.isInteger(ship.hitPoints) ||
      ship.hitPoints < 0 ||
      ship.hitPoints > ship.maxHitPoints
    ) {
      throw new SetupValidationError(
        'hitPoints',
        `${ship.id} hit points ${String(ship.hitPoints)} is outside 0…${ship.maxHitPoints} (hit points out of bounds)`,
      );
    }
    if (ship.armorClass !== config.combat.armorClass) {
      throw new SetupValidationError(
        'armorClass',
        `${ship.id} armor class ${String(ship.armorClass)} does not equal the configured ${config.combat.armorClass} (armor class mismatch)`,
      );
    }
  }

  const occupantByCell = new Map(
    grid.cells.map((c) => [`${c.row}:${c.col}`, c.occupant]),
  );
  for (const ship of ships) {
    const key = `${ship.position.row}:${ship.position.col}`;
    if (!occupantByCell.has(key)) {
      throw new SetupValidationError(
        'occupancy',
        `${ship.id} sits on (${ship.position.row},${ship.position.col}) which is not a grid cell (occupancy mismatch)`,
      );
    }
    if (occupantByCell.get(key) !== ship.id) {
      throw new SetupValidationError(
        'occupancy',
        `cell (${ship.position.row},${ship.position.col}) occupant is ` +
          `${String(occupantByCell.get(key))}, expected ${ship.id} (occupancy mismatch)`,
      );
    }
  }
  for (const cell of grid.cells) {
    if (cell.occupant !== null) {
      const owner = ships.find(
        (s) => s.position.row === cell.row && s.position.col === cell.col,
      );
      if (owner === undefined || owner.id !== cell.occupant) {
        throw new SetupValidationError(
          'occupancy',
          `cell (${cell.row},${cell.col}) claims occupant ${String(cell.occupant)} with no matching ship (occupancy mismatch)`,
        );
      }
    }
  }

  for (const zone of config.spawnZones) {
    const count =
      (zone.rows[1] - zone.rows[0] + 1) * (zone.cols[1] - zone.cols[0] + 1);
    if (count < 1) {
      throw new SetupValidationError(
        'zone',
        `spawn zone "${zone.name}" contains no cells`,
      );
    }
  }
  const zoneCells = (rows: readonly [number, number], cols: readonly [number, number]) => {
    const out = new Set<string>();
    for (let r = rows[0]; r <= rows[1]; r++) {
      for (let c = cols[0]; c <= cols[1]; c++) {
        out.add(`${r}:${c}`);
      }
    }
    return out;
  };
  const [zoneA, zoneB] = config.spawnZones;
  if (zoneA !== undefined && zoneB !== undefined) {
    const cellsA = zoneCells(zoneA.rows, zoneA.cols);
    for (const cell of zoneCells(zoneB.rows, zoneB.cols)) {
      if (cellsA.has(cell)) {
        throw new SetupValidationError(
          'zone',
          `spawn zones "${zoneA.name}" and "${zoneB.name}" overlap at ${cell} — zones must be disjoint`,
        );
      }
    }
  }
}
