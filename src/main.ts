import { Engine, Random } from 'excalibur';
import boardJson from './config/board.json';
import { BattleScene } from './scenes/battle-scene.js';
import { loadBoardConfig } from './sim/board-config.js';
import { setupNewGame } from './sim/setup.js';
import type { RngFactory } from './sim/types.js';

/** Surface setup failures explicitly (scene-contract guarantee 5). */
function showFatal(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[kyle-trek] invalid game setup:', message);
  document
    .getElementById('game-root')
    ?.replaceChildren(
      Object.assign(document.createElement('pre'), {
        textContent: `Could not start the game:\n${message}`,
      }),
    );
}

let setup;
try {
  const config = loadBoardConfig(boardJson);
  // ex.Random adapter: explicit seed reproduces its sequence (SC-004);
  // unseeded construction draws a unique Date.now()-based seed per instance,
  // so every page visit is an independent draw. Seed selection stays a
  // developer-only detail — no player-facing seed UI.
  const exRandomFactory: RngFactory = {
    create(seed?: number) {
      const random = seed === undefined ? new Random() : new Random(seed);
      return {
        rng: {
          integer: (min, max) => random.integer(min, max),
        },
        seed: random.seed,
      };
    },
  };
  const game = setupNewGame(config, exRandomFactory);
  console.info(`[kyle-trek] game seed: ${game.seed} (re-run with this seed to replay this setup)`);
  setup = { config, game };
} catch (error) {
  showFatal(error);
  throw error;
}

const game = new Engine({
  width: 800,
  height: 600,
});
game.addScene('battle', new BattleScene(setup.game, setup.config));

await game.start();
await game.goToScene('battle');
