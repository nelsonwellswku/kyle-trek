import { describe, expect, it } from 'vitest';
import { CombatGameFactory } from '../domain/CombatGameFactory.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';

describe('CombatGameFactory', () => {
  it('draws positions first, then four independent values per ship in documented order', () => {
    const random = new ScriptedRandomSource([
      0,
      0.5, // ship-1 (1,1), ship-2 (9,1)
      0,
      0.5,
      0.75,
      0.5, // ship-1: agility 8, strength 14, constitution 17, HP roll 10
      0.999999,
      0.25,
      0.25,
      0.999999, // ship-2: agility 20, strength 11, constitution 11, HP roll 20
    ]);

    const battle = new CombatGameFactory(random).create();
    expect(random.consumedDraws).toBe(10);
    expect(battle.ship1.position.row).toBe(1);
    expect(battle.ship2.position.row).toBe(10);
    expect(battle.ship1.agility.score).toBe(8);
    expect(battle.ship1.strength.score).toBe(14);
    expect(battle.ship1.constitution.score).toBe(17);
    expect(battle.ship1.startingHitPoints).toBe(16);
    expect(battle.ship1.hitPoints).toBe(16);
    expect(battle.ship2.agility.score).toBe(20);
    expect(battle.ship2.strength.score).toBe(11);
    expect(battle.ship2.constitution.score).toBe(11);
    expect(battle.ship2.startingHitPoints).toBe(20);
    expect(battle.ship1.armorClass).toBe(12);
    expect(battle.ship2.armorClass).toBe(12);
  });

  it.each([
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.999999, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0.999999, 0, 1],
  ])('clamps starting hp to at least one for low constitutions and low rolls', (...samples) => {
    const source = new ScriptedRandomSource(samples);
    const battle = new CombatGameFactory(source).create();
    expect(battle.ship1.startingHitPoints).toBeGreaterThanOrEqual(1);
    expect(battle.ship2.startingHitPoints).toBeGreaterThanOrEqual(1);
    expect(source.consumedDraws).toBe(10);
  });

  it('creates distinct starts in opposing zones and permits fresh repeated values', () => {
    const samples = Array.from({ length: 20 }, (_, index) => (index % 10) / 10);
    const source = new ScriptedRandomSource(samples);
    const factory = new CombatGameFactory(source);
    const first = factory.create();
    const second = factory.create();
    expect(first.ship1.position.row).toBeLessThanOrEqual(2);
    expect(first.ship2.position.row).toBeGreaterThanOrEqual(9);
    expect(second.ship1.position.equals(first.ship1.position)).toBe(true);
    expect(source.consumedDraws).toBe(20);
  });

  it('covers both HP endpoints and 100 known-roll setups without rerolling', () => {
    const lowSamples = [0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0];
    const highSamples = [0, 0.5, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999];
    const samples = Array.from({ length: 100 }, (_, index) =>
      index % 2 === 0 ? lowSamples : highSamples,
    ).flat();
    const source = new ScriptedRandomSource(samples);
    const factory = new CombatGameFactory(source);

    for (let index = 0; index < 100; index += 1) {
      const battle = factory.create();
      expect(battle.ship1.startingHitPoints).toBe(index % 2 === 0 ? 1 : 30);
      expect(battle.ship2.startingHitPoints).toBe(index % 2 === 0 ? 1 : 30);
      expect(battle.ship1.hitPoints).toBe(battle.ship1.startingHitPoints);
      expect(battle.ship2.hitPoints).toBe(battle.ship2.startingHitPoints);
    }
    expect(source.consumedDraws).toBe(1_000);
  });

  it('covers all stat buckets and derived constraints across 1,000 deterministic setups', () => {
    const samples: number[] = [];
    for (let index = 0; index < 1_000; index += 1) {
      samples.push(0, 0.5);
      for (const offset of [0, 1, 2, 6, 3, 4, 5, 6]) {
        const bucket = (index + offset) % 13;
        samples.push((bucket + 0.5) / 13);
      }
    }
    const source = new ScriptedRandomSource(samples);
    const factory = new CombatGameFactory(source);

    for (let index = 0; index < 1_000; index += 1) {
      const battle = factory.create();
      for (const ship of [battle.ship1, battle.ship2]) {
        for (const ability of [ship.agility, ship.strength, ship.constitution]) {
          expect(ability.score).toBeGreaterThanOrEqual(8);
          expect(ability.score).toBeLessThanOrEqual(20);
          expect(ability.modifier).toBe(Math.floor((ability.score - 10) / 2));
        }
        expect(ship.agility.movementAllowance).toBe(Math.max(0, ship.agility.modifier));
        expect(ship.startingHitPoints).toBeGreaterThanOrEqual(1);
        expect(ship.startingHitPoints).toBeLessThanOrEqual(30);
        expect(ship.hitPoints).toBe(ship.startingHitPoints);
      }
    }
    expect(source.consumedDraws).toBe(10_000);
  });

  it.each([
    [-0.1, 0],
    [1, 4],
    [Number.NaN, 5],
    [Number.POSITIVE_INFINITY, 8],
  ])('rejects invalid random sample %s', (invalid, index) => {
    const samples = Array.from({ length: 10 }, () => 0.1);
    samples[index] = invalid;
    expect(() => new CombatGameFactory(new ScriptedRandomSource(samples)).create()).toThrow(
      RangeError,
    );
  });
});
