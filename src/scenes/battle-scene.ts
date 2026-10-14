import {
  Actor,
  Circle,
  Color,
  Engine,
  Font,
  Label,
  Polygon,
  Rectangle,
  Scene,
  TileMap,
  Vector,
} from 'excalibur';
import { initialTurn, resolveMove } from '../sim/turn.js';
import type {
  BoardConfig,
  GameSetup,
  ShipId,
  TurnState,
} from '../sim/types.js';

/** Fixed canvas size (matches the Engine created in main.ts). */
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;
const BOARD_MARGIN = 60;

/** Board cell styling (tuning-independent; ship visuals come from config). */
const CELL_FILL = '#0b1020';
const CELL_BORDER = '#334155';

/** Highlight styling: amber markers; move vs. stay differ by SHAPE
 * (hollow ring vs. solid halo disc), never by color alone. */
const HIGHLIGHT = '#facc15';

/**
 * Presentation-only battle board: maps a validated GameSetup onto an
 * Excalibur TileMap plus two ship Actors, with US2 highlight markers for the
 * active turn's legal destinations, US3 left-click move dispatch, and a turn
 * status display. Reads sim state, advances it only through the pure turn
 * reducer, never rolls RNG. Guarantees per contracts/scene-contract.md (001)
 * and contracts/movement-scene-contract.md (guarantees 1-5).
 */
export class BattleScene extends Scene {
  private tile = 0;
  private originX = 0;
  private originY = 0;
  /** Current known ship positions (setup at first; updated on accepted moves). */
  private readonly positions = new Map<ShipId, { row: number; col: number }>();
  /** Active highlight marker actors, cleared on every turn change. */
  private markers: Actor[] = [];
  /** Frozen active turn; advanced only by accepted reducer results. */
  private turn: TurnState | null = null;
  private readonly shipActors = new Map<ShipId, Actor>();
  private status: Label | null = null;

  constructor(
    private readonly setup: GameSetup,
    private readonly config: BoardConfig,
  ) {
    super();
  }

  override onInitialize(engine: Engine): void {
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
    this.tile = tile;
    this.originX = Math.floor((VIEW_WIDTH - tile * cols) / 2);
    this.originY = Math.floor((VIEW_HEIGHT - tile * rows) / 2);
    const originX = this.originX;
    const originY = this.originY;

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
      this.positions.set(ship.id, { ...ship.position });
    }

    this.status = new Label({
      x: VIEW_WIDTH / 2,
      y: 30,
      anchor: Vector.Half,
      font: new Font({ size: 16, family: 'monospace', color: Color.White }),
    });
    this.status.z = 3;
    this.add(this.status);

