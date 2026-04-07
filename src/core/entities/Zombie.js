/**
 * @file Zombie.js
 * @layer Core / Domain
 * @description Zombie entity with AI state management.
 */

import { GameEntity } from './GameEntity.js';

/**
 * @typedef {'idle' | 'chase' | 'attack' | 'flee'} ZombieState
 */

export class Zombie extends GameEntity {
  /**
   * @param {string} id - Unique identifier.
   * @param {Object} params
   * @param {number} params.health - Current health points.
   * @param {number} params.speed  - Movement speed.
   * @param {number} [params.hitboxRadius=0.8] - Radius for collision detection.
   * @param {number} [params.damage=15] - Damage dealt per attack.
   * @param {number} [params.attackRange=1.8] - Range within which attacks connect.
   * @param {number} [params.attackCooldown=1500] - Ms between attacks.
   */
  constructor(id, { health, speed, hitboxRadius = 0.8, damage = 15, attackRange = 1.8, attackCooldown = 1500 }) {
    super(id, 'zombie');
    
    /** @type {number} */
    this.health = health;
    /** @type {number} */
    this.maxHealth = health;
    /** @type {number} */
    this.speed = speed;
    /** @type {number} */
    this.hitboxRadius = hitboxRadius;
    
    /** @type {number} */
    this.damage = damage;
    /** @type {number} */
    this.attackRange = attackRange;
    /** @type {number} */
    this.attackCooldown = attackCooldown;
    /** @type {number} */
    this.lastAttackTime = 0;
    
    /** 
     * @type {ZombieState} 
     * @private
     */
    this._aiState = 'idle';
  }

  /** @returns {ZombieState} */
  get aiState() {
    return this._aiState;
  }

  /** 
   * @param {ZombieState} newState 
   */
  setAIState(newState) {
    const validStates = ['idle', 'chase', 'attack', 'flee'];
    if (validStates.includes(newState)) {
      this._aiState = newState;
    }
  }

  /**
   * Apply damage to the zombie.
   * @param {number} amount 
   */
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.active = false;
    }
  }

  /** @returns {boolean} */
  isDead() {
    return this.health <= 0;
  }
}
