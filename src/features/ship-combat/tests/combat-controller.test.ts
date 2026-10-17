import { describe, expect, it, vi } from 'vitest';
import { BoardPosition } from '../../board/domain/BoardPosition.js';
import { BoardGeometry } from '../../board/presentation/BoardGeometry.js';
import type { BoardView } from '../../board/presentation/BoardView.js';
import { AgilityStat } from '../../ship-movement/domain/AgilityStat.js';
import { ControlledFlightAnimator } from '../../ship-movement/tests/fixtures/ControlledFlightAnimator.js';
import { AbilityStat } from '../../ship-stats/domain/AbilityStat.js';
import { BattleSession, type BattleSnapshot } from '../domain/BattleSession.js';
import { CombatGame, type CombatShip } from '../domain/CombatGame.js';
import type { AttackOutcome, AttackResolution } from '../domain/AttackResolver.js';
import { ControlledTorpedoAnimator } from './fixtures/ControlledTorpedoAnimator.js';
import { CombatController } from '../presentation/CombatController.js';
import type { CombatControls } from '../presentation/CombatControls.js';
import type {
  FlightAnimator,
  FlightCompletionHandler,
  FlightFailureHandler,
  FlightHandle,
  FlightIdentity,
  FlightProgressHandler,
} from '../../ship-movement/presentation/FlightAnimator.js';
import type { PendingMove } from '../../ship-movement/domain/PendingMove.js';
import type { TorpedoAnimator } from '../presentation/TorpedoAnimator.js';

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

interface HarnessOptions {
  readonly flightAnimator?: FlightAnimator;
  readonly torpedoAnimator?: TorpedoAnimator;
  readonly attackResolution?: AttackResolution;
}

function harness(agilityScore = 14, options: HarnessOptions = {}) {
  const game = combatGame(agilityScore);
  const resolution: AttackResolution = options.attackResolution ?? {
    resolve: vi.fn((attacker: CombatShip, defender: CombatShip): AttackOutcome => ({
      kind: 'miss' as const,
      attacker: attacker.identity,
      defender: defender.identity,
      attackDie: 1,
      strengthModifier: attacker.strength.modifier,
      attackTotal: 1 + attacker.strength.modifier,
      armorClass: 12,
      hitPointsBefore: defender.hitPoints,
      hitPointsAfter: defender.hitPoints,
    })),
  };
  const session = new BattleSession(game, resolution);
  const geometry = new BoardGeometry(600);
  const boardView = {
    setHighlights: vi.fn(),
    setShipPosition: vi.fn(),
    setShipVisualPosition: vi.fn(),
  };
  const controls = {
    setActionHandlers: vi.fn(),
    renderBattle: vi.fn(),
  };
  const flights = new ControlledFlightAnimator();
  const torpedoes = new ControlledTorpedoAnimator();
  const onMovementError = vi.fn();
  const onAttackError = vi.fn();
  const onBoardChanged = vi.fn();
  const controller = new CombatController(
    session,
    geometry,
    boardView as unknown as BoardView,
    options.flightAnimator ?? flights,
    options.torpedoAnimator ?? torpedoes,
    controls as unknown as CombatControls,
    onMovementError,
    onAttackError,
    onBoardChanged,
  );
  return {
    game,
    session,
    geometry,
    boardView,
    controls,
    flights,
    torpedoes,
    resolution,
    onMovementError,
    onAttackError,
    onBoardChanged,
    controller,
  };
}

class CallbackFlightAnimator implements FlightAnimator {
  readonly startedMoves: PendingMove[] = [];
  readonly identities: FlightIdentity[] = [];
  readonly cancellationStates: boolean[] = [];
  private readonly completionHandlers: FlightCompletionHandler[] = [];
  private readonly failureHandlers: FlightFailureHandler[] = [];
  private onProgress: FlightProgressHandler | null = null;
  onCancel: (() => void) | null = null;

  constructor(
    private readonly completeSynchronously = false,
    private readonly throwOnStart: Error | null = null,
  ) {}

