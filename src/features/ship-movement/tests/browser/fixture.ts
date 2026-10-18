import Phaser from 'phaser';
import '../../../../app/styles.css';
import { BoardPosition } from '../../../board/domain/BoardPosition.js';
import { BoardGeometry } from '../../../board/presentation/BoardGeometry.js';
import { GameSetupControls } from '../../../game-setup/presentation/GameSetupControls.js';
import { AgilityStat } from '../../domain/AgilityStat.js';
import { MovementGame } from '../../domain/MovementGame.js';
import type { PendingMove, TurnSnapshot } from '../../domain/TurnSession.js';
import { TurnSession } from '../../domain/TurnSession.js';
import { MovementScene } from '../../presentation/MovementScene.js';
import { SpaceFlightPath } from '../../presentation/SpaceFlightPath.js';
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
let lastMovingIdentity = '';
let pendingPointerAt: number | null = null;
let observedCanvas: HTMLCanvasElement | null = null;
let routeOverlay: SVGSVGElement | null = null;
const startedAt = performance.now();
let currentTurnStartedAt = startedAt;
let lastReadyIdentity = '';

function appendObservation(label: string, snapshot: TurnSnapshot, at = performance.now()): void {
  const identity =
    snapshot.phase === 'disposed'
      ? 'disposed'
      : `game ${snapshot.gameRevision}; turn ${snapshot.turnToken}; ${snapshot.activePlayer}${snapshot.phase === 'moving' ? `; move ${snapshot.pendingMove.moveId}` : ''}`;
  const elapsed = (at - startedAt).toFixed(1);
  observationLog.textContent =
    `${elapsed} ms | ${label} | ${identity}\n${observationLog.textContent}`
      .split('\n')
      .slice(0, 81)
      .join('\n');
}

function clearRouteOverlay(): void {
  routeOverlay?.replaceChildren();
}

function drawRouteOverlay(move: PendingMove): void {
  if (!routeOverlay) {
    return;
  }

  clearRouteOverlay();
  const path = new SpaceFlightPath(
    move.origin,
    move.destination,
    move.otherShipPosition,
    new BoardGeometry(BOARD_SIZE),
  );
  const namespace = 'http://www.w3.org/2000/svg';
  for (const segment of path.segments) {
    const overlaySegment = document.createElementNS(namespace, 'path');
    const data =
      segment.kind === 'line'
        ? `M ${segment.start.x} ${segment.start.y} L ${segment.end.x} ${segment.end.y}`
        : `M ${segment.start.x} ${segment.start.y} A ${segment.radius} ${segment.radius} 0 ${Math.abs(segment.sweepRadians) > Math.PI ? 1 : 0} ${segment.sweepRadians > 0 ? 1 : 0} ${segment.end.x} ${segment.end.y}`;
    overlaySegment.setAttribute('d', data);
    overlaySegment.setAttribute('class', 'flight-route-segment');
    overlaySegment.setAttribute('data-segment', segment.kind);
    routeOverlay.append(overlaySegment);
  }

  for (const position of [move.origin, move.destination]) {
    const center = new BoardGeometry(BOARD_SIZE).cellCenter(position);
    const endpoint = document.createElementNS(namespace, 'circle');
    endpoint.setAttribute('cx', String(center.x));
    endpoint.setAttribute('cy', String(center.y));
    endpoint.setAttribute('r', '5');
    endpoint.setAttribute('class', 'flight-route-endpoint');
    routeOverlay.append(endpoint);
  }
}

function observePointerSelection(canvas: HTMLCanvasElement): void {
  if (observedCanvas === canvas) {
    return;
  }

  observedCanvas?.removeEventListener('pointerdown', capturePointerSelection, true);
  observedCanvas = canvas;
  observedCanvas.addEventListener('pointerdown', capturePointerSelection, true);
}

function capturePointerSelection(event: PointerEvent): void {
  if (event.button === 0 && session.snapshot.phase === 'ready') {
    pendingPointerAt = performance.now();
  }
}

function observeRenderedHighlights(): void {
  const snapshot = session.snapshot;
  if (snapshot.phase !== 'ready') {
    lastReadyIdentity = '';
    return;
  }

  const identity = `${snapshot.gameRevision}:${snapshot.turnToken}`;
  if (identity !== lastReadyIdentity) {
    lastReadyIdentity = identity;
    const latency = Math.max(0, performance.now() - currentTurnStartedAt).toFixed(1);
    appendObservation(`actionable highlights (+${latency} ms)`, snapshot);
  }
}

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

  if (phase === 'moving') {
    const moveIdentity = `${snapshot.gameRevision}:${snapshot.turnToken}:${snapshot.pendingMove.moveId}`;
    if (moveIdentity !== lastMovingIdentity) {
      lastMovingIdentity = moveIdentity;
      appendObservation('destination selected', snapshot, pendingPointerAt ?? performance.now());
      pendingPointerAt = null;
      drawRouteOverlay(snapshot.pendingMove);
    }
  } else if (lastMovingIdentity) {
    lastMovingIdentity = '';
    clearRouteOverlay();
  }

  requestAnimationFrame(recordTurnObservation);
}

const controls = new GameSetupControls(appRoot, () => resetSelectedPreset());
routeOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
routeOverlay.setAttribute('class', 'flight-observation-overlay');
routeOverlay.setAttribute('viewBox', `0 0 ${BOARD_SIZE} ${BOARD_SIZE}`);
routeOverlay.setAttribute('preserveAspectRatio', 'none');
routeOverlay.setAttribute('aria-hidden', 'true');
controls.gameCanvasHost.append(routeOverlay);
const turnControls = new TurnControls(controls.turnHudHost, (revision, token) => {
  if (scene?.acknowledgePass(revision, token)) {
    currentTurnStartedAt = performance.now();
  }
});
resetPresetButton.disabled = true;

function resetSelectedPreset(): void {
  if (!scene) {
    return;
  }

  resetPresetButton.disabled = true;
  clearRouteOverlay();
  lastMovingIdentity = '';
  currentTurnStartedAt = performance.now();
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
    observePointerSelection(game.canvas);
    appendObservation('turn start', snapshot, currentTurnStartedAt);
    if (snapshot.phase === 'awaiting-pass') {
      appendObservation('turn awaits pass', snapshot);
    }
    resetPresetButton.disabled = false;
  },
  (message) => controls.showMovementError(message),
  undefined,
  (snapshot) => {
    controls.updateBoard(snapshot);
    const turn = session.snapshot;
    const arrivedAt = performance.now();
    currentTurnStartedAt = arrivedAt;
    appendObservation('move arrival', turn, arrivedAt);
    appendObservation('next turn start', turn, arrivedAt);
    if (turn.phase === 'awaiting-pass') {
      appendObservation('next turn awaits pass', turn, arrivedAt);
    }
  },
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
  game.events.on('postrender', observeRenderedHighlights);
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
  observedCanvas?.removeEventListener('pointerdown', capturePointerSelection, true);
  game?.events.off('postrender', observeRenderedHighlights);
  clearRouteOverlay();
  session.dispose();
  scene?.dispose();
  controls.dispose();
  turnControls.dispose();
  game?.destroy(true);
});
