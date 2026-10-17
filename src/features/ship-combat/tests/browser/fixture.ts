import Phaser from 'phaser';
import '../../../../app/styles.css';
import { BoardPosition } from '../../../board/domain/BoardPosition.js';
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

interface CombatPreset {
  readonly attackerPosition: readonly [row: number, column: number];
  readonly defenderPosition: readonly [row: number, column: number];
  readonly strengthScore: number;
  readonly defenderHitPoints: number;
  readonly attackDie: number;
  readonly damageDie?: number;
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
const clearButton = requiredElement<HTMLButtonElement>('#clear-observations');
const status = requiredElement<HTMLElement>('#fixture-status');
const eventLog = requiredElement<HTMLElement>('#event-log');

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
  position: BoardPosition,
  strengthScore: number,
  hitPoints: number,
): CombatShip {
  return {
    identity,
    owner: identity === 'ship-1' ? 'player-1' : 'player-2',
    position,
    agility: new AgilityStat(8),
    strength: new AbilityStat(strengthScore),
    constitution: new AbilityStat(10),
    armorClass: 12,
    startingHitPoints: hitPoints,
    hitPoints,
  };
}

function makeGame(preset: CombatPreset): CombatGame {
  return new CombatGame(
    makeShip('ship-1', new BoardPosition(...preset.attackerPosition), preset.strengthScore, 10),
    makeShip('ship-2', new BoardPosition(...preset.defenderPosition), 10, preset.defenderHitPoints),
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
  status.textContent = `Battle revision ${revision} ready · Skip movement, then select the opposing ship.`;
  resetButton.disabled = false;
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

resetButton.disabled = true;
resetButton.addEventListener('click', resetBattle);
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
  clearButton.removeEventListener('click', clearObservations);
  session.dispose();
  scene.dispose();
  controls.dispose();
  phaserGame?.destroy(true);
  phaserGame = null;
}

window.addEventListener('beforeunload', disposeFixture, { once: true });
