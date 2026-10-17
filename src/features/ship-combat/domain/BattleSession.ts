import { BoardPosition } from '../../board/domain/BoardPosition.js';
import type { ShipIdentity } from '../../board/domain/BoardSnapshot.js';
import type { PlayerIdentity } from '../../ship-movement/domain/MovementGame.js';
import { Reachability, type ReachabilityResult } from '../../ship-movement/domain/Reachability.js';
import { CombatGame, type CombatShip } from './CombatGame.js';
import type { AttackOutcome, AttackResolution } from './AttackResolver.js';
import type { PendingAttack } from './PendingAttack.js';
import type { PendingMove } from '../../ship-movement/domain/PendingMove.js';

interface LiveBattleSnapshot {
  readonly gameRevision: number;
  readonly turnToken: number;
  readonly activePlayer: PlayerIdentity;
  readonly activeShip: ShipIdentity;
  readonly game: CombatGame;
  readonly lastCompletedAttack: AttackOutcome | null;
}

export interface MovementReadySnapshot extends LiveBattleSnapshot {
  readonly phase: 'movement-ready';
  readonly reachability: ReachabilityResult;
}

export interface AwaitingMovementSkipSnapshot extends LiveBattleSnapshot {
  readonly phase: 'awaiting-movement-skip';
  readonly reason: string;
  readonly reachability: ReachabilityResult;
}

export interface MovingSnapshot extends LiveBattleSnapshot {
  readonly phase: 'moving';
  readonly pendingMove: PendingMove;
}

export interface AttackReadySnapshot extends LiveBattleSnapshot {
  readonly phase: 'attack-ready';
}

export interface AttackingSnapshot extends LiveBattleSnapshot {
  readonly phase: 'attacking';
  readonly pendingAttack: PendingAttack;
}

export interface FinishedSnapshot extends LiveBattleSnapshot {
  readonly phase: 'finished';
  readonly winner: PlayerIdentity;
  readonly defeatedShip: ShipIdentity;
}

export interface DisposedSnapshot {
  readonly phase: 'disposed';
  readonly gameRevision: number;
  readonly turnToken: number;
}

export type BattleSnapshot =
  | MovementReadySnapshot
  | AwaitingMovementSkipSnapshot
  | MovingSnapshot
  | AttackReadySnapshot
  | AttackingSnapshot
  | FinishedSnapshot
  | DisposedSnapshot;

export interface InitialBattleCounters {
  readonly gameRevision?: number;
  readonly turnToken?: number;
  readonly moveId?: number;
  readonly attackId?: number;
}

export class BattleSession {
  private currentGame: CombatGame;
  private currentGameRevision: number;
  private currentTurnToken: number;
  private currentMoveId: number;
  private currentAttackId: number;
  private activePlayer: PlayerIdentity = 'player-1';
  private currentPhase:
    | 'movement-ready'
    | 'awaiting-movement-skip'
    | 'moving'
    | 'attack-ready'
    | 'attacking'
    | 'finished'
    | 'disposed';
  private currentReachability: ReachabilityResult;
  private pendingMove: PendingMove | null = null;
  private pendingAttack: PendingAttack | null = null;
  private lastCompletedAttack: AttackOutcome | null = null;
  private winner: PlayerIdentity | null = null;
  private defeatedShip: ShipIdentity | null = null;

  constructor(
    initialGame: CombatGame,
    private readonly attackResolution: AttackResolution,
    private readonly reachability = new Reachability(),
    initialIdentityCounters: InitialBattleCounters = {},
  ) {
    this.currentGameRevision = initialIdentityCounters.gameRevision ?? 1;
    this.currentTurnToken = initialIdentityCounters.turnToken ?? 1;
    this.currentMoveId = initialIdentityCounters.moveId ?? 0;
    this.currentAttackId = initialIdentityCounters.attackId ?? 0;
    BattleSession.validateCounter(this.currentGameRevision, 'Game revision', 1);
    BattleSession.validateCounter(this.currentTurnToken, 'Turn token', 1);
    BattleSession.validateCounter(this.currentMoveId, 'Move identity', 0);
    BattleSession.validateCounter(this.currentAttackId, 'Attack identity', 0);
    if (!(initialGame instanceof CombatGame)) {
      throw new RangeError('A battle session requires a complete CombatGame.');
    }
    this.currentGame = initialGame;
    this.currentReachability = this.findReachability(initialGame, 'player-1');
    this.currentPhase = this.phaseFor(this.currentReachability);
  }

