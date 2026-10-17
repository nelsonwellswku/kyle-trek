import Phaser from 'phaser';
import '../../../../app/styles.css';
import { BoardGeometry } from '../../../board/presentation/BoardGeometry.js';
import { BoardView } from '../../../board/presentation/BoardView.js';
import { CombatGameFactory } from '../../domain/CombatGameFactory.js';
import { ScriptedRandomSource } from '../fixtures/ScriptedRandomSource.js';
import { CombatControls } from '../../presentation/CombatControls.js';

const BOARD_SIZE = 600;
const presets: Readonly<Record<string, readonly number[]>> = {
  known: [0, 0.5, 0.4, 0.6, 0.7, 0.5, 0.8, 0.3, 0.4, 0.8],
  'low-hp': [0.1, 0.6, 0, 0, 0, 0, 0, 0, 0, 0],
  'high-stats': [0.9, 0.2, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999],
};

const boardHost = document.querySelector<HTMLElement>('#combat-board');
const statsHost = document.querySelector<HTMLElement>('#combat-stats');
const preset = document.querySelector<HTMLSelectElement>('#setup-preset');
const resetButton = document.querySelector<HTMLButtonElement>('#reset-setup');
const status = document.querySelector<HTMLElement>('#setup-status');

if (!boardHost || !statsHost || !preset || !resetButton || !status) {
  throw new Error('The combat setup fixture could not be initialized.');
}

const selectedPreset = preset;
const setupResetButton = resetButton;
const setupStatus = status;
const controls = new CombatControls(statsHost);
let currentGame = createGame(selectedPreset.value);
let revision = 1;
let boardView: BoardView | null = null;
let game: Phaser.Game | null = null;

function createGame(name: string) {
  const samples = presets[name];
  if (!samples) throw new RangeError(`Unknown setup preset ${name}.`);
  return new CombatGameFactory(new ScriptedRandomSource(samples)).create();
}

class SetupPreviewScene extends Phaser.Scene {
  constructor() {
    super('combat-setup-preview');
  }

  create(): void {
    boardView = new BoardView(this, new BoardGeometry(BOARD_SIZE));
    this.drawCurrentSetup();
  }

  drawCurrentSetup(): void {
    boardView?.draw(currentGame, revision, (drawnRevision) => {
      if (drawnRevision !== revision) return;
      controls.renderShips(currentGame);
      setupStatus.textContent = `Setup ${revision} ready · both ships start at armor class 12.`;
      setupResetButton.disabled = false;
    });
  }

  disposeBoard(): void {
    boardView?.dispose();
    boardView = null;
  }
}

const scene = new SetupPreviewScene();
setupResetButton.disabled = true;

try {
  game = new Phaser.Game({
    type: Phaser.WEBGL,
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    parent: boardHost,
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
  setupStatus.textContent = 'Unable to start preview. Check WebGL availability and reload.';
  scene.disposeBoard();
}

function resetSetup(): void {
  if (!boardView) return;
  setupResetButton.disabled = true;
  setupStatus.textContent = 'Preparing a fresh setup…';
  const replacement = createGame(selectedPreset.value);
  currentGame = replacement;
  revision += 1;
  scene.drawCurrentSetup();
}

setupResetButton.addEventListener('click', resetSetup);
window.addEventListener('beforeunload', () => {
  setupResetButton.removeEventListener('click', resetSetup);
  scene.disposeBoard();
  controls.dispose();
  game?.destroy(true);
  game = null;
});
