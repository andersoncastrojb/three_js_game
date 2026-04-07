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

import { eventBus, PlayerEvents, LevelEvents, ZombieEvents } from '../core/EventBus.js';

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
  SCAN:     ['KeyV'],
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
    
    /** @private Track previous V key state */
    this._prevV = false;

    /** @private @type {number[][]} logic grid for collisions */
    this._grid = null;
    /** @private @type {number} */
    this._cellSize = 4; // match MazeRenderer default
    /** @private @type {Object} */
    this._exitCoord = null;
    /** @private @type {Object} */
    this._entranceCoord = null;

    /** @private @type {number} Last time fired (ms) */
    this._lastFireTime = 0;
    /** @private @type {number} Fire rate delay (ms) */
    this._fireRateDelay = 200; // 5 shots per second

    this._bus.on(LevelEvents.GENERATED, (payload) => {
      this._grid = payload.grid;
      this._exitCoord = payload.exit;
      this._entranceCoord = payload.entrance;
      
      // Full reset of player state
      this._player.health = this._player.maxHealth;
      this._player.ammo = this._player.maxAmmo;
      this._player.lives = 3; // Reset to 3 lives on level restart
      this._player.scans = this._player.maxScans;
      this._player.isReloading = false;
      this._player.isScanning = false;

      const sx = this._entranceCoord.col * this._cellSize + (this._cellSize / 2);
      const sz = this._entranceCoord.row * this._cellSize + (this._cellSize / 2);
      this._player.setPosition(sx, 0, sz);
      
      this._bus.emit(PlayerEvents.MOVED, this._player.toSnapshot());
      this._bus.emit(PlayerEvents.SCAN_CHANGED, this._player.toSnapshot());
      this._bus.emit(PlayerEvents.SPAWNED, this._player.toSnapshot());
    });

    this._bus.on(ZombieEvents.ATTACK, (payload) => {
      this.applyDamage(payload.damage);
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

    this._processScanToggle();

    if (this._player.isScanning) {
      // Freeze movement and combat while in radar mode
      return; 
    }

    this._processMovement(delta);
    this._processFire();
    this._processReload();
    this._checkExit();
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
    if (this._player.isScanning) return; // Lock rotation in radar mode
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

  /** Force cancel scan mode (e.g. on pause/ESC). */
  cancelScan() {
    if (this._player.isScanning) {
       this._player.isScanning = false;
       this._bus.emit(PlayerEvents.SCAN_CHANGED, this._player.toSnapshot());
       this._bus.emit(PlayerEvents.MOVED, this._player.toSnapshot());
    }
  }

  // ───────────────────────────────────────────────────────────
  // Private
  // ───────────────────────────────────────────────────────────

  /** @private */
  _processScanToggle() {
    const fn = (codes) => codes.some((c) => this._input.isPressed(c));
    const vPressed = fn(KEYS.SCAN);
    
    if (vPressed && !this._prevV) {
      if (this._player.isScanning) {
        this._player.isScanning = false;
        this._bus.emit(PlayerEvents.SCAN_CHANGED, this._player.toSnapshot());
        this._bus.emit(PlayerEvents.MOVED, this._player.toSnapshot()); // Force cam sync
      } else if (this._player.scans > 0) {
        this._player.scans--;
        this._player.isScanning = true;
        this._bus.emit(PlayerEvents.SCAN_CHANGED, this._player.toSnapshot());
        this._bus.emit(PlayerEvents.MOVED, this._player.toSnapshot()); // Force cam sync
      }
    }
    this._prevV = vPressed;
  }

  /**
   * Check if player reached the exit cell.
   * @private
   */
  _checkExit() {
    if (!this._exitCoord) return;
    
    const pCol = Math.floor(this._player.position.x / this._cellSize);
    const pRow = Math.floor(this._player.position.z / this._cellSize);

    if (pCol === this._exitCoord.col && pRow === this._exitCoord.row) {
      this._bus.emit(LevelEvents.CHANGED, { levelIndex: 1 /* placeholder for next level */ });
      // Reset exit to avoid spamming
      this._exitCoord = null;
    }
  }

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
      const now = Date.now();
      if (now - this._lastFireTime >= this._fireRateDelay) {
        if (this._player.consumeAmmo()) {
          this._lastFireTime = now;
          
          // Calculate firing direction from player yaw/pitch
          const yaw = this._player.yaw;
          const pitch = this._player.pitch;
          
          // Three.js forward is -Z. 
          const direction = {
            x: -Math.sin(yaw) * Math.cos(pitch),
            y: Math.sin(pitch),
            z: -Math.cos(yaw) * Math.cos(pitch)
          };

          this._bus.emit(PlayerEvents.FIRED, {
            origin: { 
              x: this._player.position.x, 
              y: 1.6, // Eye height
              z: this._player.position.z 
            },
            direction,
            damage: 25,
            speed: 50
          });
        }
      }
    }
  }

  /** @private */
  _processReload() {
    if (this._input.isPressed('KeyR')) {
      if (this._player.startReload()) {
        this._bus.emit(PlayerEvents.RELOAD_START, this._player.toSnapshot());
        setTimeout(() => {
          this._player.finishReload();
          this._bus.emit(PlayerEvents.RELOAD_FINISH, this._player.toSnapshot());
          this._dispatchChangeEvents();
        }, 1500);
      }
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
      
      // Reset position to entrance
      if (this._entranceCoord) {
         const sx = this._entranceCoord.col * this._cellSize + (this._cellSize / 2);
         const sz = this._entranceCoord.row * this._cellSize + (this._cellSize / 2);
         this._player.setPosition(sx, 0, sz);
      } else {
         this._player.setPosition(this._cellSize / 2, 0, this._cellSize / 2);
      }
      
      this._bus.emit(PlayerEvents.MOVED, this._player.toSnapshot());
      this._bus.emit(PlayerEvents.SPAWNED, this._player.toSnapshot());
    } else {
      console.warn('[PlayerController] Game Over — no lives remaining.');
    }
  }
}
