/**
 * @file LevelManager.js
 * @layer Use Cases
 * @description Orchestrates level progression for the maze-escape game.
 *
 * Responsibilities:
 *  - Generate maze grids via the {@link Maze} domain entity.
 *  - Track the current level index and configuration.
 *  - Emit {@link LevelEvents} so that Infrastructure (Three.js) and
 *    Presentation (HUD) can react without coupling to this use-case.
 *
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  May ONLY import from src/core/.                             ║
 * ║  No Three.js · No DOM · No LLMs · No Vue                    ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import { Maze } from '../core/entities/Maze.js';
import { eventBus, LevelEvents } from '../core/EventBus.js';

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

/**
 * Configuration for a single level.
 * @typedef {Object} LevelConfig
 * @property {number}  cols          - Maze grid width in cells.
 * @property {number}  rows          - Maze grid height in cells.
 * @property {number}  zombieCount   - Number of zombies to spawn.
 * @property {number}  [seed]        - Optional deterministic seed.
 *                                     Defaults to `Date.now()` when omitted.
 */

/**
 * Internal state snapshot of the LevelManager.
 * @typedef {Object} LevelState
 * @property {number}      levelIndex   - 0-based index of the active level.
 * @property {LevelConfig} config       - Configuration used to generate the level.
 * @property {Maze}        maze         - The active Maze entity.
 * @property {boolean}     active       - Whether a level is currently running.
 */

// ─────────────────────────────────────────────────────────────
// Default level progression table
// Add more entries here to extend the game.
// ─────────────────────────────────────────────────────────────

/**
 * Built-in level configuration table.
 * The LevelManager cycles through this table; once exhausted,
 * it scales the last entry so the game never dead-ends.
 *
 * @type {Readonly<LevelConfig[]>}
 */
const DEFAULT_LEVEL_TABLE = Object.freeze([
  { cols: 10, rows: 10, zombieCount:  3 },   // Level 1 — tutorial
  { cols: 12, rows: 12, zombieCount:  5 },   // Level 2
  { cols: 15, rows: 15, zombieCount:  8 },   // Level 3
  { cols: 18, rows: 18, zombieCount: 12 },   // Level 4
  { cols: 20, rows: 20, zombieCount: 16 },   // Level 5 — scaling baseline
]);

// ─────────────────────────────────────────────────────────────
// LevelManager
// ─────────────────────────────────────────────────────────────

export class LevelManager {
  /**
   * @param {EventBus}      [bus]         - EventBus instance. Defaults to the global singleton.
   * @param {LevelConfig[]} [levelTable]  - Custom level table. Defaults to {@link DEFAULT_LEVEL_TABLE}.
   */
  constructor(bus = eventBus, levelTable = DEFAULT_LEVEL_TABLE) {
    if (typeof bus?.emit !== 'function' || typeof bus?.on !== 'function') {
      throw new TypeError('LevelManager: `bus` must be an EventBus instance.');
    }
    if (!Array.isArray(levelTable) || levelTable.length === 0) {
      throw new TypeError('LevelManager: `levelTable` must be a non-empty array.');
    }

    /** @private @type {EventBus} */
    this._bus = bus;

    /** @private @type {Readonly<LevelConfig[]>} */
    this._levelTable = levelTable;

    /**
     * 0-based index of the currently active level.
     * @type {number}
     */
    this.levelIndex = 0;

    /**
     * The active Maze entity. `null` until `generateLevel()` is called.
     * @type {Maze | null}
     */
    this.maze = null;

    /**
     * Whether a level is currently active (generated & running).
     * @type {boolean}
     */
    this.active = false;
  }

  // ───────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────

