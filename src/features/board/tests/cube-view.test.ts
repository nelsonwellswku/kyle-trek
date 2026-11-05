import { describe, expect, it, vi } from 'vitest';
import {
  ArrowHelper,
  Color,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  SphereGeometry,
} from 'three';
import { CubePosition } from '../domain/CubePosition.js';
import { CubeOrientation } from '../domain/CubeOrientation.js';
import { CubeSnapshot } from '../domain/CubeSnapshot.js';
import { CubeOrbitControls, type OrbitControlsDriver } from '../presentation/CubeOrbitControls.js';
import { CubePicker } from '../presentation/CubePicker.js';
import { ThreeCubeView, type CubeRendererPort } from '../presentation/ThreeCubeView.js';

class FakeDomNode {
  readonly style: Record<string, string> = {};
  readonly children: FakeDomNode[] = [];
  className = '';
  textContent = '';
  clientWidth = 600;
  clientHeight = 400;
  private bounds = { left: 0, top: 0, width: 600, height: 400 };

  constructor(readonly ownerDocument: FakeDocument) {}

  setAttribute(): void {}

  appendChild(child: FakeDomNode): void {
    this.children.push(child);
  }

  removeChild(child: FakeDomNode): void {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
  }

  getBoundingClientRect() {
    return this.bounds;
  }

  setBounds(width: number, height: number): void {
    this.bounds = { left: 0, top: 0, width, height };
  }
}

class FakeDocument {
  createElement(): FakeDomNode {
    return new FakeDomNode(this);
  }
}

class FakePointerTarget {
  readonly listeners = new Map<string, Set<(event: PointerEvent) => void>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const entries = this.listeners.get(type) ?? new Set<(event: PointerEvent) => void>();
    entries.add(
      typeof listener === 'function'
        ? (listener as (event: PointerEvent) => void)
        : (event) => listener.handleEvent(event),
    );
    this.listeners.set(type, entries);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const entries = this.listeners.get(type);
    if (entries && typeof listener === 'function') {
      entries.delete(listener as (event: PointerEvent) => void);
    }
  }

  dispatch(type: string, event: Partial<PointerEvent>): void {
    const pointerEvent = {
      button: 0,
      buttons: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 20,
      ...event,
    } as PointerEvent;
    for (const listener of this.listeners.get(type) ?? []) listener(pointerEvent);
  }
}

function fakeOrbitDriver(): OrbitControlsDriver {
  return {
    target: { set: vi.fn() },
    enableDamping: true,
    minAzimuthAngle: 0,
    maxAzimuthAngle: 0,
    minPolarAngle: 0,
    maxPolarAngle: 0,
    addEventListener: vi.fn(),
    dispose: vi.fn(),
  };
}

function rendererDouble(canvas: HTMLCanvasElement) {
  const renderer: CubeRendererPort = {
    domElement: canvas,
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  };
  return renderer;
}