  get snapshot(): BattleSnapshot {
    if (this.currentPhase === 'disposed') {
      return Object.freeze({
        phase: 'disposed',
        gameRevision: this.currentGameRevision,
        turnToken: this.currentTurnToken,
      });
    }

    const base = {
      gameRevision: this.currentGameRevision,
      turnToken: this.currentTurnToken,
      activePlayer: this.activePlayer,
      activeShip: BattleSession.shipForPlayer(this.activePlayer),
      game: this.currentGame,
      lastCompletedAttack: this.lastCompletedAttack,
    };

    switch (this.currentPhase) {
      case 'movement-ready':
        return Object.freeze({
          ...base,
          phase: 'movement-ready',
          reachability: this.currentReachability,
        });
      case 'awaiting-movement-skip':
        return Object.freeze({
          ...base,
          phase: 'awaiting-movement-skip',
          reason: 'This ship has no legal movement destinations. Skip movement to continue.',
          reachability: this.currentReachability,
        });
      case 'moving':
        if (!this.pendingMove) throw new Error('A moving battle must retain its pending move.');
        return Object.freeze({ ...base, phase: 'moving', pendingMove: this.pendingMove });
      case 'attack-ready':
        return Object.freeze({ ...base, phase: 'attack-ready' });
      case 'attacking':
        if (!this.pendingAttack) {
          throw new Error('An attacking battle must retain its pending attack.');
        }
        return Object.freeze({ ...base, phase: 'attacking', pendingAttack: this.pendingAttack });
      case 'finished':
        if (!this.winner || !this.defeatedShip) {
          throw new Error('A finished battle must retain its winner and defeated ship.');
        }
        return Object.freeze({
          ...base,
          phase: 'finished',
          winner: this.winner,
          defeatedShip: this.defeatedShip,
        });
    }
  }

  selectDestination(
    gameRevision: number,
    turnToken: number,
    position: BoardPosition,
  ): PendingMove | null {
    if (
      this.currentPhase !== 'movement-ready' ||
      !this.matchesTurn(gameRevision, turnToken) ||
      !(position instanceof BoardPosition)
    ) {
      return null;
    }

    const route = this.currentReachability.routeTo(position);
    if (!route) return null;

    const moveId = BattleSession.incrementCounter(this.currentMoveId, 'Move identity');
    const shipIdentity = BattleSession.shipForPlayer(this.activePlayer);
    const otherShipIdentity = BattleSession.otherShip(shipIdentity);
    const pendingMove: PendingMove = Object.freeze({
      gameRevision: this.currentGameRevision,
      turnToken: this.currentTurnToken,
      moveId,
      shipIdentity,
      origin: this.ship(shipIdentity).position,
      destination: position,
      otherShipPosition: this.ship(otherShipIdentity).position,
      route,
    });

    this.currentMoveId = moveId;
    this.pendingMove = pendingMove;
    this.currentPhase = 'moving';
    return pendingMove;
  }

  completeMove(gameRevision: number, turnToken: number, moveId: number): boolean {
    const pendingMove = this.pendingMove;
    if (!this.matchesMove(gameRevision, turnToken, moveId, pendingMove)) return false;

    const replacement = this.currentGame.withPosition(
      pendingMove.shipIdentity,
      pendingMove.destination,
    );
    this.currentGame = replacement;
    this.pendingMove = null;
    this.currentPhase = 'attack-ready';
    return true;
  }

  recoverFailedMove(gameRevision: number, turnToken: number, moveId: number): boolean {
    const pendingMove = this.pendingMove;
    if (!this.matchesMove(gameRevision, turnToken, moveId, pendingMove)) return false;

    const nextReachability = this.findReachability(this.currentGame, this.activePlayer);
    this.currentReachability = nextReachability;
    this.pendingMove = null;
    this.currentPhase = this.phaseFor(nextReachability);
    return true;
  }

  acknowledgeMovementSkip(gameRevision: number, turnToken: number): boolean {
    if (
      this.currentPhase !== 'awaiting-movement-skip' ||
      !this.matchesTurn(gameRevision, turnToken)
    ) {
      return false;
    }
    this.currentPhase = 'attack-ready';
    return true;
  }

  selectAttack(
    gameRevision: number,
    turnToken: number,
    target: ShipIdentity,
  ): PendingAttack | null {
    if (
      this.currentPhase !== 'attack-ready' ||
      !this.matchesTurn(gameRevision, turnToken) ||
      target !== BattleSession.otherShip(BattleSession.shipForPlayer(this.activePlayer))
    ) {
      return null;
    }

    const attackId = BattleSession.incrementCounter(this.currentAttackId, 'Attack identity');
    const attacker = this.ship(BattleSession.shipForPlayer(this.activePlayer));
    const defender = this.ship(target);
    const outcome = BattleSession.freezeOutcome(
      this.attackResolution.resolve(attacker, defender),
      attacker,
      defender,
    );
    const pendingAttack: PendingAttack = Object.freeze({
      gameRevision: this.currentGameRevision,
      turnToken: this.currentTurnToken,
      attackId,
      attackerIdentity: attacker.identity,
      defenderIdentity: defender.identity,
      attackerPosition: attacker.position,
      defenderPosition: defender.position,
      outcome,
    });

    this.currentAttackId = attackId;
    this.pendingAttack = pendingAttack;
    this.currentPhase = 'attacking';
    return pendingAttack;
  }

