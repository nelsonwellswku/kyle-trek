import {
  Actor,
  Circle,
  Color,
  Engine,
  Font,
  Keys,
  Label,
  Polygon,
  Rectangle,
  Scene,
  TileMap,
  Vector,
} from 'excalibur';
import {
  dispatchAttack,
  endTurnEarly,
  initialTurn,
  resolveMove,
  skipMove,
} from '../sim/turn.js';
import type {
  AttackOutcome,
  BoardConfig,
  GameSetup,
  Rng,
  ShipId,
  Spaceship,
  TurnState,
} from '../sim/types.js';

/** Fixed canvas size (matches the Engine created in main.ts). */
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;
const BOARD_MARGIN = 60;
/** Extra headroom above the grid for the multi-line status text. */
const BOARD_TOP_MARGIN = 112;
/** Status text styling: small monospace, anchored top-center. */
const STATUS_FONT_SIZE = 14;
const STATUS_TOP = 8;

/** Bottom-strip action buttons (skip controls, FR-020). */
const BUTTON_WIDTH = 180;
const BUTTON_HEIGHT = 30;
const BUTTON_Y = 572;
const SKIP_BUTTON_X = 300;
const END_BUTTON_X = 500;
const BUTTON_FILL = '#1e293b';
const BUTTON_FILL_DISABLED = '#0f172a';
const BUTTON_BORDER = '#facc15';
const BUTTON_TEXT_SIZE = 13;

/** Board cell styling (tuning-independent; ship visuals come from config). */
const CELL_FILL = '#0b1020';
const CELL_BORDER = '#334155';

/** Highlight styling: amber markers; move vs. stay differ by SHAPE
 * (hollow ring vs. solid halo disc), never by color alone. */
const HIGHLIGHT = '#facc15';

/** Photon-torpedo styling (presentation-only; path/speed come from config). */
const TORPEDO_FILL = '#fef08a';
const TORPEDO_Z = 5;
/** Contact-explosion styling: expanding amber ring fading out. */
const EXPLOSION_TTL_MS = 450;

/**
 * Presentation-only battle board: maps a validated GameSetup onto an
 * Excalibur TileMap plus two ship Actors, with highlight markers for the
 * active turn's legal destinations, left-click move/attack dispatch, skip
 * controls, and a turn status display. Reads sim state, advances it only
 * through the pure turn reducer, never rolls RNG except via the injected
 * seedable source for attacks. Guarantees per contracts/scene-contract.md
 * (001), contracts/movement-scene-contract.md (guarantees 1-5), and
 * contracts/combat-scene-contract.md (all 10 guarantees).
 */
export class BattleScene extends Scene {
  private tile = 0;
  private originX = 0;
  private originY = 0;
  /** Current known ship positions (setup at first; updated on accepted moves). */
  private readonly positions = new Map<ShipId, { row: number; col: number }>();
  /** Current known hit points (setup at first; updated on accepted attacks). */
  private readonly hitPoints = new Map<ShipId, number>();
  /** Active highlight marker actors, cleared on every turn change. */
  private markers: Actor[] = [];
  /** Frozen active turn; advanced only by accepted reducer results. */
  private turn: TurnState | null = null;
  private readonly shipActors = new Map<ShipId, Actor>();
  private status: Label | null = null;
  private skipButton: ButtonControl | null = null;
  private endButton: ButtonControl | null = null;
  /** Formatted last-attack outcome for the status display (T027). */
  private lastOutcome: string | null = null;
  /** In-flight torpedoes and contact explosions (presentation-only). */
  private fx: ActiveFx[] = [];

