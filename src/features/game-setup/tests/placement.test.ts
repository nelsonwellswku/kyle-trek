import { describe, expect, it } from 'vitest';
import { CUBE_SIZE } from '../../board/domain/CubePosition.js';
import { MathRandomSource } from '../adapters/MathRandomSource.js';
import { GameSetupFactory } from '../domain/GameSetupFactory.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';

function drawForIndex(index: number): number {
  return (index + 0.5) / 50;
}

function expectedPosition(index: number, firstLayer: 1 | 4) {
  const cellsAcrossTwoLayers = 2 * CUBE_SIZE;
  return {
    x: Math.floor(index / cellsAcrossTwoLayers) + 1,
    y: firstLayer + Math.floor((index % cellsAcrossTwoLayers) / CUBE_SIZE),
    z: (index % CUBE_SIZE) + 1,
  };
}

describe('GameSetupFactory', () => {
  it('maps each of 50 uniform draws bijectively into each ship’s assigned two Y layers', () => {
    const ship1Positions = new Set<string>();
    const ship2Positions = new Set<string>();

    for (let index = 0; index < 50; index += 1) {
      const source = new ScriptedRandomSource([drawForIndex(index), drawForIndex(index)]);
      const setup = new GameSetupFactory(source).create();
      const expectedShip1 = expectedPosition(index, 1);
      const expectedShip2 = expectedPosition(index, 4);

      expect(setup.ship1.position).toMatchObject(expectedShip1);
      expect(setup.ship2.position).toMatchObject(expectedShip2);
      expect(setup.ship1.position.equals(setup.ship2.position)).toBe(false);
      expect(source.consumedDraws).toBe(2);
      ship1Positions.add(
        `${setup.ship1.position.x},${setup.ship1.position.y},${setup.ship1.position.z}`,
      );
      ship2Positions.add(
        `${setup.ship2.position.x},${setup.ship2.position.y},${setup.ship2.position.z}`,
      );
    }

    expect(ship1Positions.size).toBe(50);
    expect(ship2Positions.size).toBe(50);
  });

  it('uses two independent draws and allows any eligible cell pair', () => {
    const first = 37;
    const second = 46;
    const source = new ScriptedRandomSource([drawForIndex(first), drawForIndex(second)]);
    const setup = new GameSetupFactory(source).create();

    expect(setup.ship1.position).toMatchObject(expectedPosition(first, 1));
    expect(setup.ship2.position).toMatchObject(expectedPosition(second, 4));
    expect(source.consumedDraws).toBe(2);
  });

  it('supports repeated setups without rerolling matching X/Z values', () => {
    const source = new ScriptedRandomSource([
      drawForIndex(34),
      drawForIndex(34),
      drawForIndex(34),
      drawForIndex(34),
    ]);
    const factory = new GameSetupFactory(source);
    const first = factory.create();
    const second = factory.create();

    expect(second.ship1.position.equals(first.ship1.position)).toBe(true);
    expect(second.ship2.position.equals(first.ship2.position)).toBe(true);
    expect(source.consumedDraws).toBe(4);
  });

  it.each([
    { label: 'zero', value: 0, index: 0 },
    { label: 'one half', value: 0.5, index: 25 },
    { label: 'the largest value below one', value: 1 - Number.EPSILON / 2, index: 49 },
  ])('maps $label into eligible cube index $index', ({ value, index }) => {
    const setup = new GameSetupFactory(new ScriptedRandomSource([value, value])).create();
    expect(setup.ship1.position).toMatchObject(expectedPosition(index, 1));
    expect(setup.ship2.position).toMatchObject(expectedPosition(index, 4));
  });

  it.each([
    { label: 'negative', value: -0.01 },
    { label: 'one', value: 1 },
    { label: 'NaN', value: Number.NaN },
    { label: 'positive infinity', value: Number.POSITIVE_INFINITY },
    { label: 'negative infinity', value: Number.NEGATIVE_INFINITY },
  ])('rejects a $label sample without retrying', ({ value }) => {
    const source = new ScriptedRandomSource([value, 0.5, 0.75]);

    expect(() => new GameSetupFactory(source).create()).toThrow(RangeError);
    expect(source.consumedDraws).toBe(1);
  });
});

describe('MathRandomSource', () => {
  it('provides values within the RandomSource half-open interval', () => {
    const source = new MathRandomSource();

    for (let draw = 0; draw < 100; draw += 1) {
      const value = source.next();
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
