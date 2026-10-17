import { BoardPosition } from '../../board/domain/BoardPosition.js';
import type { BoardSnapshot, ShipIdentity } from '../../board/domain/BoardSnapshot.js';

export interface LegalRoute {
  readonly positions: readonly BoardPosition[];
  readonly stepCount: number;
}

export interface ReachableDestination {
  readonly position: BoardPosition;
  readonly distance: number;
  readonly route: LegalRoute;
}

export class ReachabilityResult {
  readonly blockers: readonly BoardPosition[];
  readonly destinations: readonly ReachableDestination[];

  constructor(
    readonly origin: BoardPosition,
    blockers: readonly BoardPosition[],
    readonly allowance: number,
    destinations: readonly ReachableDestination[],
  ) {
    this.blockers = Object.freeze([...blockers]);
    this.destinations = Object.freeze(
      destinations.map((destination) =>
        Object.freeze({
          position: destination.position,
          distance: destination.distance,
          route: Object.freeze({
            positions: Object.freeze([...destination.route.positions]),
            stepCount: destination.route.stepCount,
          }),
        }),
      ),
    );
    Object.freeze(this);
  }

  routeTo(position: BoardPosition): LegalRoute | null {
    return (
      this.destinations.find((destination) => destination.position.equals(position))?.route ?? null
    );
  }
}

export class Reachability {
  private static readonly directions = [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1],
  ] as const;

  find(
    snapshot: BoardSnapshot,
    activeShip: ShipIdentity,
    allowance: number,
    fixtureBlockers: readonly BoardPosition[] = [],
  ): ReachabilityResult {
    if (!Number.isFinite(allowance)) {
      throw new RangeError('Movement allowance must be finite.');
    }

    const active = activeShip === 'ship-1' ? snapshot.ship1 : snapshot.ship2;
    const blocker = activeShip === 'ship-1' ? snapshot.ship2 : snapshot.ship1;
    const effectiveAllowance = Math.min(5, Math.max(0, Math.floor(allowance)));
    const origin = active.position;
    // Extra fixture blockers cover route-finder states unavailable in a two-ship game.
    const blockersByKey = new Map<string, BoardPosition>([
      [Reachability.positionKey(blocker.position), blocker.position],
    ]);
    for (const fixtureBlocker of fixtureBlockers) {
      blockersByKey.set(Reachability.positionKey(fixtureBlocker), fixtureBlocker);
    }
    const blockerKeys = new Set(blockersByKey.keys());
    const distanceByPosition = new Map<string, number>([[Reachability.positionKey(origin), 0]]);
    const predecessorByPosition = new Map<string, BoardPosition>();
    const queue: BoardPosition[] = [origin];
    const destinations: ReachableDestination[] = [];

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (!current) {
        continue;
      }

      const currentDistance = distanceByPosition.get(Reachability.positionKey(current));
      if (currentDistance === undefined || currentDistance >= effectiveAllowance) {
        continue;
      }

      for (const [rowDelta, columnDelta] of Reachability.directions) {
        const row = current.row + rowDelta;
        const column = current.column + columnDelta;
        if (row < 1 || row > 10 || column < 1 || column > 10) {
          continue;
        }

        const next = new BoardPosition(row, column);
        const nextKey = Reachability.positionKey(next);
        if (blockerKeys.has(nextKey) || distanceByPosition.has(nextKey)) {
          continue;
        }

        const distance = currentDistance + 1;
        distanceByPosition.set(nextKey, distance);
        predecessorByPosition.set(nextKey, current);
        queue.push(next);
        destinations.push({
          position: next,
          distance,
          route: Reachability.createRoute(origin, next, predecessorByPosition),
        });
      }
    }

    return new ReachabilityResult(
      origin,
      [...blockersByKey.values()],
      effectiveAllowance,
      destinations,
    );
  }

  private static createRoute(
    origin: BoardPosition,
    destination: BoardPosition,
    predecessorByPosition: ReadonlyMap<string, BoardPosition>,
  ): LegalRoute {
    const positions: BoardPosition[] = [destination];
    let current = destination;

    while (!current.equals(origin)) {
      const predecessor = predecessorByPosition.get(Reachability.positionKey(current));
      if (!predecessor) {
        throw new Error('A reachable destination must have a predecessor route to its origin.');
      }

      positions.push(predecessor);
      current = predecessor;
    }

    positions.reverse();
    return Object.freeze({
      positions: Object.freeze(positions),
      stepCount: positions.length - 1,
    });
  }

  private static positionKey(position: BoardPosition): string {
    return `${position.row}:${position.column}`;
  }
}
