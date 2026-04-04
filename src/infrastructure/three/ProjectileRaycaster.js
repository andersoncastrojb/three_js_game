/**
 * @file ProjectileRaycaster.js
 * @layer Infrastructure / Three.js
 * @description Bridges the pure-math domain combat system with Three.js.
 * Listens for firing events, calculates line-of-sight intersections using
 * THREE.Raycaster, and emits the hit results back to the domain.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  May import Three.js — this IS the infrastructure layer.    ║
 * ║  Listens to CombatEvents; never mutates domain directly.    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import * as THREE from 'three';
import { eventBus } from '../../core/EventBus.js';
import { CombatSystemEvents } from '../../use-cases/CombatSystem.js';

export class ProjectileRaycaster {
  /**
   * @param {THREE.Scene} scene
   * @param {EventBus}   bus
   */
  constructor(scene, bus = eventBus) {
    if (!(scene instanceof THREE.Scene)) {
      throw new TypeError('ProjectileRaycaster requires a THREE.Scene.');
    }

    /** @private */
    this._scene = scene;
    /** @private */
    this._bus = bus;
    /** @private */
    this._raycaster = new THREE.Raycaster();
    
    // We only care about objects with zombie IDs and the walls.
    // However, it's simpler to raycast against the entire scene (recursive)
    // and just find the nearest valid target or blocking wall.
    
    this._unsubFired = this._bus.on(CombatSystemEvents.FIRED, (payload) => this._onFired(payload));
  }

  /**
   * Translates the pure domain Fired event into a Three.js raycast.
   * @private
   * @param {{ playerId: string, position: {x:number,y:number,z:number}, yaw: number, pitch: number }} payload
   */
  _onFired(payload) {
    const { position, yaw, pitch } = payload;

    // 1. Reconstruct the firing ray completely independent of the actual Camera object.
    // Match the Player / Camera's local space logic: forward is -Z.
    const direction = new THREE.Vector3(0, 0, -1);
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    direction.applyEuler(euler);

    // Origin is at player eye height (matching FirstPersonCamera)
    const origin = new THREE.Vector3(position.x, 1.7, position.z);
    
    this._raycaster.set(origin, direction);

    // 2. Perform the intersection test against all meshes in the scene
    const intersects = this._raycaster.intersectObjects(this._scene.children, true);

    if (intersects.length === 0) {
      this._emitMiss();
      return;
    }

    // 3. Find the first meaningful hit (Wall or Zombie)
    for (const hit of intersects) {
      const obj = hit.object;

      // Hit a wall? Stop. Bullet doesn't penetrate.
      if (obj.name === 'MazeWalls' || obj.name === 'MazeFloor' || obj.name === 'MazeCeiling') {
        this._emitMiss();
        return;
      }

      // Hit a zombie? Send it back to the domain layer!
      if (obj.userData && obj.userData.zombieId) {
        this._bus.emit(CombatSystemEvents.RAY_RESULT, {
          hit: true,
          zombieId: obj.userData.zombieId,
          distance: hit.distance,
          point: hit.point, // THREE.Vector3 auto-serialises cleanly here
        });
        return;
      }
    }
    
    this._emitMiss();
  }

  /** @private */
  _emitMiss() {
    this._bus.emit(CombatSystemEvents.RAY_RESULT, { hit: false });
  }

  dispose() {
    this._unsubFired();
  }
}
