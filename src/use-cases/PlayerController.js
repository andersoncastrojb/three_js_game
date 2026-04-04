/**
 * @file PlayerController.js
 * @layer Use Cases
 * @description Translates raw input state into Player entity mutations
 * and emits domain events each game tick.
 *
 * This is a "system" registered with GameLoop — its `update(delta)` method
 * runs every frame. It reads held-key state from a snapshot the InputHandler
 * provides, moves the Player entity, and emits PlayerEvents.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  May import from src/core/ only. No Three.js. No DOM.       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { eventBus, PlayerEvents, LevelEvents } from '../core/EventBus.js';

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

/**
 * Minimal interface that PlayerController requires from an InputHandler.
 * Decouples the use case from the concrete DOM InputHandler class.
 * @typedef {Object} InputSnapshot
 * @property {(code: string) => boolean} isPressed - Returns true if key is held.
 */

// ─────────────────────────────────────────────────────────────
// Key bindings (WASD + alternatives)
// ─────────────────────────────────────────────────────────────

/** @type {Readonly<Record<string, string[]>>} */
const KEYS = Object.freeze({
  FORWARD:  ['KeyW', 'ArrowUp'],
  BACKWARD: ['KeyS', 'ArrowDown'],
  LEFT:     ['KeyA', 'ArrowLeft'],
  RIGHT:    ['KeyD', 'ArrowRight'],
  FIRE:     ['Mouse0'],        // handled separately via mouse-button state
  RELOAD:   ['KeyR'],
  JUMP:     ['Space'],         // future use (reserved)
});

// ─────────────────────────────────────────────────────────────
// PlayerController
// ─────────────────────────────────────────────────────────────

export class PlayerController {
  /**
   * @param {import('../core/entities/Player.js').Player} player
   * @param {InputSnapshot} input   - InputHandler instance (or compatible mock).
   * @param {import('./CombatSystem.js').CombatSystem} combat
   * @param {EventBus} [bus]
   */
  constructor(player, input, combat, bus = eventBus) {
    if (!player || player.type !== 'player') {
      throw new TypeError('PlayerController requires a Player entity.');
    }
    if (typeof input?.isPressed !== 'function') {
      throw new TypeError('PlayerController requires an InputSnapshot (isPressed method).');
    }

    /** @private @type {import('../core/entities/Player.js').Player} */
    this._player = player;

    /** @private @type {InputSnapshot} */
    this._input = input;

    /** @private @type {import('./CombatSystem.js').CombatSystem} */
    this._combat = combat;

    /** @private @type {EventBus} */
    this._bus = bus;

    /** @private Whether the mouse button is currently held (set externally). */
    this._mouseFireHeld = false;

    /** @private Track previous ammo to avoid spamming ammo-change events. */
    this._prevAmmo = player.ammo;

    /** @private Track previous health. */
    this._prevHealth = player.health;

    /** @private @type {number[][]} logic grid for collisions */
    this._grid = null;
    /** @private @type {number} */
    this._cellSize = 4; // match MazeRenderer default

    this._bus.on(LevelEvents.GENERATED, (payload) => {
      this._grid = payload.grid;
    });

    // Emit spawn event once
    this._bus.emit(PlayerEvents.SPAWNED, this._player.toSnapshot());
  }

  // ───────────────────────────────────────────────────────────
  // GameLoop System Interface
  // ───────────────────────────────────────────────────────────

  /**
   * Called every frame by GameLoop.tick(delta).
   * @param {number} delta - Time since last frame in seconds.
   */
  update(delta) {
    if (!this._player.isAlive) return;

    this._processMovement(delta);
    this._processFire();
    this._processReload();
    this._dispatchChangeEvents();
  }

  // ───────────────────────────────────────────────────────────
  // Public API (called from infrastructure / presentation)
  // ───────────────────────────────────────────────────────────

  /**
   * Feed mouse-delta to the player's look angles.
   * Called from infrastructure (FirstPersonCamera) on pointer-lock move events.
   * @param {number} dx - Horizontal pixel delta.
   * @param {number} dy - Vertical pixel delta.
   */
  applyMouseLook(dx, dy) {
    this._player.applyMouseLook(dx, dy);
    this._bus.emit(PlayerEvents.MOVED, this._player.toSnapshot());
  }

  /**
   * Signal that the mouse fire button is held / released.
   * @param {boolean} held
   */
  setMouseFire(held) {
    this._mouseFireHeld = held;
  }