  start(
    move: PendingMove,
    onProgress: FlightProgressHandler,
    onComplete: FlightCompletionHandler,
    onFailure: FlightFailureHandler,
  ): FlightHandle {
    if (this.throwOnStart) throw this.throwOnStart;
    const identity = Object.freeze({
      gameRevision: move.gameRevision,
      turnToken: move.turnToken,
      moveId: move.moveId,
    });
    this.startedMoves.push(move);
    this.identities.push(identity);
    this.onProgress = onProgress;
    this.completionHandlers.push(onComplete);
    this.failureHandlers.push(onFailure);
    let cancelled = false;
    const handle: FlightHandle = {
      identity,
      cancel: () => {
        cancelled = true;
        this.cancellationStates.push(cancelled);
        this.onCancel?.();
      },
    };
    if (this.completeSynchronously) onComplete(identity);
    return handle;
  }

  update(point: { readonly x: number; readonly y: number }): void {
    this.onProgress?.(point);
  }

  deliverComplete(index = this.identities.length - 1): void {
    const identity = this.identities[index];
    const handler = this.completionHandlers[index];
    if (identity && handler) handler(identity);
  }

  deliverFailure(error: Error, index = this.identities.length - 1): void {
    const identity = this.identities[index];
    const handler = this.failureHandlers[index];
    if (identity && handler) handler(identity, error);
  }
}

function live(session: BattleSession): Exclude<BattleSnapshot, { phase: 'disposed' }> {
  const snapshot = session.snapshot;
  if (snapshot.phase === 'disposed') throw new Error('Expected a live battle.');
  return snapshot;
}

function clickAt(geometry: BoardGeometry, position: BoardPosition, button = 0) {
  const point = geometry.cellCenter(position);
  return { button, worldX: point.x, worldY: point.y };
}

