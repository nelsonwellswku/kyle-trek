import Phaser from 'phaser';
import { Color, Vector3 } from 'three';
import '../../../../app/styles.css';
import { CubeOrientation } from '../../../board/domain/CubeOrientation.js';
import { CUBE_CELL_COUNT, CUBE_SIZE, CubePosition } from '../../../board/domain/CubePosition.js';
import type { CubePickTarget } from '../../../board/presentation/CubePicker.js';
import { CubeScreenGeometry } from '../../../board/presentation/CubeScreenGeometry.js';
import { AgilityStat } from '../../../ship-movement/domain/AgilityStat.js';
import { AbilityStat } from '../../../ship-stats/domain/AbilityStat.js';
import type { RandomSource } from '../../../game-setup/domain/RandomSource.js';
import { AttackResolver, type AttackOutcome } from '../../domain/AttackResolver.js';
import { BattleSession } from '../../domain/BattleSession.js';
import { CombatGame, type CombatShip } from '../../domain/CombatGame.js';
import { DiceRoller } from '../../domain/DiceRoller.js';
import { CombatControls } from '../../presentation/CombatControls.js';
import { CombatScene } from '../../presentation/CombatScene.js';
import type { TorpedoIdentity } from '../../presentation/TorpedoAnimator.js';
import type { TorpedoVisualEvent } from '../../presentation/PhaserTorpedoAnimator.js';

const BOARD_SIZE = 600;

interface ShipRotationAcceptance {
  readonly checkedDirections: number;
  readonly failed: readonly string[];
  readonly turnAndCombatStatePreserved: boolean;
  readonly cameraOrbitIndependent: boolean;
  readonly torpedoUsedCurrentPositions: boolean;
  readonly attackOutcomeUnchanged: boolean;
  readonly newGameResetBothOrientations: boolean;
  readonly staleRotationIgnored: boolean;
}

interface CubeBrowserFixture {
  readonly markerCount: number;
  readonly positions: readonly CubePosition[];
  readonly canvas: HTMLCanvasElement;
  pickAt(clientX: number, clientY: number): CubePickTarget | null;
  verifyAllCellPicks(): Promise<{
    readonly checked: number;
    readonly failed: readonly string[];
    readonly stateUnchanged: boolean;
    readonly oneThreeCanvas: boolean;
    readonly canvasBoundsAligned: boolean;
  }>;
  verifySixAxisMovement(): Promise<{
    readonly checked: number;
    readonly failed: readonly string[];
    readonly movementTimesMs: readonly number[];
    readonly everyMarkerPicked: boolean;
    readonly everyDestinationHighlighted: boolean;
    readonly everyPositionCommitted: boolean;
    readonly turnsAdvancedOnce: boolean;
  }>;
  verifyShipRotations(): Promise<ShipRotationAcceptance>;
}

declare global {
  interface Window {
    cubeFixture?: CubeBrowserFixture;
  }
}

interface CombatPreset {
  readonly attackerPosition: readonly [row: number, column: number];
  readonly defenderPosition: readonly [row: number, column: number];
  readonly strengthScore: number;
  readonly defenderHitPoints: number;
  readonly attackDie: number;
  readonly damageDie?: number;
  readonly attackerDepth?: number;
  readonly defenderDepth?: number;
  readonly agilityScore?: number;
}

const presets: Readonly<Record<string, CombatPreset>> = {
  'threshold-hit': {
    attackerPosition: [3, 3],
    defenderPosition: [3, 4],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 12,
    damageDie: 4,
  },
  'threshold-miss': {
    attackerPosition: [3, 3],
    defenderPosition: [3, 4],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 11,
  },
  'zero-damage': {
    attackerPosition: [3, 3],
    defenderPosition: [3, 4],
    strengthScore: 8,
    defenderHitPoints: 10,
    attackDie: 13,
    damageDie: 1,
  },
  lethal: {
    attackerPosition: [3, 3],
    defenderPosition: [3, 4],
    strengthScore: 14,
    defenderHitPoints: 2,
    attackDie: 10,
    damageDie: 1,
  },
  overkill: {
    attackerPosition: [3, 3],
    defenderPosition: [3, 4],
    strengthScore: 20,
    defenderHitPoints: 3,
    attackDie: 7,
    damageDie: 8,
  },
  'adjacent-hit': {
    attackerPosition: [3, 3],
    defenderPosition: [3, 4],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 12,
    damageDie: 4,
  },
  'adjacent-miss': {
    attackerPosition: [3, 3],
    defenderPosition: [3, 4],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 11,
  },
  'corner-top-left': {
    attackerPosition: [4, 4],
    defenderPosition: [1, 1],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 11,
  },
  'corner-top-right': {
    attackerPosition: [4, 5],
    defenderPosition: [1, 5],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 11,
  },
  'corner-bottom-left': {
    attackerPosition: [5, 4],
    defenderPosition: [5, 1],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 11,
  },
  'corner-bottom-right': {
    attackerPosition: [4, 4],
    defenderPosition: [5, 5],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 11,
  },
  'maximum-separation': {
    attackerPosition: [1, 1],
    defenderPosition: [5, 5],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 11,
  },
  'maximum-separation-hit': {
    attackerPosition: [1, 1],
    defenderPosition: [5, 5],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 12,
    damageDie: 4,
  },
  immobility: {
    attackerPosition: [3, 3],
    defenderPosition: [5, 5],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 12,
    damageDie: 4,
  },
  'six-axis-movement': {
    attackerPosition: [3, 3],
    defenderPosition: [5, 5],
    attackerDepth: 3,
    defenderDepth: 5,
    agilityScore: 20,
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 1,
  },
};

