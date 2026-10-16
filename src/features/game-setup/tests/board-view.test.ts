import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { BoardPosition } from '../domain/BoardPosition.js';
import { GameSetup } from '../domain/GameSetup.js';
import { BoardGeometry } from '../presentation/BoardGeometry.js';
import { BoardView } from '../presentation/BoardView.js';

describe('BoardView', () => {
  it('draws the square grid and labeled markers before publishing the rendered revision', () => {
    let postRender: (() => void) | undefined;
    const graphics = {
      clear: vi.fn().mockReturnThis(),
      fillStyle: vi.fn().mockReturnThis(),
      fillRect: vi.fn().mockReturnThis(),
      lineStyle: vi.fn().mockReturnThis(),
      lineBetween: vi.fn().mockReturnThis(),
      fillCircle: vi.fn().mockReturnThis(),
      strokeCircle: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
    const labels = [];
    const addText = vi.fn((_x: number, _y: number, text: string) => {
      const label = {
        text,
        setOrigin: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };
      labels.push(label);
      return label;
    });
    const events = {
      once: vi.fn((_event: string, callback: () => void) => {
        postRender = callback;
      }),
    };
    const scene = {
      add: {
        graphics: vi.fn(() => graphics),
        text: addText,
      },
      game: { events },
    } as unknown as Phaser.Scene;
    const setup = new GameSetup(
      { identity: 'ship-1', position: new BoardPosition(1, 1) },
      { identity: 'ship-2', position: new BoardPosition(10, 10) },
    );
    const onDrawn = vi.fn();
    const view = new BoardView(scene, new BoardGeometry(600));

    view.draw(setup, 1, onDrawn);

    expect(graphics.lineBetween).toHaveBeenCalledTimes(22);
    expect(graphics.fillCircle).toHaveBeenCalledTimes(2);
    expect(addText.mock.calls.map((call) => call[2])).toEqual(['1', '2']);
    expect(events.once).toHaveBeenCalledWith('postrender', expect.any(Function));
    expect(onDrawn).not.toHaveBeenCalled();

    postRender?.();

    expect(onDrawn).toHaveBeenCalledWith(1);
  });
});
