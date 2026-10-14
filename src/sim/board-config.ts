import type {
  AgilityBand,
  AgilityConfig,
  AttackTuning,
  BoardConfig,
  CombatConfig,
  DamageTuning,
  HitPointsTuning,
  IntRange,
  ShipId,
  ShipVisual,
  SpawnZone,
  StatBand,
  TorpedoTuning,
} from './types.js';

/**
 * Parse and validate raw board tuning data (e.g. `src/config/board.json`)
 * into a BoardConfig. Unknown fields are ignored. Any missing or invalid
 * required field throws an Error naming the offending field path —
 * setups fail fast instead of running on bad tuning.
 *
 * Schema: specs/001-grid-ship-spawn/contracts/board-config-schema.md
 *   plus specs/002-agility-based-movement/contracts/agility-config-schema.md
 *   plus specs/003-ship-combat-system/contracts/combat-config-schema.md
 */
export function loadBoardConfig(raw: unknown): BoardConfig {
  const root = requireObject(raw, 'config');
  const version = requireString(root['version'], 'version');

  const gridRaw = requireObject(root['grid'], 'grid');
  const rows = requirePositiveInt(gridRaw['rows'], 'grid.rows');
  const cols = requirePositiveInt(gridRaw['cols'], 'grid.cols');

  const zonesRaw = requireArray(root['spawnZones'], 'spawnZones');
  if (zonesRaw.length !== 2) {
    throw new Error(
      `board config: "spawnZones" must list exactly 2 zones, got ${zonesRaw.length}`,
    );
  }
  const spawnZones = zonesRaw.map((z, i) =>
    parseZone(z, `spawnZones[${i}]`),
  );
  assertDisjointZones(spawnZones, rows, cols);

  const shipsRaw = requireArray(root['ships'], 'ships');
  if (shipsRaw.length !== 2) {
    throw new Error(
      `board config: "ships" must list exactly 2 ships, got ${shipsRaw.length}`,
    );
  }
  const ships = shipsRaw.map((s, i) => parseShip(s, `ships[${i}]`));
  assertShipsMatchZones(ships, spawnZones);
  assertShipsVisuallyDistinct(ships);

  const agility = parseAgility(root['agility'], 'agility');

  const combat = parseCombat(root['combat'], 'combat');

  return { version, grid: { rows, cols }, spawnZones, ships, agility, combat };
}

function parseZone(raw: unknown, path: string): SpawnZone {
  const obj = requireObject(raw, path);
  const name = requireString(obj['name'], `${path}.name`);
  const shipId = requireShipId(obj['shipId'], `${path}.shipId`);
  const rows = requireIntRange(obj['rows'], `${path}.rows`);
  const cols = requireIntRange(obj['cols'], `${path}.cols`);
  return { name, shipId, rows, cols };
}

/** Parse the agility tuning section (schema: agility-config-schema.md rules 1–3). */
function parseAgility(raw: unknown, path: string): AgilityConfig {
  const obj = requireObject(raw, path);
  const rangeRaw = obj['rollRange'];
  if (
    !Array.isArray(rangeRaw) ||
    rangeRaw.length !== 2 ||
    typeof rangeRaw[0] !== 'number' ||
    typeof rangeRaw[1] !== 'number' ||
    !Number.isInteger(rangeRaw[0]) ||
    !Number.isInteger(rangeRaw[1]) ||
    (rangeRaw[0] as number) > (rangeRaw[1] as number)
  ) {
    throw new Error(
      `board config: invalid [min, max] integer roll range at "${path}.rollRange"`,
    );
  }
  const rollRange = [rangeRaw[0], rangeRaw[1]] as unknown as AgilityConfig['rollRange'];

  const tableRaw = requireArray(obj['table'], `${path}.table`);
  if (tableRaw.length === 0) {
    throw new Error(
      `board config: "${path}.table" must list at least one band`,
    );
  }
  const table: AgilityBand[] = tableRaw.map((b, i) =>
    parseAgilityBand(b, `${path}.table[${i}]`),
  );
  assertAgilityTableCoversRange(table, rollRange, path);

  return { rollRange, table };
}

