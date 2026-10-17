import { describe, expect, it, vi } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { ControlledFlightAnimator } from '../../ship-movement/tests/fixtures/ControlledFlightAnimator.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';
import { BattleSession } from '../domain/BattleSession.js';
import { CombatGame, type CombatShip } from '../domain/CombatGame.js';
import type { AttackOutcome, AttackResolution } from '../domain/AttackResolver.js';
import { ControlledTorpedoAnimator } from './fixtures/ControlledTorpedoAnimator.js';
import { CombatScene } from '../presentation/CombatScene.js';
import type { CombatControls, BattleActionHandler } from '../presentation/CombatControls.js';

interface EventEmitterPort {
  emit(event: string, ...args: unknown[]): void;
  listenerCount(event: string): number;
}

const sceneHarness = vi.hoisted(() => ({
  gameEvents: null as null | EventEmitterPort,
  input: null as null | EventEmitterPort,
}));

vi.mock('phaser', () => {
  interface Listener {
    readonly callback: (...args: unknown[]) => void;
    readonly once: boolean;
    readonly context: unknown;
  }

  class MockEventEmitter {
    private readonly listeners = new Map<string, Listener[]>();

    on(event: string, callback: (...args: unknown[]) => void, context?: unknown): void {
      const entries = this.listeners.get(event) ?? [];
      entries.push({ callback, once: false, context });
      this.listeners.set(event, entries);
    }

    once(event: string, callback: (...args: unknown[]) => void, context?: unknown): void {
      const entries = this.listeners.get(event) ?? [];
      entries.push({ callback, once: true, context });
      this.listeners.set(event, entries);
    }

    off(event: string, callback: (...args: unknown[]) => void): void {
      this.listeners.set(
        event,
        (this.listeners.get(event) ?? []).filter((entry) => entry.callback !== callback),
      );
    }

    emit(event: string, ...args: unknown[]): void {
      for (const entry of [...(this.listeners.get(event) ?? [])]) {
        if (entry.once) this.off(event, entry.callback);
        entry.callback.apply(entry.context, args);
      }
    }

    listenerCount(event: string): number {
      return this.listeners.get(event)?.length ?? 0;
    }
  }

  class SceneBase {
    readonly events = new MockEventEmitter();
    readonly game = { events: new MockEventEmitter() };
    readonly input = new MockEventEmitter();
    readonly add = {
      graphics: () => ({
        clear: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        lineBetween: vi.fn().mockReturnThis(),
        strokeRect: vi.fn().mockReturnThis(),
        fillCircle: vi.fn().mockReturnThis(),
        strokeCircle: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      }),
      text: vi.fn((_x: number, _y: number, text: string) => ({
        text,
        setOrigin: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      container: vi.fn((x: number, y: number) => ({
        setPosition: vi.fn().mockReturnThis(),
        x,
        y,
        destroy: vi.fn(),
      })),
    };

    constructor() {
      sceneHarness.gameEvents = this.game.events;
      sceneHarness.input = this.input;
    }
  }

  return {
    default: {
      Scene: SceneBase,
      Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    },
  };
});

function combatGame(agilityScore = 14): CombatGame {
  const ship = (identity: 'ship-1' | 'ship-2', position: BoardPosition): CombatShip => ({
    identity,
    owner: identity === 'ship-1' ? 'player-1' : 'player-2',
    position,
    agility: new AgilityStat(agilityScore),
    strength: new AbilityStat(10),
    constitution: new AbilityStat(12),
    armorClass: 12,
    startingHitPoints: 10,
    hitPoints: 10,
  });
  return new CombatGame(
    ship('ship-1', new BoardPosition(2, 2)),
    ship('ship-2', new BoardPosition(9, 9)),
  );
}

function missResolution(): AttackResolution {
  return {
    resolve: (attacker: CombatShip, defender: CombatShip): AttackOutcome => ({
      kind: 'miss',
      attacker: attacker.identity,
      defender: defender.identity,
      attackDie: 1,
      strengthModifier: attacker.strength.modifier,
      attackTotal: 1 + attacker.strength.modifier,
      armorClass: 12,
      hitPointsBefore: defender.hitPoints,
      hitPointsAfter: defender.hitPoints,
    }),
  };
}

class ControlsSpy {
  readonly renderBattle = vi.fn();
  readonly dispose = vi.fn();
  skipHandler: BattleActionHandler = () => {};
  endHandler: BattleActionHandler = () => {};

  setActionHandlers(skip: BattleActionHandler, end: BattleActionHandler): void {
    this.skipHandler = skip;
    this.endHandler = end;
  }
}

function harness(agilityScore = 14) {
  const session = new BattleSession(combatGame(agilityScore), missResolution());
  const geometry = new BoardGeometry(600);
  const controls = new ControlsSpy();
  const flights = new ControlledFlightAnimator();
  const torpedoes = new ControlledTorpedoAnimator();
  const onDrawn = vi.fn();
  const onMovementError = vi.fn();
  const onAttackError = vi.fn();
  const onBoardChanged = vi.fn();
  const scene = new CombatScene(
    session,
    geometry,
    controls as unknown as CombatControls,
    onDrawn,
    onMovementError,
    onAttackError,
    torpedoes,
    flights,
    onBoardChanged,
  );
  const phaser = scene as unknown as {
    readonly input: EventEmitterPort;
    readonly events: EventEmitterPort;
    readonly game: { readonly events: EventEmitterPort };
  };
  return {
    session,
    geometry,
    controls,
    flights,
    torpedoes,
    onDrawn,
    onMovementError,
    onAttackError,
    onBoardChanged,
    scene,
    phaser,
    gameEvents: sceneHarness.gameEvents,
    input: sceneHarness.input,
  };
}

function clickAt(geometry: BoardGeometry, position: BoardPosition) {
  const point = geometry.cellCenter(position);
  return { button: 0, worldX: point.x, worldY: point.y };
}

describe('CombatScene lifecycle', () => {
  it('gates input on matching postrender and routes resized-viewport world coordinates through board geometry', () => {
    const { session, geometry, flights, onDrawn, scene, phaser } = harness();
    scene.create();
    scene.create();
    expect(phaser.input.listenerCount('pointerdown')).toBe(1);
    const initial = session.snapshot;
    if (initial.phase !== 'movement-ready') throw new Error('Expected movement-ready.');
    const destination = initial.reachability.destinations[0]?.position;
    if (!destination) throw new Error('Expected a legal destination.');
    phaser.input.emit('pointerdown', clickAt(geometry, destination));
    expect(flights.startedFlights).toHaveLength(0);

    phaser.game.events.emit('postrender');
    expect(onDrawn).toHaveBeenCalledWith(1);
    phaser.input.emit('pointerdown', { button: 2, worldX: 150, worldY: 150 });
    expect(flights.startedFlights).toHaveLength(0);
    const viewportScale = 0.72;
    const destinationCenter = geometry.cellCenter(destination);
    const resizedScreenPoint = {
      x: destinationCenter.x * viewportScale,
      y: destinationCenter.y * viewportScale,
    };
    // Phaser exposes logical world coordinates after FIT scaling and viewport resize.
    const worldPoint = {
      x: resizedScreenPoint.x / viewportScale,
      y: resizedScreenPoint.y / viewportScale,
    };
    phaser.input.emit('pointerdown', { button: 0, worldX: worldPoint.x, worldY: worldPoint.y });
    expect(flights.startedFlights).toHaveLength(1);
    expect(flights.startedFlights[0]?.move.destination).toEqual(
      geometry.positionAt(geometry.cellCenter(destination)),
    );
  });

  it('invalidates readiness and cancels movement across replacement until the new board renders', () => {
    const { session, geometry, flights, onDrawn, scene, phaser } = harness();
    scene.create();
    phaser.game.events.emit('postrender');
    const initial = session.snapshot;
    if (initial.phase !== 'movement-ready') throw new Error('Expected movement-ready.');
    const destination = initial.reachability.destinations[0]?.position;
    if (!destination) throw new Error('Expected a destination.');
    phaser.input.emit('pointerdown', clickAt(geometry, destination));
    const oldFlight = flights.startedFlights[0];
    if (!oldFlight) throw new Error('Expected a controlled flight.');

    const revision = session.newGame(combatGame(14));
    scene.updateGame(revision);
    expect(oldFlight.cancelled).toBe(true);
    const replacement = session.snapshot;
    if (replacement.phase !== 'movement-ready') throw new Error('Expected replacement phase.');
    const replacementDestination = replacement.reachability.destinations[0]?.position;
    if (!replacementDestination) throw new Error('Expected replacement destination.');
    phaser.input.emit('pointerdown', clickAt(geometry, replacementDestination));
    expect(flights.startedFlights).toHaveLength(1);

    phaser.game.events.emit('postrender');
    expect(onDrawn).toHaveBeenLastCalledWith(revision);
    expect(onDrawn).toHaveBeenCalledTimes(2);
    phaser.input.emit('pointerdown', clickAt(geometry, replacementDestination));
    expect(flights.startedFlights).toHaveLength(2);
  });

  it('cancels torpedoes on replacement and disposal with one listener set and idempotent cleanup', () => {
    const { session, geometry, controls, torpedoes, onDrawn, scene, phaser } = harness(8);
    scene.create();
    expect(phaser.input.listenerCount('pointerdown')).toBe(1);
    phaser.game.events.emit('postrender');
    const immobile = session.snapshot;
    if (immobile.phase !== 'awaiting-movement-skip') throw new Error('Expected immobility.');
    controls.skipHandler(immobile.gameRevision, immobile.turnToken);
    phaser.input.emit('pointerdown', clickAt(geometry, immobile.game.ship2.position));
    const firstTorpedo = torpedoes.startedAttacks[0];
    if (!firstTorpedo) throw new Error('Expected a controlled torpedo.');

    const replacementRevision = session.newGame(combatGame(8));
    scene.updateGame(replacementRevision);
    expect(firstTorpedo.cancelled).toBe(true);
    firstTorpedo.deliverLateCompletion();
    firstTorpedo.deliverLateFailure(new Error('stale failure'));
    const replaced = session.snapshot;
    expect(replaced.gameRevision).toBe(replacementRevision);
    expect(replaced.phase).toBe('awaiting-movement-skip');
    if (replaced.phase !== 'awaiting-movement-skip') throw new Error('Expected new immobility.');
    expect(replaced.game.ship2.hitPoints).toBe(10);
    phaser.game.events.emit('postrender');
    expect(onDrawn).toHaveBeenLastCalledWith(replacementRevision);

    const next = session.snapshot;
    if (next.phase !== 'awaiting-movement-skip') throw new Error('Expected immobility.');
    controls.skipHandler(next.gameRevision, next.turnToken);
    phaser.input.emit('pointerdown', clickAt(geometry, next.game.ship2.position));
    const finalTorpedo = torpedoes.startedAttacks[1];
    if (!finalTorpedo) throw new Error('Expected second controlled torpedo.');
    scene.dispose();
    scene.dispose();
    expect(finalTorpedo.cancelled).toBe(true);
    expect(phaser.input.listenerCount('pointerdown')).toBe(0);
    expect(controls.dispose).toHaveBeenCalledTimes(1);
    finalTorpedo.deliverLateCompletion();
    expect(session.snapshot.phase).toBe('attacking');
  });

  it('rejects stale postrender callbacks after idempotent disposal', () => {
    const { onDrawn, scene, phaser } = harness();
    scene.create();
    scene.dispose();
    scene.dispose();
    expect(phaser.game.events.listenerCount('postrender')).toBe(0);
    phaser.game.events.emit('postrender');
    expect(onDrawn).not.toHaveBeenCalled();
  });
});