class PresetRandomSource implements RandomSource {
  private samples: readonly number[] = [];
  private index = 0;

  replace(samples: readonly number[]): void {
    this.samples = [...samples];
    this.index = 0;
  }

  next(): number {
    const sample = this.samples[this.index];
    if (sample === undefined) throw new Error(`Attack preset exhausted after ${this.index} draws.`);
    this.index += 1;
    return sample;
  }
}

class FixedTorpedoPathRandomSource implements RandomSource {
  next(): number {
    return 0.5;
  }
}

interface FixtureObservation {
  readonly key: string;
  readonly event: string;
  readonly timestampMs: number;
}

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`The combat fixture element ${selector} is missing.`);
  return element;
}

const boardHost = requiredElement<HTMLElement>('#combat-board');
const controlsHost = requiredElement<HTMLElement>('#combat-controls');
const presetSelect = requiredElement<HTMLSelectElement>('#combat-preset');
const resetButton = requiredElement<HTMLButtonElement>('#reset-battle');
const verifyCubeButton = requiredElement<HTMLButtonElement>('#verify-cube-picks');
const verifyMovementButton = requiredElement<HTMLButtonElement>('#verify-six-axis-movement');
const verifyRotationsButton = requiredElement<HTMLButtonElement>('#verify-ship-rotations');
const clearButton = requiredElement<HTMLButtonElement>('#clear-observations');
const status = requiredElement<HTMLElement>('#fixture-status');
const eventLog = requiredElement<HTMLElement>('#event-log');
const cubeInspection = requiredElement<HTMLElement>('#cube-fixture-inspection');

const geometry = new CubeScreenGeometry(BOARD_SIZE);
const controls = new CombatControls(controlsHost);
const randomSource = new PresetRandomSource();
const resolver = new AttackResolver(new DiceRoller(randomSource));
randomSource.replace(attackSamples(currentPreset()));
const observations: FixtureObservation[] = [];
const recordedFrameEvents = new Set<string>();
let activeIdentity: TorpedoIdentity | null = null;
let activeOutcome: AttackOutcome | null = null;
let phaserGame: Phaser.Game | null = null;

function currentPreset(): CombatPreset {
  const preset = presets[presetSelect.value];
  if (!preset) throw new RangeError(`Unknown combat preset ${presetSelect.value}.`);
  return preset;
}

function makeShip(
  identity: CombatShip['identity'],
  position: CubePosition,
  agilityScore: number,
  strengthScore: number,
  hitPoints: number,
): CombatShip {
  return {
    identity,
    owner: identity === 'ship-1' ? 'player-1' : 'player-2',
    position,
    orientation:
      identity === 'ship-1' ? CubeOrientation.ship1Default() : CubeOrientation.ship2Default(),
    agility: new AgilityStat(agilityScore),
    strength: new AbilityStat(strengthScore),
    constitution: new AbilityStat(10),
    armorClass: 12,
    startingHitPoints: hitPoints,
    hitPoints,
  };
}

function makeGame(preset: CombatPreset): CombatGame {
  return new CombatGame(
    makeShip(
      'ship-1',
      new CubePosition(
        preset.attackerPosition[1],
        preset.attackerPosition[0],
        preset.attackerDepth ?? 5,
      ),
      preset.agilityScore ?? 8,
      preset.strengthScore,
      10,
    ),
    makeShip(
      'ship-2',
      new CubePosition(
        preset.defenderPosition[1],
        preset.defenderPosition[0],
        preset.defenderDepth ?? 5,
      ),
      preset.agilityScore ?? 8,
      10,
      preset.defenderHitPoints,
    ),
  );
}

const session = new BattleSession(makeGame(currentPreset()), resolver);

function observationKey(identity: TorpedoIdentity): string {
  return `revision-${identity.gameRevision}/turn-${identity.turnToken}/attack-${identity.attackId}`;
}

function recordObservation(
  identity: TorpedoIdentity,
  event: string,
  timestampMs = performance.now(),
): void {
  observations.push({
    key: observationKey(identity),
    event,
    timestampMs: Number(timestampMs.toFixed(2)),
  });
  eventLog.textContent = JSON.stringify(observations, null, 2);
}

function observeTorpedo(
  identity: TorpedoIdentity,
  event: TorpedoVisualEvent,
  timestampMs: number,
): void {
  if (event === 'launch') {
    activeIdentity = identity;
    const snapshot = session.snapshot;
    activeOutcome =
      snapshot.phase === 'attacking' && snapshot.pendingAttack.attackId === identity.attackId
        ? snapshot.pendingAttack.outcome
        : null;
  }
  recordObservation(identity, event, timestampMs);
}

