import { describe, expect, it } from 'vitest';
import { loadBoardConfig } from '../../src/sim/board-config.js';
import {
  computeHitPoints,
  modifierForStat,
  resolveAttack,
  rollConstitution,
  rollStrength,
} from '../../src/sim/combat.js';
import { setupGame } from '../../src/sim/setup.js';
import { dispatchAttack, initialTurn } from '../../src/sim/turn.js';
import type { BoardConfig, Rng, ShipId, Spaceship } from '../../src/sim/types.js';
import shippedConfig from '../../src/config/board.json';

// TDD (US1): written BEFORE src/sim/combat.ts exists → must FAIL until T011.
// Setup/validation cases fail until T012/T013.

const shipped = (): BoardConfig =>
  loadBoardConfig(JSON.parse(JSON.stringify(shippedConfig)));

const firstPick: Rng = { integer: (min: number) => min };
const lastPick: Rng = { integer: (_min: number, max: number) => max };
const sequencePick = (picks: number[]): Rng => {
  let i = 0;
  return {
    integer: (min: number, max: number) => {
      const pick = picks[i % picks.length]!;
      i++;
      return Math.min(Math.max(pick, min), max);
    },
  };
};

describe('combat stat mapping (FR-003, shared table)', () => {
  const expected: Array<[number, number]> = [
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [13, 1],
    [14, 2],
    [15, 2],
    [16, 3],
    [17, 3],
    [18, 4],
    [19, 4],
    [20, 5],
  ];

  it.each(expected)('stat %i maps to modifier %i', (stat, modifier) => {
    expect(modifierForStat(shipped(), stat)).toBe(modifier);
  });

  it('pins the band boundaries (9/-1, 10/0, 11/0, 12/1, 19/4, 20/5)', () => {
    const config = shipped();
    expect(modifierForStat(config, 9)).toBe(-1);
    expect(modifierForStat(config, 10)).toBe(0);
    expect(modifierForStat(config, 11)).toBe(0);
    expect(modifierForStat(config, 12)).toBe(1);
    expect(modifierForStat(config, 19)).toBe(4);
    expect(modifierForStat(config, 20)).toBe(5);
  });

  it('throws for stats outside the table (7 and 21), naming the stat', () => {
    const config = shipped();
    expect(() => modifierForStat(config, 7)).toThrow(/7/);
    expect(() => modifierForStat(config, 21)).toThrow(/21/);
  });
});

describe('strength and constitution rolls (FR-001/FR-002)', () => {
  it('rolls strength 8 (→ -1) on a min-stub RNG', () => {
    const { strength, strengthModifier } = rollStrength(
      shipped(),
      'ship-1',
      firstPick,
    );
    expect(strength).toBe(8);
    expect(strengthModifier).toBe(-1);
  });

  it('rolls strength 20 (→ 5) on a max-stub RNG', () => {
    const { strength, strengthModifier } = rollStrength(
      shipped(),
      'ship-2',
      lastPick,
    );
    expect(strength).toBe(20);
    expect(strengthModifier).toBe(5);
  });

  it('rolls constitution 8 (→ -1) on a min-stub RNG', () => {
    const { constitution, constitutionModifier } = rollConstitution(
      shipped(),
      'ship-1',
      firstPick,
    );
    expect(constitution).toBe(8);
    expect(constitutionModifier).toBe(-1);
  });

  it('rolls constitution 20 (→ 5) on a max-stub RNG', () => {
    const { constitution, constitutionModifier } = rollConstitution(
      shipped(),
      'ship-2',
      lastPick,
    );
    expect(constitution).toBe(20);
    expect(constitutionModifier).toBe(5);
  });
});

describe('hit points and armor class (FR-004/FR-005)', () => {
  it('computes the worked example: base 10 + modifier +2 → 14', () => {
    expect(
      computeHitPoints(shipped(), 2, { integer: () => 10 }),
    ).toBe(14);
  });

  it('floors starting hit points at a minimum of 1 (base 1, modifier -1)', () => {
    expect(
      computeHitPoints(shipped(), -1, { integer: () => 1 }),
    ).toBe(1);
  });

  it('stamps armor class 12 on both ships at setup', () => {
    const setup = setupGame(shipped(), 42, firstPick);
    expect(setup.ships[0]!.armorClass).toBe(12);
    expect(setup.ships[1]!.armorClass).toBe(12);
  });
});

