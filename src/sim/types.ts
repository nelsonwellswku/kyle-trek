/**
 * Domain + config types for the simulation core (`src/sim/`).
 *
 * See specs/001-grid-ship-spawn/data-model.md for entity rules and
 * specs/001-grid-ship-spawn/contracts/board-config-schema.md for the
 * on-disk config schema. Coordinates are 1-based: row 1 is the top edge,
 * col 1 is the left edge.
 */

/** Fixed ship identities — exactly two ships exist per setup. */
export type ShipId = 'ship-1' | 'ship-2';

/**
 * Minimal RNG contract for the simulation core. `integer(min, max)` returns a
 * uniform integer in the INCLUSIVE range [min, max] (mirrors ex.Random).
 * The sim takes this as a parameter so it never imports the engine and stays
 * deterministic under test stubs; production passes an ex.Random adapter.
 */
export interface Rng {
  integer(min: number, max: number): number;
}

/**
 * Creates an Rng for a setup plus the effective seed. Called with a seed for
 * reproducible setups; called without one for an independent draw (the
 * factory must then supply a unique seed, e.g. ex.Random's Date.now()-based
 * sequence). Production implements this over ex.Random; tests use stubs.
 */
export interface RngFactory {
  create(seed?: number): { rng: Rng; seed: number };
}

/** Inclusive 1-based range, e.g. rows `[1, 2]`. */
export type IntRange = readonly [min: number, max: number];

/** A single grid square. At most one ship per cell. */
export interface Cell {
  readonly row: number;
  readonly col: number;
  readonly occupant: ShipId | null;
}

/** The grid: `rows × cols` uniquely addressable cells. */
export interface Grid {
  readonly rows: number;
  readonly cols: number;
  readonly cells: readonly Cell[];
}

/** A spaceship occupying exactly one grid square. */
export interface Spaceship {
  readonly id: ShipId;
  readonly position: { readonly row: number; readonly col: number };
  /** Agility stat, integer within the config roll range (8–20 shipped). */
  readonly agility: number;
  /** Movement range derived from the config stat→modifier table. */
  readonly agilityModifier: number;
  /** Strength stat, integer within the combat roll range (8–20 shipped). */
  readonly strength: number;
  /** Attack/damage bonus derived from the shared stat→modifier table. */
  readonly strengthModifier: number;
  /** Constitution stat, integer within the combat roll range (8–20 shipped). */
  readonly constitution: number;
  /** Hit-point bonus driver derived from the shared stat→modifier table. */
  readonly constitutionModifier: number;
  /** Current hit points, integer in 0…maxHitPoints (floored at 0). */
  readonly hitPoints: number;
  /** Starting hit points, integer >= 1 (d20 + constitutionModifier × 2, floored at 1). */
  readonly maxHitPoints: number;
  /** Static defense target, always 12 for the whole battle. */
  readonly armorClass: number;
}

/** Spawn placement before agility is rolled (see setup.ts draw order). */
export interface ShipPlacement {
  readonly id: ShipId;
  readonly position: { readonly row: number; readonly col: number };
}

/**
 * A named set of eligible starting squares (tuning data).
 * Exactly one zone serves each ship; zones must be disjoint.
 */
export interface SpawnZone {
  readonly name: string;
  readonly shipId: ShipId;
  readonly rows: IntRange;
  readonly cols: IntRange;
}

/** Visual descriptor for a ship (tuning data; resolved to graphics by the scene). */
export interface ShipVisual {
  readonly id: ShipId;
  readonly shape: string;
  readonly color: string;
}

/** One stat→modifier band of the agility table (tuning data). */
export interface AgilityBand {
  readonly min: number;
  readonly max: number;
  readonly modifier: number;
}

/** Agility tuning: roll bounds plus the stat→modifier table. */
export interface AgilityConfig {
  readonly rollRange: IntRange;
  readonly table: readonly AgilityBand[];
}