function observeRenderedFrames(): void {
  requestAnimationFrame(observeRenderedFrames);
  if (!activeIdentity || !activeOutcome) return;
  const snapshot = session.snapshot;
  if (snapshot.phase === 'disposed' || snapshot.lastCompletedAttack !== activeOutcome) return;

  const key = observationKey(activeIdentity);
  const result = controlsHost.querySelector<HTMLElement>('#battle-result')?.textContent?.trim();
  if (result && !recordedFrameEvents.has(`${key}:result`)) {
    recordedFrameEvents.add(`${key}:result`);
    recordObservation(activeIdentity, 'result-rendered');
  }

  if (snapshot.phase === 'finished') {
    if (!recordedFrameEvents.has(`${key}:winner`)) {
      recordedFrameEvents.add(`${key}:winner`);
      recordObservation(activeIdentity, 'winner-rendered');
    }
  } else if (
    (snapshot.phase === 'movement-ready' || snapshot.phase === 'awaiting-movement-skip') &&
    !recordedFrameEvents.has(`${key}:actionable`)
  ) {
    recordedFrameEvents.add(`${key}:actionable`);
    recordObservation(activeIdentity, 'next-actionable-frame');
  }
}

function onDrawn(revision: number): void {
  if (revision !== session.snapshot.gameRevision) return;
  status.textContent = `Battle revision ${revision} ready · drag to orbit; inspect any marker.`;
  resetButton.disabled = false;
  const view = scene.cubeViewForFixture;
  if (view) {
    verifyCubeButton.disabled = false;
    verifyMovementButton.disabled = false;
    verifyRotationsButton.disabled = false;
    window.cubeFixture = {
      markerCount: view.markerCount,
      positions: view.cellPositions,
      canvas: view.canvas,
      pickAt: (clientX, clientY) => view.pickAt(clientX, clientY),
      verifyAllCellPicks: async () => {
        const initial = session.snapshot;
        if (initial.phase === 'disposed') throw new Error('The fixture battle was disposed.');
        const initialCameraPosition = view.camera.position.clone();
        const initialCameraQuaternion = view.camera.quaternion.clone();
        const bounds = view.canvas.getBoundingClientRect();
        const failures: string[] = [];
        const elevations = [0.22, 0.5, 0.85, 1.2, 1.57, 1.9, 2.35, 2.75];
        const azimuthSteps = 16;

        for (const [index, position] of view.cellPositions.entries()) {
          const center = (CUBE_SIZE + 1) / 2;
          const world = new Vector3(position.x - center, position.y - center, position.z - center);
          let found = false;
          for (const elevation of elevations) {
            for (let azimuthIndex = 0; azimuthIndex < azimuthSteps; azimuthIndex += 1) {
              const azimuth = (azimuthIndex / azimuthSteps) * Math.PI * 2;
              const radius = 17;
              view.camera.position.set(
                radius * Math.sin(elevation) * Math.cos(azimuth),
                radius * Math.sin(elevation) * Math.sin(azimuth),
                radius * Math.cos(elevation),
              );
              view.camera.up.set(0, 0, 1);
              view.camera.lookAt(0, 0, 0);
              view.camera.updateMatrixWorld(true);
              const projected = world.clone().project(view.camera);
              if (
                projected.x < -1 ||
                projected.x > 1 ||
                projected.y < -1 ||
                projected.y > 1 ||
                projected.z < -1 ||
                projected.z > 1
              ) {
                continue;
              }
              const clientX = bounds.left + ((projected.x + 1) / 2) * bounds.width;
              const clientY = bounds.top + ((1 - projected.y) / 2) * bounds.height;
              const target = view.pickAt(clientX, clientY);
              if (target?.type === 'cell' && target.position.equals(position)) {
                found = true;
                break;
              }
            }
            if (found) break;
          }
          if (!found) failures.push(`${position.x},${position.y},${position.z}`);
          if (index % 25 === 0) {
            status.textContent = `Checking cube marker picks: ${index + 1} / ${CUBE_CELL_COUNT}`;
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          }
        }

        view.camera.position.copy(initialCameraPosition);
        view.camera.quaternion.copy(initialCameraQuaternion);
        view.camera.updateMatrixWorld(true);
        view.renderCurrentPose();
        const final = session.snapshot;
        const stateUnchanged =
          final.phase !== 'disposed' &&
          final.game === initial.game &&
          final.gameRevision === initial.gameRevision &&
          final.turnToken === initial.turnToken &&
          final.phase === initial.phase;
        const hostBounds = boardHost.getBoundingClientRect();
        const phaserCanvas = boardHost.querySelector('canvas:not(.three-cube-canvas)');
        const phaserBounds = phaserCanvas?.getBoundingClientRect();
        return {
          checked: view.cellPositions.length,
          failed: failures,
          stateUnchanged,
          oneThreeCanvas: boardHost.querySelectorAll('.three-cube-canvas').length === 1,
          canvasBoundsAligned:
            !!phaserBounds &&
            bounds.left === hostBounds.left &&
            bounds.top === hostBounds.top &&
            bounds.width === hostBounds.width &&
            bounds.height === hostBounds.height &&
            phaserBounds.left === bounds.left &&
            phaserBounds.top === bounds.top &&
            phaserBounds.width === bounds.width &&
            phaserBounds.height === bounds.height,
        };
      },
      verifySixAxisMovement: async () => {
        resetButton.disabled = true;
        presetSelect.value = 'six-axis-movement';
        randomSource.replace(attackSamples(presets['six-axis-movement']!));
        const revision = session.newGame(makeGame(presets['six-axis-movement']!));
        scene.updateGame(revision);
        const ready = await waitUntil(
          () => session.snapshot.phase === 'movement-ready' && !resetButton.disabled,
          3_000,
        );
        if (!ready) throw new Error('The deterministic movement preset did not become ready.');

        const moves = [
          { ship: 'ship-1', destination: new CubePosition(4, 3, 3) },
          { ship: 'ship-2', destination: new CubePosition(4, 5, 5) },
          { ship: 'ship-1', destination: new CubePosition(3, 3, 3) },
          { ship: 'ship-2', destination: new CubePosition(5, 5, 5) },
          { ship: 'ship-1', destination: new CubePosition(3, 4, 3) },
          { ship: 'ship-2', destination: new CubePosition(5, 4, 5) },
          { ship: 'ship-1', destination: new CubePosition(3, 3, 3) },
          { ship: 'ship-2', destination: new CubePosition(5, 5, 5) },
          { ship: 'ship-1', destination: new CubePosition(3, 3, 4) },
          { ship: 'ship-2', destination: new CubePosition(5, 5, 4) },
          { ship: 'ship-1', destination: new CubePosition(3, 3, 3) },
          { ship: 'ship-2', destination: new CubePosition(5, 5, 5) },
        ] as const;
        const failed: string[] = [];
        const movementTimesMs: number[] = [];
        let everyMarkerPicked = true;
        let everyDestinationHighlighted = true;
        let everyPositionCommitted = true;
        let turnsAdvancedOnce = true;
        const inputCanvas = phaserGame?.canvas;
        if (!inputCanvas) throw new Error('The Phaser input canvas is unavailable.');

        for (const [index, step] of moves.entries()) {
          const before = session.snapshot;
          if (before.phase !== 'movement-ready' || before.activeShip !== step.ship) {
            failed.push(`move ${index + 1}: wrong active movement phase`);
            break;
          }
          const color = new Color();
          view.markerMesh.getColorAt(step.destination.presentationIndex, color);
          if (color.getHex() !== 0xffe679) everyDestinationHighlighted = false;

          const clientPoint = findCellPoint(view, step.destination);
          if (!clientPoint) {
            everyMarkerPicked = false;
            failed.push(
              `move ${index + 1}: no camera pose picked ${step.destination.x},${step.destination.y},${step.destination.z}`,
            );
            break;
          }
          const picked = view.pickAt(clientPoint.x, clientPoint.y);
          if (picked?.type !== 'cell' || !picked.position.equals(step.destination)) {
            everyMarkerPicked = false;
            failed.push(`move ${index + 1}: ray picked the wrong marker`);
            break;
          }

          const moveStartedAt = performance.now();
          inputCanvas.dispatchEvent(
            new PointerEvent('pointerdown', {
              button: 0,
              buttons: 1,
              pointerId: 91,
              clientX: clientPoint.x,
              clientY: clientPoint.y,
              bubbles: true,
            }),
          );
          inputCanvas.dispatchEvent(
            new PointerEvent('pointerup', {
              button: 0,
              buttons: 0,
              pointerId: 91,
              clientX: clientPoint.x,
              clientY: clientPoint.y,
              bubbles: true,
            }),
          );
          const moving = await waitUntil(() => session.snapshot.phase === 'moving', 500);
          if (!moving) {
            everyPositionCommitted = false;
            failed.push(`move ${index + 1}: pointer release did not start a move`);
            break;
          }
          const arrived = await waitUntil(() => {
            const current = session.snapshot;
            return (
              current.phase === 'attack-ready' &&
              (step.ship === 'ship-1' ? current.game.ship1 : current.game.ship2).position.equals(
                step.destination,
              )
            );
          }, 1_500);
          movementTimesMs.push(Number((performance.now() - moveStartedAt).toFixed(1)));
          if (!arrived) {
            everyPositionCommitted = false;
            failed.push(
              `move ${index + 1}: ship did not arrive at ${step.destination.x},${step.destination.y},${step.destination.z} within 1.5 s`,
            );
            break;
          }

          const attackReady = session.snapshot;
          if (attackReady.phase !== 'attack-ready' || attackReady.turnToken !== before.turnToken) {
            turnsAdvancedOnce = false;
            failed.push(`move ${index + 1}: movement did not preserve the active turn`);
            break;
          }
          if (index === moves.length - 1) continue;
          const endTurnButton = controlsHost.querySelector<HTMLButtonElement>('.end-turn-button');
          if (!endTurnButton || endTurnButton.disabled) {
            turnsAdvancedOnce = false;
            failed.push(`turn ${index + 1}: native End turn control was unavailable`);
            break;
          }
          endTurnButton.click();
          const handedOff = await waitUntil(() => {
            const current = session.snapshot;
            return (
              current.phase === 'movement-ready' &&
              current.activeShip !== step.ship &&
              current.turnToken === before.turnToken + 1
            );
          }, 1_000);
          if (!handedOff) {
            turnsAdvancedOnce = false;
            failed.push(`turn ${index + 1}: End turn did not hand off exactly once`);
            break;
          }
        }

        return {
          checked: movementTimesMs.length,
          failed,
          movementTimesMs,
          everyMarkerPicked,
          everyDestinationHighlighted,
          everyPositionCommitted,
          turnsAdvancedOnce,
        };
      },
      verifyShipRotations,
    };
  }
}