describe('combat setup determinism (FR-019)', () => {
  // Pinned draw order (research R-02): spawn s1, spawn s2, agility s1,
  // agility s2, strength s1, strength s2, constitution s1, constitution s2,
  // HP-base s1, HP-base s2.
  const draws = [5, 7, 12, 18, 14, 16, 10, 8, 10, 1];

  it('rolls combat stats after agility without disturbing 001/002 draws', () => {
    const setup = setupGame(shipped(), 1, sequencePick(draws));
    const [ship1, ship2] = setup.ships;
    // 001/002 expectations preserved (see agility.test.ts):
    expect(ship1.position).toEqual({ row: 1, col: 6 });
    expect(ship2.position).toEqual({ row: 9, col: 8 });
    expect(ship1.agility).toBe(12);
    expect(ship2.agility).toBe(18);
    // Combat draws in pinned order:
    expect(ship1.strength).toBe(14);
    expect(ship1.strengthModifier).toBe(2);
    expect(ship2.strength).toBe(16);
    expect(ship2.strengthModifier).toBe(3);
    expect(ship1.constitution).toBe(10);
    expect(ship1.constitutionModifier).toBe(0);
    expect(ship2.constitution).toBe(8);
    expect(ship2.constitutionModifier).toBe(-1);
    // HP: ship1 base 10 + 0×2 = 10; ship2 base 1 + (−1)×2 = −1 → floor 1:
    expect(ship1.maxHitPoints).toBe(10);
    expect(ship1.hitPoints).toBe(10);
    expect(ship2.maxHitPoints).toBe(1);
    expect(ship2.hitPoints).toBe(1);
  });

  it('reproduces identical combat stats for the same seed (determinism)', () => {
    const config = shipped();
    const first = setupGame(config, 77, sequencePick(draws));
    const second = setupGame(config, 77, sequencePick(draws));
    expect(second.ships).toEqual(first.ships);
  });
});

describe('attack rolls (US3, FR-010)', () => {
  const counting = (values: number[]) => {
    let calls = 0;
    let i = 0;
    const rng: Rng = {
      integer: (min: number, max: number) => {
        calls++;
        const pick = values[i % values.length]!;
        i++;
        return Math.min(Math.max(pick, min), max);
      },
    };
    return { rng, calls: () => calls };
  };

  it('consumes exactly one d20 per attack (integer 1–20)', () => {
    const { rng, calls } = counting([5]);
    const roll = resolveAttack(shipped(), 0, 12, rng);
    expect(calls()).toBe(1);
    expect(roll.attackRoll).toBe(5);
  });

  it('declares the worked hit: roll 10 + modifier +2 = 12 vs AC 12', () => {
    const roll = resolveAttack(shipped(), 2, 12, { integer: () => 10 });
    expect(roll.total).toBe(12);
    expect(roll.hit).toBe(true);
  });

  it('declares the worked miss: roll 9 + modifier +1 = 10 vs AC 12', () => {
    const { rng, calls } = counting([9]);
    const roll = resolveAttack(shipped(), 1, 12, rng);
    expect(roll.total).toBe(10);
    expect(roll.hit).toBe(false);
    // A miss consumes no damage roll.
    expect(calls()).toBe(1);
    expect(roll.damageRoll).toBeUndefined();
    expect(roll.damage).toBeUndefined();
  });

  it('applies negative modifiers (strength 8–9 → -1) to the total', () => {
    const roll = resolveAttack(shipped(), -1, 12, { integer: () => 12 });
    expect(roll.total).toBe(11);
    expect(roll.hit).toBe(false);
  });
});

