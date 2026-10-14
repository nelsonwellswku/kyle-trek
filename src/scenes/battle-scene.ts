import {
  Actor,
  Color,
  Engine,
  Polygon,
  Rectangle,
  Scene,
  TileMap,
  Vector,
} from 'excalibur';
import type { BoardConfig, GameSetup, ShipId } from '../sim/types.js';

/** Fixed canvas size (matches the Engine created in main.ts). */
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;
const BOARD_MARGIN = 60;

/** Board cell styling (tuning-independent; ship visuals come from config). */
const CELL_FILL = '#0b1020';
const CELL_BORDER = '#334155';

/**
 * Presentation-only battle board (T014): maps a validated GameSetup onto an
 * Excalibur TileMap plus two ship Actors. Reads sim state, never mutates it,
 * never rolls RNG. Guarantees per contracts/scene-contract.md.
 */
export class BattleScene extends Scene {
  constructor(
    private readonly setup: GameSetup,
    private readonly config: BoardConfig,
  ) {
    super();
  }

  override onInitialize(_engine: Engine): void {
    const { rows, cols } = this.setup.grid;
    const tile = Math.max(
      8,
      Math.floor(
        Math.min(
          (VIEW_WIDTH - BOARD_MARGIN * 2) / cols,
          (VIEW_HEIGHT - BOARD_MARGIN * 2) / rows,
        ),
      ),
    );
    const originX = Math.floor((VIEW_WIDTH - tile * cols) / 2);
    const originY = Math.floor((VIEW_HEIGHT - tile * rows) / 2);

    const tilemap = new TileMap({
      pos: new Vector(originX, originY),
      tileWidth: tile,
      tileHeight: tile,
      columns: cols,
      rows,
    });
    const cellGraphic = new Rectangle({
      width: tile - 2,
      height: tile - 2,
      color: Color.fromHex(CELL_FILL),
      strokeColor: Color.fromHex(CELL_BORDER),
      lineWidth: 2,
    });
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        tilemap.getTile(x, y)?.addGraphic(cellGraphic, {
          offset: new Vector(1, 1),
        });
      }
    }
    this.add(tilemap);

    for (const ship of this.setup.ships) {
      const visual = this.config.ships.find((s) => s.id === ship.id);
      if (visual === undefined) {
        throw new Error(
          `battle-scene: no visual configured for ${ship.id} (ships[])`,
        );
      }
      const actor = new Actor({
        x: originX + (ship.position.col - 1) * tile + tile / 2,
        y: originY + (ship.position.row - 1) * tile + tile / 2,
        anchor: Vector.Half,
      });
      actor.graphics.add(
        shipGraphic(ship.id, visual.shape, tile, Color.fromHex(visual.color)),
      );
      this.add(actor);
    }
  }
}

/**
 * Resolve a config shape key to a centered procedural polygon.
 * Unknown keys throw — a misconfigured ship must fail loudly, never render
 * as an invisible or default marker.
 */
function shipGraphic(
  id: ShipId,
  shape: string,
  tile: number,
  color: Color,
): Polygon {
  const radius = tile * 0.34;
  const ring = (sides: number): Vector[] => {
    const points: Vector[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
      points.push(
        new Vector(radius * Math.cos(angle), radius * Math.sin(angle)),
      );
    }
    return points;
  };
  switch (shape) {
    case 'triangle':
      return new Polygon({ points: ring(3), color });
    case 'pentagon':
      return new Polygon({ points: ring(5), color });
    default:
      throw new Error(
        `battle-scene: unknown ship shape "${shape}" for ${id} ` +
          `(expected "triangle" or "pentagon")`,
      );
  }
}