async function verifyShipRotations(): Promise<ShipRotationAcceptance> {
  const fixture = window.cubeFixture;
  const view = scene.cubeViewForFixture;
  if (!fixture || !view)
    throw new Error('The production cube view is not ready for rotation checks.');
  verifyRotationsButton.disabled = true;
  status.textContent =
    'Verifying signed ship rotations, current-position torpedo, and New Game reset…';
  const failed: string[] = [];
  let checkedDirections = 0;
  let turnAndCombatStatePreserved = true;
  let cameraOrbitIndependent = true;
  let torpedoUsedCurrentPositions = false;
  let attackOutcomeUnchanged = false;
  let newGameResetBothOrientations = false;
  let staleRotationIgnored = false;
  try {
    presetSelect.value = 'threshold-hit';
    randomSource.replace(attackSamples(presets['threshold-hit']!));
    const initialRevision = session.newGame(makeGame(presets['threshold-hit']!));
    scene.updateGame(initialRevision);
    const initialized = await waitUntil(
      () => session.snapshot.gameRevision === initialRevision && !resetButton.disabled,
      3_000,
    );
    if (!initialized) throw new Error('The deterministic rotation preset did not become ready.');

    const rotationActions = [
      { axis: 'x', direction: 1, button: 'rotate-x-positive' },
      { axis: 'x', direction: -1, button: 'rotate-x-negative' },
      { axis: 'y', direction: 1, button: 'rotate-y-positive' },
      { axis: 'y', direction: -1, button: 'rotate-y-negative' },
      { axis: 'z', direction: 1, button: 'rotate-z-positive' },
      { axis: 'z', direction: -1, button: 'rotate-z-negative' },
    ] as const;

    const rotateCurrentShip = async (shipIdentity: 'ship-1' | 'ship-2'): Promise<void> => {
      for (const action of rotationActions) {
        const before = session.snapshot;
        if (
          before.phase === 'disposed' ||
          before.activeShip !== shipIdentity ||
          !['movement-ready', 'awaiting-movement-skip', 'attack-ready'].includes(before.phase)
        ) {
          failed.push(
            `${shipIdentity} ${action.axis}${action.direction}: not in a ready turn phase`,
          );
          turnAndCombatStatePreserved = false;
          return;
        }
        const originalShip = shipIdentity === 'ship-1' ? before.game.ship1 : before.game.ship2;
        const opposingShip = shipIdentity === 'ship-1' ? before.game.ship2 : before.game.ship1;
        const model = view.shipModels.get(shipIdentity);
        if (!model) throw new Error(`The ${shipIdentity} 3D model is missing.`);
        const oldQuaternion = model.quaternion.clone();
        const button = controlsHost.querySelector<HTMLButtonElement>(`button.${action.button}`);
        if (!button || button.disabled || button.hidden) {
          failed.push(`${shipIdentity} ${action.axis}${action.direction}: control unavailable`);
          turnAndCombatStatePreserved = false;
          return;
        }
        button.click();
        const started = await waitUntil(() => session.snapshot.phase === 'rotating', 500);
        if (!started) {
          failed.push(`${shipIdentity} ${action.axis}${action.direction}: rotation did not start`);
          turnAndCombatStatePreserved = false;
          return;
        }
        const rotating = session.snapshot;
        if (rotating.phase !== 'rotating') return;
        const targetOrientation = originalShip.orientation.rotate(action.axis, action.direction);
        const orientationBeforeCommit =
          shipIdentity === 'ship-1'
            ? rotating.game.ship1.orientation
            : rotating.game.ship2.orientation;
        if (!orientationBeforeCommit.equals(originalShip.orientation)) {
          turnAndCombatStatePreserved = false;
        }
        const completed = await waitUntil(() => {
          const current = session.snapshot;
          return (
            current.phase === rotating.pendingRotation.resumePhase &&
            (shipIdentity === 'ship-1'
              ? current.game.ship1.orientation
              : current.game.ship2.orientation
            ).equals(targetOrientation)
          );
        }, 1_200);
        if (!completed) {
          failed.push(
            `${shipIdentity} ${action.axis}${action.direction}: animation did not commit`,
          );
          turnAndCombatStatePreserved = false;
          return;
        }
        const after = session.snapshot;
        if (after.phase === 'disposed') return;
        const rotatedShip = shipIdentity === 'ship-1' ? after.game.ship1 : after.game.ship2;
        const unchangedOpponent = shipIdentity === 'ship-1' ? after.game.ship2 : after.game.ship1;
        const preserved =
          after.turnToken === before.turnToken &&
          rotatedShip.position.equals(originalShip.position) &&
          rotatedShip.agility === originalShip.agility &&
          rotatedShip.strength === originalShip.strength &&
          rotatedShip.constitution === originalShip.constitution &&
          rotatedShip.armorClass === originalShip.armorClass &&
          rotatedShip.startingHitPoints === originalShip.startingHitPoints &&
          rotatedShip.hitPoints === originalShip.hitPoints &&
          unchangedOpponent.position.equals(opposingShip.position) &&
          unchangedOpponent.orientation.equals(opposingShip.orientation) &&
          unchangedOpponent.hitPoints === opposingShip.hitPoints;
        if (!preserved) {
          turnAndCombatStatePreserved = false;
          failed.push(`${shipIdentity} ${action.axis}${action.direction}: battle state changed`);
        }
        if (model.quaternion.angleTo(oldQuaternion) <= 1e-4) {
          failed.push(`${shipIdentity} ${action.axis}${action.direction}: model did not turn`);
        }
        checkedDirections += 1;
      }
    };

    await rotateCurrentShip('ship-1');
    const shipOneState = session.snapshot;
    if (shipOneState.phase === 'disposed')
      throw new Error('The battle was disposed during rotation.');
    const shipOneModel = view.shipModels.get('ship-1');
    if (!shipOneModel) throw new Error('The ship-1 model is missing.');
    const shipOneQuaternion = shipOneModel.quaternion.clone();
    const oldCamera = view.camera.position.clone();
    view.camera.position.applyAxisAngle(new Vector3(0, 0, 1), 0.61);
    view.camera.lookAt(0, 0, 0);
    view.camera.updateMatrixWorld(true);
    view.renderCurrentPose();
    cameraOrbitIndependent =
      session.snapshot.phase !== 'disposed' &&
      session.snapshot.game.ship1.orientation.equals(shipOneState.game.ship1.orientation) &&
      shipOneModel.quaternion.angleTo(shipOneQuaternion) < 1e-5;
    view.camera.position.copy(oldCamera);
    view.camera.lookAt(0, 0, 0);
    view.camera.updateMatrixWorld(true);
    view.renderCurrentPose();

    let state = session.snapshot;
    if (state.phase === 'awaiting-movement-skip') {
      controlsHost.querySelector<HTMLButtonElement>('.skip-movement-button')?.click();
      await waitUntil(() => session.snapshot.phase === 'attack-ready', 500);
      state = session.snapshot;
    }
    if (state.phase !== 'attack-ready') throw new Error('Ship 1 did not reach attack-ready.');
    const targetPoint = findShipPoint(view, 'ship-2');
    const inputCanvas = phaserGame?.canvas;
    if (!targetPoint || !inputCanvas) throw new Error('The target ship ray could not be prepared.');
    inputCanvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        buttons: 1,
        pointerId: 93,
        clientX: targetPoint.x,
        clientY: targetPoint.y,
        bubbles: true,
      }),
    );
    inputCanvas.dispatchEvent(
      new PointerEvent('pointerup', {
        button: 0,
        buttons: 0,
        pointerId: 93,
        clientX: targetPoint.x,
        clientY: targetPoint.y,
        bubbles: true,
      }),
    );
    const attackStarted = await waitUntil(() => session.snapshot.phase === 'attacking', 750);
    if (!attackStarted) throw new Error('The deterministic attack did not start.');
    const attacking = session.snapshot;
    if (attacking.phase !== 'attacking') throw new Error('Expected a pending attack.');
    const torpedo = view.scene.children.find((object) => object.userData['torpedoEffect']);
    const effectStart = torpedo?.userData['startPosition'];
    const effectTarget = torpedo?.userData['targetPosition'];
    torpedoUsedCurrentPositions =
      effectStart instanceof CubePosition &&
      effectTarget instanceof CubePosition &&
      effectStart.equals(attacking.pendingAttack.attackerPosition) &&
      effectTarget.equals(attacking.pendingAttack.defenderPosition);
    const expectedOutcome = attacking.pendingAttack.outcome;
    const finishedAttack = await waitUntil(() => session.snapshot.phase !== 'attacking', 1_500);
    const afterAttack = session.snapshot;
    attackOutcomeUnchanged =
      finishedAttack &&
      afterAttack.phase !== 'disposed' &&
      afterAttack.lastCompletedAttack === expectedOutcome &&
      expectedOutcome.kind === 'hit';

    await rotateCurrentShip('ship-2');
    const beforeInterruptedRotation = session.snapshot;
    if (beforeInterruptedRotation.phase === 'disposed') {
      throw new Error('The battle was disposed before New Game reset verification.');
    }
    controlsHost.querySelector<HTMLButtonElement>('button.rotate-x-positive')?.click();
    const rotationStarted = await waitUntil(() => session.snapshot.phase === 'rotating', 500);
    if (!rotationStarted) throw new Error('The reset-interruption rotation did not start.');
    const oldRevision = session.snapshot.gameRevision;
    resetButton.click();
    const resetReady = await waitUntil(
      () =>
        session.snapshot.gameRevision > oldRevision &&
        session.snapshot.phase !== 'disposed' &&
        !resetButton.disabled,
      3_000,
    );
    const replacement = session.snapshot;
    newGameResetBothOrientations =
      resetReady &&
      replacement.phase !== 'disposed' &&
      replacement.activePlayer === 'player-1' &&
      replacement.game.ship1.orientation.equals(CubeOrientation.ship1Default()) &&
      replacement.game.ship2.orientation.equals(CubeOrientation.ship2Default());
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const afterStaleWindow = session.snapshot;
    staleRotationIgnored =
      afterStaleWindow.phase !== 'disposed' &&
      afterStaleWindow.gameRevision > oldRevision &&
      afterStaleWindow.game.ship1.orientation.equals(CubeOrientation.ship1Default()) &&
      afterStaleWindow.game.ship2.orientation.equals(CubeOrientation.ship2Default());
  } catch (error) {
    failed.push(error instanceof Error ? error.message : 'Rotation acceptance failed.');
  } finally {
    verifyRotationsButton.disabled = false;
  }

  const result = {
    checkedDirections,
    failed,
    turnAndCombatStatePreserved,
    cameraOrbitIndependent,
    torpedoUsedCurrentPositions,
    attackOutcomeUnchanged,
    newGameResetBothOrientations,
    staleRotationIgnored,
  };
  status.textContent = `Rotation acceptance: ${checkedDirections} signed turns · state ${turnAndCombatStatePreserved ? 'pass' : 'fail'} · orbit ${cameraOrbitIndependent ? 'pass' : 'fail'} · torpedo positions ${torpedoUsedCurrentPositions ? 'pass' : 'fail'} · outcome ${attackOutcomeUnchanged ? 'pass' : 'fail'} · reset ${newGameResetBothOrientations ? 'pass' : 'fail'} · stale callback ${staleRotationIgnored ? 'ignored' : 'fail'}.`;
  eventLog.textContent = JSON.stringify(result, null, 2);
  return result;
}

