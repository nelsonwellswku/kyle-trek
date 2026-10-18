import { describe, expect, it } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';
import { CombatGame, type CombatShip } from '../domain/CombatGame.js';
import { AttackResolver } from '../domain/AttackResolver.js';
import { DiceRoller } from '../domain/DiceRoller.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';

function ship(
  identity: 'ship-1' | 'ship-2',
  row: number,
  strengthScore: number,
  startingHitPoints: number,
  hitPoints = startingHitPoints,
): CombatShip {
  return {
    identity,
    owner: identity === 'ship-1' ? 'player-1' : 'player-2',
    position: new BoardPosition(row, 2),
    agility: new AgilityStat(14),
    strength: new AbilityStat(strengthScore),
    constitution: new AbilityStat(12),
    armorClass: 12,
    startingHitPoints,
    hitPoints,
  };
}

function game(
  attackerModifier = 0,
  defenderHitPoints = 12,
  defenderStartingHitPoints = defenderHitPoints,
): CombatGame {
  return new CombatGame(
    ship('ship-1', 1, 10 + 2 * attackerModifier, 12),
    ship('ship-2', 10, 10, defenderStartingHitPoints, defenderHitPoints),
  );
}

function resolver(samples: readonly number[]): {
  readonly resolver: AttackResolver;
  readonly random: ScriptedRandomSource;
} {
  const random = new ScriptedRandomSource(samples);
  return { resolver: new AttackResolver(new DiceRoller(random)), random };
}

function sampleForDie(die: number, sides: number): number {
  return (die - 1) / sides;
}

