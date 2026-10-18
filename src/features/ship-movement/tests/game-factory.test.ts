import { describe, expect, it } from 'vitest';
import { MovementGameFactory } from '../domain/MovementGameFactory.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';

function scoreDraw(score: number): number {
  return (score - 8 + 0.25) / 13;
}

function createWithScores(ship1Score: number, ship2Score: number) {
  const source = new ScriptedRandomSource([
    0.01,
    0.99,
    scoreDraw(ship1Score),
    scoreDraw(ship2Score),
  ]);
  return { game: new MovementGameFactory(source).create(), source };
}

describe('MovementGameFactory', () => {
  it('consumes placements before separate agility draws and accepts repeated scores', () => {
    const { game, source } = createWithScores(14, 14);

    expect(source.consumedDraws).toBe(4);
    expect(game.ship1.position).toEqual({ row: 1, column: 1 });
    expect(game.ship2.position).toEqual({ row: 10, column: 10 });
    expect(game.ship1.agility.score).toBe(14);
    expect(game.ship2.agility.score).toBe(14);
  });

  it('maps all 13 bucket interiors and exact lower boundaries to their scores', () => {
    for (let bucket = 0; bucket < 13; bucket += 1) {
      const source = new ScriptedRandomSource([0, 0.999, bucket / 13, (bucket + 0.5) / 13]);
      const game = new MovementGameFactory(source).create();

      expect(game.ship1.agility.score).toBe(8 + bucket);
      expect(game.ship2.agility.score).toBe(8 + bucket);
      expect(source.consumedDraws).toBe(4);
    }
  });

  it('produces every one of the 169 independent agility-score pairs', () => {
    for (let ship1Score = 8; ship1Score <= 20; ship1Score += 1) {
      for (let ship2Score = 8; ship2Score <= 20; ship2Score += 1) {
        const { game, source } = createWithScores(ship1Score, ship2Score);

        expect([game.ship1.agility.score, game.ship2.agility.score]).toEqual([
          ship1Score,
          ship2Score,
        ]);
        expect(source.consumedDraws).toBe(4);
      }
    }
  });

  it('rejects invalid agility draws without rerolling or publishing a partial game', () => {
    for (const [draws, expectedCount] of [
      [[0.01, 0.99, -0.1, 0.5], 3],
      [[0.01, 0.99, 0.5, 1], 4],
      [[0.01, 0.99, Number.NaN, 0.5], 3],
    ] as const) {
      const source = new ScriptedRandomSource(draws);
      const factory = new MovementGameFactory(source);

      expect(() => factory.create()).toThrow(RangeError);
      expect(source.consumedDraws).toBe(expectedCount);
    }
  });

  it('covers all agility scores for both ships in a deterministic 1,000-game run', () => {
    const draws: number[] = [];
    for (let gameIndex = 0; gameIndex < 1000; gameIndex += 1) {
      draws.push(0.25, 0.75, ((gameIndex % 13) + 0.5) / 13, (((gameIndex * 7) % 13) + 0.5) / 13);
    }
    const source = new ScriptedRandomSource(draws);
    const factory = new MovementGameFactory(source);
    const ship1Scores = new Set<number>();
    const ship2Scores = new Set<number>();

    for (let gameIndex = 0; gameIndex < 1000; gameIndex += 1) {
      const game = factory.create();
      ship1Scores.add(game.ship1.agility.score);
      ship2Scores.add(game.ship2.agility.score);
    }

    expect(ship1Scores).toEqual(new Set(Array.from({ length: 13 }, (_, index) => index + 8)));
    expect(ship2Scores).toEqual(new Set(Array.from({ length: 13 }, (_, index) => index + 8)));
    expect(source.consumedDraws).toBe(4000);
  });
});