function parseAgilityBand(raw: unknown, path: string): AgilityBand {
  const obj = requireObject(raw, path);
  const min = requireInteger(obj['min'], `${path}.min`);
  const max = requireInteger(obj['max'], `${path}.max`);
  const modifier = requireInteger(obj['modifier'], `${path}.modifier`);
  if (max < min) {
    throw new Error(
      `board config: invalid band at "${path}" — max (${max}) < min (${min})`,
    );
  }
  return { min, max, modifier };
}

/** Bands must be ascending, non-overlapping, and gapless over the roll range. */
function assertAgilityTableCoversRange(
  table: AgilityBand[],
  rollRange: AgilityConfig['rollRange'],
  path: string,
): void {
  const sorted = [...table].sort((a, b) => a.min - b.min);
  const [first] = sorted as [AgilityBand, ...AgilityBand[]];
  if (first.min !== rollRange[0]) {
    throw new Error(
      `board config: "${path}.table" starts at ${first.min} but rollRange starts at ${rollRange[0]} — table must cover the full roll range without gaps`,
    );
  }
  let cursor = first.max;
  for (const band of sorted.slice(1)) {
    if (band.min <= cursor) {
      throw new Error(
        `board config: "${path}.table" bands overlap at ${band.min} — bands must be non-overlapping`,
      );
    }
    if (band.min !== cursor + 1) {
      throw new Error(
        `board config: "${path}.table" has a gap between ${cursor} and ${band.min} — table must cover the full roll range without gaps`,
      );
    }
    cursor = band.max;
  }
  const last = sorted[sorted.length - 1]!;
  if (last.max !== rollRange[1]) {
    throw new Error(
      `board config: "${path}.table" ends at ${last.max} but rollRange ends at ${rollRange[1]} — table must cover the full roll range without gaps`,
    );
  }
}

function parseShip(raw: unknown, path: string): ShipVisual {
  const obj = requireObject(raw, path);
  const id = requireShipId(obj['id'], `${path}.id`);
  const shape = requireString(obj['shape'], `${path}.shape`);
  const color = requireString(obj['color'], `${path}.color`);
  return { id, shape, color };
}

