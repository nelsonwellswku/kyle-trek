import {
  AmbientLight,
  ArrowHelper,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  type Material,
  WebGLRenderer,
} from 'three';
import type { ShipIdentity } from '../domain/CubeSnapshot.js';
import { CubeOrientation } from '../domain/CubeOrientation.js';
import { CubePosition } from '../domain/CubePosition.js';
import type { CubeSnapshot } from '../domain/CubeSnapshot.js';
import { CubeOrbitControls, type OrbitControlsDriverFactory } from './CubeOrbitControls.js';
import type { CubePickTarget } from './CubePicker.js';
import { CubePicker } from './CubePicker.js';

export interface CubeRendererPort {
  readonly domElement: HTMLCanvasElement;
  setPixelRatio(value: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
}

export interface CubeOrbitControlsPort {
  dispose(): void;
}

export interface CubePickerPort {
  pick(clientX: number, clientY: number): CubePickTarget | null;
}

export interface CubeRotationAnimationHandle {
  cancel(): void;
}

export interface CubeResizeObserverPort {
  observe(target: Element): void;
  disconnect(): void;
}

export type CubeRendererFactory = (canvas: HTMLCanvasElement) => CubeRendererPort;

export type CubeViewControlsFactory = (
  camera: PerspectiveCamera,
  inputElement: HTMLElement,
  onClick: (clientX: number, clientY: number) => void,
  onHover: (clientX: number, clientY: number) => void,
  onChange: () => void,
) => CubeOrbitControlsPort;

export type CubeViewPickerFactory = (
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera,
  markers: InstancedMesh,
  ships: readonly Group[],
) => CubePickerPort;

export interface ThreeCubeViewOptions {
  readonly rendererFactory?: CubeRendererFactory;
  readonly controlsFactory?: CubeViewControlsFactory;
  readonly pickerFactory?: CubeViewPickerFactory;
  readonly inputElement?: HTMLElement;
  readonly orbitControlsDriverFactory?: OrbitControlsDriverFactory;
  readonly resizeObserverFactory?: (callback: () => void) => CubeResizeObserverPort;
  readonly pixelRatio?: number;
  readonly rotationDurationMs?: number;
  readonly requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelAnimationFrame?: (handle: number) => void;
  readonly onSelect?: (target: CubePickTarget | null) => void;
}

export type CubeInspectionHandler = (target: CubePickTarget | null) => void;

interface OrientedShip {
  readonly identity: ShipIdentity;
  readonly position: CubePosition;
  readonly orientation?: CubeOrientation;
}

/** Independently-owned WebGL2 cube view; game state is supplied as immutable snapshots. */
export class ThreeCubeView {
  readonly cellPositions: readonly CubePosition[] = Object.freeze(
    Array.from({ length: 1_000 }, (_, index) => CubePosition.fromPresentationIndex(index)),
  );
  readonly camera!: PerspectiveCamera;
  readonly scene!: Scene;
  readonly renderer!: CubeRendererPort;
  readonly canvas: HTMLCanvasElement;
  readonly markerMesh!: InstancedMesh;
  readonly shipModels = new Map<ShipIdentity, Group>();
  private readonly cubeLabels: HTMLElement;
  private highlightedCellIndexes = new Set<number>();
  private readonly orbitControls!: CubeOrbitControlsPort;
  private readonly picker!: CubePickerPort;
  private readonly resizeObserver!: CubeResizeObserverPort | null;
  private readonly scheduleAnimationFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelScheduledAnimationFrame: (handle: number) => void;
  private readonly rotationDurationMs: number;
  private readonly rotationAnimations = new Map<
    ShipIdentity,
    {
      readonly handle: CubeRotationAnimationHandle;
      frame: number | null;
    }
  >();
  private isDisposed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly onInspection: CubeInspectionHandler = () => {},
    options: ThreeCubeViewOptions = {},
  ) {
    this.scheduleAnimationFrame =
      options.requestAnimationFrame ?? ((callback) => globalThis.requestAnimationFrame(callback));
    this.cancelScheduledAnimationFrame =
      options.cancelAnimationFrame ?? ((handle) => globalThis.cancelAnimationFrame(handle));
    this.rotationDurationMs = options.rotationDurationMs ?? 250;
    if (!Number.isFinite(this.rotationDurationMs) || this.rotationDurationMs <= 0) {
      throw new RangeError('Ship rotation animation duration must be positive and finite.');
    }
    this.canvas = host.ownerDocument.createElement('canvas');
    this.canvas.className = 'three-cube-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      display: 'block',
    });
    if (host.style.position === '' || host.style.position === 'static')
      host.style.position = 'relative';
    host.appendChild(this.canvas);
    this.cubeLabels = ThreeCubeView.createAxisLabels(host.ownerDocument);
    host.appendChild(this.cubeLabels);

    try {
      this.renderer = (options.rendererFactory ?? ThreeCubeView.createWebGL2Renderer)(this.canvas);
      this.scene = new Scene();
      this.scene.background = new Color(0x0b1b2b);
      this.camera = new PerspectiveCamera(38, 1, 0.1, 100);
      this.camera.up.set(0, 0, 1);
      this.camera.position.set(13, 12, 14);
      this.camera.lookAt(0, 0, 0);

      this.scene.add(new AmbientLight(0xffffff, 1.8));
      const keyLight = new DirectionalLight(0xffffff, 2.3);
      keyLight.position.set(8, -5, 14);
      this.scene.add(keyLight);
      this.scene.add(ThreeCubeView.createOpenLattice());
      this.scene.add(ThreeCubeView.createAxisArrow('x', 0x48d9ff));
      this.scene.add(ThreeCubeView.createAxisArrow('y', 0xffc86f));
      this.scene.add(ThreeCubeView.createAxisArrow('z', 0x9de3a9));
      this.markerMesh = ThreeCubeView.createMarkers(this.cellPositions);
      this.scene.add(this.markerMesh);
      this.shipModels.set('ship-1', ThreeCubeView.createShipModel('ship-1', 0x35c8f2));
      this.shipModels.set('ship-2', ThreeCubeView.createShipModel('ship-2', 0xffad4d));
      for (const model of this.shipModels.values()) this.scene.add(model);

      this.picker = (
        options.pickerFactory ??
        ((canvas, camera, markers, ships) => new CubePicker(canvas, camera, markers, ships))
      )(this.canvas, this.camera, this.markerMesh, [...this.shipModels.values()]);
      const inputElement =
        options.inputElement ??
        host.querySelector<HTMLElement>('canvas:not(.three-cube-canvas)') ??
        host;
      this.orbitControls = (
        options.controlsFactory ??
        ((camera, element, onClick, onHover, onChange) =>
          new CubeOrbitControls(
            camera,
            element,
            onClick,
            onHover,
            onChange,
            options.orbitControlsDriverFactory,
          ))
      )(
        this.camera,
        inputElement,
        (clientX, clientY) => this.selectAt(clientX, clientY, options.onSelect),
        (clientX, clientY) => this.hoverAt(clientX, clientY),
        () => this.renderFrame(),
      );

      const pixelRatio = options.pixelRatio ?? ThreeCubeView.devicePixelRatio();
      this.renderer.setPixelRatio(Math.min(2, Math.max(1, pixelRatio)));
      this.resize();
      this.resizeObserver = ThreeCubeView.createResizeObserver(options.resizeObserverFactory, () =>
        this.resize(),
      );
      this.resizeObserver?.observe(host);
      this.renderFrame();
    } catch (error) {
      host.removeChild(this.canvas);
      host.removeChild(this.cubeLabels);
      throw error instanceof Error
        ? new Error(`Unable to initialize the 3D cube view: ${error.message}`, { cause: error })
        : new Error('Unable to initialize the 3D cube view because WebGL2 is unavailable.');
    }
  }

  get markerCount(): number {
    return this.markerMesh.count;
  }

  render(snapshot: CubeSnapshot): void {
    if (this.isDisposed) return;
    this.updateShip(snapshot.ship1, 'ship-1');
    this.updateShip(snapshot.ship2, 'ship-2');
    this.renderFrame();
  }

  pickAt(clientX: number, clientY: number): CubePickTarget | null {
    if (this.isDisposed) return null;
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    return this.picker.pick(clientX, clientY);
  }

  setHighlights(destinations: readonly CubePosition[]): void {
    if (this.isDisposed) return;
    const next = new Set<number>();
    for (const position of destinations) {
      if (position instanceof CubePosition) next.add(position.presentationIndex);
    }
    const affected = new Set([...this.highlightedCellIndexes, ...next]);
    for (const index of affected) {
      this.markerMesh.setColorAt(index, new Color(next.has(index) ? 0xffe679 : 0x9fe8ff));
    }
    this.markerMesh.instanceColor!.needsUpdate = true;
    this.highlightedCellIndexes = next;
    this.renderFrame();
  }

  setShipPosition(identity: ShipIdentity, position: CubePosition): void {
    if (this.isDisposed || !(position instanceof CubePosition)) return;
    this.cancelShipRotation(identity);
    const model = this.shipModels.get(identity);
    model?.position.copy(ThreeCubeView.worldPosition(position));
    this.renderFrame();
  }

  setShipVisualPosition(
    identity: ShipIdentity,
    point: { readonly x: number; readonly y: number; readonly z: number },
  ): void {
    if (
      this.isDisposed ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      !Number.isFinite(point.z)
    ) {
      return;
    }
    this.shipModels.get(identity)?.position.set(point.x, point.y, point.z);
    this.renderFrame();
  }

  setShipOrientation(identity: ShipIdentity, orientation: CubeOrientation): void {
    if (this.isDisposed || !(orientation instanceof CubeOrientation)) return;
    this.cancelShipRotation(identity);
    const model = this.shipModels.get(identity);
    model?.quaternion.copy(ThreeCubeView.orientationQuaternion(orientation));
    this.renderFrame();
  }

  animateShipOrientation(
    identity: ShipIdentity,
    orientation: CubeOrientation,
    onComplete: () => void,
    onFailure: (error: Error) => void,
  ): CubeRotationAnimationHandle {
    if (this.isDisposed) return { cancel: () => {} };
    if (!(orientation instanceof CubeOrientation)) {
      onFailure(new RangeError('A ship rotation requires a valid CubeOrientation.'));
      return { cancel: () => {} };
    }
    const model = this.shipModels.get(identity);
    if (!model) {
      onFailure(new RangeError(`The ${identity} model is unavailable for rotation.`));
      return { cancel: () => {} };
    }

    this.cancelShipRotation(identity);
    const start = model.quaternion.clone();
    const target = ThreeCubeView.orientationQuaternion(orientation);
    let settled = false;
    let startedAt: number | null = null;
    let frame: number | null = null;
    const handle: CubeRotationAnimationHandle = {
      cancel: () => {
        if (settled) return;
        settled = true;
        if (frame !== null) this.cancelScheduledAnimationFrame(frame);
        frame = null;
        if (this.rotationAnimations.get(identity) === animation) {
          this.rotationAnimations.delete(identity);
        }
      },
    };
    const animation: { readonly handle: CubeRotationAnimationHandle; frame: number | null } = {
      handle,
      frame: null,
    };
    this.rotationAnimations.set(identity, animation);

    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      if (frame !== null) this.cancelScheduledAnimationFrame(frame);
      frame = null;
      if (this.rotationAnimations.get(identity) === animation) {
        this.rotationAnimations.delete(identity);
      }
      onFailure(error);
    };
    const step: FrameRequestCallback = (timestamp) => {
      frame = null;
      animation.frame = null;
      if (settled || this.isDisposed) return;
      if (!Number.isFinite(timestamp)) {
        fail(new Error('The renderer returned an invalid ship rotation timestamp.'));
        return;
      }
      if (startedAt === null) startedAt = timestamp;
      const progress = Math.max(0, Math.min(1, (timestamp - startedAt) / this.rotationDurationMs));
      model.quaternion.copy(start).slerp(target, progress);
      this.renderFrame();
      if (progress >= 1) {
        settled = true;
        this.rotationAnimations.delete(identity);
        model.quaternion.copy(target);
        this.renderFrame();
        onComplete();
        return;
      }
      try {
        frame = this.scheduleAnimationFrame(step);
        animation.frame = frame;
      } catch (error) {
        fail(error instanceof Error ? error : new Error('Ship rotation could not continue.'));
      }
    };

    try {
      frame = this.scheduleAnimationFrame(step);
      animation.frame = frame;
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Ship rotation could not start.'));
    }
    return handle;
  }

  renderCurrentPose(): void {
    this.renderFrame();
  }

  resize(): void {
    if (this.isDisposed) return;
    const bounds = this.host.getBoundingClientRect();
    const width = Math.max(1, bounds.width || this.host.clientWidth || 600);
    const height = Math.max(1, bounds.height || this.host.clientHeight || width);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderFrame();
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    for (const identity of [...this.rotationAnimations.keys()]) this.cancelShipRotation(identity);
    this.resizeObserver?.disconnect();
    this.orbitControls.dispose();
    this.onInspection(null);

    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    this.scene.traverse((object) => {
      const renderable = object as typeof object & {
        geometry?: BufferGeometry;
        material?: Material | Material[];
      };
      if (renderable.geometry) geometries.add(renderable.geometry);
      if (Array.isArray(renderable.material)) {
        for (const material of renderable.material) materials.add(material);
      } else if (renderable.material) {
        materials.add(renderable.material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.renderer.dispose();
    this.host.removeChild(this.canvas);
    this.host.removeChild(this.cubeLabels);
    this.shipModels.clear();
  }

  private inspectAt(clientX: number, clientY: number): void {
    if (!this.isDisposed) this.onInspection(this.picker.pick(clientX, clientY));
  }

  private selectAt(
    clientX: number,
    clientY: number,
    onSelect: ThreeCubeViewOptions['onSelect'],
  ): void {
    if (this.isDisposed) return;
    const target = this.picker.pick(clientX, clientY);
    this.onInspection(target);
    onSelect?.(target);
  }

  private hoverAt(clientX: number, clientY: number): void {
    if (!this.isDisposed) this.onInspection(this.picker.pick(clientX, clientY));
  }

  private renderFrame(): void {
    if (!this.isDisposed) this.renderer.render(this.scene, this.camera);
  }

  private updateShip(placement: OrientedShip, identity: ShipIdentity): void {
    this.cancelShipRotation(identity);
    const model = this.shipModels.get(identity);
    if (!model) return;
    model.position.copy(ThreeCubeView.worldPosition(placement.position));
    const orientation =
      placement.orientation ??
      (identity === 'ship-1' ? CubeOrientation.ship1Default() : CubeOrientation.ship2Default());
    model.quaternion.copy(ThreeCubeView.orientationQuaternion(orientation));
  }

  private cancelShipRotation(identity: ShipIdentity): void {
    this.rotationAnimations.get(identity)?.handle.cancel();
  }

  private static orientationQuaternion(orientation: CubeOrientation): Quaternion {
    const basis = new Matrix4().makeBasis(
      ThreeCubeView.axisVector(orientation.right),
      ThreeCubeView.axisVector(orientation.up),
      ThreeCubeView.axisVector(orientation.forward),
    );
    return new Quaternion().setFromRotationMatrix(basis);
  }

  private static createWebGL2Renderer(canvas: HTMLCanvasElement): CubeRendererPort {
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!context) throw new Error('This game requires WebGL2 to display the 3D cube.');
    // Three.js requires WebGL2 and owns the independent context for this canvas.
    return new WebGLRenderer({ canvas, context, antialias: true, alpha: false });
  }

  private static createMarkers(positions: readonly CubePosition[]): InstancedMesh {
    const geometry = new SphereGeometry(0.085, 8, 6);
    const material = new MeshBasicMaterial({
      color: 0x9fe8ff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const markers = new InstancedMesh(geometry, material, positions.length);
    const transform = new Matrix4();
    for (const [index, position] of positions.entries()) {
      transform.makeTranslation(...ThreeCubeView.worldPosition(position).toArray());
      markers.setMatrixAt(index, transform);
      markers.setColorAt(index, new Color(0x9fe8ff));
    }
    markers.instanceMatrix.needsUpdate = true;
    markers.frustumCulled = false;
    markers.userData['cubeCellMarkers'] = true;
    return markers;
  }

  private static createOpenLattice(): LineSegments {
    const vertices: Vector3[] = [];
    for (let step = 0; step <= 10; step += 1) {
      const offset = step - 5;
      for (let other = 0; other <= 10; other += 1) {
        const second = other - 5;
        vertices.push(new Vector3(-5, offset, second), new Vector3(5, offset, second));
        vertices.push(new Vector3(offset, -5, second), new Vector3(offset, 5, second));
        vertices.push(new Vector3(offset, second, -5), new Vector3(offset, second, 5));
      }
    }
    const geometry = new BufferGeometry().setFromPoints(vertices);
    const material = new LineBasicMaterial({ color: 0x4d7992, transparent: true, opacity: 0.34 });
    return new LineSegments(geometry, material);
  }

  private static createAxisArrow(axis: 'x' | 'y' | 'z', color: number): ArrowHelper {
    const direction = new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
    return new ArrowHelper(direction, new Vector3(), 5.65, color, 0.34, 0.2);
  }

  private static createShipModel(identity: ShipIdentity, color: number): Group {
    const group = new Group();
    group.userData['shipIdentity'] = identity;
    const material = new MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.12 });
    const hull = new Mesh(new CylinderGeometry(0.13, 0.22, 0.72, 9), material);
    hull.rotation.x = Math.PI / 2;
    hull.position.z = -0.02;
    group.add(hull);
    const nose = new Mesh(new ConeGeometry(0.19, 0.38, 9), material);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.48;
    group.add(nose);
    const wingGeometry = new BufferGeometry();
    wingGeometry.setAttribute(
      'position',
      new Float32BufferAttribute([-0.52, 0, -0.13, 0.52, 0, -0.13, 0, 0, 0.16], 3),
    );
    wingGeometry.computeVertexNormals();
    const wings = new Mesh(wingGeometry, material);
    wings.material = material;
    group.add(wings);
    const topMarker = new Mesh(
      new SphereGeometry(0.075, 8, 6),
      new MeshBasicMaterial({ color: 0xffffff }),
    );
    topMarker.position.set(0, 0.2, -0.03);
    group.add(topMarker);
    return group;
  }

  private static createAxisLabels(document: Document): HTMLElement {
    const labels = document.createElement('div');
    labels.className = 'cube-axis-labels';
    labels.setAttribute('aria-hidden', 'true');
    for (const [axis, text] of [
      ['x', 'X'],
      ['y', 'Y'],
      ['z', 'Z'],
    ] as const) {
      const label = document.createElement('span');
      label.className = `cube-axis-label cube-axis-label-${axis}`;
      label.textContent = text;
      labels.appendChild(label);
    }
    return labels;
  }

  private static worldPosition(position: CubePosition): Vector3 {
    return new Vector3(position.x - 5.5, position.y - 5.5, position.z - 5.5);
  }

  private static axisVector(vector: CubeOrientation['right']): Vector3 {
    return new Vector3(
      vector.axis === 'x' ? vector.sign : 0,
      vector.axis === 'y' ? vector.sign : 0,
      vector.axis === 'z' ? vector.sign : 0,
    );
  }

  private static devicePixelRatio(): number {
    return typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  }

  private static createResizeObserver(
    factory: ThreeCubeViewOptions['resizeObserverFactory'],
    callback: () => void,
  ): CubeResizeObserverPort | null {
    if (factory) return factory(callback);
    if (typeof ResizeObserver === 'undefined') return null;
    return new ResizeObserver(callback);
  }
}
