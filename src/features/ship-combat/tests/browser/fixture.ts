import Phaser from 'phaser';
import { Color, Vector3 } from 'three';
import '../../../../app/styles.css';
import { CubeOrientation } from '../../../board/domain/CubeOrientation.js';
import { CubePosition } from '../../../board/domain/CubePosition.js';
import type { CubePickTarget } from '../../../board/presentation/CubePicker.js';
import { BoardGeometry } from '../../../board/presentation/BoardGeometry.js';
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
    attackerPosition: [5, 5],
    defenderPosition: [5, 6],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 12,
    damageDie: 4,
  },
  'threshold-miss': {
    attackerPosition: [5, 5],
    defenderPosition: [5, 6],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 11,
  },
  'zero-damage': {
    attackerPosition: [5, 5],
    defenderPosition: [5, 6],
    strengthScore: 8,
    defenderHitPoints: 10,
    attackDie: 13,
    damageDie: 1,
  },
  lethal: {
    attackerPosition: [5, 5],
    defenderPosition: [5, 6],
    strengthScore: 14,
    defenderHitPoints: 2,
    attackDie: 10,
    damageDie: 1,
  },
  overkill: {
    attackerPosition: [5, 5],
    defenderPosition: [5, 6],
    strengthScore: 20,
    defenderHitPoints: 3,
    attackDie: 7,
    damageDie: 8,
  },
  'adjacent-hit': {
    attackerPosition: [5, 5],
    defenderPosition: [5, 6],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 12,
    damageDie: 4,
  },
  'adjacent-miss': {
    attackerPosition: [5, 5],
    defenderPosition: [5, 6],
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
    attackerPosition: [4, 7],
    defenderPosition: [1, 10],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 11,
  },
  'corner-bottom-left': {
    attackerPosition: [7, 4],
    defenderPosition: [10, 1],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 11,
  },
  'corner-bottom-right': {
    attackerPosition: [7, 7],
    defenderPosition: [10, 10],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 11,
  },
  'maximum-separation': {
    attackerPosition: [1, 1],
    defenderPosition: [10, 10],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 11,
  },
  'maximum-separation-hit': {
    attackerPosition: [1, 1],
    defenderPosition: [10, 10],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 12,
    damageDie: 4,
  },
  immobility: {
    attackerPosition: [5, 5],
    defenderPosition: [9, 9],
    strengthScore: 10,
    defenderHitPoints: 10,
    attackDie: 12,
    damageDie: 4,
  },
  'six-axis-movement': {
    attackerPosition: [5, 5],
    defenderPosition: [10, 10],
    attackerDepth: 5,
    defenderDepth: 10,
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
const clearButton = requiredElement<HTMLButtonElement>('#clear-observations');
const status = requiredElement<HTMLElement>('#fixture-status');
const eventLog = requiredElement<HTMLElement>('#event-log');
const cubeInspection = requiredElement<HTMLElement>('#cube-fixture-inspection');

const geometry = new BoardGeometry(BOARD_SIZE);
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
          const world = new Vector3(position.x - 5.5, position.y - 5.5, position.z - 5.5);
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
            status.textContent = `Checking cube marker picks: ${index + 1} / 1,000`;
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
          { ship: 'ship-1', destination: new CubePosition(6, 5, 5) },
          { ship: 'ship-2', destination: new CubePosition(9, 10, 10) },
          { ship: 'ship-1', destination: new CubePosition(5, 5, 5) },
          { ship: 'ship-2', destination: new CubePosition(10, 10, 10) },
          { ship: 'ship-1', destination: new CubePosition(5, 6, 5) },
          { ship: 'ship-2', destination: new CubePosition(10, 9, 10) },
          { ship: 'ship-1', destination: new CubePosition(5, 5, 5) },
          { ship: 'ship-2', destination: new CubePosition(10, 10, 10) },
          { ship: 'ship-1', destination: new CubePosition(5, 5, 6) },
          { ship: 'ship-2', destination: new CubePosition(10, 10, 9) },
          { ship: 'ship-1', destination: new CubePosition(5, 5, 5) },
          { ship: 'ship-2', destination: new CubePosition(10, 10, 10) },
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
    };
  }
}

function findCellPoint(
  view: NonNullable<typeof scene.cubeViewForFixture>,
  position: CubePosition,
): { readonly x: number; readonly y: number } | null {
  const bounds = view.canvas.getBoundingClientRect();
  const world = new Vector3(position.x - 5.5, position.y - 5.5, position.z - 5.5);
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

resetButton.disabled = true;
verifyCubeButton.disabled = true;
verifyMovementButton.disabled = true;
resetButton.addEventListener('click', resetBattle);
verifyCubeButton.addEventListener('click', verifyCubePicks);
verifyMovementButton.addEventListener('click', verifySixAxisMovement);
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
  clearButton.removeEventListener('click', clearObservations);
  session.dispose();
  scene.dispose();
  controls.dispose();
  phaserGame?.destroy(true);
  phaserGame = null;
}

window.addEventListener('beforeunload', disposeFixture, { once: true });