describe('ThreeCubeView', () => {
  it('animates ship orientation through signed-axis quarter-turns and cancels stale frames', () => {
    const document = new FakeDocument();
    const host = new FakeDomNode(document);
    const frames = new Map<number, FrameRequestCallback>();
    const cancelled: number[] = [];
    let nextFrameId = 1;
    const view = new ThreeCubeView(host as unknown as HTMLElement, undefined, {
      inputElement: new FakePointerTarget() as unknown as HTMLElement,
      rendererFactory: (canvas) => rendererDouble(canvas),
      controlsFactory: () => ({ dispose: vi.fn() }),
      pickerFactory: () => ({ pick: () => null }),
      requestAnimationFrame: (callback) => {
        const id = nextFrameId++;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (id) => {
        cancelled.push(id);
        frames.delete(id);
      },
    });
    const model = view.shipModels.get('ship-1');
    if (!model) throw new Error('Expected the ship-1 model.');
    const original = model.quaternion.clone();
    const target = CubeOrientation.ship1Default().rotate('x', 1);
    const onComplete = vi.fn();
    const onFailure = vi.fn();
    view.animateShipOrientation('ship-1', target, onComplete, onFailure);
    const advance = (timestamp: number): void => {
      const [id, callback] = [...frames.entries()][0] ?? [];
      if (id === undefined || !callback) throw new Error('Expected a queued rotation frame.');
      frames.delete(id);
      callback(timestamp);
    };
    advance(0);
    advance(125);
    expect(model.quaternion.equals(original)).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
    advance(250);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    const completedQuaternion = model.quaternion.clone();
    view.setShipOrientation('ship-1', target);
    expect(model.quaternion.angleTo(completedQuaternion)).toBeCloseTo(0);

    const staleCompletion = vi.fn();
    view.animateShipOrientation(
      'ship-1',
      CubeOrientation.ship1Default(),
      staleCompletion,
      onFailure,
    );
    const staleFrame = [...frames.keys()][0];
    const staleCallback = staleFrame === undefined ? undefined : frames.get(staleFrame);
    const staleHandle = view.animateShipOrientation('ship-1', target, staleCompletion, onFailure);
    staleHandle.cancel();
    staleCallback?.(500);
    expect(staleCompletion).not.toHaveBeenCalled();
    expect(cancelled.length).toBeGreaterThan(0);
    view.dispose();
  });

  it('creates 125 stable marker identities, an open labeled view, oriented ships, and resizes', () => {
    const document = new FakeDocument();
    const host = new FakeDomNode(document);
    const input = new FakePointerTarget();
    let click: ((x: number, y: number) => void) | undefined;
    let hover: ((x: number, y: number) => void) | undefined;
    let renderer: CubeRendererPort | undefined;
    const resizeDisconnect = vi.fn();
    const onInspection = vi.fn();
    const onSelect = vi.fn();
    const view = new ThreeCubeView(host as unknown as HTMLElement, onInspection, {
      inputElement: input as unknown as HTMLElement,
      rendererFactory: (canvas) => {
        renderer = rendererDouble(canvas);
        return renderer;
      },
      controlsFactory: (_camera, _element, onClick, onHover) => {
        click = onClick;
        hover = onHover;
        return { dispose: vi.fn() };
      },
      pickerFactory: () => ({
        pick: (x, y) =>
          x === 15 && y === 25 ? { type: 'cell', position: new CubePosition(4, 3, 2) } : null,
      }),
      resizeObserverFactory: () => ({ observe: vi.fn(), disconnect: resizeDisconnect }),
      pixelRatio: 1.5,
      onSelect,
    });

    expect(view.markerCount).toBe(125);
    expect(view.cellPositions).toHaveLength(125);
    expect(new Set(view.cellPositions.map((position) => position.presentationIndex)).size).toBe(
      125,
    );
    expect(view.cellPositions[74]).toEqual(CubePosition.fromPresentationIndex(74));
    expect(view.shipModels.size).toBe(2);
    expect([...view.shipModels.values()].every((model) => model.children.length >= 4)).toBe(true);
    expect(view.scene.children.some((object) => object instanceof LineSegments)).toBe(true);
    expect(view.scene.children.filter((object) => object instanceof ArrowHelper)).toHaveLength(3);
    expect(view.camera.position.x).not.toBe(0);
    expect(view.camera.position.y).not.toBe(0);
    expect(view.camera.position.z).not.toBe(0);
    expect(host.children).toHaveLength(2);
    expect(host.children[1]?.children.map((child) => child.textContent)).toEqual(['X', 'Y', 'Z']);
    expect(renderer?.render).toHaveBeenCalled();
    expect(renderer?.setPixelRatio).toHaveBeenCalledWith(1.5);

    click?.(15, 25);
    hover?.(200, 200);
    expect(onInspection).toHaveBeenNthCalledWith(1, {
      type: 'cell',
      position: new CubePosition(4, 3, 2),
    });
    expect(onInspection).toHaveBeenNthCalledWith(2, null);
    expect(onSelect).toHaveBeenCalledWith({
      type: 'cell',
      position: new CubePosition(4, 3, 2),
    });

    host.setBounds(800, 400);
    view.resize();
    expect(view.camera.aspect).toBe(2);
    expect(renderer?.setSize).toHaveBeenLastCalledWith(800, 400, false);
    view.render(
      new CubeSnapshot(
        { identity: 'ship-1', position: new CubePosition(2, 1, 4) },
        { identity: 'ship-2', position: new CubePosition(4, 5, 3) },
      ),
    );
    expect(view.shipModels.get('ship-1')?.position.toArray()).toEqual([-1, -2, 1]);
    expect(view.shipModels.get('ship-2')?.position.toArray()).toEqual([1, 2, 0]);
    expect(
      view.shipModels.get('ship-1')?.quaternion.equals(view.shipModels.get('ship-2')!.quaternion),
    ).toBe(false);
    expect(renderer?.render).toHaveBeenCalled();

    const highlighted = new Color();
    const cell = new CubePosition(4, 3, 2);
    view.setHighlights([cell]);
    view.markerMesh.getColorAt(cell.presentationIndex, highlighted);
    expect(highlighted.getHex()).toBe(0xffe679);
    view.setShipVisualPosition('ship-1', { x: 1, y: 2, z: 3 });
    expect(view.shipModels.get('ship-1')?.position.toArray()).toEqual([1, 2, 3]);
    view.setShipPosition('ship-1', new CubePosition(4, 5, 4));
    expect(view.shipModels.get('ship-1')?.position.toArray()).toEqual([1, 2, 1]);
    view.setHighlights([]);
    view.markerMesh.getColorAt(cell.presentationIndex, highlighted);
    expect(highlighted.getHex()).toBe(0x9fe8ff);

    view.dispose();
    view.dispose();
    expect(resizeDisconnect).toHaveBeenCalledTimes(1);
    expect(renderer?.dispose).toHaveBeenCalledTimes(1);
    expect(host.children).toHaveLength(0);
  });

  it('reports WebGL2 renderer creation failure and removes partial overlay elements', () => {
    const document = new FakeDocument();
    const host = new FakeDomNode(document);

    expect(
      () =>
        new ThreeCubeView(host as unknown as HTMLElement, undefined, {
          rendererFactory: () => {
            throw new Error('WebGL2 unavailable');
          },
        }),
    ).toThrow(/WebGL2 unavailable/);
    expect(host.children).toHaveLength(0);
  });
});

describe('CubePicker', () => {
  it('maps a CSS ray to the nearest visible cell marker and rejects points outside the canvas', () => {
    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const markers = new InstancedMesh(new SphereGeometry(0.6, 12, 8), new MeshBasicMaterial(), 2);
    markers.setMatrixAt(0, new Matrix4().makeTranslation(0, 0, 2));
    markers.setMatrixAt(1, new Matrix4().makeTranslation(0, 0, 0));
    markers.instanceMatrix.needsUpdate = true;
    markers.updateMatrixWorld(true);
    const canvas = {
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 200, height: 200 }),
    };
    const picker = new CubePicker(canvas, camera, markers, []);

    expect(picker.pick(200, 150)).toEqual({
      type: 'cell',
      position: new CubePosition(1, 1, 1),
    });
    expect(picker.pick(99, 150)).toBeNull();
    expect(picker.pick(300, 150)).toBeNull();
  });

  it('returns a typed ship target when a ship model is the nearest ray hit', () => {
    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const markers = new InstancedMesh(new SphereGeometry(0.4, 8, 6), new MeshBasicMaterial(), 1);
    markers.setMatrixAt(0, new Matrix4().makeTranslation(0, 0, 0));
    markers.updateMatrixWorld(true);
    const ship = new Group();
    ship.userData['shipIdentity'] = 'ship-2';
    ship.add(new Mesh(new SphereGeometry(0.6, 8, 6), new MeshBasicMaterial()));
    ship.position.z = 2;
    ship.updateMatrixWorld(true);
    const picker = new CubePicker(
      { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
      camera,
      markers,
      [ship],
    );

    expect(picker.pick(50, 50)).toEqual({ type: 'ship', identity: 'ship-2' });
  });
});