/** One stat→modifier band of the shared combat table (tuning data). */
export interface StatBand {
  readonly min: number;
  readonly max: number;
  readonly modifier: number;
}

/** Hit-point formula tuning: base die + per-modifier bonus, floored at minStart. */
export interface HitPointsTuning {
  readonly die: number;
  readonly perModifierBonus: number;
  readonly minStart: number;
}

/** Attack die tuning (hit iff d20 + strengthModifier >= armorClass). */
export interface AttackTuning {
  readonly die: number;
}

/** Damage die tuning (d8 + strengthModifier, floored at minDamage). */
export interface DamageTuning {
  readonly die: number;
  readonly minDamage: number;
}

/** Photon-torpedo visual parameters (presentation-only, never affect outcomes). */
export interface TorpedoTuning {
  readonly blinkHz: number;
  readonly speedTilesPerSec: number;
  readonly nearMissOffsetTiles: number;
}

/** Combat tuning: stat ranges, shared modifier table, AC, dice, torpedo visuals. */
export interface CombatConfig {
  readonly strength: { readonly rollRange: IntRange };
  readonly constitution: { readonly rollRange: IntRange };
  readonly statTable: readonly StatBand[];
  readonly armorClass: number;
  readonly hitPoints: HitPointsTuning;
  readonly attack: AttackTuning;
  readonly damage: DamageTuning;
  readonly torpedo: TorpedoTuning;
}

/** Validated board tuning loaded from `src/config/board.json`. */
export interface BoardConfig {
  readonly version: string;
  readonly grid: { readonly rows: number; readonly cols: number };
  readonly spawnZones: readonly SpawnZone[];
  readonly ships: readonly ShipVisual[];
  readonly agility: AgilityConfig;
  readonly combat: CombatConfig;
}

/** Which ship acts and on which numbered turn (exactly one active). */
export interface TurnState {
  readonly activeShipId: ShipId;
  readonly turnNumber: number;
  /** Frozen legal destinations for this turn (see movement.ts). */
  readonly legalSet: readonly { readonly row: number; readonly col: number }[];
  /** False until one accepted move/skip; at most one relocation per turn. */
  readonly moveUsed: boolean;
  /** False until one torpedo dispatch/skip; at most one attack per turn. */
  readonly attackUsed: boolean;
  /** Null during play; set the instant any HP reaches 0 (terminal). */
  readonly over: { readonly winner: ShipId } | null;
}

/** Outcome of dispatching a destination click to the turn reducer. */
export type MoveResult =
  | {
      readonly accepted: true;
      readonly next: TurnState;
      readonly move: {
        readonly shipId: ShipId;
        readonly from: { readonly row: number; readonly col: number };
        readonly to: { readonly row: number; readonly col: number };
      };
    }
  | { readonly accepted: false; readonly reason: string };

/** Per-torpedo outcome with HP bookkeeping for the defending ship. */
export interface AttackOutcome {
  readonly attackerId: ShipId;
  readonly defenderId: ShipId;
  readonly attackRoll: number;
  readonly total: number;
  readonly hit: boolean;
  readonly damageRoll?: number;
  readonly damage?: number;
  readonly defenderHPBefore: number;
  readonly defenderHPAfter: number;
}

/** Outcome of dispatching an enemy-ship selection to the turn reducer. */
export type AttackResult =
  | {
      readonly accepted: true;
      readonly next: TurnState;
      readonly ships: readonly Spaceship[];
      readonly outcome: AttackOutcome;
    }
  | { readonly accepted: false; readonly reason: string };

/**
 * The complete initial game configuration: inputs plus outcome.
 * `setup(config, seed)` must be pure — identical (version, seed) inputs
 * yield identical ship positions.
 */
export interface GameSetup {
  readonly seed: number;
  readonly configVersion: string;
  readonly grid: Grid;
  readonly ships: readonly [Spaceship, Spaceship];
}
