import { BoardPosition } from '../../board/domain/BoardPosition.js';
import type { ShipIdentity } from '../../board/domain/BoardSnapshot.js';
import { Reachability, type LegalRoute, type ReachabilityResult } from './Reachability.js';
import { MovementGame, type PlayerIdentity } from './MovementGame.js';

export interface PendingMove {
  readonly gameRevision: number;
  readonly turnToken: number;
  readonly moveId: number;
  readonly shipIdentity: ShipIdentity;
  readonly origin: BoardPosition;
  readonly destination: BoardPosition;
  readonly otherShipPosition: BoardPosition;
  readonly route: LegalRoute;
}

interface TurnSnapshotBase {
  readonly gameRevision: number;
  readonly turnToken: number;
  readonly activePlayer: PlayerIdentity;
  readonly activeShip: ShipIdentity;
  readonly game: MovementGame;
}

export interface ReadyTurnSnapshot extends TurnSnapshotBase {
  readonly phase: 'ready';
  readonly reachability: ReachabilityResult;
}

export interface MovingTurnSnapshot extends TurnSnapshotBase {
  readonly phase: 'moving';
  readonly pendingMove: PendingMove;
}

export interface AwaitingPassTurnSnapshot extends TurnSnapshotBase {
  readonly phase: 'awaiting-pass';
  readonly reason: string;
  readonly reachability: ReachabilityResult;
}

export interface DisposedTurnSnapshot {
  readonly phase: 'disposed';
  readonly gameRevision: number;
  readonly turnToken: number;
}

export type TurnSnapshot =
  ReadyTurnSnapshot | MovingTurnSnapshot | AwaitingPassTurnSnapshot | DisposedTurnSnapshot;

export interface InitialIdentityCounters {
  readonly gameRevision?: number;
  readonly turnToken?: number;
  readonly moveId?: number;
}

export class TurnSession {
  private currentGame: MovementGame;
  private currentGameRevision: number;
  private currentTurnToken: number;
  private currentMoveId: number;
  private activePlayer: PlayerIdentity = 'player-1';
  private currentPhase: 'ready' | 'moving' | 'awaiting-pass' | 'disposed';
  private currentReachability: ReachabilityResult;
  private pendingMove: PendingMove | null = null;

  constructor(
    initialGame: MovementGame,
    private readonly reachability = new Reachability(),
    initialIdentityCounters: InitialIdentityCounters = {},
  ) {
    this.currentGameRevision = initialIdentityCounters.gameRevision ?? 1;
    this.currentTurnToken = initialIdentityCounters.turnToken ?? 1;
    this.currentMoveId = initialIdentityCounters.moveId ?? 0;
    TurnSession.validateCounter(this.currentGameRevision, 'Game revision', 1);
    TurnSession.validateCounter(this.currentTurnToken, 'Turn token', 1);
    TurnSession.validateCounter(this.currentMoveId, 'Move identity', 0);
    this.currentGame = initialGame;
    this.currentReachability = this.findReachability(initialGame, this.activePlayer);
    this.currentPhase =
      this.currentReachability.destinations.length > 0 ? 'ready' : 'awaiting-pass';
  }

  get snapshot(): TurnSnapshot {
    if (this.currentPhase === 'disposed') {
      return Object.freeze({
        phase: 'disposed',
        gameRevision: this.currentGameRevision,
        turnToken: this.currentTurnToken,
      });
    }

    const activeShip = TurnSession.shipForPlayer(this.activePlayer);
    if (this.currentPhase === 'moving') {
      if (!this.pendingMove) {
        throw new Error('A moving turn must retain its pending move.');
      }

      return Object.freeze({
        phase: 'moving',
        gameRevision: this.currentGameRevision,
        turnToken: this.currentTurnToken,
        activePlayer: this.activePlayer,
        activeShip,
        game: this.currentGame,
        pendingMove: this.pendingMove,
      });
    }

    if (this.currentPhase === 'awaiting-pass') {
      return Object.freeze({
        phase: 'awaiting-pass',
        gameRevision: this.currentGameRevision,
        turnToken: this.currentTurnToken,
        activePlayer: this.activePlayer,
        activeShip,
        game: this.currentGame,
        reason: 'This ship has no legal destinations. Pass turn to continue.',
        reachability: this.currentReachability,
      });
    }

    return Object.freeze({
      phase: 'ready',
      gameRevision: this.currentGameRevision,
      turnToken: this.currentTurnToken,
      activePlayer: this.activePlayer,
      activeShip,
      game: this.currentGame,
      reachability: this.currentReachability,
    });
  }

  selectDestination(turnToken: number, position: BoardPosition): PendingMove | null {
    if (
      this.currentPhase !== 'ready' ||
      turnToken !== this.currentTurnToken ||
      !(position instanceof BoardPosition)
    ) {
      return null;
    }

    const route = this.currentReachability.routeTo(position);
    if (!route) {
      return null;
    }

    const moveId = TurnSession.incrementCounter(this.currentMoveId, 'Move identity');
    const activeShip = TurnSession.shipForPlayer(this.activePlayer);
    const otherShip = this.ship(activeShip === 'ship-1' ? 'ship-2' : 'ship-1');
    const pendingMove: PendingMove = Object.freeze({
      gameRevision: this.currentGameRevision,
      turnToken: this.currentTurnToken,
      moveId,
      shipIdentity: activeShip,
      origin: this.ship(activeShip).position,
      destination: position,
      otherShipPosition: otherShip.position,
      route,
    });

    this.currentMoveId = moveId;
    this.pendingMove = pendingMove;
    this.currentPhase = 'moving';
    return pendingMove;
  }