describe('CombatController', () => {
  it('routes movement then optional opponent attack and holds the turn through both animations', () => {
    const {
      session,
      geometry,
      boardView,
      controls,
      flights,
      torpedoes,
      onBoardChanged,
      controller,
    } = harness();
    const initial = session.snapshot;
    if (initial.phase !== 'movement-ready') throw new Error('Expected movement-ready.');

    const destination = initial.reachability.destinations[0]?.position;
    if (!destination) throw new Error('Expected a legal destination.');
    controller.handlePointerDown(clickAt(geometry, destination));
    expect(flights.startedFlights).toHaveLength(0);
    controller.markReady(initial.gameRevision + 1);
    controller.handlePointerDown(clickAt(geometry, destination));
    expect(flights.startedFlights).toHaveLength(0);

    controller.markReady(initial.gameRevision);
    controller.handlePointerDown(clickAt(geometry, destination));
    expect(live(session).phase).toBe('moving');
    expect(flights.startedFlights).toHaveLength(1);
    expect(boardView.setHighlights).toHaveBeenLastCalledWith([]);
    controller.handlePointerDown(clickAt(geometry, new BoardPosition(3, 3)));
    expect(flights.startedFlights).toHaveLength(1);

    const token = live(session).turnToken;
    flights.startedFlights[0]?.complete();
    const ready = live(session);
    expect(ready.phase).toBe('attack-ready');
    expect(ready.activePlayer).toBe('player-1');
    expect(ready.turnToken).toBe(token);
    expect(onBoardChanged).toHaveBeenCalledWith(ready.game);
    expect(controls.renderBattle).toHaveBeenLastCalledWith(ready);

    const target = ready.game.ship2.position;
    controller.handlePointerDown(clickAt(geometry, target));
    expect(live(session).phase).toBe('attacking');
    expect(torpedoes.startedAttacks).toHaveLength(1);
    expect(live(session).game.ship2.hitPoints).toBe(10);
    controller.handlePointerDown(clickAt(geometry, target));
    expect(torpedoes.startedAttacks).toHaveLength(1);

    torpedoes.startedAttacks[0]?.complete();
    const next = live(session);
    expect(next.phase).toBe('movement-ready');
    expect(next.activePlayer).toBe('player-2');
    expect(next.turnToken).toBe(token + 1);
    expect(next.game.ship2.hitPoints).toBe(10);
    expect(boardView.setHighlights).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.any(BoardPosition)]),
    );
  });

  it('ignores non-left, empty, own-ship, off-board, and invalid-target clicks', () => {
    const { session, geometry, flights, torpedoes, controller } = harness();
    const initial = session.snapshot;
    if (initial.phase !== 'movement-ready') throw new Error('Expected movement-ready.');
    const legal = initial.reachability.destinations[0]?.position;
    if (!legal) throw new Error('Expected a legal destination.');
    controller.markReady(initial.gameRevision);
    controller.handlePointerDown(clickAt(geometry, legal, 2));
    controller.handlePointerDown({ button: 0, worldX: 600, worldY: 300 });
    controller.handlePointerDown(clickAt(geometry, initial.game.ship1.position));
    controller.handlePointerDown(clickAt(geometry, initial.game.ship2.position));
    controller.handlePointerDown(clickAt(geometry, new BoardPosition(10, 1)));
    expect(flights.startedFlights).toHaveLength(0);

    controller.handlePointerDown(clickAt(geometry, legal));
    flights.startedFlights[0]?.complete();
    const ready = live(session);
    if (ready.phase !== 'attack-ready') throw new Error('Expected attack-ready.');
    controller.handlePointerDown(clickAt(geometry, ready.game.ship1.position));
    controller.handlePointerDown(clickAt(geometry, new BoardPosition(1, 10)));
    controller.handlePointerDown(clickAt(geometry, ready.game.ship2.position, 2));
    controller.handlePointerDown({ button: 0, worldX: -1, worldY: 10 });
    expect(torpedoes.startedAttacks).toHaveLength(0);
    expect(live(session).phase).toBe('attack-ready');

    controller.handlePointerDown(clickAt(geometry, ready.game.ship2.position));
    expect(torpedoes.startedAttacks).toHaveLength(1);
  });

  it('rejects stale movement and attack callbacks after replacement and blocks input until ready', () => {
    const { session, geometry, flights, torpedoes, controller } = harness();
    const initial = session.snapshot;
    if (initial.phase !== 'movement-ready') throw new Error('Expected movement-ready.');
    const destination = initial.reachability.destinations[0]?.position;
    if (!destination) throw new Error('Expected a legal destination.');
    controller.handlePointerDown(clickAt(geometry, destination));
    expect(flights.startedFlights).toHaveLength(0);
    controller.markReady(initial.gameRevision);
    controller.handlePointerDown(clickAt(geometry, destination));
    const oldMove = flights.startedFlights[0];
    if (!oldMove) throw new Error('Expected a controlled flight.');

    const replacementRevision = session.newGame(combatGame(14));
    controller.prepareForReplacement();
    controller.markReady(replacementRevision);
    expect(oldMove.cancelled).toBe(true);
    oldMove.complete();
    oldMove.fail(new Error('late movement error'));
    expect(live(session).gameRevision).toBe(replacementRevision);
    expect(live(session).game.ship1.position).toEqual(new BoardPosition(2, 2));

    const replacement = live(session);
    if (replacement.phase !== 'movement-ready') throw new Error('Expected replacement ready.');
    const nextDestination = replacement.reachability.destinations[0]?.position;
    if (!nextDestination) throw new Error('Expected replacement destination.');
    controller.handlePointerDown(clickAt(geometry, nextDestination));
    const currentMove = flights.startedFlights[1];
    if (!currentMove) throw new Error('Expected replacement flight.');
    currentMove.complete();
    const attackReady = live(session);
    if (attackReady.phase !== 'attack-ready') throw new Error('Expected attack-ready.');
    controller.handlePointerDown(clickAt(geometry, attackReady.game.ship2.position));
    const oldAttack = torpedoes.startedAttacks[0];
    if (!oldAttack) throw new Error('Expected a controlled torpedo.');

    const secondRevision = session.newGame(combatGame(14));
    controller.prepareForReplacement();
    controller.markReady(secondRevision);
    expect(oldAttack.cancelled).toBe(true);
    oldAttack.deliverLateCompletion();
    oldAttack.deliverLateFailure(new Error('late torpedo error'));
    expect(live(session).gameRevision).toBe(secondRevision);
    expect(live(session).game.ship2.hitPoints).toBe(10);
    expect(live(session).activePlayer).toBe('player-1');
  });

  it('recovers from movement startup and runtime failures without handoff or stale arrival', () => {
    const startupError = new Error('movement startup');
    const startupAnimator = new CallbackFlightAnimator(false, startupError);
    const startup = harness(14, { flightAnimator: startupAnimator });
    const startupInitial = live(startup.session);
    if (startupInitial.phase !== 'movement-ready') throw new Error('Expected movement-ready.');
    const startupDestination = startupInitial.reachability.destinations[0]?.position;
    if (!startupDestination) throw new Error('Expected a legal movement destination.');
    startup.controller.markReady(startupInitial.gameRevision);
    startup.controller.handlePointerDown(clickAt(startup.geometry, startupDestination));
    const afterStartupFailure = live(startup.session);
    expect(afterStartupFailure.phase).toBe('movement-ready');
    expect(afterStartupFailure.activePlayer).toBe('player-1');
    expect(afterStartupFailure.turnToken).toBe(startupInitial.turnToken);
    expect(afterStartupFailure.game.ship1.position).toEqual(startupInitial.game.ship1.position);
    expect(startup.onMovementError).toHaveBeenCalledWith('Movement failed: movement startup');

    const runtimeAnimator = new CallbackFlightAnimator();
    const runtime = harness(14, { flightAnimator: runtimeAnimator });
    const runtimeInitial = live(runtime.session);
    if (runtimeInitial.phase !== 'movement-ready') throw new Error('Expected movement-ready.');
    const destination = runtimeInitial.reachability.destinations[0]?.position;
    if (!destination) throw new Error('Expected a legal movement destination.');
    runtime.controller.markReady(runtimeInitial.gameRevision);
    runtime.controller.handlePointerDown(clickAt(runtime.geometry, destination));
    runtimeAnimator.onCancel = () => runtimeAnimator.deliverComplete(0);
    runtimeAnimator.deliverFailure(new Error('movement runtime'));
    const recovered = live(runtime.session);
    expect(recovered.phase).toBe('movement-ready');
    expect(recovered.activePlayer).toBe('player-1');
    expect(recovered.turnToken).toBe(runtimeInitial.turnToken);
    expect(recovered.game.ship1.position).toEqual(runtimeInitial.game.ship1.position);
    expect(runtime.onMovementError).toHaveBeenCalledWith('Movement failed: movement runtime');
    runtimeAnimator.deliverComplete(0);
    runtimeAnimator.deliverFailure(new Error('duplicate late failure'), 0);
    expect(live(runtime.session)).toEqual(recovered);
  });

  it('handles synchronous movement and torpedo completion without leaving stale handles', () => {
    const flightAnimator = new CallbackFlightAnimator(true);
    const movement = harness(14, { flightAnimator });
    const initial = live(movement.session);
    if (initial.phase !== 'movement-ready') throw new Error('Expected movement-ready.');
    const destination = initial.reachability.destinations[0]?.position;
    if (!destination) throw new Error('Expected a legal destination.');
    movement.controller.markReady(initial.gameRevision);
    movement.controller.handlePointerDown(clickAt(movement.geometry, destination));
    const arrived = live(movement.session);
    expect(arrived.phase).toBe('attack-ready');
    expect(arrived.activePlayer).toBe('player-1');
    expect(flightAnimator.cancellationStates).toEqual([true]);

    const torpedoAnimator = new ControlledTorpedoAnimator({ completeSynchronously: true });
    const attack = harness(8, { torpedoAnimator });
    const immobile = live(attack.session);
    if (immobile.phase !== 'awaiting-movement-skip') throw new Error('Expected an immobile ship.');
    attack.controller.markReady(immobile.gameRevision);
    expect(
      attack.controller.acknowledgeMovementSkip(immobile.gameRevision, immobile.turnToken),
    ).toBe(true);
    const ready = live(attack.session);
    if (ready.phase !== 'attack-ready') throw new Error('Expected attack-ready.');
    attack.controller.handlePointerDown(clickAt(attack.geometry, ready.game.ship2.position));
    const handedOff = live(attack.session);
    expect(handedOff.phase).toBe('awaiting-movement-skip');
    expect(handedOff.activePlayer).toBe('player-2');
    expect(torpedoAnimator.completedAttacks).toHaveLength(1);
    expect(attack.resolution.resolve).toHaveBeenCalledTimes(1);
  });

  it.each(['startup', 'runtime', 'synchronous-callback'] as const)(
    'commits the same stored attack outcome once after %s torpedo failure without rerolling',
    (failureMode) => {
      const resolver: AttackResolution = {
        resolve: vi.fn((attacker: CombatShip, defender: CombatShip): AttackOutcome => ({
          kind: 'hit',
          attacker: attacker.identity,
          defender: defender.identity,
          attackDie: 12,
          strengthModifier: attacker.strength.modifier,
          attackTotal: 12 + attacker.strength.modifier,
          armorClass: 12,
          damageDie: 4,
          damage: 4 + attacker.strength.modifier,
          hitPointsBefore: defender.hitPoints,
          hitPointsAfter: Math.max(0, defender.hitPoints - 4 - attacker.strength.modifier),
        })),
      };
      const error = new Error(`${failureMode} torpedo failure`);
      const torpedoAnimator = new ControlledTorpedoAnimator(
        failureMode === 'startup'
          ? { throwOnStart: error }
          : failureMode === 'synchronous-callback'
            ? { failSynchronously: error }
            : {},
      );
      const battle = harness(8, { attackResolution: resolver, torpedoAnimator });
      const immobile = live(battle.session);
      if (immobile.phase !== 'awaiting-movement-skip') throw new Error('Expected immobility.');
      battle.controller.markReady(immobile.gameRevision);
      battle.controller.acknowledgeMovementSkip(immobile.gameRevision, immobile.turnToken);
      const attackReady = live(battle.session);
      if (attackReady.phase !== 'attack-ready') throw new Error('Expected attack-ready.');
      battle.controller.handlePointerDown(
        clickAt(battle.geometry, attackReady.game.ship2.position),
      );
      const launched = live(battle.session);
      if (launched.phase === 'attacking') {
        expect(launched.game.ship2.hitPoints).toBe(10);
        if (failureMode === 'runtime') {
          torpedoAnimator.startedAttacks[0]?.fail(error);
        }
      }

      const completed = live(battle.session);
      expect(completed.activePlayer).toBe('player-2');
      expect(completed.game.ship2.hitPoints).toBe(6);
      expect(completed.lastCompletedAttack).toMatchObject({ kind: 'hit', damage: 4 });
      expect(resolver.resolve).toHaveBeenCalledTimes(1);
      expect(battle.onAttackError).toHaveBeenCalledWith(
        `Attack animation failed: ${error.message}`,
      );
      if (failureMode === 'runtime') {
        torpedoAnimator.startedAttacks[0]?.deliverLateCompletion();
        torpedoAnimator.startedAttacks[0]?.deliverLateFailure(new Error('duplicate late failure'));
        expect(live(battle.session)).toEqual(completed);
        expect(resolver.resolve).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('ignores a late torpedo completion after controller disposal', () => {
    const { session, geometry, controller, torpedoes } = harness(8);
    const immobile = live(session);
    if (immobile.phase !== 'awaiting-movement-skip') throw new Error('Expected immobility.');
    controller.markReady(immobile.gameRevision);
    controller.acknowledgeMovementSkip(immobile.gameRevision, immobile.turnToken);
    const ready = live(session);
    if (ready.phase !== 'attack-ready') throw new Error('Expected attack-ready.');
    controller.handlePointerDown(clickAt(geometry, ready.game.ship2.position));
    const pending = torpedoes.startedAttacks[0];
    if (!pending) throw new Error('Expected an attack animation.');
    controller.dispose();
    pending.deliverLateCompletion();
    expect(live(session).phase).toBe('attacking');
    expect(live(session).game.ship2.hitPoints).toBe(10);
  });
});