  completeAttack(gameRevision: number, turnToken: number, attackId: number): boolean {
    const pendingAttack = this.pendingAttack;
    if (!this.matchesAttack(gameRevision, turnToken, attackId, pendingAttack)) return false;

    const outcome = pendingAttack.outcome;
    const nextGame = this.currentGame.withDamage(
      pendingAttack.defenderIdentity,
      outcome.kind === 'hit' ? outcome.damage : 0,
    );
    const defeatedShip = outcome.hitPointsAfter === 0 ? pendingAttack.defenderIdentity : null;
    const nextTurnToken = defeatedShip
      ? this.currentTurnToken
      : BattleSession.incrementCounter(this.currentTurnToken, 'Turn token');

    this.currentGame = nextGame;
    this.lastCompletedAttack = outcome;
    this.pendingAttack = null;
    if (defeatedShip) {
      this.winner = this.activePlayer;
      this.defeatedShip = defeatedShip;
      this.currentPhase = 'finished';
      return true;
    }

    const nextPlayer = BattleSession.otherPlayer(this.activePlayer);
    const nextReachability = this.findReachability(nextGame, nextPlayer);
    this.currentTurnToken = nextTurnToken;
    this.activePlayer = nextPlayer;
    this.currentReachability = nextReachability;
    this.currentPhase = this.phaseFor(nextReachability);
    return true;
  }

  endTurn(gameRevision: number, turnToken: number): boolean {
    if (this.currentPhase !== 'attack-ready' || !this.matchesTurn(gameRevision, turnToken)) {
      return false;
    }

    const nextTurnToken = BattleSession.incrementCounter(this.currentTurnToken, 'Turn token');
    const nextPlayer = BattleSession.otherPlayer(this.activePlayer);
    const nextReachability = this.findReachability(this.currentGame, nextPlayer);
    this.currentTurnToken = nextTurnToken;
    this.activePlayer = nextPlayer;
    this.currentReachability = nextReachability;
    this.currentPhase = this.phaseFor(nextReachability);
    return true;
  }

  newGame(replacement: CombatGame): number {
    if (this.currentPhase === 'disposed') {
      throw new Error('A disposed battle session cannot start a new game.');
    }
    if (!(replacement instanceof CombatGame)) {
      throw new RangeError('A replacement battle must be a complete CombatGame.');
    }

    const nextRevision = BattleSession.incrementCounter(this.currentGameRevision, 'Game revision');
    const nextTurnToken = BattleSession.incrementCounter(this.currentTurnToken, 'Turn token');
    const nextReachability = this.findReachability(replacement, 'player-1');
    this.currentGame = replacement;
    this.currentGameRevision = nextRevision;
    this.currentTurnToken = nextTurnToken;
    this.currentMoveId = 0;
    this.currentAttackId = 0;
    this.activePlayer = 'player-1';
    this.pendingMove = null;
    this.pendingAttack = null;
    this.lastCompletedAttack = null;
    this.winner = null;
    this.defeatedShip = null;
    this.currentReachability = nextReachability;
    this.currentPhase = this.phaseFor(nextReachability);
    return nextRevision;
  }

  dispose(): void {
    if (this.currentPhase === 'disposed') return;
    this.pendingMove = null;
    this.pendingAttack = null;
    this.currentPhase = 'disposed';
  }

  private matchesTurn(gameRevision: number, turnToken: number): boolean {
    return gameRevision === this.currentGameRevision && turnToken === this.currentTurnToken;
  }

  private matchesMove(
    gameRevision: number,
    turnToken: number,
    moveId: number,
    pendingMove: PendingMove | null,
  ): pendingMove is PendingMove {
    return (
      this.currentPhase === 'moving' &&
      pendingMove !== null &&
      this.matchesTurn(gameRevision, turnToken) &&
      pendingMove.gameRevision === gameRevision &&
      pendingMove.turnToken === turnToken &&
      pendingMove.moveId === moveId
    );
  }

  private matchesAttack(
    gameRevision: number,
    turnToken: number,
    attackId: number,
    pendingAttack: PendingAttack | null,
  ): pendingAttack is PendingAttack {
    return (
      this.currentPhase === 'attacking' &&
      pendingAttack !== null &&
      this.matchesTurn(gameRevision, turnToken) &&
      pendingAttack.gameRevision === gameRevision &&
      pendingAttack.turnToken === turnToken &&
      pendingAttack.attackId === attackId
    );
  }

