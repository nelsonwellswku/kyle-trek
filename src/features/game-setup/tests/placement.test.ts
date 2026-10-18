import { describe, expect, it } from 'vitest';
import { MathRandomSource } from '../adapters/MathRandomSource.js';
import { GameSetupFactory } from '../domain/GameSetupFactory.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';

const expectedPositions = [
  { row: 1, column: 1 },
  { row: 1, column: 2 },
  { row: 1, column: 3 },
  { row: 1, column: 4 },
  { row: 1, column: 5 },
  { row: 1, column: 6 },
  { row: 1, column: 7 },
  { row: 1, column: 8 },
  { row: 1, column: 9 },
  { row: 1, column: 10 },
  { row: 2, column: 1 },
  { row: 2, column: 2 },
  { row: 2, column: 3 },
  { row: 2, column: 4 },
  { row: 2, column: 5 },
  { row: 2, column: 6 },
  { row: 2, column: 7 },
  { row: 2, column: 8 },
  { row: 2, column: 9 },
  { row: 2, column: 10 },
] as const;

function midpoint(bucket: number): number {
  return (bucket + 0.5) / 20;
}

function expectedPosition(bucket: number): (typeof expectedPositions)[number] {
  const expected = expectedPositions[bucket];

  if (!expected) {
    throw new Error(`No independently listed expected placement for bucket ${bucket}.`);
  }

  return expected;
}

