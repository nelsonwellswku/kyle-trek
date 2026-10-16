import type Phaser from 'phaser';
import type { GameSetup } from '../domain/GameSetup.js';
import type { BoardGeometry } from './BoardGeometry.js';

export type RenderedRevisionHandler = (revision: number) => void;

export class BoardView {
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly pendingReadiness = new Set<() => void>();
  private isDisposed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly geometry: BoardGeometry,
  ) {}

  draw(setup: GameSetup, revision: number, onDrawn: RenderedRevisionHandler): void {
    if (this.isDisposed) {
      throw new Error('A disposed BoardView cannot draw another revision.');
    }

    const graphics = this.graphics ?? this.scene.add.graphics();
    this.graphics = graphics;
    graphics.clear();

    for (const label of this.labels) {
      label.destroy();
    }
    this.labels.length = 0;

    graphics
      .fillStyle(0x0b1b2b, 1)
      .fillRect(0, 0, this.geometry.logicalSize, this.geometry.logicalSize);
    graphics.lineStyle(2, 0x54718e, 1);

    const cellSize = this.geometry.logicalSize / 10;
    for (let line = 0; line <= 10; line += 1) {
      const offset = line * cellSize;
      graphics.lineBetween(0, offset, this.geometry.logicalSize, offset);
      graphics.lineBetween(offset, 0, offset, this.geometry.logicalSize);
    }

    this.drawShip(setup.ship1, '1', 0x32d7ff);
    this.drawShip(setup.ship2, '2', 0xffbf5f);

    const onPostRender = (): void => {
      this.pendingReadiness.delete(onPostRender);
      if (!this.isDisposed) {
        onDrawn(revision);
      }
    };

    this.pendingReadiness.add(onPostRender);
    this.scene.game.events.once('postrender', onPostRender);
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    for (const listener of this.pendingReadiness) {
      this.scene.game.events.off('postrender', listener);
    }
    this.pendingReadiness.clear();

    this.graphics?.destroy();
    this.graphics = null;
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels.length = 0;
  }

  private drawShip(placement: GameSetup['ship1'], label: string, color: number): void {
    const center = this.geometry.cellCenter(placement.position);
    const bounds = this.geometry.markerBounds(placement.position);
    const radius = Math.min(bounds.width, bounds.height) / 2;

    this.graphics?.fillStyle(color, 1).fillCircle(center.x, center.y, radius);
    this.graphics?.lineStyle(2, 0xffffff, 1).strokeCircle(center.x, center.y, radius);
    const text = this.scene.add
      .text(center.x, center.y, label, {
        align: 'center',
        color: '#071523',
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Math.max(12, bounds.width * 0.4)}px`,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.labels.push(text);
  }
}