/** Parse the combat tuning section (schema: combat-config-schema.md rules 1–6). */
function parseCombat(raw: unknown, path: string): CombatConfig {
  const obj = requireObject(raw, path);

  const strengthRaw = requireObject(obj['strength'], `${path}.strength`);
  const strengthRollRange = requireStatRollRange(
    strengthRaw['rollRange'],
    `${path}.strength.rollRange`,
  );
  const constitutionRaw = requireObject(
    obj['constitution'],
    `${path}.constitution`,
  );
  const constitutionRollRange = requireStatRollRange(
    constitutionRaw['rollRange'],
    `${path}.constitution.rollRange`,
  );

  const tableRaw = requireArray(obj['statTable'], `${path}.statTable`);
  if (tableRaw.length === 0) {
    throw new Error(
      `board config: "${path}.statTable" must list at least one band`,
    );
  }
  const statTable: StatBand[] = tableRaw.map((b, i) =>
    parseStatBand(b, `${path}.statTable[${i}]`),
  );
  assertStatTableCoversRanges(
    statTable,
    [strengthRollRange, constitutionRollRange],
    path,
  );

  const armorClass = requirePositiveInt(obj['armorClass'], `${path}.armorClass`);

  const hpRaw = requireObject(obj['hitPoints'], `${path}.hitPoints`);
  const hitPoints: HitPointsTuning = {
    die: requirePositiveInt(hpRaw['die'], `${path}.hitPoints.die`),
    perModifierBonus: requireInteger(
      hpRaw['perModifierBonus'],
      `${path}.hitPoints.perModifierBonus`,
    ),
    minStart: requirePositiveInt(
      hpRaw['minStart'],
      `${path}.hitPoints.minStart`,
    ),
  };

  const attackRaw = requireObject(obj['attack'], `${path}.attack`);
  const attack: AttackTuning = {
    die: requirePositiveInt(attackRaw['die'], `${path}.attack.die`),
  };

  const damageRaw = requireObject(obj['damage'], `${path}.damage`);
  const damage: DamageTuning = {
    die: requirePositiveInt(damageRaw['die'], `${path}.damage.die`),
    minDamage: requirePositiveInt(
      damageRaw['minDamage'],
      `${path}.damage.minDamage`,
    ),
  };

  const torpedoRaw = requireObject(obj['torpedo'], `${path}.torpedo`);
  const torpedo: TorpedoTuning = {
    blinkHz: requirePositiveNumber(
      torpedoRaw['blinkHz'],
      `${path}.torpedo.blinkHz`,
    ),
    speedTilesPerSec: requirePositiveNumber(
      torpedoRaw['speedTilesPerSec'],
      `${path}.torpedo.speedTilesPerSec`,
    ),
    nearMissOffsetTiles: requirePositiveNumber(
      torpedoRaw['nearMissOffsetTiles'],
      `${path}.torpedo.nearMissOffsetTiles`,
    ),
  };

  return {
    strength: { rollRange: strengthRollRange },
    constitution: { rollRange: constitutionRollRange },
    statTable,
    armorClass,
    hitPoints,
    attack,
    damage,
    torpedo,
  };
}

function parseStatBand(raw: unknown, path: string): StatBand {
  const obj = requireObject(raw, path);
  const min = requireInteger(obj['min'], `${path}.min`);
  const max = requireInteger(obj['max'], `${path}.max`);
  const modifier = requireInteger(obj['modifier'], `${path}.modifier`);
  if (max < min) {
    throw new Error(
      `board config: invalid band at "${path}" — max (${max}) < min (${min})`,
    );
  }
  return { min, max, modifier };
}

/**
 * Bands must be ascending, non-overlapping, and gapless over every covered
 * roll range (strength + constitution).
 */
function assertStatTableCoversRanges(
  table: StatBand[],
  ranges: IntRange[],
  path: string,
): void {
  const sorted = [...table].sort((a, b) => a.min - b.min);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.min <= sorted[i - 1]!.max) {
      throw new Error(
        `board config: "${path}.statTable" bands overlap at ${sorted[i]!.min} — bands must be non-overlapping`,
      );
    }
    if (sorted[i]!.min !== sorted[i - 1]!.max + 1) {
      throw new Error(
        `board config: "${path}.statTable" has a gap between ${sorted[i - 1]!.max} and ${sorted[i]!.min} — table must cover the full roll ranges without gaps`,
      );
    }
  }
  const lo = sorted[0]!.min;
  const hi = sorted[sorted.length - 1]!.max;
  for (const [min, max] of ranges) {
    if (min < lo || max > hi) {
      throw new Error(
        `board config: "${path}.statTable" covers ${lo}-${hi} but roll range ${min}-${max} reaches outside it — table must cover the full roll ranges without gaps`,
      );
    }
  }
}

