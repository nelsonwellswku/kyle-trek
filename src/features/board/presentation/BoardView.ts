import type Phaser from 'phaser';
import type { BoardSnapshot, ShipIdentity } from '../domain/BoardSnapshot.js';
import type { BoardGeometry, BoardPoint } from './BoardGeometry.js';
import { BoardPosition } from '../domain/BoardPosition.js';

export type RenderedRevisionHandler = (revision: number) => void;

export class BoardView {
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private highlightGraphics: Phaser.GameObjects.Graphics | null = null;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly shipGraphics: Phaser.GameObjects.Graphics[] = [];
  private readonly shipContainers = new Map<ShipIdentity, Phaser.GameObjects.Container>();
  private readonly pendingReadiness = new Set<() => void>();
  private currentHighlights: readonly BoardPosition[] = [];
  private isDisposed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly geometry: BoardGeometry,
  ) {}

  draw(
    snapshot: BoardSnapshot,
    revision: number,
    onDrawn: RenderedRevisionHandler,
    highlights?: readonly BoardPosition[],
  ): void {
    if (this.isDisposed) {
      throw new Error('A disposed BoardView cannot draw another revision.');
    }

    const graphics = this.graphics ?? this.scene.add.graphics();
    this.graphics = graphics;
    graphics.clear();
    this.destroyShipGroups();

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

    this.drawShip(snapshot.ship1, '1', 0x32d7ff);
    this.drawShip(snapshot.ship2, '2', 0xffbf5f);
    if (highlights !== undefined) {
      this.currentHighlights = Object.freeze([...highlights]);
    }
    this.renderHighlights();

    const onPostRender = (): void => {
      this.pendingReadiness.delete(onPostRender);
      if (!this.isDisposed) {
        onDrawn(revision);
      }
    };

    this.pendingReadiness.add(onPostRender);
    this.scene.game.events.once('postrender', onPostRender);
  }

  setHighlights(destinations: readonly BoardPosition[]): void {
    if (this.isDisposed) {
      return;
    }

    this.currentHighlights = Object.freeze([...destinations]);
    this.renderHighlights();
  }

  private renderHighlights(): void {
    if (this.isDisposed || !this.graphics) {
      return;
    }

    const graphics = this.highlightGraphics ?? this.scene.add.graphics();
    this.highlightGraphics = graphics;
    graphics.clear();

    for (const destination of this.currentHighlights) {
      const bounds = this.geometry.cellBounds(destination);
      const center = this.geometry.cellCenter(destination);
      graphics
        .lineStyle(3, 0x91efff, 1)
        .strokeRect(bounds.x + 4, bounds.y + 4, bounds.width - 8, bounds.height - 8)
        .fillStyle(0xffffff, 1)
        .fillCircle(center.x, center.y, 3);
    }
  }

  setShipPosition(identity: ShipIdentity, position: BoardPosition): void {
    this.setShipVisualPosition(identity, this.geometry.cellCenter(position));
  }

  setShipVisualPosition(identity: ShipIdentity, point: BoardPoint): void {
    if (this.isDisposed || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return;
    }

    const container = this.shipContainers.get(identity);
    container?.setPosition(point.x, point.y);
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
    this.highlightGraphics?.destroy();
    this.highlightGraphics = null;
    this.destroyShipGroups();
  }

  private drawShip(placement: BoardSnapshot['ship1'], label: string, color: number): void {
    const center = this.geometry.cellCenter(placement.position);
    const bounds = this.geometry.markerBounds(placement.position);
    const radius = Math.min(bounds.width, bounds.height) / 2;
    const marker = this.scene.add.graphics();
    marker
      .fillStyle(color, 1)
      .fillCircle(0, 0, radius)
      .lineStyle(2, 0xffffff, 1)
      .strokeCircle(0, 0, radius);
    const text = this.scene.add
      .text(0, 0, label, {
        align: 'center',
        color: '#071523',
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Math.max(12, bounds.width * 0.4)}px`,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const container = this.scene.add.container(center.x, center.y, [marker, text]);
    this.shipGraphics.push(marker);
    this.labels.push(text);
    this.shipContainers.set(placement.identity, container);
  }

  private destroyShipGroups(): void {
    for (const container of this.shipContainers.values()) {
      container.destroy();
    }
    this.shipContainers.clear();
    for (const graphic of this.shipGraphics) {
      graphic.destroy();
    }
    this.shipGraphics.length = 0;
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels.length = 0;
  }
}
