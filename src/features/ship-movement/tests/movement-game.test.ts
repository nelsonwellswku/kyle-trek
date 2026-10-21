import { describe, expect, it } from 'vitest';
import { CubePosition } from '../../board/domain/CubePosition.js';
import { AgilityStat } from '../domain/AgilityStat.js';
import { MovementGame, type MovementShip } from '../domain/MovementGame.js';

function ship(
  identity: MovementShip['identity'],
  owner: MovementShip['owner'],
  x: number,
  y: number,
  z: number,
  score: number,
): MovementShip {
  return { identity, owner, position: new CubePosition(x, y, z), agility: new AgilityStat(score) };
}

describe('MovementGame', () => {
  it('accepts two distinct cube positions and retains immutable stats', () => {
    const game = new MovementGame(
      ship('ship-1', 'player-1', 5, 5, 5, 12),
      ship('ship-2', 'player-2', 6, 6, 6, 18),
    );

    expect(game.width).toBe(10);
    expect(game.height).toBe(10);
    expect(game.depth).toBe(10);
    expect(game.ship1.owner).toBe('player-1');
    expect(game.ship2.owner).toBe('player-2');
    expect(game.ship1.position).toEqual(new CubePosition(5, 5, 5));
    expect(game.ship2.position).toEqual(new CubePosition(6, 6, 6));
    expect(game.ship1.agility.score).toBe(12);
    expect(Object.isFrozen(game)).toBe(true);
    expect(Object.isFrozen(game.ship1)).toBe(true);
  });

  it('rejects owner/identity mismatches and overlapping positions', () => {
    expect(
      () =>
        new MovementGame(
          ship('ship-1', 'player-2', 5, 5, 5, 12),
          ship('ship-2', 'player-2', 6, 6, 6, 18),
        ),
    ).toThrow(RangeError);
    expect(
      () =>
        new MovementGame(
          ship('ship-1', 'player-1', 5, 5, 5, 12),
          ship('ship-2', 'player-2', 5, 5, 5, 18),
        ),
    ).toThrow(RangeError);
  });

  it('moves by creating a replacement cube game without mutating the prior snapshot or stats', () => {
    const game = new MovementGame(
      ship('ship-1', 'player-1', 5, 5, 5, 12),
      ship('ship-2', 'player-2', 10, 10, 10, 18),
    );
    const moved = game.withPosition('ship-1', new CubePosition(5, 5, 6));

    expect(moved).not.toBe(game);
    expect(game.ship1.position).toEqual(new CubePosition(5, 5, 5));
    expect(moved.ship1.position).toEqual(new CubePosition(5, 5, 6));
    expect(moved.ship1.agility).toBe(game.ship1.agility);
    expect(moved.ship2).toEqual(game.ship2);
    expect(moved.occupantAt(new CubePosition(5, 5, 6))).toBe('ship-1');
  });
});