describe('GameSetupFactory', () => {
  it('maps every bucket midpoint to its independently listed position for each ship', () => {
    for (const [bucket, expected] of expectedPositions.entries()) {
      const ship1Source = new ScriptedRandomSource([midpoint(bucket), 0]);
      const ship1Setup = new GameSetupFactory(ship1Source).create();
      expect(ship1Setup.ship1.position).toMatchObject(expected);
      expect(ship1Source.consumedDraws).toBe(2);

      const ship2Source = new ScriptedRandomSource([0, midpoint(bucket)]);
      const ship2Setup = new GameSetupFactory(ship2Source).create();
      expect(ship2Setup.ship2.position).toMatchObject({
        row: expected.row + 8,
        column: expected.column,
      });
      expect(ship2Source.consumedDraws).toBe(2);
    }
  });

  it('allows all 400 independently selected pairs, including matching columns', () => {
    for (const [ship1Bucket, ship1Expected] of expectedPositions.entries()) {
      for (const [ship2Bucket, ship2Expected] of expectedPositions.entries()) {
        const source = new ScriptedRandomSource([midpoint(ship1Bucket), midpoint(ship2Bucket)]);
        const setup = new GameSetupFactory(source).create();

        expect(setup.ship1.position).toMatchObject(ship1Expected);
        expect(setup.ship2.position).toMatchObject({
          row: ship2Expected.row + 8,
          column: ship2Expected.column,
        });
        expect(source.consumedDraws).toBe(2);
      }
    }
  });

  it('produces 100 complete setups with fixed dimensions, identities, zones, and distinct positions', () => {
    const values = Array.from({ length: 200 }, (_, draw) => {
      const setupIndex = Math.floor(draw / 2);
      const bucket = draw % 2 === 0 ? setupIndex % 20 : (setupIndex * 7) % 20;
      return midpoint(bucket);
    });
    const factory = new GameSetupFactory(new ScriptedRandomSource(values));

    for (let setupIndex = 0; setupIndex < 100; setupIndex += 1) {
      const setup = factory.create();

      expect(setup.rows).toBe(10);
      expect(setup.columns).toBe(10);
      expect(setup.ship1.identity).toBe('ship-1');
      expect(setup.ship2.identity).toBe('ship-2');
      expect(setup.ship1.position.row).toBeLessThanOrEqual(2);
      expect(setup.ship2.position.row).toBeGreaterThanOrEqual(9);
      expect(setup.ship1.position.column).toBeGreaterThanOrEqual(1);
      expect(setup.ship1.position.column).toBeLessThanOrEqual(10);
      expect(setup.ship2.position.column).toBeGreaterThanOrEqual(1);
      expect(setup.ship2.position.column).toBeLessThanOrEqual(10);
      expect(setup.ship1.position.equals(setup.ship2.position)).toBe(false);
    }
  });

  it('covers all eligible squares in both zones across 1,000 valid setups', () => {
    const values = Array.from({ length: 2_000 }, (_, draw) => {
      const setupIndex = Math.floor(draw / 2);
      const bucket = draw % 2 === 0 ? setupIndex % 20 : (setupIndex * 7) % 20;
      return midpoint(bucket);
    });
    const source = new ScriptedRandomSource(values);
    const factory = new GameSetupFactory(source);
    const ship1Positions = new Set<string>();
    const ship2Positions = new Set<string>();

    for (let setupIndex = 0; setupIndex < 1_000; setupIndex += 1) {
      const setup = factory.create();

      expect([1, 2]).toContain(setup.ship1.position.row);
      expect([9, 10]).toContain(setup.ship2.position.row);
      expect(setup.ship1.position.column).toBeGreaterThanOrEqual(1);
      expect(setup.ship1.position.column).toBeLessThanOrEqual(10);
      expect(setup.ship2.position.column).toBeGreaterThanOrEqual(1);
      expect(setup.ship2.position.column).toBeLessThanOrEqual(10);
      ship1Positions.add(`${setup.ship1.position.row},${setup.ship1.position.column}`);
      ship2Positions.add(`${setup.ship2.position.row},${setup.ship2.position.column}`);
    }

    expect(ship1Positions).toEqual(
      new Set(expectedPositions.map(({ row, column }) => `${row},${column}`)),
    );
    expect(ship2Positions).toEqual(
      new Set(expectedPositions.map(({ row, column }) => `${row + 8},${column}`)),
    );
    expect(source.consumedDraws).toBe(2_000);
  });

  it.each([
    { label: 'zero', value: 0, ship1: { row: 1, column: 1 }, ship2: { row: 9, column: 1 } },
    {
      label: 'one half',
      value: 0.5,
      ship1: { row: 2, column: 1 },
      ship2: { row: 10, column: 1 },
    },
    {
      label: 'the largest value below one',
      value: 1 - Number.EPSILON / 2,
      ship1: { row: 2, column: 10 },
      ship2: { row: 10, column: 10 },
    },
  ])('maps the $label endpoint to the expected zone positions', ({ value, ship1, ship2 }) => {
    const setup = new GameSetupFactory(new ScriptedRandomSource([value, value])).create();

    expect(setup.ship1.position).toMatchObject(ship1);
    expect(setup.ship2.position).toMatchObject(ship2);
  });

  it.each([
    { label: 'below 0.5', value: 0.5 - 1e-9, bucket: 9 },
    { label: 'at 0.5', value: 0.5, bucket: 10 },
    { label: 'above 0.5', value: 0.5 + 1e-9, bucket: 10 },
    { label: 'below the 0.25 boundary', value: 0.25 - 1e-9, bucket: 4 },
    { label: 'at the 0.25 boundary', value: 0.25, bucket: 5 },
    { label: 'above the 0.25 boundary', value: 0.25 + 1e-9, bucket: 5 },
    { label: 'below the 0.75 boundary', value: 0.75 - 1e-9, bucket: 14 },
    { label: 'at the 0.75 boundary', value: 0.75, bucket: 15 },
    { label: 'above the 0.75 boundary', value: 0.75 + 1e-9, bucket: 15 },
  ])('maps the value $label into bucket $bucket', ({ value, bucket }) => {
    const setup = new GameSetupFactory(new ScriptedRandomSource([value, 0])).create();

    expect(setup.ship1.position).toMatchObject(expectedPosition(bucket));
  });

  it.each([
    { label: 'negative', value: -0.01 },
    { label: 'one', value: 1 },
    { label: 'NaN', value: Number.NaN },
    { label: 'positive infinity', value: Number.POSITIVE_INFINITY },
    { label: 'negative infinity', value: Number.NEGATIVE_INFINITY },
  ])('rejects a $label first draw without retrying', ({ value }) => {
    const source = new ScriptedRandomSource([value, 0.5, 0.75]);

    expect(() => new GameSetupFactory(source).create()).toThrow(RangeError);
    expect(source.consumedDraws).toBe(1);
  });

  it.each([
    { label: 'negative', value: -0.01 },
    { label: 'one', value: 1 },
    { label: 'NaN', value: Number.NaN },
    { label: 'positive infinity', value: Number.POSITIVE_INFINITY },
    { label: 'negative infinity', value: Number.NEGATIVE_INFINITY },
  ])('rejects a $label second draw without retrying', ({ value }) => {
    const source = new ScriptedRandomSource([0.25, value, 0.75]);

    expect(() => new GameSetupFactory(source).create()).toThrow(RangeError);
    expect(source.consumedDraws).toBe(2);
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