describe('AttackResolver', () => {
  it('resolves 112 controlled attacks at totals 11 and 12 for every strength modifier', () => {
    const modifiers = [-1, 0, 1, 2, 3, 4, 5];
    const cases: {
      readonly modifier: number;
      readonly attackDie: number;
      readonly attackTotal: 11 | 12;
      readonly kind: 'miss' | 'hit';
      readonly damageDie?: number;
    }[] = [];
    const samples: number[] = [];

    for (const modifier of modifiers) {
      for (let repetition = 0; repetition < 8; repetition += 1) {
        for (const attackTotal of [11, 12] as const) {
          const attackDie = attackTotal - modifier;
          const kind = attackTotal === 11 ? 'miss' : 'hit';
          samples.push(sampleForDie(attackDie, 20));
          const damageDie = kind === 'hit' ? (repetition % 8) + 1 : undefined;
          if (damageDie !== undefined) samples.push(sampleForDie(damageDie, 8));
          const attackCase = { modifier, attackDie, attackTotal, kind } as const;
          cases.push(damageDie === undefined ? attackCase : { ...attackCase, damageDie });
        }
      }
    }

    const { resolver: attackResolver, random } = resolver(samples);
    let attackCount = 0;

    for (const attack of cases) {
      const battle = game(attack.modifier, 30, 30);
      const outcome = attackResolver.resolve(battle.ship1, battle.ship2);
      attackCount += 1;

      expect(outcome.kind).toBe(attack.kind);
      expect(outcome.attacker).toBe('ship-1');
      expect(outcome.defender).toBe('ship-2');
      expect(outcome.attackDie).toBe(attack.attackDie);
      expect(outcome.strengthModifier).toBe(attack.modifier);
      expect(outcome.attackTotal).toBe(attack.attackTotal);
      expect(outcome.armorClass).toBe(12);
      expect(outcome.hitPointsBefore).toBe(30);

      if (outcome.kind === 'miss') {
        expect(attack.kind).toBe('miss');
        expect(outcome.hitPointsAfter).toBe(30);
        expect('damageDie' in outcome).toBe(false);
        expect('damage' in outcome).toBe(false);
      } else {
        expect(attack.kind).toBe('hit');
        expect(outcome.damageDie).toBe(attack.damageDie);
        expect(outcome.damage).toBe(attack.damageDie! + attack.modifier);
        expect(outcome.hitPointsAfter).toBe(30 - outcome.damage);
      }
    }

    expect(attackCount).toBeGreaterThanOrEqual(100);
    expect(cases.filter(({ attackTotal }) => attackTotal === 11)).toHaveLength(56);
    expect(cases.filter(({ attackTotal }) => attackTotal === 12)).toHaveLength(56);
    expect(random.consumedDraws).toBe(168);
  });

  it('uses the endpoints of the d20 and d8 ranges', () => {
    const lower = game(0);
    const lowerRolls = resolver([0, 0]);
    const lowerOutcome = lowerRolls.resolver.resolve(lower.ship1, lower.ship2);
    expect(lowerOutcome).toMatchObject({ kind: 'miss', attackDie: 1, attackTotal: 1 });
    expect(lowerRolls.random.consumedDraws).toBe(1);

    const upper = game(0);
    const upperRolls = resolver([sampleForDie(20, 20), sampleForDie(8, 8)]);
    const upperOutcome = upperRolls.resolver.resolve(upper.ship1, upper.ship2);
    expect(upperOutcome).toMatchObject({
      kind: 'hit',
      attackDie: 20,
      attackTotal: 20,
      damageDie: 8,
      damage: 8,
    });
    expect(upperRolls.random.consumedDraws).toBe(2);
  });

  it('uses totals alone rather than special natural-1 or natural-20 rules', () => {
    const naturalOneBattle = game(5);
    const naturalOneRolls = resolver([sampleForDie(1, 20)]);
    const naturalOne = naturalOneRolls.resolver.resolve(
      naturalOneBattle.ship1,
      naturalOneBattle.ship2,
    );
    expect(naturalOne).toMatchObject({
      kind: 'miss',
      attackDie: 1,
      strengthModifier: 5,
      attackTotal: 6,
      hitPointsBefore: 12,
      hitPointsAfter: 12,
    });
    expect('damage' in naturalOne).toBe(false);

    const naturalTwentyBattle = game(-1);
    const naturalTwentyRolls = resolver([sampleForDie(20, 20), sampleForDie(2, 8)]);
    const naturalTwenty = naturalTwentyRolls.resolver.resolve(
      naturalTwentyBattle.ship1,
      naturalTwentyBattle.ship2,
    );
    expect(naturalTwenty).toMatchObject({
      kind: 'hit',
      attackDie: 20,
      strengthModifier: -1,
      attackTotal: 19,
      damageDie: 2,
      damage: 1,
      hitPointsAfter: 11,
    });
    expect('critical' in naturalTwenty).toBe(false);
  });

  it('keeps a zero-damage roll as a hit and leaves hit points unchanged', () => {
    const battle = game(-1, 7, 12);
    const { resolver: attackResolver } = resolver([sampleForDie(13, 20), 0]);
    const outcome = attackResolver.resolve(battle.ship1, battle.ship2);

    expect(outcome).toMatchObject({
      kind: 'hit',
      attackTotal: 12,
      damageDie: 1,
      damage: 0,
      hitPointsBefore: 7,
      hitPointsAfter: 7,
    });
    expect(battle.ship2.hitPoints).toBe(7);
  });

  it.each([
    {
      label: 'exactly lethal damage',
      defenderHp: 5,
      damageDie: 6,
      modifier: -1,
      expectedDamage: 5,
    },
    { label: 'overkill damage', defenderHp: 3, damageDie: 8, modifier: 5, expectedDamage: 13 },
  ])(
    'reports $label and clamps remaining HP to zero',
    ({ defenderHp, damageDie, modifier, expectedDamage }) => {
      const battle = game(modifier, defenderHp, 12);
      const attackDie = 12 - modifier;
      const { resolver: attackResolver } = resolver([
        sampleForDie(attackDie, 20),
        sampleForDie(damageDie, 8),
      ]);
      const outcome = attackResolver.resolve(battle.ship1, battle.ship2);

      expect(outcome).toMatchObject({
        kind: 'hit',
        attackTotal: 12,
        damageDie,
        damage: expectedDamage,
        hitPointsBefore: defenderHp,
        hitPointsAfter: 0,
      });
      expect(battle.ship2.hitPoints).toBe(defenderHp);
    },
  );

  it('consumes a d8 only after an attack hits', () => {
    const missedBattle = game(0);
    const missRolls = resolver([sampleForDie(11, 20), sampleForDie(8, 8)]);
    expect(missRolls.resolver.resolve(missedBattle.ship1, missedBattle.ship2).kind).toBe('miss');
    expect(missRolls.random.consumedDraws).toBe(1);

    const hitBattle = game(0);
    const hitRolls = resolver([sampleForDie(12, 20), sampleForDie(1, 8)]);
    expect(hitRolls.resolver.resolve(hitBattle.ship1, hitBattle.ship2).kind).toBe('hit');
    expect(hitRolls.random.consumedDraws).toBe(2);
  });

  it('rejects an invalid scripted sample without mutating the battle', () => {
    const battle = game(2, 9, 12);
    const before = { ship1: battle.ship1, ship2: battle.ship2 };
    const invalidRolls = resolver([Number.NaN, sampleForDie(8, 8)]);

    expect(() => invalidRolls.resolver.resolve(battle.ship1, battle.ship2)).toThrow(RangeError);
    expect(invalidRolls.random.consumedDraws).toBe(1);
    expect(battle.ship1).toBe(before.ship1);
    expect(battle.ship2).toBe(before.ship2);
    expect(battle.ship1.hitPoints).toBe(12);
    expect(battle.ship2.hitPoints).toBe(9);
  });
});