function findShipPoint(
  view: NonNullable<typeof scene.cubeViewForFixture>,
  identity: 'ship-1' | 'ship-2',
): { readonly x: number; readonly y: number } | null {
  const model = view.shipModels.get(identity);
  if (!model) return null;
  model.updateWorldMatrix(true, true);
  const world = new Vector3();
  model.getWorldPosition(world);
  const bounds = view.canvas.getBoundingClientRect();
  for (const elevation of [0.22, 0.5, 0.85, 1.2, 1.57, 1.9, 2.35, 2.75]) {
    for (let azimuthIndex = 0; azimuthIndex < 16; azimuthIndex += 1) {
      const azimuth = (azimuthIndex / 16) * Math.PI * 2;
      view.camera.position.set(
        17 * Math.sin(elevation) * Math.cos(azimuth),
        17 * Math.sin(elevation) * Math.sin(azimuth),
        17 * Math.cos(elevation),
      );
      view.camera.up.set(0, 0, 1);
      view.camera.lookAt(0, 0, 0);
      view.camera.updateMatrixWorld(true);
      const projected = world.clone().project(view.camera);
      if (projected.x < -1 || projected.x > 1 || projected.y < -1 || projected.y > 1) continue;
      const point = {
        x: bounds.left + ((projected.x + 1) / 2) * bounds.width,
        y: bounds.top + ((1 - projected.y) / 2) * bounds.height,
      };
      const target = view.pickAt(point.x, point.y);
      if (target?.type === 'ship' && target.identity === identity) {
        view.renderCurrentPose();
        return point;
      }
    }
  }
  return null;
}

