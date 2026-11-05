import { Raycaster, Vector2, type Camera, type InstancedMesh, type Object3D } from 'three';
import type { ShipIdentity } from '../domain/CubeSnapshot.js';
import { CubePosition } from '../domain/CubePosition.js';

export type CubePickTarget =
  | { readonly type: 'cell'; readonly position: CubePosition }
  | { readonly type: 'ship'; readonly identity: ShipIdentity };

export interface ClientBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface CubePickerCanvas {
  getBoundingClientRect(): ClientBounds;
}

/** Ray-picks only the 125 marker instances and the two ship models. */
export class CubePicker {
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();

  constructor(
    private readonly canvas: CubePickerCanvas,
    private readonly camera: Camera,
    private readonly markers: InstancedMesh,
    private readonly ships: readonly Object3D[],
  ) {}

  pick(clientX: number, clientY: number): CubePickTarget | null {
    const bounds = this.canvas.getBoundingClientRect();
    if (
      !Number.isFinite(clientX) ||
      !Number.isFinite(clientY) ||
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      clientX < bounds.left ||
      clientY < bounds.top ||
      clientX >= bounds.left + bounds.width ||
      clientY >= bounds.top + bounds.height
    ) {
      return null;
    }

    this.pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.camera.updateMatrixWorld(true);
    this.markers.updateWorldMatrix(true, false);
    for (const ship of this.ships) ship.updateWorldMatrix(true, true);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects([this.markers, ...this.ships], true);
    for (const intersection of intersections) {
      const shipIdentity = CubePicker.shipIdentityOf(intersection.object);
      if (shipIdentity) return Object.freeze({ type: 'ship', identity: shipIdentity });
      if (intersection.object === this.markers && intersection.instanceId !== undefined) {
        return Object.freeze({
          type: 'cell',
          position: CubePosition.fromPresentationIndex(intersection.instanceId),
        });
      }
    }
    return null;
  }

  private static shipIdentityOf(object: Object3D): ShipIdentity | null {
    let current: Object3D | null = object;
    while (current) {
      if (
        current.userData['shipIdentity'] === 'ship-1' ||
        current.userData['shipIdentity'] === 'ship-2'
      ) {
        return current.userData['shipIdentity'];
      }
      current = current.parent;
    }
    return null;
  }
}
