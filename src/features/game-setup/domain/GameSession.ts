import type { GameSetup } from './GameSetup.js';
import type { GameSetupFactory } from './GameSetupFactory.js';

export class GameSession {
  private setup: GameSetup;
  private currentRevision = 1;

  constructor(private readonly factory: GameSetupFactory) {
    this.setup = this.factory.create();
  }

  get currentSetup(): GameSetup {
    return this.setup;
  }

  get revision(): number {
    return this.currentRevision;
  }

  newGame(): GameSetup {
    if (!Number.isSafeInteger(this.currentRevision + 1)) {
      throw new RangeError('Game session revision cannot be incremented safely.');
    }

    const replacement = this.factory.create();
    this.setup = replacement;
    this.currentRevision += 1;
    return replacement;
  }
}
