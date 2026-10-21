import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PerspectiveCamera } from 'three';

export interface OrbitControlsDriver {
  readonly target: { set(x: number, y: number, z: number): void };
  enableDamping: boolean;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  addEventListener(type: 'change', listener: () => void): void;
  dispose(): void;
}

export type OrbitControlsDriverFactory = (
  camera: PerspectiveCamera,
  element: HTMLElement,
) => OrbitControlsDriver;

export type PointerPositionHandler = (clientX: number, clientY: number) => void;

const CLICK_DRAG_THRESHOLD_CSS_PIXELS = 5;
const USABLE_ELEVATION_LIMIT = 0.08;

/** Mouse orbit input with click-vs-drag arbitration in CSS pixel coordinates. */
export class CubeOrbitControls {
  private readonly controls: OrbitControlsDriver;
  private activePointer: { readonly id: number; readonly x: number; readonly y: number } | null =
    null;
  private dragged = false;
  private isDisposed = false;

  constructor(
    camera: PerspectiveCamera,
    private readonly element: HTMLElement,
    private readonly onClick: PointerPositionHandler,
    private readonly onHover: PointerPositionHandler,
    onChange: () => void,
    controlsFactory: OrbitControlsDriverFactory = (activeCamera, target) =>
      new OrbitControls(activeCamera, target),
  ) {
    this.controls = controlsFactory(camera, element);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = false;
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    this.controls.minPolarAngle = USABLE_ELEVATION_LIMIT;
    this.controls.maxPolarAngle = Math.PI - USABLE_ELEVATION_LIMIT;
    this.controls.addEventListener('change', onChange);
    this.element.addEventListener('pointerdown', this.handlePointerDown);
    this.element.addEventListener('pointermove', this.handlePointerMove);
    this.element.addEventListener('pointerup', this.handlePointerUp);
    this.element.addEventListener('pointercancel', this.handlePointerCancel);
  }

  get minAzimuthAngle(): number {
    return this.controls.minAzimuthAngle;
  }

  get maxAzimuthAngle(): number {
    return this.controls.maxAzimuthAngle;
  }

  get minPolarAngle(): number {
    return this.controls.minPolarAngle;
  }

  get maxPolarAngle(): number {
    return this.controls.maxPolarAngle;
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.element.removeEventListener('pointerdown', this.handlePointerDown);
    this.element.removeEventListener('pointermove', this.handlePointerMove);
    this.element.removeEventListener('pointerup', this.handlePointerUp);
    this.element.removeEventListener('pointercancel', this.handlePointerCancel);
    this.controls.dispose();
    this.activePointer = null;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.isDisposed || event.button !== 0) return;
    this.activePointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.dragged = false;
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.isDisposed) return;
    if (!this.activePointer) {
      if (event.buttons === 0) this.onHover(event.clientX, event.clientY);
      return;
    }
    if (this.activePointer.id !== event.pointerId) return;
    if (
      CubeOrbitControls.distance(this.activePointer, event.clientX, event.clientY) >=
      CLICK_DRAG_THRESHOLD_CSS_PIXELS
    ) {
      this.dragged = true;
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const pointer = this.activePointer;
    if (this.isDisposed || !pointer || pointer.id !== event.pointerId) return;
    if (
      CubeOrbitControls.distance(pointer, event.clientX, event.clientY) >=
      CLICK_DRAG_THRESHOLD_CSS_PIXELS
    ) {
      this.dragged = true;
    }
    const shouldPick = event.button === 0 && !this.dragged;
    this.activePointer = null;
    if (shouldPick) this.onClick(event.clientX, event.clientY);
    this.dragged = false;
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (this.activePointer?.id === event.pointerId) {
      this.activePointer = null;
      this.dragged = false;
    }
  };

  private static distance(
    pointer: { readonly x: number; readonly y: number },
    clientX: number,
    clientY: number,
  ): number {
    return Math.hypot(clientX - pointer.x, clientY - pointer.y);
  }
}
