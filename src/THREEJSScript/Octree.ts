/**
 * Octree — vendored THREE.js octree script.
 *
 * DISABLED: @brakebein/threeoctree's useFaces option on large merged
 * BufferGeometry causes browser crash. Direct raycasting is used instead.
 * See GlobeVisual.jsx for commented-out Octree usage.
 *
 * The source Octree.js did not exist when this TypeScript migration was
 * performed. This stub file is created per the locked decision to have all
 * files in src/THREEJSScript/ be .ts files (not .js).
 */

import * as THREE from 'three';

/** Stub interface representing the disabled Octree API surface */
export interface OctreeHandle {
  update: () => void;
  remove: (object: THREE.Object3D) => void;
}

/**
 * Disabled Octree stub — all methods are no-ops.
 * Replace with a real implementation if Octree functionality is re-enabled.
 */
export class Octree implements OctreeHandle {
  update(): void {
    // Octree disabled — no-op
  }

  remove(_object: THREE.Object3D): void {
    // Octree disabled — no-op
  }
}
