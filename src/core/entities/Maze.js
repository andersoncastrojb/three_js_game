/**
 * @file Maze.js
 * @layer Core / Domain
 * @description Pure-JS domain entity that stores a procedurally generated maze grid.
 *
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  ZERO external dependencies permitted in this file.      ║
 * ║  No Three.js · No DOM · No LLMs · No Vue                 ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * ## Grid Encoding
 * Each cell in the 2-D `grid[row][col]` is a 4-bit bitmask describing
 * which walls are OPEN (passage exists):
 *
 *   Bit 0 (1) → NORTH wall is open
 *   Bit 1 (2) → SOUTH wall is open
 *   Bit 2 (4) → EAST  wall is open
 *   Bit 3 (8) → WEST  wall is open
 *
 * A value of 0 means all four walls are solid (fully enclosed cell).
 * A value of 15 (0b1111) means all walls are open (fully connected cell).
 *
 * Example: cell value 6 (0b0110) → SOUTH and EAST passages open.
 */

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/**
 * Bitmask flags for wall/passage directions within a maze cell.
 * @readonly
 * @enum {number}
 */
export const MazeCell = Object.freeze({
  NORTH: 1,  // 0001
  SOUTH: 2,  // 0010
  EAST:  4,  // 0100
  WEST:  8,  // 1000
});

/**
 * Opposite direction map — used during DFS to carve both sides of a passage.
 * @type {Readonly<Record<number, number>>}
 */
const OPPOSITE = Object.freeze({
  [MazeCell.NORTH]: MazeCell.SOUTH,
  [MazeCell.SOUTH]: MazeCell.NORTH,
  [MazeCell.EAST]:  MazeCell.WEST,
  [MazeCell.WEST]:  MazeCell.EAST,
});

/**
 * Direction → row/column delta mapping.
 * @type {Readonly<Record<number, { dRow: number, dCol: number }>>}
 */
const DIRECTION_DELTA = Object.freeze({
  [MazeCell.NORTH]: { dRow: -1, dCol:  0 },
  [MazeCell.SOUTH]: { dRow:  1, dCol:  0 },
  [MazeCell.EAST]:  { dRow:  0, dCol:  1 },
  [MazeCell.WEST]:  { dRow:  0, dCol: -1 },
});

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} MazeCoord
 * @property {number} col - Column index (0-based, left → right).
 * @property {number} row - Row index    (0-based, top  → bottom).
 */

/**
 * @typedef {Object} MazeSnapshot
 * @property {number}     cols      - Grid width in cells.
 * @property {number}     rows      - Grid height in cells.
 * @property {number[][]} grid      - 2-D bitmask array [row][col].
 * @property {MazeCoord}  entrance  - Entrance cell coordinates.
 * @property {MazeCoord}  exit      - Exit cell coordinates.
 * @property {number}     seed      - PRNG seed used during generation.
 */

// ─────────────────────────────────────────────────────────────
// Seeded PRNG (Mulberry32) — deterministic, no Math.random()
// ─────────────────────────────────────────────────────────────

/**
 * Creates a seeded pseudo-random number generator (Mulberry32 algorithm).
 * Returns a function that produces floats in [0, 1) deterministically.
 *
 * @param {number} seed - Integer seed value.
 * @returns {() => number} PRNG function.
 */
