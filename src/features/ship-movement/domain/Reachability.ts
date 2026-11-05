import { CubePosition } from '../../board/domain/CubePosition.js';
import type { CubeSnapshot } from '../../board/domain/CubeSnapshot.js';
import type { ShipIdentity } from '../../board/domain/CubeSnapshot.js';

export interface LegalRoute {
  readonly positions: readonly CubePosition[];
  readonly stepCount: number;
}

export interface ReachableDestination {
  readonly position: CubePosition;
  readonly distance: number;
  readonly route: LegalRoute;
}

export class ReachabilityResult {
  readonly blockers: readonly CubePosition[];
  readonly destinations: readonly ReachableDestination[];

  constructor(
    readonly origin: CubePosition,
    blockers: readonly CubePosition[],
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

  routeTo(position: CubePosition): LegalRoute | null {
    return (
      this.destinations.find((destination) => destination.position.equals(position))?.route ?? null
    );
  }
}

export class Reachability {
  private static readonly directions = [
    [-1, 0, 0],
    [1, 0, 0],
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [0, 0, 1],
  ] as const;

  find(
    snapshot: CubeSnapshot,
    activeShip: ShipIdentity,
    allowance: number,
    fixtureBlockers: readonly CubePosition[] = [],
  ): ReachabilityResult {
    if (!Number.isFinite(allowance)) {
      throw new RangeError('Movement allowance must be finite.');
    }

    const active = activeShip === 'ship-1' ? snapshot.ship1 : snapshot.ship2;
    const blocker = activeShip === 'ship-1' ? snapshot.ship2 : snapshot.ship1;
    const effectiveAllowance = Math.min(5, Math.max(0, Math.floor(allowance)));
    const origin = active.position;
    const blockersByKey = new Map<string, CubePosition>([
      [Reachability.positionKey(blocker.position), blocker.position],
    ]);
    for (const fixtureBlocker of fixtureBlockers) {
      if (!(fixtureBlocker instanceof CubePosition)) {
        throw new RangeError('Route blockers must be valid CubePosition values.');
      }
      blockersByKey.set(Reachability.positionKey(fixtureBlocker), fixtureBlocker);
    }
    const blockerKeys = new Set(blockersByKey.keys());
    const distanceByPosition = new Map<string, number>([[Reachability.positionKey(origin), 0]]);
    const predecessorByPosition = new Map<string, CubePosition>();
    const queue: CubePosition[] = [origin];
    const destinations: ReachableDestination[] = [];

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (!current) continue;

      const currentDistance = distanceByPosition.get(Reachability.positionKey(current));
      if (currentDistance === undefined || currentDistance >= effectiveAllowance) continue;

      for (const [xDelta, yDelta, zDelta] of Reachability.directions) {
        const x = current.x + xDelta;
        const y = current.y + yDelta;
        const z = current.z + zDelta;
        if (
          x < 1 ||
          x > snapshot.width ||
          y < 1 ||
          y > snapshot.height ||
          z < 1 ||
          z > snapshot.depth
        ) {
          continue;
        }

        const next = new CubePosition(x, y, z);
        const nextKey = Reachability.positionKey(next);
        if (blockerKeys.has(nextKey) || distanceByPosition.has(nextKey)) continue;

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
    origin: CubePosition,
    destination: CubePosition,
    predecessorByPosition: ReadonlyMap<string, CubePosition>,
  ): LegalRoute {
    const positions: CubePosition[] = [destination];
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

  private static positionKey(position: CubePosition): string {
    return `${position.x}:${position.y}:${position.z}`;
  }
}