  /**
   * Generate the maze for the current `levelIndex` and emit `level:generated`.
   *
   * Infrastructure (MazeRenderer) and Presentation (LevelHUD) should listen
   * to `LevelEvents.GENERATED` on the EventBus to react.
   *
   * @param {number} [seed]  - Optional seed override. Defaults to `Date.now()`.
   * @returns {Maze}         - The newly generated Maze entity.
   *
   * @fires LevelEvents.GENERATED
   *
   * @example
   * const lm = new LevelManager();
   * lm.generateLevel();                     // auto-seed
   * lm.generateLevel(42);                   // deterministic seed
   */
  generateLevel(seed) {
    const config = this._resolveConfig(this.levelIndex);
    const resolvedSeed = (seed !== undefined && Number.isFinite(seed))
      ? seed
      : Date.now();

    const maze = new Maze(config.cols, config.rows, resolvedSeed);
    maze.generate();

    this.maze   = maze;
    this.active = true;

    /** @type {import('../core/EventBus.js').LevelGeneratedPayload} */
    const payload = {
      levelIndex:  this.levelIndex,
      cols:        maze.cols,
      rows:        maze.rows,
      grid:        maze.toSnapshot().grid,    // deep-copied — consumers cannot mutate
      entrance:    maze.entrance,
      exit:        maze.exit,
      seed:        maze.seed,
      zombieCount: config.zombieCount,
    };

    this._bus.emit(LevelEvents.GENERATED, payload);
    return maze;
  }

  /**
   * Advance to the next level and generate a new maze.
   * Emits `level:changed` first, then `level:generated`.
   *
   * @param {number} [seed] - Optional seed for the next level.
   * @returns {Maze}        - The newly generated Maze entity.
   *
   * @fires LevelEvents.CHANGED
   * @fires LevelEvents.GENERATED
   */
  nextLevel(seed) {
    this._destroyCurrent();
    this.levelIndex += 1;

    this._bus.emit(LevelEvents.CHANGED, { levelIndex: this.levelIndex });
    return this.generateLevel(seed);
  }

  /**
   * Reset back to level 0 and regenerate.
   * Useful for "New Game" flows.
   *
   * @param {number} [seed]
   * @returns {Maze}
   *
   * @fires LevelEvents.DESTROYED
   * @fires LevelEvents.CHANGED
   * @fires LevelEvents.GENERATED
   */
  restart(seed) {
    this._destroyCurrent();
    this.levelIndex = 0;

    this._bus.emit(LevelEvents.CHANGED, { levelIndex: 0 });
    return this.generateLevel(seed);
  }

  /**
   * Return the config for the current (or any indexed) level.
   * @param {number} [index] - Level index to query. Defaults to `this.levelIndex`.
   * @returns {LevelConfig}
   */
  getConfig(index = this.levelIndex) {
    return this._resolveConfig(index);
  }

  /**
   * Expose a read-only snapshot of internal state (useful for debugging/HUD).
   * @returns {LevelState}
   */
  getState() {
    return {
      levelIndex: this.levelIndex,
      config:     this._resolveConfig(this.levelIndex),
      maze:       this.maze,
      active:     this.active,
    };
  }

  // ───────────────────────────────────────────────────────────
  // Private Helpers
  // ───────────────────────────────────────────────────────────

  /**
   * Resolve the {@link LevelConfig} for a given level index.
   * Beyond the table, scales the last entry (cols/rows/zombies grow gradually).
   *
   * @private
   * @param {number} index - 0-based level index.
   * @returns {LevelConfig}
   */
  _resolveConfig(index) {
    if (index < this._levelTable.length) {
      return { ...this._levelTable[index] };
    }

    // Procedural scaling beyond the table
    const base    = this._levelTable[this._levelTable.length - 1];
    const extra   = index - (this._levelTable.length - 1); // levels past the table
    const scale   = 1 + extra * 0.1;                       // +10 % per extra level

    return {
      cols:         Math.round(base.cols  * scale),
      rows:         Math.round(base.rows  * scale),
      zombieCount:  Math.round(base.zombieCount * scale),
    };
  }

  /**
   * Tear down the current level state and emit `level:destroyed`.
   * @private
   * @fires LevelEvents.DESTROYED
   */
  _destroyCurrent() {
    if (this.active) {
      this._bus.emit(LevelEvents.DESTROYED, { levelIndex: this.levelIndex });
    }
    this.maze   = null;
    this.active = false;
  }
}