    // Initial turn is always ship-1 (FR-003).
    this.advanceTo(
      initialTurn({
        rows: this.setup.grid.rows,
        cols: this.setup.grid.cols,
        ships: this.setup.ships,
      }),
    );

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
      actor.z = 2;
      this.add(actor);
      this.shipActors.set(ship.id, actor);
    }

    engine.input.pointers.on('down', (pointer) => {
      this.onLeftClick(pointer.screenPos);
    });
  }

  /**
   * Single-action left-click dispatch (US3, contract guarantee 5): map the
   * click to a board cell and feed it to the turn reducer. Accepted moves
   * (including stay-in-place) relocate the ship actor and rotate the turn;
   * anything else — off-board, non-highlighted, or opponent-occupied cells —
   * is ignored with no state change (FR-009).
   */
  private onLeftClick(screenPos: Vector): void {
    if (this.turn === null) return;
    const col = Math.floor((screenPos.x - this.originX) / this.tile) + 1;
    const row = Math.floor((screenPos.y - this.originY) / this.tile) + 1;
    if (
      row < 1 ||
      row > this.setup.grid.rows ||
      col < 1 ||
      col > this.setup.grid.cols
    ) {
      return;
    }
    const result = resolveMove(
      this.turn,
      {
        rows: this.setup.grid.rows,
        cols: this.setup.grid.cols,
        ships: this.setup.ships.map((s) => ({
          ...s,
          position: { ...this.positionOf(s.id) },
        })),
      },
      { row, col },
    );
    if (!result.accepted) return;
    this.positions.set(result.move.shipId, { ...result.move.to });
    const actor = this.shipActors.get(result.move.shipId);
    if (actor !== undefined) {
      actor.pos.x =
        this.originX + (result.move.to.col - 1) * this.tile + this.tile / 2;
      actor.pos.y =
        this.originY + (result.move.to.row - 1) * this.tile + this.tile / 2;
    }
    this.advanceTo(result.next);
  }

  /** Rotate to a new turn: refresh markers and the status display together,
   * so the board never shows a new turn with stale highlights or text. */
  private advanceTo(turn: TurnState): void {
    this.turn = turn;
    this.renderLegalSet(turn);
    this.renderStatus(turn);
  }

  /** Turn ownership + explainable range (US3, contract guarantees 1-2):
   * active player/ship on line one, every ship's agility stat and derived
   * modifier on line two. */
  private renderStatus(turn: TurnState): void {
    if (this.status === null) return;
    const activePlayer = turn.activeShipId === 'ship-1' ? 'Player 1' : 'Player 2';
    const stats = this.setup.ships
      .map((s) => {
        const sign = s.agilityModifier >= 0 ? '+' : '';
        return `${s.id}: agility ${s.agility} (${sign}${s.agilityModifier})`;
      })
      .join(' · ');
    this.status.text =
      `Turn ${turn.turnNumber} — ${activePlayer} (${turn.activeShipId}) to move\n` +
      stats;
  }

  private positionOf(id: ShipId): { row: number; col: number } {
    const pos = this.positions.get(id);
    if (pos === undefined) {
      throw new Error(`battle-scene: no known position for ${id}`);
    }
    return pos;
  }

  /**
   * Draw highlight markers for a turn's frozen legal set (US2, contract
   * guarantees 3-4): every member marked, nothing outside it. Clears the
   * previous turn's markers first. The stay-in-place (origin) cell gets a
   * solid halo disc behind the active ship; relocation cells get hollow
   * rings — distinct shapes, never color alone. Markers sit above the board
   * (z=1) and below the ships (z=2) regardless of add order.
   */
  renderLegalSet(turn: TurnState): void {
    for (const marker of this.markers) {
      this.remove(marker);
    }
    this.markers = [];

    const activePos = this.positionOf(turn.activeShipId);
    for (const cell of turn.legalSet) {
      const isOrigin = cell.row === activePos.row && cell.col === activePos.col;
      const marker = new Actor({
        x: this.originX + (cell.col - 1) * this.tile + this.tile / 2,
        y: this.originY + (cell.row - 1) * this.tile + this.tile / 2,
        anchor: Vector.Half,
      });
      marker.graphics.add(
        isOrigin ? stayMarker(this.tile) : moveMarker(this.tile),
      );
      marker.z = 1;
      this.add(marker);
      this.markers.push(marker);
    }
  }
}

/**
 * Hollow ring for relocation destinations: transparent fill with a thick
 * amber outline — an outline shape, readable without color.
 */
function moveMarker(tile: number): Circle {
  return new Circle({
    radius: tile * 0.3,
    color: Color.Transparent,
    strokeColor: Color.fromHex(HIGHLIGHT),
    lineWidth: 3,
  });
}

/**
 * Solid halo disc for the stay-in-place (origin) cell: drawn before (under)
 * the active ship actor, slightly larger than the ship graphic, so the ship
 * sits on a backplate — a filled shape, distinct from the hollow move rings.
 */
function stayMarker(tile: number): Circle {
  return new Circle({
    radius: tile * 0.44,
    color: Color.fromHex(HIGHLIGHT),
  });
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
