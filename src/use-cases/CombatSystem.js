/**
 * @file CombatSystem.js
 * @layer Use Cases
 * @description Orchestrates combat logic, projectiles, and damage resolution.
 */

import { Projectile } from '../core/entities/Projectile.js';
import { Vector3Utils } from '../core/math/Vector3Utils.js';
import { eventBus, PlayerEvents, ZombieEvents, CombatEvents, LevelEvents } from '../core/EventBus.js';

/** @typedef {import('../core/entities/Zombie').Zombie} Zombie */
/** @typedef {import('../core/math/Vector3Utils').Vec3} Vec3 */

export class CombatSystem {
  /**
   * @param {Object} deps
   * @param {Map<string, Zombie>} deps.zombieRegistry - Reference to active zombies.
   */
  constructor({ zombieRegistry }) {
    /** @type {Map<string, Zombie>} */
    this.zombies = zombieRegistry;
    /** @type {Set<Projectile>} */
    this.projectiles = new Set();
    
    this._setupListeners();
  }

  _setupListeners() {
    // Listen for player shoot events
    eventBus.on(PlayerEvents.FIRED, (payload) => {
      this.spawnProjectile(payload);
    });

    eventBus.on(LevelEvents.GENERATED, () => {
      this._clearProjectiles();
    });
  }

  /** @private */
  _clearProjectiles() {
    for (const p of this.projectiles) {
      eventBus.emit(CombatEvents.PROJECTILE_DESTROYED, { projectileId: p.id });
    }
    this.projectiles.clear();
  }

  /**
   * @param {Object} params
   * @param {Vec3}   params.origin    - Starting position.
   * @param {Vec3}   params.direction - Normalized direction.
   * @param {number} params.damage    - Projectile damage.
   * @param {number} params.speed     - Projectile speed.
   */
  spawnProjectile({ origin, direction, damage, speed }) {
    const id = `projectile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const projectile = new Projectile({
      id,
      position: origin,
      direction,
      damage,
      speed
    });

    this.projectiles.add(projectile);
    
    eventBus.emit(CombatEvents.PROJECTILE_SPAWNED, {
      projectileId: id,
      position: origin,
      direction
    });
  }

  /**
   * Update all projectiles and check for intersections.
   * @param {number} deltaTime 
   */
  update(deltaTime) {
    for (const projectile of this.projectiles) {
      if (!projectile.active) {
        this.projectiles.delete(projectile);
        eventBus.emit(CombatEvents.PROJECTILE_DESTROYED, { projectileId: projectile.id });
        continue;
      }

      const oldPos = Vector3Utils.clone(projectile.position);
      projectile.update(deltaTime);
      const newPos = projectile.position;

      eventBus.emit(CombatEvents.PROJECTILE_MOVED, {
        projectileId: projectile.id,
        position: newPos
      });

      // Check for zombie intersections
      this._checkIntersections(projectile, oldPos, newPos);
    }
  }

  /**
   * Cylinder-based intersection check for hitboxes.
   * @private
   * @param {Projectile} projectile 
   * @param {Vec3} oldPos 
   * @param {Vec3} newPos 
   */
  _checkIntersections(projectile, oldPos, newPos) {
    const ZOMBIE_HEIGHT = 2.5;

    for (const zombie of this.zombies.values()) {
      if (!zombie.active) continue;

      // 1. Height check: Check if the projectile is within the vertical range of the zombie
      // Zombie is at ground level (y=0) up to y=ZOMBIE_HEIGHT
      const withinHeight = (newPos.y >= 0 && newPos.y <= ZOMBIE_HEIGHT) ||
                           (oldPos.y >= 0 && oldPos.y <= ZOMBIE_HEIGHT);

      if (!withinHeight) continue;

      // 2. 2D distance check: Check if the projectile is within the hitbox radius on the XZ plane
      const zombiePos2D = { x: zombie.position.x, z: zombie.position.z };
      const oldPos2D = { x: oldPos.x, z: oldPos.z };
      const newPos2D = { x: newPos.x, z: newPos.z };

      const distance2D = this._distancePointToSegment2D(zombiePos2D, oldPos2D, newPos2D);

      if (distance2D <= zombie.hitboxRadius) {
        this._resolveHit(projectile, zombie);
        break; // Projectile destroyed on first hit
      }
    }
  }

  /**
   * @private
   * @param {Projectile} projectile 
   * @param {Zombie} zombie 
   */
  _resolveHit(projectile, zombie) {
    projectile.active = false;
    zombie.takeDamage(projectile.damage);

    eventBus.emit(ZombieEvents.DAMAGED, {
      zombieId: zombie.id,
      damage: projectile.damage,
      hpRemaining: zombie.health,
      position: Vector3Utils.clone(zombie.position)
    });

    if (zombie.isDead()) {
      eventBus.emit(ZombieEvents.DIED, {
        zombieId: zombie.id,
        position: Vector3Utils.clone(zombie.position)
      });
    }
  }

  /**
   * @private
   * @param {{x: number, z: number}} p - Point (Zombie)
   * @param {{x: number, z: number}} a - Segment start
   * @param {{x: number, z: number}} b - Segment end
   * @returns {number}
   */
  _distancePointToSegment2D(p, a, b) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l2 = dx * dx + dz * dz;
    if (l2 === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.z - a.z) ** 2);

    let t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2;
    t = Math.max(0, Math.min(1, t));

    const projection = {
      x: a.x + t * dx,
      z: a.z + t * dz
    };

    const distDx = p.x - projection.x;
    const distDz = p.z - projection.z;
    return Math.sqrt(distDx * distDx + distDz * distDz);
  }
}
