/**
 * @file EventBus.js
 * @layer Core
 * @description Lightweight publish/subscribe event bus.
 * Decouples all layers: use-cases emit events, infrastructure listens and reacts.
 *
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  ZERO external dependencies permitted in this file.      ║
 * ║  No Three.js · No DOM · No LLMs · No Vue                 ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────
// Typed Event Catalog
// All event name constants MUST live here so every layer uses
// the same string without risk of typos.
// ─────────────────────────────────────────────────────────────

/**
 * Events emitted by the Agent / NPC subsystem.
 * @readonly
 * @enum {string}
 */
export const AgentEvents = {
  SPAWNED:      'agent:spawned',
  MOVED:        'agent:moved',
  ACTIVATED:    'agent:activated',
  DISMISSED:    'agent:dismissed',
  SKILL_RESULT: 'agent:skillResult',
};

/**
 * Events emitted by the Level / Maze subsystem.
 * @readonly
 * @enum {string}
 */
export const LevelEvents = {
  /** Emitted when a new maze grid has been generated. Payload: {@link LevelGeneratedPayload} */
  GENERATED:   'level:generated',
  /** Emitted when the player transitions to the next level. Payload: `{ levelIndex: number }` */
  CHANGED:     'level:changed',
  /** Emitted when the level is fully torn down and cleaned up. */
  DESTROYED:   'level:destroyed',
};

/**
 * Events emitted by the Player subsystem.
 * @readonly
 * @enum {string}
 */
export const PlayerEvents = {
  SPAWNED:     'player:spawned',
  MOVED:       'player:moved',
  HEALTH_CHANGED: 'player:healthChanged',
  DIED:        'player:died',
  AMMO_CHANGED: 'player:ammoChanged',
  FIRED:       'player:fired',
  RELOAD_START: 'player:reloadStart',
  RELOAD_FINISH: 'player:reloadFinish',
  SCAN_CHANGED: 'player:scanChanged',
};

/**
 * Events emitted by the Combat subsystem.
 * @readonly
 * @enum {string}
 */
export const CombatEvents = {
  PROJECTILE_SPAWNED: 'combat:projectileSpawned',
  PROJECTILE_MOVED:   'combat:projectileMoved',
  PROJECTILE_DESTROYED: 'combat:projectileDestroyed',
  HIT:         'combat:hit',
  KILL:        'combat:kill',
  MISS:        'combat:miss',
};

/**
 * Events emitted by the Zombie subsystem.
 * @readonly
 * @enum {string}
 */
export const ZombieEvents = {
  SPAWNED:     'zombie:spawned',
  STATE_CHANGED: 'zombie:stateChanged',
  DAMAGED:     'zombie:damaged',
  DIED:        'zombie:died',
  ATTACK:      'zombie:attack',
  GROAN:       'zombie:groan',
};

// ─────────────────────────────────────────────────────────────
// Payload Type Definitions (JSDoc-only, no runtime cost)
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} LevelGeneratedPayload
 * @property {number}   levelIndex   - 0-based index of the current level.
 * @property {number}   cols         - Number of columns in the maze grid.
 * @property {number}   rows         - Number of rows in the maze grid.
 * @property {number[][]} grid       - 2-D array [row][col] of cell bitmasks (see MazeCell).
 * @property {{ col: number, row: number }} entrance - Grid coords of the entrance cell.
 * @property {{ col: number, row: number }} exit     - Grid coords of the exit cell.
 * @property {number}   seed         - The random seed used for generation.
 */

// ─────────────────────────────────────────────────────────────
// EventBus Class
// ─────────────────────────────────────────────────────────────

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();

    /** @type {Set<Function>} Wildcard listeners — called for every event (DEV debug only). */
    this._wildcards = new Set();
  }

  /**
   * Subscribe to a named event.
   * @param {string}   event   - Event name (use the *Events constants above).
   * @param {Function} handler - Callback receiving the event payload.
   * @returns {() => void}     - Call this function to unsubscribe.
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe exactly once — auto-unsubscribes after the first call.
   * @param {string}   event
   * @param {Function} handler
   * @returns {() => void} - Early-unsubscribe function (if you need to cancel before first fire).
   */
  once(event, handler) {
    /** @type {Function} */
    const wrapper = (payload) => {
      handler(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe a handler from a named event.
   * @param {string}   event
   * @param {Function} handler
   */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  /**
   * Emit a named event, invoking all registered handlers synchronously.
   * @param {string} event   - One of the *Events enum values.
   * @param {*}      [payload] - Arbitrary data delivered to every handler.
   */
  emit(event, payload) {
    this._listeners.get(event)?.forEach((fn) => fn(payload));
    // Notify wildcard listeners (DEV instrumentation only — zero cost in prod)
    this._wildcards.forEach((fn) => fn(event, payload));
  }

  /**
   * Register a wildcard listener that fires for EVERY event.
   * Intended for DEV-mode debugging and logging only.
   * @param {(event: string, payload: *) => void} handler
   * @returns {() => void} unsubscribe function
   */
  onAny(handler) {
    this._wildcards.add(handler);
    return () => this._wildcards.delete(handler);
  }

  /** Remove all listeners for all events (including wildcards). */
  clear() {
    this._listeners.clear();
    this._wildcards.clear();
  }

  /**
   * Return the number of subscribers for a given event (useful for tests).
   * @param {string} event
   * @returns {number}
   */
  listenerCount(event) {
    return this._listeners.get(event)?.size ?? 0;
  }
}

/** Singleton instance shared across the entire application. */
export const eventBus = new EventBus();