/** Zones must be disjoint and fully inside the grid (schema rules 3 + 5). */
function assertDisjointZones(
  zones: SpawnZone[],
  gridRows: number,
  gridCols: number,
): void {
  for (const z of zones) {
    for (const [label, range, limit] of [
      ['rows', z.rows, gridRows],
      ['cols', z.cols, gridCols],
    ] as const) {
      if (range[0] < 1 || range[1] > limit) {
        throw new Error(
          `board config: spawnZones "${z.name}" ${label} ` +
            `reaches outside the grid (1..${limit}): [${range[0]}, ${range[1]}]`,
        );
      }
    }
  }
  const cells = (z: SpawnZone): Set<string> => {
    const out = new Set<string>();
    for (let r = z.rows[0]; r <= z.rows[1]; r++) {
      for (let c = z.cols[0]; c <= z.cols[1]; c++) {
        out.add(`${r}:${c}`);
      }
    }
    return out;
  };
  const [first, second] = zones as [SpawnZone, SpawnZone];
  for (const cell of cells(first)) {
    if (cells(second).has(cell)) {
      throw new Error(
        `board config: spawnZones "${first.name}" and "${second.name}" ` +
          `overlap at cell ${cell} — zones must be disjoint (spawnZones[].rows)`,
      );
    }
  }
  for (const z of zones) {
    if (cells(z).size === 0) {
      throw new Error(
        `board config: spawnZones "${z.name}" contains no cells (spawnZones[].rows/cols)`,
      );
    }
  }
}

/** Every ship id must match exactly one zone's shipId and vice versa. */
function assertShipsMatchZones(
  ships: ShipVisual[],
  zones: SpawnZone[],
): void {
  const zoneIds = new Set(zones.map((z) => z.shipId));
  for (const s of ships) {
    if (!zoneIds.has(s.id)) {
      throw new Error(
        `board config: ships entry "${s.id}" has no matching spawnZones[].shipId`,
      );
    }
  }
  const shipIds = new Set(ships.map((s) => s.id));
  for (const z of zones) {
    if (!shipIds.has(z.shipId)) {
      throw new Error(
        `board config: spawnZones "${z.name}" shipId "${z.shipId}" has no matching ships[].id`,
      );
    }
  }
}

/** The two ships must differ in BOTH shape and color (schema rule 4). */
function assertShipsVisuallyDistinct(ships: ShipVisual[]): void {
  const [a, b] = ships as [ShipVisual, ShipVisual];
  if (a.shape === b.shape && a.color === b.color) {
    throw new Error(
      `board config: ships "${a.id}" and "${b.id}" are identical in both ` +
        `shape and color — ships must differ in BOTH (ships[].shape/color)`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`board config: missing or invalid object at "${path}"`);
  }
  return value;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`board config: missing or invalid array at "${path}"`);
  }
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`board config: missing or invalid string at "${path}"`);
  }
  return value;
}

function requireShipId(value: unknown, path: string): ShipId {
  if (value !== 'ship-1' && value !== 'ship-2') {
    throw new Error(
      `board config: invalid ship id at "${path}" — expected "ship-1" or "ship-2"`,
    );
  }
  return value;
}

function requirePositiveInt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(
      `board config: invalid positive integer at "${path}": ${String(value)}`,
    );
  }
  return value;
}

function requireInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(
      `board config: invalid integer at "${path}": ${String(value)}`,
    );
  }
  return value;
}

function requirePositiveNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `board config: invalid positive number at "${path}": ${String(value)}`,
    );
  }
  return value;
}

function requireStatRollRange(value: unknown, path: string): IntRange {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== 'number' ||
    typeof value[1] !== 'number' ||
    !Number.isInteger(value[0]) ||
    !Number.isInteger(value[1]) ||
    (value[0] as number) > (value[1] as number)
  ) {
    throw new Error(
      `board config: invalid [min, max] integer roll range at "${path}"`,
    );
  }
  return [value[0], value[1]];
}

function requireIntRange(
  value: unknown,
  path: string,
): readonly [number, number] {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== 'number' ||
    typeof value[1] !== 'number' ||
    !Number.isInteger(value[0]) ||
    !Number.isInteger(value[1]) ||
    (value[0] as number) > (value[1] as number) ||
    (value[0] as number) < 1
  ) {
    throw new Error(
      `board config: invalid inclusive 1-based [min, max] range at "${path}"`,
    );
  }
  return [value[0], value[1]];
}