function createPRNG(seed) {
  let s = seed >>> 0; // force unsigned 32-bit
  return function () {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using a seeded PRNG (in-place).
 * @template T
 * @param {T[]}          array - Array to shuffle.
 * @param {() => number} rand  - PRNG function returning [0, 1).
 * @returns {T[]}              - The same array, shuffled.
 */
function shuffleArray(array, rand) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ─────────────────────────────────────────────────────────────
// Maze Entity
// ─────────────────────────────────────────────────────────────

export class Maze {
  /**
   * @param {number} cols   - Number of columns (width).  Minimum 3.
   * @param {number} rows   - Number of rows    (height). Minimum 3.
   * @param {number} [seed] - Optional PRNG seed. Defaults to Date.now().
   */
  constructor(cols, rows, seed = Date.now()) {
    if (!Number.isInteger(cols) || cols < 3) {
      throw new RangeError(`Maze cols must be an integer >= 3, got: ${cols}`);
    }
    if (!Number.isInteger(rows) || rows < 3) {
      throw new RangeError(`Maze rows must be an integer >= 3, got: ${rows}`);
    }

    /** @type {number} */
    this.cols = cols;

    /** @type {number} */
    this.rows = rows;

    /** @type {number} */
    this.seed = seed;

    /**
     * 2-D bitmask grid [row][col].
     * Initialised to all-zero (all walls solid).
     * @type {number[][]}
     */
    this.grid = Array.from({ length: rows }, () => new Array(cols).fill(0));

    /**
     * Entrance cell — top-left corner by convention.
     * @type {MazeCoord}
     */
    this.entrance = { col: 0, row: 0 };

    /**
     * Exit cell — bottom-right corner by convention.
     * @type {MazeCoord}
     */
    this.exit = { col: cols - 1, row: rows - 1 };

    /** @type {boolean} Whether `generate()` has been called. */
    this._generated = false;
  }

  // ───────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────

  /**
   * Generate the maze using the Recursive Backtracker (DFS) algorithm.
   * Safe to call multiple times — resets the grid each time.
   *
   * Algorithm summary:
   *  1. Start from the entrance cell.
   *  2. Pick a random unvisited neighbour, carve a passage, recurse.
   *  3. Backtrack when all neighbours have been visited.
   *  This guarantees a perfect maze: exactly one path between any two cells.
   *
   * @returns {this} - Fluent interface for chaining.
   */
  generate() {
    // Reset grid
    for (let r = 0; r < this.rows; r++) {
      this.grid[r].fill(0);
    }

    const rand = createPRNG(this.seed);

    /** @type {boolean[][]} */
    const visited = Array.from({ length: this.rows }, () =>
      new Array(this.cols).fill(false)
    );

    // Iterative DFS using an explicit stack (avoids call-stack overflow for large mazes)
    /** @type {{ row: number, col: number }[]} */
    const stack = [{ row: this.entrance.row, col: this.entrance.col }];
    visited[this.entrance.row][this.entrance.col] = true;

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbours = this._getUnvisitedNeighbours(current.row, current.col, visited, rand);

      if (neighbours.length === 0) {
        // Dead end — backtrack
        stack.pop();
      } else {
        // Carve passage to a random unvisited neighbour
        const { row: nRow, col: nCol, direction } = neighbours[0];
        this._carvePassage(current.row, current.col, nRow, nCol, direction);
        visited[nRow][nCol] = true;
        stack.push({ row: nRow, col: nCol });
      }
    }

    // Open entrance (N wall of top-left cell) and exit (S wall of bottom-right cell)
    // so the renderer can place doorways.
    this.grid[this.entrance.row][this.entrance.col] |= MazeCell.NORTH;
    this.grid[this.exit.row][this.exit.col]         |= MazeCell.SOUTH;

    this._generated = true;
    return this;
  }

  /**
   * Check whether a wall exists between two adjacent cells.
   * @param {number} row        - Source cell row.
   * @param {number} col        - Source cell column.
   * @param {number} direction  - One of the {@link MazeCell} direction constants.
   * @returns {boolean} `true` if the wall is OPEN (passage exists), `false` if solid.
   */
  hasPassage(row, col, direction) {
    return (this.grid[row]?.[col] & direction) !== 0;
  }

  /**
   * Return a read-only snapshot suitable for event payloads.
   * Deep-copies the grid so consumers cannot mutate internal state.
   * @returns {MazeSnapshot}
   */
  toSnapshot() {
    return {
      cols:     this.cols,
      rows:     this.rows,
      grid:     this.grid.map((row) => [...row]),
      entrance: { ...this.entrance },
      exit:     { ...this.exit },
      seed:     this.seed,
    };
  }

  // ───────────────────────────────────────────────────────────
  // Private Helpers
  // ───────────────────────────────────────────────────────────

  /**
   * Collect all valid, unvisited neighbours of (row, col) in random order.
   * @param {number}      row
   * @param {number}      col
   * @param {boolean[][]} visited
   * @param {() => number} rand
   * @returns {{ row: number, col: number, direction: number }[]}
   */
  _getUnvisitedNeighbours(row, col, visited, rand) {
    const directions = shuffleArray(
      [MazeCell.NORTH, MazeCell.SOUTH, MazeCell.EAST, MazeCell.WEST],
      rand
    );

    /** @type {{ row: number, col: number, direction: number }[]} */
    const result = [];

    for (const dir of directions) {
      const { dRow, dCol } = DIRECTION_DELTA[dir];
      const nRow = row + dRow;
      const nCol = col + dCol;

      if (
        nRow >= 0 && nRow < this.rows &&
        nCol >= 0 && nCol < this.cols &&
        !visited[nRow][nCol]
      ) {
        result.push({ row: nRow, col: nCol, direction: dir });
      }
    }

    return result;
  }

  /**
   * Carves a bi-directional passage between two adjacent cells.
   * @param {number} fromRow
   * @param {number} fromCol
   * @param {number} toRow
   * @param {number} toCol
   * @param {number} direction - Direction FROM source TOWARD neighbour.
   */
  _carvePassage(fromRow, fromCol, toRow, toCol, direction) {
    this.grid[fromRow][fromCol] |= direction;
    this.grid[toRow][toCol]     |= OPPOSITE[direction];
  }
}
