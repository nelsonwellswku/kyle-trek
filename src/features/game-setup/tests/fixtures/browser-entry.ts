import { GameApplication } from '../../../../app/GameApplication.js';
import { ScriptedRandomSource } from './ScriptedRandomSource.js';
import '../../../../app/styles.css';

const rootElement = document.querySelector<HTMLElement>('#app');

if (!rootElement) {
  throw new Error('Fixture application root #app was not found.');
}
const root: HTMLElement = rootElement;

const injectedValues = Reflect.get(window, '__gameSetupRandomValues');
const randomValues =
  Array.isArray(injectedValues) &&
  injectedValues.every((value: unknown) => typeof value === 'number')
    ? (injectedValues as number[])
    : [0, 1 - Number.EPSILON / 2];
let randomSource = new ScriptedRandomSource(randomValues);

function mountApplication(): GameApplication {
  randomSource = new ScriptedRandomSource(randomValues);
  return new GameApplication(root, randomSource);
}

let application = mountApplication();

function restartScene(): boolean {
  const game = Reflect.get(application, 'game');
  if (!game || typeof game !== 'object') {
    return false;
  }

  const sceneManager = Reflect.get(game, 'scene');
  if (!sceneManager || typeof sceneManager !== 'object') {
    return false;
  }

  const getScene = Reflect.get(sceneManager, 'getScene');
  if (typeof getScene !== 'function') {
    return false;
  }

  const scene = getScene.call(sceneManager, 'game-setup');
  const scenePlugin = scene && typeof scene === 'object' ? Reflect.get(scene, 'scene') : null;
  const restart =
    scenePlugin && typeof scenePlugin === 'object' ? Reflect.get(scenePlugin, 'restart') : null;
  if (typeof restart !== 'function') {
    return false;
  }

  restart.call(scenePlugin);
  return true;
}

Reflect.set(window, '__gameSetupTestHooks', {
  getConsumedDraws: () => randomSource.consumedDraws,
  remount: () => {
    application.dispose();
    application = mountApplication();
  },
  restartScene,
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => application.dispose());
}
