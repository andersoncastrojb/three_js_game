/**
 * @file GameEntity.js
 * @layer Core / Domain
 * @description Base class for all domain entities. Zero Three.js dependencies.
 * Represents a named, positioned object in abstract game space.
 */

export class GameEntity {
  /**
   * @param {string} id   Unique identifier
   * @param {string} type Entity type label (e.g. 'agent', 'obstacle')
   */
  constructor(id, type = 'entity') {
    this.id = id;
    this.type = type;
    /** Position in abstract 3-space {x, y, z} */
    this.position = { x: 0, y: 0, z: 0 };
    /** Rotation in radians {x, y, z} – Euler angles */
    this.rotation = { x: 0, y: 0, z: 0 };
    /** Arbitrary key-value store for domain state */
    this.state = {};
    this.active = true;
  }

  /** Apply a partial position update */
  setPosition(x, y, z) {
    this.position = { x, y, z };
    return this;
  }

  /** Merge arbitrary state properties */
  setState(partial) {
    this.state = { ...this.state, ...partial };
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      position: this.position,
      rotation: this.rotation,
      state: this.state,
      active: this.active,
    };
  }
}
