/**
 * @file CombatSystem.js
 * @layer Use Cases
 * @description Handles all combat interactions: shooting, hit detection,
 * damage application, and reload timing.
 *
 * ## Raycast Strategy (pure JS)
 * Three.js Raycaster is INFRASTRUCTURE and must not be used here.
 * Instead, we accept pre-computed hit results (from the infrastructure
 * `ProjectileRaycaster`) delivered via EventBus, then apply domain logic.
 *
 * The combat loop works like this:
 *  1. Player fires → `CombatSystem.fire()` checks ammo, emits `combat:fired`.
 *  2. Infrastructure `ProjectileRaycaster` catches `combat:fired`, runs
 *     Three.js ray → scene intersection, emits `combat:rayResult`.
 *  3. `CombatSystem` catches `combat:rayResult`, calls `applyHit()`.
 *  4. `applyHit()` subtracts HP, emits `combat:hit` / `combat:kill`.
 *
 * This keeps Three.js 100% in infrastructure while domain owns all rules.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  May import from src/core/ only. No Three.js.               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { eventBus, CombatEvents, PlayerEvents, ZombieEvents } from '../core/EventBus.js';

// ─────────────────────────────────────────────────────────────
// Additional combat-specific event names (extend the catalog)
// ─────────────────────────────────────────────────────────────

export const CombatSystemEvents = {
  FIRED:      'combat:fired',      // Player attempted to fire
  RAY_RESULT: 'combat:rayResult',  // Infrastructure returns ray hit data
  RELOAD_START:  'combat:reloadStart',
  RELOAD_FINISH: 'combat:reloadFinish',
};

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RayHitResult
 * @property {boolean} hit          - Whether the ray intersected a zombie hitbox.
 * @property {string}  [zombieId]   - ID of the zombie that was hit.
 * @property {number}  [distance]   - Distance from player to hit point.
 * @property {{ x: number, y: number, z: number }} [point] - World-space hit point.
 */

/**
 * @typedef {Object} ZombieRecord
 * @property {string}  id
 * @property {number}  health
 * @property {number}  maxHealth
 * @property {boolean} isDead
 */

// ─────────────────────────────────────────────────────────────
// CombatSystem
// ─────────────────────────────────────────────────────────────

export class CombatSystem {
  /**
   * @param {Player}   player   - The domain Player entity.
   * @param {EventBus} [bus]    - EventBus instance.
   * @param {number}   [reloadMs] - Reload animation duration in ms. Default: 1500.
   * @param {number}   [damage]   - Damage per bullet. Default: 34 (3 shots to kill at 100 HP).
   */
  constructor(player, bus = eventBus, reloadMs = 1500, damage = 34) {
    if (!player || player.type !== 'player') {
      throw new TypeError('CombatSystem: requires a Player entity.');
    }

    /** @private @type {Player} */
    this._player = player;

    /** @private @type {EventBus} */
    this._bus = bus;

    /** @private @type {number} */
    this._reloadMs = reloadMs;

    /** @private @type {number} Damage per bullet. */
    this._damage = damage;

    /**
     * Registry of all live zombies by ID.
     * Populated externally via `registerZombie()` / `removeZombie()`.
     * @private @type {Map<string, ZombieRecord>}
     */
    this._zombies = new Map();

    /** @private @type {ReturnType<typeof setTimeout> | null} */
    this._reloadTimer = null;

    // Subscribe: when infrastructure returns a ray result, apply domain logic.
    this._unsubRay = this._bus.on(CombatSystemEvents.RAY_RESULT, (result) => {
      this._applyRayResult(result);
    });
  }

  // ───────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────