  private findReachability(game: CombatGame, player: PlayerIdentity): ReachabilityResult {
    const shipIdentity = BattleSession.shipForPlayer(player);
    return this.reachability.find(
      game,
      shipIdentity,
      this.shipIn(game, shipIdentity).agility.movementAllowance,
    );
  }

  private phaseFor(result: ReachabilityResult): 'movement-ready' | 'awaiting-movement-skip' {
    return result.destinations.length > 0 ? 'movement-ready' : 'awaiting-movement-skip';
  }

  private ship(identity: ShipIdentity): CombatShip {
    return this.shipIn(this.currentGame, identity);
  }

  private shipIn(game: CombatGame, identity: ShipIdentity): CombatShip {
    return identity === 'ship-1' ? game.ship1 : game.ship2;
  }

  private static freezeOutcome(
    outcome: AttackOutcome,
    attacker: CombatShip,
    defender: CombatShip,
  ): AttackOutcome {
    const validInteger = (value: number, min: number, max: number): boolean =>
      Number.isInteger(value) && value >= min && value <= max;
    const commonIsValid =
      outcome !== null &&
      typeof outcome === 'object' &&
      outcome.attacker === attacker.identity &&
      outcome.defender === defender.identity &&
      outcome.attacker !== outcome.defender &&
      validInteger(outcome.attackDie, 1, 20) &&
      validInteger(outcome.strengthModifier, -1, 5) &&
      outcome.strengthModifier === attacker.strength.modifier &&
      Number.isInteger(outcome.attackTotal) &&
      outcome.attackTotal === outcome.attackDie + outcome.strengthModifier &&
      outcome.armorClass === 12 &&
      outcome.hitPointsBefore === defender.hitPoints &&
      validInteger(outcome.hitPointsBefore, 0, defender.startingHitPoints);
    if (!commonIsValid) throw new RangeError('Attack resolution returned an invalid outcome.');

    if (outcome.kind === 'miss') {
      if (
        outcome.attackTotal >= 12 ||
        outcome.hitPointsAfter !== outcome.hitPointsBefore ||
        Object.hasOwn(outcome, 'damageDie') ||
        Object.hasOwn(outcome, 'damage')
      ) {
        throw new RangeError('A miss outcome must be below AC and contain no damage fields.');
      }
      return Object.freeze({
        kind: 'miss',
        attacker: outcome.attacker,
        defender: outcome.defender,
        attackDie: outcome.attackDie,
        strengthModifier: outcome.strengthModifier,
        attackTotal: outcome.attackTotal,
        armorClass: 12,
        hitPointsBefore: outcome.hitPointsBefore,
        hitPointsAfter: outcome.hitPointsAfter,
      });
    }

    if (
      outcome.kind !== 'hit' ||
      outcome.attackTotal < 12 ||
      !validInteger(outcome.damageDie, 1, 8) ||
      !validInteger(outcome.damage, 0, 13) ||
      outcome.damage !== outcome.damageDie + outcome.strengthModifier ||
      outcome.hitPointsAfter !== Math.max(0, outcome.hitPointsBefore - outcome.damage)
    ) {
      throw new RangeError('A hit outcome violates its roll, damage, or HP constraints.');
    }
    return Object.freeze({
      kind: 'hit',
      attacker: outcome.attacker,
      defender: outcome.defender,
      attackDie: outcome.attackDie,
      strengthModifier: outcome.strengthModifier,
      attackTotal: outcome.attackTotal,
      armorClass: 12,
      damageDie: outcome.damageDie,
      damage: outcome.damage,
      hitPointsBefore: outcome.hitPointsBefore,
      hitPointsAfter: outcome.hitPointsAfter,
    });
  }

  private static shipForPlayer(player: PlayerIdentity): ShipIdentity {
    return player === 'player-1' ? 'ship-1' : 'ship-2';
  }

  private static otherPlayer(player: PlayerIdentity): PlayerIdentity {
    return player === 'player-1' ? 'player-2' : 'player-1';
  }

  private static otherShip(ship: ShipIdentity): ShipIdentity {
    return ship === 'ship-1' ? 'ship-2' : 'ship-1';
  }

  private static validateCounter(value: number, name: string, minimum: number): void {
    if (!Number.isSafeInteger(value) || value < minimum) {
      throw new RangeError(`${name} must be a safe integer at least ${minimum}.`);
    }
  }

  private static incrementCounter(value: number, name: string): number {
    if (!Number.isSafeInteger(value + 1)) {
      throw new RangeError(`${name} cannot be incremented safely.`);
    }
    return value + 1;
  }
}