function findCellPoint(
  view: NonNullable<typeof scene.cubeViewForFixture>,
  position: CubePosition,
): { readonly x: number; readonly y: number } | null {
  const bounds = view.canvas.getBoundingClientRect();
  const center = (CUBE_SIZE + 1) / 2;
  const world = new Vector3(position.x - center, position.y - center, position.z - center);
  for (const elevation of [0.22, 0.5, 0.85, 1.2, 1.57, 1.9, 2.35, 2.75]) {
    for (let azimuthIndex = 0; azimuthIndex < 16; azimuthIndex += 1) {
      const azimuth = (azimuthIndex / 16) * Math.PI * 2;
      const radius = 17;
      view.camera.position.set(
        radius * Math.sin(elevation) * Math.cos(azimuth),
        radius * Math.sin(elevation) * Math.sin(azimuth),
        radius * Math.cos(elevation),
      );
      view.camera.up.set(0, 0, 1);
      view.camera.lookAt(0, 0, 0);
      view.camera.updateMatrixWorld(true);
      const projected = world.clone().project(view.camera);
      if (
        projected.x < -1 ||
        projected.x > 1 ||
        projected.y < -1 ||
        projected.y > 1 ||
        projected.z < -1 ||
        projected.z > 1
      ) {
        continue;
      }
      const point = {
        x: bounds.left + ((projected.x + 1) / 2) * bounds.width,
        y: bounds.top + ((1 - projected.y) / 2) * bounds.height,
      };
      const target = view.pickAt(point.x, point.y);
      if (target?.type === 'cell' && target.position.equals(position)) {
        view.renderCurrentPose();
        return point;
      }
    }
  }
  return null;
}

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const startedAt = performance.now();
  while (performance.now() - startedAt <= timeoutMs) {
    if (predicate()) return true;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return predicate();
}

