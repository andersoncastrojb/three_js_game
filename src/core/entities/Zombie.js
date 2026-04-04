/**
 * @file Zombie.js
 * @layer Core / Domain
 * @description Domain entity representing an individual Zombie.
 * Tracks health, move speed, damage output, and AI state.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ZERO external dependencies permitted in this file.         ║
 * ║  No Three.js · No DOM · No LLMs · No Vue                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { GameEntity } from './GameEntity.js';

/** @typedef {'idle' | 'wander' | 'chase' | 'attack' | 'dead'} ZombieState */

export class Zombie extends GameEntity {
  /**
   * @param {string} id
   * @param {number} maxHealth
   * @param {number} damage
   * @param {number} speed
   */
  constructor(id, maxHealth = 100, damage = 15, speed = 2.5) {
    super(id, 'zombie');

    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.damage = damage;
    this.speed = speed;

    /** @type {ZombieState} */
    this.state = 'idle';

    /** Target position for wandering */
    this.targetPos = null;

    /** Time tracking for state transitions */
    this.stateTimer = 0;
    
    /** Attack cooldown tracking */
    this.lastAttackTime = 0;

    /** Async AI Loop tracking */
    this.lastThinkTime = 0;
    this.isThinking = false;
  }

  get isAlive() { return this.health > 0 && this.state !== 'dead'; }

  /**
   * Returns a snapshot for Events.
   */
  toSnapshot() {
    return {
      id:        this.id,
      health:    this.health,
      maxHealth: this.maxHealth,
      state:     this.state,
      position:  { ...this.position },
    };
  }
}