describe('damage and hit points (US3, FR-012/FR-013)', () => {
  it('resolves the worked hit: damage roll 5 + modifier +2 vs 10 HP → 3 HP', () => {
    // Attacker strength 14 (+2); defender at 10 HP.
    const config = shipped();
    const setup = setupGame(
      config,
      5,
      sequencePick([0, 0, 19, 19, 14, 10, 10, 12, 10, 15]),
    );
    const board = {
      rows: setup.grid.rows,
      cols: setup.grid.cols,
      ships: setup.ships.map((s) => ({
        ...s,
        position: { ...s.position },
        hitPoints: s.id === 'ship-2' ? 10 : s.hitPoints,
      })),
    };
    const turn = initialTurn(board);
    // Attack roll 10 (+2 = 12, hit); damage roll 5 (+2 = 7); 10 − 7 = 3.
    const result = dispatchAttack(
      turn,
      board,
      config,
      'ship-2',
      sequencePick([10, 5]),
    );
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.outcome.hit).toBe(true);
    expect(result.outcome.damage).toBe(7);
    expect(
      result.ships.find((s) => s.id === 'ship-2')!.hitPoints,
    ).toBe(3);
  });

  it('floors damage at 1 so a hit with a negative modifier still matters', () => {
    // Attack 12 − 1 = 11 meets AC 11 (hit); damage max(1, 1 − 1) = 1.
    const roll = resolveAttack(shipped(), -1, 11, sequencePick([12, 1]));
    expect(roll.hit).toBe(true);
    expect(roll.damage).toBe(1);
  });

  it('clamps hit points at 0 on oversized damage', () => {
    const config = shipped();
    const setup = setupGame(config, 5, sequencePick([0, 0, 19, 19]));
    const board = {
      rows: setup.grid.rows,
      cols: setup.grid.cols,
      ships: setup.ships.map((s) => ({
        ...s,
        position: { ...s.position },
        hitPoints: s.id === 'ship-2' ? 4 : s.hitPoints,
      })),
    };
    const result = dispatchAttack(
      initialTurn(board),
      board,
      config,
      'ship-2',
      { integer: (min: number, max: number) => max },
    );
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.ships.find((s) => s.id === 'ship-2')!.hitPoints).toBe(0);
    expect(result.outcome.defenderHPAfter).toBe(0);
  });
});

describe('seeded battle replay (US3, FR-019/SC-007)', () => {
  // Setup draws (10) then battle draws: P1 attack d20 + d8.
  const script = [0, 0, 19, 19, 18, 10, 14, 12, 15, 15, 15, 4];

  const playScriptedBattle = () => {
    const config = shipped();
    const rng = sequencePick(script);
    const setup = setupGame(config, 99, rng);
    const board = {
      rows: setup.grid.rows,
      cols: setup.grid.cols,
      ships: setup.ships.map((s) => ({ ...s, position: { ...s.position } })),
    };
    const turn = initialTurn(board);
    const attacked = dispatchAttack(turn, board, config, 'ship-2', rng);
    if (!attacked.accepted) throw new Error('scripted attack rejected');
    return { ships: attacked.ships, outcome: attacked.outcome, next: attacked.next };
  };

  it('same seed + action sequence reproduces rolls, HP, and flow', () => {
    const first = playScriptedBattle();
    const second = playScriptedBattle();
    expect(second).toEqual(first);
    // Spot-check the scripted values: 15 + 4 = 19 hit; 4 + 4 = 8 damage.
    expect(first.outcome.total).toBe(19);
    expect(first.outcome.damage).toBe(8);
  });

  it('a scripted kill replays the same winner', () => {
    const playKill = () => {
      const config = shipped();
      const rng = sequencePick(script);
      const setup = setupGame(config, 99, rng);
      const ships: Spaceship[] = setup.ships.map((s) => ({
        ...s,
        position: { ...s.position },
        hitPoints: s.id === 'ship-2' ? 5 : s.hitPoints,
        maxHitPoints: s.id === 'ship-2' ? 5 : s.maxHitPoints,
      }));
      const board = { rows: setup.grid.rows, cols: setup.grid.cols, ships };
      const result = dispatchAttack(
        initialTurn(board),
        board,
        config,
        'ship-2' as ShipId,
        rng,
      );
      if (!result.accepted) throw new Error('scripted kill rejected');
      return { over: result.next.over, ships: result.ships };
    };
    const first = playKill();
    expect(first.over).toEqual({ winner: 'ship-1' });
    expect(playKill()).toEqual(first);
  });
});