function showError(message: string): void {
  status.textContent = message;
}

const scene = new CombatScene(
  session,
  geometry,
  controls,
  onDrawn,
  showError,
  showError,
  undefined,
  undefined,
  undefined,
  observeTorpedo,
  new FixedTorpedoPathRandomSource(),
  boardHost,
  (target: CubePickTarget | null, game: CombatGame) => {
    if (!target) {
      cubeInspection.textContent =
        'Hover or click a marker to inspect its X/Y/Z coordinate and occupancy.';
      return;
    }
    const position =
      target.type === 'cell'
        ? target.position
        : target.identity === 'ship-1'
          ? game.ship1.position
          : game.ship2.position;
    const occupant = game.occupantAt(position);
    cubeInspection.textContent = `X ${position.x}, Y ${position.y}, Z ${position.z} — ${occupant ?? 'empty'}.`;
  },
  (message) => showError(`3D cube renderer startup failed: ${message}`),
);

function attackSamples(preset: CombatPreset): readonly number[] {
  const samples = [(preset.attackDie - 1) / 20];
  if (preset.damageDie !== undefined) samples.push((preset.damageDie - 1) / 8);
  return samples;
}

function resetBattle(): void {
  resetButton.disabled = true;
  status.textContent = 'Preparing a fresh battle…';
  const preset = currentPreset();
  randomSource.replace(attackSamples(preset));
  activeIdentity = null;
  activeOutcome = null;
  const revision = session.newGame(makeGame(preset));
  scene.updateGame(revision);
}

