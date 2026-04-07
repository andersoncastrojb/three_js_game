/**
 * @file Projectile.js
 * @layer Core / Domain
 * @description Represents a projectile in flight. Zero Three.js dependencies.
 */

/** @typedef {import('../math/Vector3Utils').Vec3} Vec3 */

export class Projectile {
  /**
   * @param {Object} params
   * @param {string} params.id        - Unique identifier.
   * @param {Vec3}   params.position  - Current position in 3D space.
   * @param {Vec3}   params.direction - Normalized direction vector.
   * @param {number} params.speed     - Speed units per second.
   * @param {number} params.damage    - Damage dealt on impact.
   * @param {number} [params.maxDistance=100] - Max distance before projectile expires.
   */
  constructor({ id, position, direction, speed, damage, maxDistance = 100 }) {
    /** @type {string} */
    this.id = id;
    /** @type {Vec3} */
    this.position = { ...position };
    /** @type {Vec3} */
    this.direction = { ...direction };
    /** @type {number} */
    this.speed = speed;
    /** @type {number} */
    this.damage = damage;
    /** @type {number} */
    this.maxDistance = maxDistance;
    /** @type {number} */
    this.distanceTraveled = 0;
    /** @type {boolean} */
    this.active = true;
  }

  /**
   * Update the projectile's position based on delta time.
   * @param {number} deltaTime - Time elapsed since last frame in seconds.
   */
  update(deltaTime) {
    const distanceStep = this.speed * deltaTime;
    
    this.position.x += this.direction.x * distanceStep;
    this.position.y += this.direction.y * distanceStep;
    this.position.z += this.direction.z * distanceStep;
    
    this.distanceTraveled += distanceStep;
    
    if (this.distanceTraveled >= this.maxDistance) {
      this.active = false;
    }
  }
}
