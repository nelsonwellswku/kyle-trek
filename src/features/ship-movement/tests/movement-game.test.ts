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
      ship('ship-1', 'player-1', 3, 3, 3, 12),
      ship('ship-2', 'player-2', 4, 4, 4, 18),
    );

    expect(game.width).toBe(5);
    expect(game.height).toBe(5);
    expect(game.depth).toBe(5);
    expect(game.ship1.owner).toBe('player-1');
    expect(game.ship2.owner).toBe('player-2');
    expect(game.ship1.position).toEqual(new CubePosition(3, 3, 3));
    expect(game.ship2.position).toEqual(new CubePosition(4, 4, 4));
    expect(game.ship1.agility.score).toBe(12);
    expect(Object.isFrozen(game)).toBe(true);
    expect(Object.isFrozen(game.ship1)).toBe(true);
  });

  it('rejects owner/identity mismatches and overlapping positions', () => {
    expect(
      () =>
        new MovementGame(
          ship('ship-1', 'player-2', 3, 3, 3, 12),
          ship('ship-2', 'player-2', 4, 4, 4, 18),
        ),
    ).toThrow(RangeError);
    expect(
      () =>
        new MovementGame(
          ship('ship-1', 'player-1', 3, 3, 3, 12),
          ship('ship-2', 'player-2', 3, 3, 3, 18),
        ),
    ).toThrow(RangeError);
  });

  it('moves by creating a replacement cube game without mutating the prior snapshot or stats', () => {
    const game = new MovementGame(
      ship('ship-1', 'player-1', 3, 3, 3, 12),
      ship('ship-2', 'player-2', 5, 5, 5, 18),
    );
    const moved = game.withPosition('ship-1', new CubePosition(3, 3, 4));

    expect(moved).not.toBe(game);
    expect(game.ship1.position).toEqual(new CubePosition(3, 3, 3));
    expect(moved.ship1.position).toEqual(new CubePosition(3, 3, 4));
    expect(moved.ship1.agility).toBe(game.ship1.agility);
    expect(moved.ship2).toEqual(game.ship2);
    expect(moved.occupantAt(new CubePosition(3, 3, 4))).toBe('ship-1');
  });
});