  constructor(
    private readonly setup: GameSetup,
    private readonly config: BoardConfig,
    private readonly rng: Rng,
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
          (VIEW_HEIGHT - BOARD_TOP_MARGIN - BOARD_MARGIN) / rows,
        ),
      ),
    );
    this.tile = tile;
    this.originX = Math.floor((VIEW_WIDTH - tile * cols) / 2);
    this.originY =
      BOARD_TOP_MARGIN +
      Math.floor(
        (VIEW_HEIGHT - BOARD_TOP_MARGIN - BOARD_MARGIN - tile * rows) / 2,
      );
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
      this.hitPoints.set(ship.id, ship.hitPoints);
    }

    this.status = new Label({
      x: VIEW_WIDTH / 2,
      y: STATUS_TOP,
      anchor: new Vector(0.5, 0),
      font: new Font({
        size: STATUS_FONT_SIZE,
        family: 'monospace',
        color: Color.White,
      }),
    });
    this.status.z = 3;
    this.add(this.status);

    // Initial turn is always ship-1 (FR-003).
    this.advanceTo(
      initialTurn({
        rows: this.setup.grid.rows,
        cols: this.setup.grid.cols,
        ships: this.simShips(),
      }),
    );

    this.skipButton = this.makeButton(SKIP_BUTTON_X, 'Skip Move (M)');
    this.endButton = this.makeButton(END_BUTTON_X, 'End Turn (E)');
    this.refreshButtons();

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
    engine.input.keyboard.on('press', (event) => {
      if (event.key === Keys.M) {
        this.doSkipMove();
      } else if (event.key === Keys.E || event.key === Keys.Enter) {
        this.doEndTurn();
      } else if (event.key === Keys.A) {
        this.doAttackFoe();
      }
    });
  }

  /**
   * Two-action left-click dispatch (FR-006/FR-009, contract guarantees 3+8):
   * bottom-strip buttons first, then the board cell — the enemy ship launches
   * one torpedo while the attack is unused, a highlighted square moves while
   * the move is unused, and anything else (off-board, empty or own-ship
   * squares, used actions, finished game) is ignored with no state change
   * and no roll consumed.
   */
  private onLeftClick(screenPos: Vector): void {
    if (this.turn === null || this.turn.over !== null) return;
    const button = this.buttonAt(screenPos);
    if (button === 'skip') {
      this.doSkipMove();
      return;
    }
    if (button === 'end') {
      this.doEndTurn();
      return;
    }
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
    const board = {
      rows: this.setup.grid.rows,
      cols: this.setup.grid.cols,
      ships: this.simShips(),
    };
    const foeId: ShipId =
      this.turn.activeShipId === 'ship-1' ? 'ship-2' : 'ship-1';
    const foePos = this.positionOf(foeId);
    if (row === foePos.row && col === foePos.col) {
      this.doAttackFoe();
      return;
    }
    if (this.turn.moveUsed) return;
    const result = resolveMove(this.turn, board, { row, col });
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

  /** Skip Movement control (FR-007/FR-020): consumes the move, no rolls. */
  private doSkipMove(): void {
    if (this.turn === null || this.turn.over !== null) return;
    if (this.turn.moveUsed) return;
    this.advanceTo(
      skipMove(this.turn, {
        rows: this.setup.grid.rows,
        cols: this.setup.grid.cols,
        ships: this.simShips(),
      }),
    );
  }

  /** End Turn / Skip Attack control (FR-020): passes control, no rolls. */
  private doEndTurn(): void {
    if (this.turn === null || this.turn.over !== null) return;
    this.advanceTo(
      endTurnEarly(this.turn, {
        rows: this.setup.grid.rows,
        cols: this.setup.grid.cols,
        ships: this.simShips(),
      }),
    );
  }

  /**
   * Launch one torpedo at the enemy ship (shared by enemy-ship clicks and
   * the A key so turns are fully keyboard-playable): unlimited range,
   * at most once per turn, ignored with no roll once used or finished.
   */
  private doAttackFoe(): void {
    if (this.turn === null || this.turn.over !== null) return;
    if (this.turn.attackUsed) return;
    const foeId: ShipId =
      this.turn.activeShipId === 'ship-1' ? 'ship-2' : 'ship-1';
    // Capture launch geometry BEFORE reducer updates: the torpedo flies
    // from where the ships stand at launch time.
    const from = this.cellCenter(this.positionOf(this.turn.activeShipId));
    const target = this.cellCenter(this.positionOf(foeId));
    const result = dispatchAttack(
      this.turn,
      {
        rows: this.setup.grid.rows,
        cols: this.setup.grid.cols,
        ships: this.simShips(),
      },
      this.config,
      foeId,
      this.rng,
    );
    if (!result.accepted) return;
    for (const ship of result.ships) {
      this.hitPoints.set(ship.id, ship.hitPoints);
    }
    this.lastOutcome = this.formatOutcome(result.outcome);
    this.launchTorpedo(from, target, result.outcome.hit);
    this.advanceTo(result.next);
  }

  /** Rotate to a new turn: refresh markers, buttons, and status together,
   * so the board never shows a new turn with stale highlights or text. */
  private advanceTo(turn: TurnState): void {
    this.turn = turn;
    this.renderLegalSet(turn);
    this.renderStatus(turn);
    this.refreshButtons();
  }

  /** Turn ownership + remaining actions + explainable stats + last outcome
   * (FR-008/FR-017/FR-018, contract guarantees 1-2, 7, 9): first line names the active player/ship
   * and which actions remain (or declares the winner once the game is over),
   * then agility, then one combat line per ship with LIVE hit points (kept
   * short so each fits the 800px canvas — never join both ships on one
   * line), then the last-attack outcome line. */
  private renderStatus(turn: TurnState): void {
    if (this.status === null) return;
    const activePlayer = turn.activeShipId === 'ship-1' ? 'Player 1' : 'Player 2';
    const head =
      turn.over !== null
        ? `Turn ${turn.turnNumber} — ${turn.over.winner === 'ship-1' ? 'Player 1' : 'Player 2'} (${turn.over.winner}) wins!`
        : `Turn ${turn.turnNumber} — ${activePlayer} (${turn.activeShipId}) · Move: ${turn.moveUsed ? 'used' : 'available'} · Attack: ${turn.attackUsed ? 'used' : 'available (A)'}`;
    const stats = this.setup.ships
      .map((s) => {
        const sign = s.agilityModifier >= 0 ? '+' : '';
        return `${s.id}: agility ${s.agility} (${sign}${s.agilityModifier})`;
      })
      .join(' · ');
    const combatLines = this.setup.ships.map((s) => {
      const strSign = s.strengthModifier >= 0 ? '+' : '';
      const conSign = s.constitutionModifier >= 0 ? '+' : '';
      return (
        `${s.id}: STR ${s.strength} (${strSign}${s.strengthModifier}) · ` +
        `CON ${s.constitution} (${conSign}${s.constitutionModifier}) · ` +
        `HP ${this.hpOf(s.id)}/${s.maxHitPoints} · AC ${s.armorClass}`
      );
    });
    this.status.text =
      head +
      `\n` +
      stats +
      `\n` +
      combatLines.join('\n') +
      `\n` +
      (this.lastOutcome ?? 'Last attack: none yet');
  }

  /**
   * Immediate outcome disclosure (FR-018, contract guarantee 7): attack roll
   * value and total, hit/miss verdict, and on a hit the damage roll value
   * plus the defender's remaining hit points — as text, kept short enough
   * for the 800px canvas.
   */
  private formatOutcome(outcome: AttackOutcome): string {
    const attacker = this.setup.ships.find((s) => s.id === outcome.attackerId);
    const defender = this.setup.ships.find((s) => s.id === outcome.defenderId);
    if (attacker === undefined || defender === undefined) {
      throw new Error('battle-scene: outcome references an unknown ship');
    }
    const sign = attacker.strengthModifier >= 0 ? '+' : '';
    const head =
      `Last attack: roll ${outcome.attackRoll} (${sign}${attacker.strengthModifier}) = ` +
      `${outcome.total} vs AC ${defender.armorClass} → ${outcome.hit ? 'HIT' : 'MISS'}`;
    if (
      !outcome.hit ||
      outcome.damageRoll === undefined ||
      outcome.damage === undefined
    ) {
      return head;
    }
    return (
      head +
      ` · dmg ${outcome.damageRoll} (${sign}${attacker.strengthModifier}) = ` +
      `${outcome.damage} · ${outcome.defenderId} HP ${outcome.defenderHPBefore} → ${outcome.defenderHPAfter}`
    );
  }

  /** Live ship snapshots for reducer dispatches (positions + HP). */
  private simShips(): Spaceship[] {
    return this.setup.ships.map((s) => ({
      ...s,
      position: { ...this.positionOf(s.id) },
      hitPoints: this.hpOf(s.id),
    }));
  }

  private hpOf(id: ShipId): number {
    const hp = this.hitPoints.get(id);
    if (hp === undefined) {
      throw new Error(`battle-scene: no known hit points for ${id}`);
    }
    return hp;
  }

  /**
   * Bottom-strip skip controls (FR-020, contract guarantee 8): in-canvas
   * buttons plus keyboard shortcuts (M skips movement, E/Enter ends the
   * turn, A attacks the foe). Enabled state follows the active turn; a used action reads as
   * text ("Move used"), never by color alone.
   */
  private makeButton(centerX: number, label: string): ButtonControl {
    const fill = new Rectangle({
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      color: Color.fromHex(BUTTON_FILL),
      strokeColor: Color.fromHex(BUTTON_BORDER),
      lineWidth: 2,
    });
    const actor = new Actor({
      x: centerX,
      y: BUTTON_Y,
      anchor: Vector.Half,
    });
    actor.graphics.add(fill);
    const text = new Label({
      anchor: Vector.Half,
      font: new Font({
        size: BUTTON_TEXT_SIZE,
        family: 'monospace',
        color: Color.White,
      }),
      text: label,
    });
    text.z = 4;
    actor.addChild(text);
    actor.z = 3;
    this.add(actor);
    return { centerX, fill, text, baseLabel: label };
  }

  private buttonAt(screenPos: Vector): 'skip' | 'end' | null {
    if (Math.abs(screenPos.y - BUTTON_Y) > BUTTON_HEIGHT / 2) return null;
    if (Math.abs(screenPos.x - SKIP_BUTTON_X) <= BUTTON_WIDTH / 2) {
      return 'skip';
    }
    if (Math.abs(screenPos.x - END_BUTTON_X) <= BUTTON_WIDTH / 2) {
      return 'end';
    }
    return null;
  }

  /** Sync both buttons with the active turn (called on every advance). */
  private refreshButtons(): void {
    const turn = this.turn;
    this.setButton(this.skipButton, turn !== null && turn.over === null && !turn.moveUsed, 'Move used');
    this.setButton(this.endButton, turn !== null && turn.over === null, 'Turn done');
  }

  private setButton(
    button: ButtonControl | null,
    enabled: boolean,
    usedLabel: string,
  ): void {
    if (button === null) return;
    button.fill.color = Color.fromHex(
      enabled ? BUTTON_FILL : BUTTON_FILL_DISABLED,
    );
    button.text.text = enabled ? button.baseLabel : usedLabel;
  }

  private positionOf(id: ShipId): { row: number; col: number } {
    const pos = this.positions.get(id);
    if (pos === undefined) {
      throw new Error(`battle-scene: no known position for ${id}`);
    }
    return pos;
  }

  /** Screen-space center of a board cell. */
  private cellCenter(cell: { readonly row: number; readonly col: number }): Vector {
    return new Vector(
      this.originX + (cell.col - 1) * this.tile + this.tile / 2,
      this.originY + (cell.row - 1) * this.tile + this.tile / 2,
    );
  }

  /**
   * Launch the photon-torpedo visual (FR-015/FR-016, contract guarantees
   * 4-6): a blinking star. On a hit it flies attacker → defender and bursts
   * into a contact explosion; on a miss it flies a near-miss waypoint
   * (perpendicular offset from the defender per data) and continues
   * off-grid with no explosion. Purely presentational — the outcome was
   * already decided by the reducer and is never altered here.
   */
  private launchTorpedo(from: Vector, target: Vector, hit: boolean): void {
    const { blinkHz, speedTilesPerSec, nearMissOffsetTiles } =
      this.config.combat.torpedo;
    const speedPx = speedTilesPerSec * this.tile;
    const star = new Actor({
      x: from.x,
      y: from.y,
      anchor: Vector.Half,
    });
    star.graphics.add(starGraphic(this.tile * 0.22, Color.fromHex(TORPEDO_FILL)));
    star.z = TORPEDO_Z;
    this.add(star);
    if (hit) {
      this.fx.push({
        kind: 'torpedo',
        actor: star,
        waypoints: [target],
        segment: 0,
        speedPx,
        ageMs: 0,
        blinkHz,
        onArrive: () => this.spawnExplosion(target),
      });
      return;
    }
    const direction = target.sub(from);
    const length = direction.distance();
    if (length === 0) {
      this.remove(star);
      return;
    }
    const unit = direction.scale(1 / length);
    const perp = new Vector(-unit.y, unit.x);
    const nearMiss = target.add(perp.scale(nearMissOffsetTiles * this.tile));
    // Continue past the waypoint far enough to leave the canvas from any
    // board position (grid diagonal plus margin).
    const offGrid = nearMiss.add(
      unit.scale(this.tile * (this.setup.grid.rows + this.setup.grid.cols)),
    );
    this.fx.push({
      kind: 'torpedo',
      actor: star,
      waypoints: [nearMiss, offGrid],
      segment: 0,
      speedPx,
      ageMs: 0,
      blinkHz,
      onArrive: () => {},
    });
  }

  /** Contact-explosion visual: an expanding amber ring fading out. */
  private spawnExplosion(at: Vector): void {
    const ring = new Circle({
      radius: this.tile * 0.25,
      color: Color.Transparent,
      strokeColor: Color.fromHex(HIGHLIGHT),
      lineWidth: 4,
    });
    const actor = new Actor({ x: at.x, y: at.y, anchor: Vector.Half });
    actor.graphics.add(ring);
    actor.z = TORPEDO_Z;
    this.add(actor);
    this.fx.push({ kind: 'burst', actor, ageMs: 0 });
  }

  /** Advance torpedo blink/travel and explosion fade; scene-owned timing. */
  override onPostUpdate(_engine: Engine, delta: number): void {
    const live: ActiveFx[] = [];
    for (const effect of this.fx) {
      effect.ageMs += delta;
      if (effect.kind === 'burst') {
        const progress = effect.ageMs / EXPLOSION_TTL_MS;
        if (progress >= 1) {
          this.remove(effect.actor);
          continue;
        }
        const scale = 1 + progress * 2;
        effect.actor.scale.setTo(scale, scale);
        effect.actor.graphics.opacity = 1 - progress;
        live.push(effect);
        continue;
      }
      // Blinking star: hard on/off blink, never color-only signaling.
      const phase = (effect.ageMs / 1000) * effect.blinkHz;
      effect.actor.graphics.opacity = phase % 1 < 0.5 ? 1 : 0.15;
      let step = (effect.speedPx * delta) / 1000;
      let arrived = false;
      while (step > 0 && !arrived) {
        const waypoint = effect.waypoints[effect.segment];
        if (waypoint === undefined) {
          arrived = true;
          break;
        }
        const toWaypoint = waypoint.sub(effect.actor.pos);
        const remaining = toWaypoint.distance();
        if (remaining <= step) {
          effect.actor.pos = waypoint.clone();
          step -= remaining;
          effect.segment++;
          if (effect.segment >= effect.waypoints.length) {
            arrived = true;
          }
        } else {
          effect.actor.pos = effect.actor.pos.add(
            toWaypoint.scale(step / remaining),
          );
          step = 0;
        }
      }
      if (arrived) {
        effect.onArrive();
        this.remove(effect.actor);
        continue;
      }
      live.push(effect);
    }
    this.fx = live;
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

/** In-canvas skip control: hit-tested by center x, drawn by fill + label. */
interface ButtonControl {
  readonly centerX: number;
  readonly fill: Rectangle;
  readonly text: Label;
  readonly baseLabel: string;
}

/** Scene-owned transient combat visuals (torpedoes + explosions). */
type ActiveFx = TorpedoFx | BurstFx;

interface TorpedoFx {
  readonly kind: 'torpedo';
  readonly actor: Actor;
  readonly waypoints: Vector[];
  segment: number;
  readonly speedPx: number;
  ageMs: number;
  readonly blinkHz: number;
  readonly onArrive: () => void;
}

interface BurstFx {
  readonly kind: 'burst';
  readonly actor: Actor;
  ageMs: number;
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

/**
 * Five-pointed photon-torpedo star: alternating outer/inner radius points
 * around the center — a star silhouette, distinct from the ship polygons.
 */
function starGraphic(radius: number, color: Color): Polygon {
  const points: Vector[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(new Vector(r * Math.cos(angle), r * Math.sin(angle)));
  }
  return new Polygon({ points, color });
}