  /**
   * Called each frame by `PlayerController` when the fire button is held.
   * Rate-limiting (fire rate) is handled here via `_lastFireTime`.
   *
   * @param {number} [fireRateMs] - Milliseconds between shots. Default: 150.
   * @returns {boolean} `true` if a shot was fired.
   */
  fire(fireRateMs = 150) {
    const now = performance.now();
    if (!this._player.isAlive) return false;
    if (this._player.isReloading) return false;
    if (this._player.ammo <= 0) {
      this.reload();
      return false;
    }
    if (now - (this._lastFireTime ?? 0) < fireRateMs) return false;

    this._lastFireTime = now;
    const consumed = this._player.consumeAmmo();
    if (!consumed) return false;

    this._bus.emit(PlayerEvents.AMMO_CHANGED, this._player.toSnapshot());

    // Signal infrastructure to run the ray (async — does NOT block here)
    this._bus.emit(CombatSystemEvents.FIRED, {
      playerId: this._player.id,
      position: { ...this._player.position },
      yaw:      this._player.yaw,
      pitch:    this._player.pitch,
    });

    return true;
  }

  /**
   * Begin reload sequence (domain sets flag; timer completes it).
   * @returns {boolean} `true` if reload started.
   */
  reload() {
    if (!this._player.startReload()) return false;
    this._bus.emit(CombatSystemEvents.RELOAD_START, this._player.toSnapshot());

    // Clear any previous timer (safety guard)
    if (this._reloadTimer !== null) clearTimeout(this._reloadTimer);

    this._reloadTimer = setTimeout(() => {
      this._player.finishReload();
      this._reloadTimer = null;
      this._bus.emit(CombatSystemEvents.RELOAD_FINISH, this._player.toSnapshot());
      this._bus.emit(PlayerEvents.AMMO_CHANGED, this._player.toSnapshot());
    }, this._reloadMs);

    return true;
  }

  /**
   * Register a zombie entity so CombatSystem can track its HP.
   * @param {string} id
   * @param {number} health
   */
  registerZombie(id, health) {
    this._zombies.set(id, { id, health, maxHealth: health, isDead: false });
  }

  /**
   * Forcibly remove a zombie (e.g., when respawning or level change).
   * @param {string} id
   */
  removeZombie(id) {
    this._zombies.delete(id);
  }

  /**
   * Apply direct damage to a zombie (bypasses raycast — used for Area-of-Effect
   * or scripted damage in tests).
   * @param {string} zombieId
   * @param {number} amount
   */
  damageZombie(zombieId, amount) {
    this._applyDamage(zombieId, amount, null);
  }

  /** Clean up EventBus subscriptions and any pending timers. */
  dispose() {
    this._unsubRay();
    if (this._reloadTimer !== null) clearTimeout(this._reloadTimer);
  }

  // ───────────────────────────────────────────────────────────
  // Private
  // ───────────────────────────────────────────────────────────

  /**
   * Handle the ray result emitted by the infrastructure raycaster.
   * @private
   * @param {RayHitResult} result
   */
  _applyRayResult(result) {
    if (!result.hit || !result.zombieId) {
      this._bus.emit(CombatEvents.MISS, { playerId: this._player.id });
      return;
    }
    this._applyDamage(result.zombieId, this._damage, result.point ?? null);
  }

  /**
   * Core damage application — updates zombie HP and emits events.
   * @private
   * @param {string} zombieId
   * @param {number} amount
   * @param {{ x: number, y: number, z: number } | null} hitPoint
   */
  _applyDamage(zombieId, amount, hitPoint) {
    const zombie = this._zombies.get(zombieId);
    if (!zombie || zombie.isDead) return;

    zombie.health = Math.max(0, zombie.health - amount);

    this._bus.emit(CombatEvents.HIT, {
      zombieId,
      damage:   amount,
      remaining: zombie.health,
      hitPoint,
    });

    this._bus.emit(ZombieEvents.DAMAGED, {
      id:      zombie.id,
      health:  zombie.health,
      maxHealth: zombie.maxHealth,
    });

    if (zombie.health <= 0) {
      zombie.isDead = true;
      this._bus.emit(CombatEvents.KILL,  { zombieId, killer: this._player.id });
      this._bus.emit(ZombieEvents.DIED,  { id: zombie.id });
      this._zombies.delete(zombieId);
    }
  }
}
