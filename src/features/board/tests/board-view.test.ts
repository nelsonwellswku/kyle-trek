import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { BoardPosition } from '../domain/BoardPosition.js';
import { BoardSnapshot } from '../domain/BoardSnapshot.js';
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
        container: vi.fn(() => ({
          setPosition: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        })),
      },
      game: { events },
    } as unknown as Phaser.Scene;
    const snapshot = new BoardSnapshot(
      { identity: 'ship-1', position: new BoardPosition(1, 1) },
      { identity: 'ship-2', position: new BoardPosition(10, 10) },
    );
    const onDrawn = vi.fn();
    const view = new BoardView(scene, new BoardGeometry(600));

    view.draw(snapshot, 1, onDrawn);

    expect(graphics.lineBetween).toHaveBeenCalledTimes(22);
    expect(graphics.fillCircle).toHaveBeenCalledTimes(2);
    expect(addText.mock.calls.map((call) => call[2])).toEqual(['1', '2']);
    expect(events.once).toHaveBeenCalledWith('postrender', expect.any(Function));
    expect(onDrawn).not.toHaveBeenCalled();

    postRender?.();

    expect(onDrawn).toHaveBeenCalledWith(1);
  });

  it('renders exact destination overlays and keeps each ship marker/label independently movable', () => {
    const graphics: Array<{
      clear: ReturnType<typeof vi.fn>;
      fillStyle: ReturnType<typeof vi.fn>;
      fillRect: ReturnType<typeof vi.fn>;
      lineStyle: ReturnType<typeof vi.fn>;
      lineBetween: ReturnType<typeof vi.fn>;
      strokeRect: ReturnType<typeof vi.fn>;
      fillCircle: ReturnType<typeof vi.fn>;
      strokeCircle: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    }> = [];
    const containers: Array<{
      x: number;
      y: number;
      children: readonly unknown[];
      setPosition: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    }> = [];
    const textStyles: Array<{ fontSize?: string; shadow?: unknown }> = [];
    const addGraphics = vi.fn(() => {
      const item = {
        clear: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        lineBetween: vi.fn().mockReturnThis(),
        strokeRect: vi.fn().mockReturnThis(),
        fillCircle: vi.fn().mockReturnThis(),
        strokeCircle: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };
      graphics.push(item);
      return item;
    });
    const addText = vi.fn(
      (_x: number, _y: number, text: string, style: { fontSize?: string; shadow?: unknown }) => {
        textStyles.push(style);
        return {
          text,
          setOrigin: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        };
      },
    );
    const addContainer = vi.fn((x: number, y: number, children: readonly unknown[]) => {
      const container = {
        x,
        y,
        children,
        setPosition: vi.fn(function (this: { x: number; y: number }, nextX: number, nextY: number) {
          this.x = nextX;
          this.y = nextY;
          return this;
        }),
        destroy: vi.fn(),
      };
      containers.push(container);
      return container;
    });
    const scene = {
      add: { graphics: addGraphics, text: addText, container: addContainer },
      game: { events: { once: vi.fn(), off: vi.fn() } },
    } as unknown as Phaser.Scene;
    const view = new BoardView(scene, new BoardGeometry(600));
    const snapshot = new BoardSnapshot(
      { identity: 'ship-1', position: new BoardPosition(5, 5) },
      { identity: 'ship-2', position: new BoardPosition(10, 10) },
    );

    view.setHighlights([new BoardPosition(5, 6), new BoardPosition(6, 6)]);
    view.draw(snapshot, 1, vi.fn());

    const highlightLayer = graphics.find((item) => item.strokeRect.mock.calls.length > 0);
    const gridIndex = graphics.findIndex((item) => item.lineBetween.mock.calls.length > 0);
    const highlightIndex = highlightLayer ? graphics.indexOf(highlightLayer) : -1;
    expect(highlightIndex).toBeGreaterThan(gridIndex);
    expect(highlightLayer?.clear).toHaveBeenCalledTimes(1);
    expect(highlightLayer?.strokeRect).toHaveBeenCalledTimes(2);
    expect(highlightLayer?.fillCircle).toHaveBeenCalledTimes(2);
    expect(containers).toHaveLength(2);
    expect(containers[0]?.children).toHaveLength(2);
    expect(containers[1]?.children).toHaveLength(2);
    expect(textStyles).toHaveLength(2);
    expect(containers[0]?.x).toBe(270);
    expect(containers[0]?.y).toBe(270);

    view.setShipVisualPosition('ship-1', { x: 330, y: 270 });
    expect(containers[0]?.x).toBe(330);
    expect(containers[0]?.y).toBe(270);
    expect(containers[1]?.x).toBe(570);
    expect(containers[1]?.y).toBe(570);

    const envelopeRadius = new BoardGeometry(600).visualEnvelopeRadius();
    const shipMarkers = graphics.filter(
      (item) => item.fillCircle.mock.calls.length > 0 && item.strokeCircle.mock.calls.length > 0,
    );
    expect(shipMarkers).toHaveLength(2);
    for (const marker of shipMarkers) {
      const fillRadius = marker.fillCircle.mock.calls[0]?.[2] as number;
      const strokeRadius = marker.strokeCircle.mock.calls[0]?.[2] as number;
      const outlineWidth = marker.lineStyle.mock.calls[0]?.[0] as number;
      expect(Math.max(fillRadius, strokeRadius + outlineWidth / 2)).toBeLessThanOrEqual(
        envelopeRadius,
      );
    }
    for (const style of textStyles) {
      expect(Number.parseFloat(style.fontSize ?? '0')).toBeLessThanOrEqual(envelopeRadius * 0.7);
      expect(style.shadow).toBeUndefined();
    }

    view.setHighlights([]);
    expect(highlightLayer?.clear).toHaveBeenCalled();
    expect(highlightLayer?.strokeRect).toHaveBeenCalledTimes(2);
  });
});
