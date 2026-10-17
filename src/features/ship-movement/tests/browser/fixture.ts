import Phaser from 'phaser';
import '../../../../app/styles.css';
import { BoardPosition } from '../../../board/domain/BoardPosition.js';
import { BoardGeometry } from '../../../board/presentation/BoardGeometry.js';
import { GameSetupControls } from '../../../game-setup/presentation/GameSetupControls.js';
import { AgilityStat } from '../../domain/AgilityStat.js';
import { MovementGame } from '../../domain/MovementGame.js';
import { TurnSession } from '../../domain/TurnSession.js';
import { MovementScene } from '../../presentation/MovementScene.js';
import { TurnControls } from '../../presentation/TurnControls.js';

type PresetName =
  | 'center'
  | 'blocked-direct'
  | 'enemy-detour'
  | 'edge'
  | 'straight'
  | 'one-immobile'
  | 'both-immobile'
  | 'reset-during-flight';

const BOARD_SIZE = 600;
const root = document.querySelector<HTMLElement>('#app');
const presetSelector = document.querySelector<HTMLSelectElement>('#fixture-preset');
const resetButton = document.querySelector<HTMLButtonElement>('#reset-preset');
const clearButton = document.querySelector<HTMLButtonElement>('#clear-observations');
const fixtureLog = document.querySelector<HTMLElement>('#fixture-log');

if (!root || !presetSelector || !resetButton || !clearButton || !fixtureLog) {
  throw new Error('The movement fixture controls could not be initialized.');
}

const appRoot = root;
const selectedPreset = presetSelector;
const resetPresetButton = resetButton;
const observationLog = fixtureLog;

function createPreset(name: PresetName): MovementGame {
  const presets: Record<PresetName, readonly [number, number, number, number, number, number]> = {
    center: [5, 5, 14, 10, 10, 18],
    'blocked-direct': [5, 4, 14, 5, 5, 18],
    'enemy-detour': [5, 4, 18, 5, 5, 18],
    edge: [1, 1, 20, 1, 2, 18],
    straight: [5, 2, 20, 10, 10, 18],
    'one-immobile': [1, 1, 8, 10, 10, 16],
    'both-immobile': [1, 1, 9, 10, 10, 11],
    'reset-during-flight': [5, 5, 20, 10, 10, 18],
  };
  const [ship1Row, ship1Column, ship1Score, ship2Row, ship2Column, ship2Score] = presets[name];

  return new MovementGame(
    {
      identity: 'ship-1',
      owner: 'player-1',
      position: new BoardPosition(ship1Row, ship1Column),
      agility: new AgilityStat(ship1Score),
    },
    {
      identity: 'ship-2',
      owner: 'player-2',
      position: new BoardPosition(ship2Row, ship2Column),
      agility: new AgilityStat(ship2Score),
    },
  );
}

const session = new TurnSession(createPreset(selectedPreset.value as PresetName));
let scene: MovementScene | null = null;
let game: Phaser.Game | null = null;
let lastObservation = '';
const startedAt = performance.now();

function recordTurnObservation(): void {
  const snapshot = session.snapshot;
  const phase = snapshot.phase;
  const identity =
    phase === 'disposed'
      ? 'disposed'
      : `${snapshot.gameRevision}:${snapshot.turnToken}:${phase}:${snapshot.activePlayer}${phase === 'moving' ? `:move-${snapshot.pendingMove.moveId}` : ''}`;

  if (identity !== lastObservation) {
    lastObservation = identity;
    const elapsed = (performance.now() - startedAt).toFixed(1);
    const detail =
      phase === 'disposed'
        ? 'disposed'
        : `${phase}; ${snapshot.activePlayer}/${snapshot.activeShip}; game ${snapshot.gameRevision}; turn ${snapshot.turnToken}${phase === 'moving' ? `; move ${snapshot.pendingMove.moveId}` : ''}`;
    observationLog.textContent = `${elapsed} ms  ${detail}\n${observationLog.textContent}`
      .split('\n')
      .slice(0, 41)
      .join('\n');
  }

  requestAnimationFrame(recordTurnObservation);
}

const controls = new GameSetupControls(appRoot, () => resetSelectedPreset());
const turnControls = new TurnControls(controls.turnHudHost, (revision, token) => {
  scene?.acknowledgePass(revision, token);
});
resetPresetButton.disabled = true;

function resetSelectedPreset(): void {
  if (!scene) {
    return;
  }

  resetPresetButton.disabled = true;
  const replacement = createPreset(selectedPreset.value as PresetName);
  const revision = session.newGame(replacement);
  controls.showPreparing();
  scene.updateGame(revision);
}

scene = new MovementScene(
  session,
  new BoardGeometry(BOARD_SIZE),
  turnControls,
  (revision) => {
    if (!game?.canvas) {
      return;
    }

    const snapshot = session.snapshot;
    if (snapshot.phase === 'disposed' || snapshot.gameRevision !== revision) {
      return;
    }

    controls.updateBoard(snapshot.game);
    controls.markReady(revision, game.canvas);
    resetPresetButton.disabled = false;
  },
  (message) => controls.showMovementError(message),
  undefined,
  (snapshot) => controls.updateBoard(snapshot),
);

try {
  game = new Phaser.Game({
    type: Phaser.WEBGL,
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    parent: controls.gameCanvasHost,
    canvasStyle: 'display:block;width:100%;height:100%;',
    backgroundColor: '#0b1b2b',
    banner: false,
    antialias: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      expandParent: false,
    },
    scene: [scene],
  });
} catch {
  controls.showStartupError('Unable to start the fixture. Check WebGL availability and reload.');
  scene.dispose();
}

resetPresetButton.addEventListener('click', resetSelectedPreset);
clearButton.addEventListener('click', () => {
  observationLog.textContent = '';
});
recordTurnObservation();

window.addEventListener('beforeunload', () => {
  session.dispose();
  scene?.dispose();
  controls.dispose();
  turnControls.dispose();
  game?.destroy(true);
});