  completeMove(gameRevision: number, turnToken: number, moveId: number): boolean {
    const pendingMove = this.pendingMove;
    if (
      this.currentPhase !== 'moving' ||
      !pendingMove ||
      gameRevision !== this.currentGameRevision ||
      turnToken !== this.currentTurnToken ||
      moveId !== pendingMove.moveId ||
      pendingMove.gameRevision !== gameRevision ||
      pendingMove.turnToken !== turnToken
    ) {
      return false;
    }

    const nextTurnToken = TurnSession.incrementCounter(this.currentTurnToken, 'Turn token');
    const replacementGame = this.currentGame.withPosition(
      pendingMove.shipIdentity,
      pendingMove.destination,
    );
    const nextPlayer = TurnSession.otherPlayer(this.activePlayer);
    const nextReachability = this.findReachability(replacementGame, nextPlayer);

    this.currentGame = replacementGame;
    this.currentTurnToken = nextTurnToken;
    this.activePlayer = nextPlayer;
    this.pendingMove = null;
    this.currentReachability = nextReachability;
    this.currentPhase = nextReachability.destinations.length > 0 ? 'ready' : 'awaiting-pass';
    return true;
  }

  recoverFailedMove(gameRevision: number, turnToken: number, moveId: number): boolean {
    const pendingMove = this.pendingMove;
    if (
      this.currentPhase !== 'moving' ||
      !pendingMove ||
      gameRevision !== this.currentGameRevision ||
      turnToken !== this.currentTurnToken ||
      moveId !== pendingMove.moveId
    ) {
      return false;
    }

    const nextTurnToken = TurnSession.incrementCounter(this.currentTurnToken, 'Turn token');
    const nextReachability = this.findReachability(this.currentGame, this.activePlayer);

    this.currentTurnToken = nextTurnToken;
    this.pendingMove = null;
    this.currentReachability = nextReachability;
    this.currentPhase = nextReachability.destinations.length > 0 ? 'ready' : 'awaiting-pass';
    return true;
  }

  acknowledgePass(gameRevision: number, turnToken: number): boolean {
    if (
      this.currentPhase !== 'awaiting-pass' ||
      gameRevision !== this.currentGameRevision ||
      turnToken !== this.currentTurnToken
    ) {
      return false;
    }

    const nextTurnToken = TurnSession.incrementCounter(this.currentTurnToken, 'Turn token');
    const nextPlayer = TurnSession.otherPlayer(this.activePlayer);
    const nextReachability = this.findReachability(this.currentGame, nextPlayer);

    this.currentTurnToken = nextTurnToken;
    this.activePlayer = nextPlayer;
    this.currentReachability = nextReachability;
    this.currentPhase = nextReachability.destinations.length > 0 ? 'ready' : 'awaiting-pass';
    return true;
  }

  newGame(replacement: MovementGame): number {
    if (this.currentPhase === 'disposed') {
      throw new Error('A disposed turn session cannot start a new game.');
    }

    if (!(replacement instanceof MovementGame)) {
      throw new RangeError('A new game must be a complete MovementGame.');
    }

    const nextRevision = TurnSession.incrementCounter(this.currentGameRevision, 'Game revision');
    const nextTurnToken = TurnSession.incrementCounter(this.currentTurnToken, 'Turn token');
    const nextReachability = this.findReachability(replacement, 'player-1');

    this.currentGame = replacement;
    this.currentGameRevision = nextRevision;
    this.currentTurnToken = nextTurnToken;
    this.currentMoveId = 0;
    this.activePlayer = 'player-1';
    this.pendingMove = null;
    this.currentReachability = nextReachability;
    this.currentPhase = nextReachability.destinations.length > 0 ? 'ready' : 'awaiting-pass';
    return nextRevision;
  }

  dispose(): void {
    this.pendingMove = null;
    this.currentPhase = 'disposed';
  }

  private findReachability(game: MovementGame, player: PlayerIdentity): ReachabilityResult {
    const shipIdentity = TurnSession.shipForPlayer(player);
    return this.reachability.find(
      game,
      shipIdentity,
      this.shipIn(game, shipIdentity).agility.movementAllowance,
    );
  }

  private ship(identity: ShipIdentity): MovementGame['ship1'] {
    return this.shipIn(this.currentGame, identity);
  }

  private shipIn(game: MovementGame, identity: ShipIdentity): MovementGame['ship1'] {
    return identity === 'ship-1' ? game.ship1 : game.ship2;
  }

  private static shipForPlayer(player: PlayerIdentity): ShipIdentity {
    return player === 'player-1' ? 'ship-1' : 'ship-2';
  }

  private static otherPlayer(player: PlayerIdentity): PlayerIdentity {
    return player === 'player-1' ? 'player-2' : 'player-1';
  }

  private static validateCounter(value: number, name: string, minimum: number): void {
    if (!Number.isSafeInteger(value) || value < minimum) {
      throw new RangeError(`${name} must be a safe integer greater than or equal to ${minimum}.`);
    }
  }

  private static incrementCounter(value: number, name: string): number {
    if (!Number.isSafeInteger(value + 1)) {
      throw new RangeError(`${name} cannot be incremented safely.`);
    }
    return value + 1;
  }
}