  /**
   * Apply external damage to the player (e.g., zombie attack).
   * @param {number} amount
   */
  applyDamage(amount) {
    const died = this._player.takeDamage(amount);
    this._bus.emit(PlayerEvents.HEALTH_CHANGED, this._player.toSnapshot());

    if (died) {
      this._bus.emit(PlayerEvents.DIED, this._player.toSnapshot());
      this._handleDeath();
    }
  }

  // ───────────────────────────────────────────────────────────
  // Private
  // ───────────────────────────────────────────────────────────

  /**
   * Compute WASD movement direction (in yaw-rotated player-space) and move.
   * @private
   * @param {number} delta
   */
  _processMovement(delta) {
    const fn = (codes) => codes.some((c) => this._input.isPressed(c));

    const fwd  = fn(KEYS.FORWARD)  ? 1 : 0;
    const back = fn(KEYS.BACKWARD) ? 1 : 0;
    const left = fn(KEYS.LEFT)     ? 1 : 0;
    const rgt  = fn(KEYS.RIGHT)    ? 1 : 0;

    // Net input on each local axis
    const localZ = back - fwd;   // forward is -Z in Three.js convention
    const localX = rgt  - left;

    if (localZ === 0 && localX === 0) return;

    // Rotate input direction by player yaw (pure math, matched to Three.js CCW Euler Y-axis)
    const sin = Math.sin(this._player.yaw);
    const cos = Math.cos(this._player.yaw);

    const worldX = localX * cos + localZ * sin;
    const worldZ = -localX * sin + localZ * cos;

    // Normalise diagonal movement to prevent diagonal speed boost
    const rawLen = Math.sqrt(worldX * worldX + worldZ * worldZ);
    const nx = rawLen > 0 ? worldX / rawLen : 0;
    const nz = rawLen > 0 ? worldZ / rawLen : 0;

    const speed = this._player.moveSpeed * delta;
    const p = this._player.position;

    let targetX = p.x + nx * speed;
    let targetZ = p.z + nz * speed;

    // ── Sliding Collision Detection ──
    if (this._grid) {
      const R = 0.5; // player collision radius
      const cs = this._cellSize;
      const t  = 0.3; // wall thickness (must match MazeRenderer WALL_THICKNESS)
      const wt = t / 2; // half thickness

      // Closure to check if a specific world coordinate collides with a wall
      const isColliding = (tx, tz) => {
        const col = Math.floor(tx / cs);
        const row = Math.floor(tz / cs);

        // Treat outside grid as solid
        if (row < 0 || row >= this._grid.length || col < 0 || col >= this._grid[0].length) {
          return true;
        }

        const cell = this._grid[row][col];
        const localX = tx % cs;
        const localZ = tz % cs;

        // Check the 4 walls of the current cell
        if (!(cell & 8) && localX < R + wt) return true;      // WEST
        if (!(cell & 4) && localX > cs - (R + wt)) return true; // EAST
        if (!(cell & 1) && localZ < R + wt) return true;      // NORTH
        if (!(cell & 2) && localZ > cs - (R + wt)) return true; // SOUTH

        return false;
      };

      // Test X and Z independently to allow sliding along walls
      if (isColliding(targetX, p.z)) targetX = p.x;
      if (isColliding(targetX, targetZ)) targetZ = p.z;
    }

    this._player.setPosition(targetX, p.y, targetZ);
    this._bus.emit(PlayerEvents.MOVED, this._player.toSnapshot());
  }

  /** @private */
  _processFire() {
    if (this._mouseFireHeld) {
      this._combat.fire();
    }
  }

  /** @private */
  _processReload() {
    if (this._input.isPressed('KeyR')) {
      this._combat.reload();
    }
  }

  /**
   * Emit change events only when values actually changed (reduces bus noise).
   * @private
   */
  _dispatchChangeEvents() {
    if (this._player.ammo !== this._prevAmmo) {
      this._bus.emit(PlayerEvents.AMMO_CHANGED, this._player.toSnapshot());
      this._prevAmmo = this._player.ammo;
    }
    if (this._player.health !== this._prevHealth) {
      this._bus.emit(PlayerEvents.HEALTH_CHANGED, this._player.toSnapshot());
      this._prevHealth = this._player.health;
    }
  }

  /** @private */
  _handleDeath() {
    const respawned = this._player.respawn();
    if (respawned) {
      console.info('[PlayerController] Player respawned. Lives remaining:', this._player.lives);
      this._bus.emit(PlayerEvents.SPAWNED, this._player.toSnapshot());
    } else {
      console.warn('[PlayerController] Game Over — no lives remaining.');
    }
  }
}