describe('CubeOrbitControls', () => {
  it('starts with full azimuth, usable elevation, and selects only releases below five CSS pixels', () => {
    const target = new FakePointerTarget();
    const driver = fakeOrbitDriver();
    const onClick = vi.fn();
    const onHover = vi.fn();
    const controls = new CubeOrbitControls(
      new PerspectiveCamera(),
      target as unknown as HTMLElement,
      onClick,
      onHover,
      vi.fn(),
      () => driver,
    );

    expect(controls.minAzimuthAngle).toBe(-Infinity);
    expect(controls.maxAzimuthAngle).toBe(Infinity);
    expect(controls.minPolarAngle).toBeGreaterThan(0);
    expect(controls.maxPolarAngle).toBeLessThan(Math.PI);
    target.dispatch('pointerdown', { clientX: 20, clientY: 30 });
    target.dispatch('pointerup', { clientX: 24, clientY: 30 });
    expect(onClick).toHaveBeenCalledWith(24, 30);

    target.dispatch('pointerdown', { clientX: 20, clientY: 30 });
    target.dispatch('pointermove', { clientX: 25, clientY: 30, buttons: 1 });
    target.dispatch('pointerup', { clientX: 25, clientY: 30 });
    expect(onClick).toHaveBeenCalledTimes(1);

    target.dispatch('pointermove', { clientX: 11, clientY: 12 });
    expect(onHover).toHaveBeenCalledWith(11, 12);
    controls.dispose();
    expect(driver.dispose).toHaveBeenCalledTimes(1);
  });
});
