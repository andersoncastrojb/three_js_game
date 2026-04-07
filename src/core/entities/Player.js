/**
 * @file Player.js
 * @layer Core / Domain
 * @description Domain entity representing the human player.
 * Tracks all mutable player state: health, lives, ammo, position, aim angles.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ZERO external dependencies permitted in this file.         ║
 * ║  No Three.js · No DOM · No LLMs · No Vue                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { GameEntity } from './GameEntity.js';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Default maximum health points. */
export const PLAYER_MAX_HEALTH = 100;

/** Default starting lives. */
export const PLAYER_MAX_LIVES = 3;

/** Default ammo per magazine. */
export const PLAYER_MAX_AMMO = 30;

/** Movement speed in world-units per second. */
export const PLAYER_MOVE_SPEED = 8;

/** Mouse-look sensitivity (radians per pixel). */
export const PLAYER_LOOK_SENSITIVITY = 0.002;

/** Vertical look clamp (max pitch in radians, ≈ 80°). */
export const PLAYER_PITCH_LIMIT = Math.PI * 0.44;

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PlayerSnapshot
 * @property {string}  id
 * @property {number}  health
 * @property {number}  maxHealth
 * @property {number}  lives
 * @property {number}  ammo
 * @property {number}  maxAmmo
 * @property {number}  scans
 * @property {number}  maxScans
 * @property {boolean} isAlive
 * @property {boolean} isReloading
 * @property {boolean} isScanning
 * @property {{ x: number, y: number, z: number }} position
 * @property {number}  yaw    - Horizontal look angle in radians.
 * @property {number}  pitch  - Vertical look angle in radians (clamped).
 */

// ─────────────────────────────────────────────────────────────
// Player Entity
// ─────────────────────────────────────────────────────────────

export class Player extends GameEntity {
  /**
   * @param {string} id          - Unique identifier (e.g. `'player-1'`).
   * @param {number} [maxHealth] - Starting max HP. Default: {@link PLAYER_MAX_HEALTH}.
   * @param {number} [lives]     - Starting lives.  Default: {@link PLAYER_MAX_LIVES}.
   * @param {number} [maxAmmo]   - Ammo per magazine. Default: {@link PLAYER_MAX_AMMO}.
   */
  constructor(
    id,
    maxHealth = PLAYER_MAX_HEALTH,
    lives     = PLAYER_MAX_LIVES,
    maxAmmo   = PLAYER_MAX_AMMO,
  ) {
    super(id, 'player');

    /** @type {number} Current health points. */
    this.health = maxHealth;

    /** @type {number} */
    this.maxHealth = maxHealth;

    /** @type {number} Remaining lives (0 = game over). */
    this.lives = lives;

    /** @type {number} Current ammo in magazine. */
    this.ammo = maxAmmo;

    /** @type {number} */
    this.maxAmmo = maxAmmo;

    /** @type {number} Current panoramic scans remaining. */
    this.scans = 3;

    /** @type {number} */
    this.maxScans = 3;

    /** @type {boolean} True while reload animation is running. */
    this.isReloading = false;

    /** @type {boolean} True while panoramic view is active. */
    this.isScanning = false;

    /** Horizontal look angle in radians (yaw around Y axis). */
    this.yaw = 0;

    /** Vertical look angle in radians (pitch, clamped ±{@link PLAYER_PITCH_LIMIT}). */
    this.pitch = 0;

    /** @type {number} World-units per second. */
    this.moveSpeed = PLAYER_MOVE_SPEED;

    /** @type {number} Radians per pixel. */
    this.lookSensitivity = PLAYER_LOOK_SENSITIVITY;
  }

  // ───────────────────────────────────────────────────────────
  // Health
  // ───────────────────────────────────────────────────────────

  /** @returns {boolean} True if health > 0. */
  get isAlive() { return this.health > 0; }

  /**
   * Apply damage. Returns true if the player died from this hit.
   * @param {number} amount - Damage to subtract (clamped ≥ 0).
   * @returns {boolean} `true` if the player's health reached 0.
   */
  takeDamage(amount) {
    if (!this.isAlive) return false;
    this.health = Math.max(0, this.health - Math.max(0, amount));
    return this.health === 0;
  }

  /**
   * Restore health (cannot exceed `maxHealth`).
   * @param {number} amount
   */
  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + Math.max(0, amount));
  }

  // ───────────────────────────────────────────────────────────
  // Lives
  // ───────────────────────────────────────────────────────────

  /**
   * Consume one life and reset health. Returns false if no lives remain.
   * @returns {boolean} `true` if respawn succeeded, `false` if game over.
   */
  respawn() {
    if (this.lives <= 0) return false;
    this.lives  -= 1;
    this.health  = this.maxHealth;
    this.ammo    = this.maxAmmo;
    this.scans   = this.maxScans;
    this.isReloading = false;
    this.isScanning = false;
    return true;
  }

  /** @returns {boolean} True when lives have been exhausted. */
  get isGameOver() { return this.lives <= 0 && !this.isAlive; }

  // ───────────────────────────────────────────────────────────
  // Ammo
  // ───────────────────────────────────────────────────────────

  /**
   * Consume one bullet. Returns false if out of ammo.
   * @returns {boolean} `true` if a round was successfully consumed.
   */
  consumeAmmo() {
    if (this.ammo <= 0 || this.isReloading) return false;
    this.ammo -= 1;
    return true;
  }

  /**
   * Begin a reload (caller is responsible for setting `isReloading = false`
   * after the reload duration via a timer in the use-case layer).
   * @returns {boolean} `true` if reload started (not already reloading, not full).
   */
  startReload() {
    if (this.isReloading || this.ammo === this.maxAmmo) return false;
    this.isReloading = true;
    return true;
  }

  /** Complete the reload — fills the magazine. */
  finishReload() {
    this.ammo = this.maxAmmo;
    this.isReloading = false;
  }

  // ───────────────────────────────────────────────────────────
  // Look / Aim
  // ───────────────────────────────────────────────────────────

  /**
   * Apply mouse-delta to the player's aim angles in radians.
   * @param {number} dx - Horizontal mouse delta (pixels).
   * @param {number} dy - Vertical mouse delta (pixels).
   */
  applyMouseLook(dx, dy) {
    this.yaw   -= dx * this.lookSensitivity;
    this.pitch -= dy * this.lookSensitivity;
    // Clamp pitch to prevent full vertical flip
    this.pitch = Math.max(-PLAYER_PITCH_LIMIT, Math.min(PLAYER_PITCH_LIMIT, this.pitch));
  }

  // ───────────────────────────────────────────────────────────
  // Serialisation
  // ───────────────────────────────────────────────────────────

  /**
   * Returns a plain-object snapshot suitable for EventBus payloads.
   * Deep-copies position so consumers cannot mutate domain state.
   * @returns {PlayerSnapshot}
   */
  toSnapshot() {
    return {
      id:          this.id,
      health:      this.health,
      maxHealth:   this.maxHealth,
      lives:       this.lives,
      ammo:        this.ammo,
      maxAmmo:     this.maxAmmo,
      scans:       this.scans,
      maxScans:    this.maxScans,
      isAlive:     this.isAlive,
      isReloading: this.isReloading,
      isScanning:  this.isScanning,
      position:    { ...this.position },
      yaw:         this.yaw,
      pitch:       this.pitch,
    };
  }
}