function clearObservations(): void {
  observations.length = 0;
  recordedFrameEvents.clear();
  eventLog.textContent = '';
}

async function verifyCubePicks(): Promise<void> {
  const fixture = window.cubeFixture;
  if (!fixture) return;
  verifyCubeButton.disabled = true;
  status.textContent = 'Sweeping orbit poses and ray-picking all cube markers…';
  try {
    const result = await fixture.verifyAllCellPicks();
    status.textContent = `Marker sweep: ${result.checked} checked, ${result.failed.length} missed · state ${result.stateUnchanged ? 'unchanged' : 'changed'} · one canvas ${result.oneThreeCanvas ? 'yes' : 'no'} · aligned ${result.canvasBoundsAligned ? 'yes' : 'no'}.`;
    eventLog.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : 'Marker-pick verification failed.';
  } finally {
    verifyCubeButton.disabled = false;
  }
}

async function verifySixAxisMovement(): Promise<void> {
  const fixture = window.cubeFixture;
  if (!fixture) return;
  verifyMovementButton.disabled = true;
  status.textContent = 'Picking legal WebGL2 markers and timing six-axis movement…';
  try {
    const result = await fixture.verifySixAxisMovement();
    status.textContent = `Six-axis movement: ${result.checked} moves · picks ${result.everyMarkerPicked ? 'pass' : 'fail'} · highlights ${result.everyDestinationHighlighted ? 'pass' : 'fail'} · arrival ${result.everyPositionCommitted ? 'pass' : 'fail'} · turn handoff ${result.turnsAdvancedOnce ? 'pass' : 'fail'} · max ${Math.max(0, ...result.movementTimesMs).toFixed(1)} ms.`;
    eventLog.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : 'Six-axis movement verification failed.';
  } finally {
    verifyMovementButton.disabled = false;
  }
}

async function verifyRotationAcceptance(): Promise<void> {
  const fixture = window.cubeFixture;
  if (!fixture) return;
  verifyRotationsButton.disabled = true;
  try {
    await fixture.verifyShipRotations();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Rotation acceptance failed.';
  } finally {
    verifyRotationsButton.disabled = false;
  }
}

resetButton.disabled = true;
verifyCubeButton.disabled = true;
verifyMovementButton.disabled = true;
verifyRotationsButton.disabled = true;
resetButton.addEventListener('click', resetBattle);
verifyCubeButton.addEventListener('click', verifyCubePicks);
verifyMovementButton.addEventListener('click', verifySixAxisMovement);
verifyRotationsButton.addEventListener('click', verifyRotationAcceptance);
clearButton.addEventListener('click', clearObservations);

try {
  phaserGame = new Phaser.Game({
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
  status.textContent = 'Unable to start the fixture. Check WebGL availability and reload.';
  scene.dispose();
}

requestAnimationFrame(observeRenderedFrames);

function disposeFixture(): void {
  resetButton.removeEventListener('click', resetBattle);
  verifyCubeButton.removeEventListener('click', verifyCubePicks);
  verifyMovementButton.removeEventListener('click', verifySixAxisMovement);
  verifyRotationsButton.removeEventListener('click', verifyRotationAcceptance);
  clearButton.removeEventListener('click', clearObservations);
  session.dispose();
  scene.dispose();
  controls.dispose();
  phaserGame?.destroy(true);
  phaserGame = null;
}

window.addEventListener('beforeunload', disposeFixture, { once: true });
