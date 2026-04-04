/**
 * @file MazeRenderer.js
 * @layer Infrastructure / Three.js
 * @description Translates the pure-JS Maze grid emitted via EventBus into
 * Three.js geometry (walls, floor, ceiling, doorways) inside the scene.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  May import Three.js — this IS the infrastructure layer.    ║
 * ║  Must NEVER import from src/presentation/.                  ║
 * ║  Listens to EventBus; never calls use-cases directly.       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ## How it works
 * 1. Subscribe to `LevelEvents.GENERATED` on the EventBus.
 * 2. For each cell (row, col) read its bitmask from the payload grid.
 * 3. For each of the 4 walls (N/S/E/W), if the wall bit is NOT set → build a wall segment.
 * 4. Place a floor plane for every cell.
 * 5. On `LevelEvents.DESTROYED`, dispose all geometry / materials and remove from scene.
 *
 * ## Performance strategy
 * - All wall segments of the same material are merged into a single
 *   THREE.BufferGeometry via BufferGeometryUtils.mergeGeometries() so the
 *   renderer issues a single draw call for the entire maze.
 * - Floor tiles are merged similarly.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { LevelEvents } from '../../core/EventBus.js';
import { MazeCell }    from '../../core/entities/Maze.js';
import { getWallTexture, getFloorTexture, disposeTextures } from './MazeTextureFactory.js';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** World-units per cell (cell size in Three.js space). */
const CELL_SIZE = 4;

/** Wall height in world-units. */
const WALL_HEIGHT = 3;

/** Wall thickness in world-units. */
const WALL_THICKNESS = 0.3;

/** Y-position of the wall centre (floor sits at y=0, wall middle at y = WALL_HEIGHT/2). */
const WALL_Y = WALL_HEIGHT / 2;

/** Entrance / exit doorway marker colour. */
const DOORWAY_COLOR = 0xff0000;

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../core/EventBus.js').LevelGeneratedPayload} LevelGeneratedPayload
 */

/**
 * @typedef {Object} MazeRendererOptions
 * @property {number} [cellSize]       - World-units per maze cell. Default: {@link CELL_SIZE}.
 * @property {number} [wallHeight]     - Wall height in world-units. Default: {@link WALL_HEIGHT}.
 * @property {boolean} [showCeiling]   - Whether to render a ceiling plane. Default: `false`.
 */

// ─────────────────────────────────────────────────────────────
// MazeRenderer
// ─────────────────────────────────────────────────────────────

export class MazeRenderer {
  /**
   * @param {THREE.Scene}   scene   - The Three.js scene to add geometry into.
   * @param {EventBus}      bus     - EventBus instance to subscribe to.
   * @param {MazeRendererOptions} [options]
   */
  constructor(scene, bus, options = {}) {
    if (!(scene instanceof THREE.Scene)) {
      throw new TypeError('MazeRenderer: `scene` must be a THREE.Scene.');
    }
    if (typeof bus?.on !== 'function') {
      throw new TypeError('MazeRenderer: `bus` must be an EventBus instance.');
    }

    /** @private @type {THREE.Scene} */
    this._scene = scene;

    /** @private @type {EventBus} */
    this._bus = bus;

    /** @private @type {Required<MazeRendererOptions>} */
    this._opts = {
      cellSize:    options.cellSize    ?? CELL_SIZE,
      wallHeight:  options.wallHeight  ?? WALL_HEIGHT,
      showCeiling: options.showCeiling ?? false,
    };

    /**
     * Root group that holds all maze geometry.
     * Removing this single group clears the entire maze from the scene.
     * @private @type {THREE.Group | null}
     */
    this._mazeRoot = null;

    /** @private @type {THREE.BufferGeometry[]} geometry pool for disposal */
    this._geoPool = [];

    /** @private @type {THREE.Material[]} material pool for disposal */
    this._matPool = [];

    // Wire up EventBus subscriptions
    this._unsubGenerated  = this._bus.on(LevelEvents.GENERATED,  (p) => this._onLevelGenerated(p));
    this._unsubDestroyed  = this._bus.on(LevelEvents.DESTROYED,  ()  => this._tearDown());
  }

  // ───────────────────────────────────────────────────────────
  // EventBus Handlers
  // ───────────────────────────────────────────────────────────

  /**
   * Rebuild the 3D maze geometry from the level payload.
   * @private
   * @param {LevelGeneratedPayload} payload
   */
  _onLevelGenerated(payload) {
    // Tear down any previous level first
    this._tearDown();

    const { grid, rows, cols, entrance, exit } = payload;
    const cs = this._opts.cellSize;
    const wh = this._opts.wallHeight;

    // Shared materials (instantiated once, reused across all geometry)
    const wallMat  = this._trackMaterial(new THREE.MeshStandardMaterial({
      map:          getWallTexture(),
      roughness:    0.85,
      metalness:    0.05,
      color:        0xcc8866,
    }));

    const floorMat = this._trackMaterial(new THREE.MeshStandardMaterial({
      map:          getFloorTexture(),
      roughness:    0.95,
      metalness:    0.0,
      color:        0x886655,
    }));

    const ceilMat  = this._trackMaterial(new THREE.MeshStandardMaterial({
      color:        0x080301,
      roughness:    1.0,
      metalness:    0.0,
      side:         THREE.BackSide,
    }));

    // Accumulate raw geometries for merging
    /** @type {THREE.BufferGeometry[]} */
    const wallGeos  = [];
    /** @type {THREE.BufferGeometry[]} */
    const floorGeos = [];
    /** @type {THREE.BufferGeometry[]} */
    const ceilGeos  = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell     = grid[row][col];
        const worldX   = col * cs;
        const worldZ   = row * cs;
        const centreX  = worldX + cs / 2;
        const centreZ  = worldZ + cs / 2;

        // ── Floor tile ────────────────────────────────────────
        const floorGeo = new THREE.PlaneGeometry(cs, cs);
        floorGeo.rotateX(-Math.PI / 2);
        floorGeo.translate(centreX, 0, centreZ);
        floorGeos.push(this._trackGeo(floorGeo));

        // ── Ceiling tile (optional) ───────────────────────────
        if (this._opts.showCeiling) {
          const ceilGeo = new THREE.PlaneGeometry(cs, cs);
          ceilGeo.rotateX(Math.PI / 2);
          ceilGeo.translate(centreX, wh, centreZ);
          ceilGeos.push(this._trackGeo(ceilGeo));
        }

        // ── Wall segments — only build where no passage exists ─
        // NORTH wall (top edge of cell — runs west→east along Z = worldZ)
        if (!(cell & MazeCell.NORTH)) {
          wallGeos.push(this._trackGeo(
            this._makeWallGeo(centreX, worldZ, 'NS', cs, wh)
          ));
        }

        // SOUTH wall (bottom edge — Z = worldZ + cs)
        if (!(cell & MazeCell.SOUTH)) {
          wallGeos.push(this._trackGeo(
            this._makeWallGeo(centreX, worldZ + cs, 'NS', cs, wh)
          ));
        }

        // WEST wall (left edge — X = worldX)
        if (!(cell & MazeCell.WEST)) {
          wallGeos.push(this._trackGeo(
            this._makeWallGeo(worldX, centreZ, 'EW', cs, wh)
          ));
        }

        // EAST wall (right edge — X = worldX + cs)
        if (!(cell & MazeCell.EAST)) {
          wallGeos.push(this._trackGeo(
            this._makeWallGeo(worldX + cs, centreZ, 'EW', cs, wh)
          ));
        }
      }
    }

    // ── Create merged meshes (1 draw call per material) ────────
    const root = new THREE.Group();
    root.name  = 'MazeRoot';

    if (floorGeos.length) {
      const merged = this._trackGeo(mergeGeometries(floorGeos));
      const mesh   = new THREE.Mesh(merged, floorMat);
      mesh.name    = 'MazeFloor';
      mesh.receiveShadow = true;
      root.add(mesh);
    }

    if (wallGeos.length) {
      const merged = this._trackGeo(mergeGeometries(wallGeos));
      const mesh   = new THREE.Mesh(merged, wallMat);
      mesh.name    = 'MazeWalls';
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }

    if (ceilGeos.length) {
      const merged = this._trackGeo(mergeGeometries(ceilGeos));
      const mesh   = new THREE.Mesh(merged, ceilMat);
      mesh.name    = 'MazeCeiling';
      root.add(mesh);
    }

    // ── Entrance / Exit doorway markers ────────────────────────
    root.add(this._makeDoorwayMarker(entrance.col, entrance.row, cs, 'entrance'));
    root.add(this._makeDoorwayMarker(exit.col,     exit.row,     cs, 'exit'));

    // ── Point lights inside the maze for atmosphere ─────────────
    this._addAmbientLights(root, rows, cols, cs);

    this._mazeRoot = root;
    this._scene.add(root);

    console.log(`[MazeRenderer] Level built — ${cols}×${rows} cells, ${wallGeos.length} wall segments merged.`);
  }

  // ───────────────────────────────────────────────────────────
  // Geometry Helpers
  // ───────────────────────────────────────────────────────────

  /**
   * Build a single wall segment BoxGeometry, pre-translated into world-space.
   * @private
   * @param {number} cx        - Centre X in world-space.
   * @param {number} cz        - Centre Z in world-space.
   * @param {'NS' | 'EW'} axis - Orientation: 'NS' = runs east-west, 'EW' = runs north-south.
   * @param {number} cs        - Cell size.
   * @param {number} wh        - Wall height.
   * @returns {THREE.BufferGeometry}
   */
  _makeWallGeo(cx, cz, axis, cs, wh) {
    const t = WALL_THICKNESS;
    const w = axis === 'NS' ? cs + t : t;  // width along X
    const d = axis === 'NS' ? t      : cs + t;  // depth along Z
    const geo = new THREE.BoxGeometry(w, wh, d);
    geo.translate(cx, wh / 2, cz);
    return geo;
  }

  /**
   * Create a glowing doorway pillar at a given cell position.
   * @private
   * @param {number} col
   * @param {number} row
   * @param {number} cs
   * @param {'entrance' | 'exit'} kind
   * @returns {THREE.Mesh}
   */
  _makeDoorwayMarker(col, row, cs, kind) {
    const x = col * cs + cs / 2;
    const z = row * cs + cs / 2;

    const geo = this._trackGeo(new THREE.TorusGeometry(0.8, 0.1, 8, 24));
    geo.rotateX(Math.PI / 2);

    const mat = this._trackMaterial(new THREE.MeshStandardMaterial({
      color:     DOORWAY_COLOR,
      emissive:  kind === 'entrance' ? 0x00ffcc : 0xff6600,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.8,
    }));

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name  = `doorway-${kind}`;
    mesh.position.set(x, 0.8, z);

    // Glowing point light above the doorway
    const light = new THREE.PointLight(
      kind === 'entrance' ? DOORWAY_COLOR : 0xff6600,
      2, cs * 3
    );
    light.position.set(x, 1.5, z);
    mesh.add(light);

    return mesh;
  }

  /**
   * Scatter a handful of dim point lights through the maze for atmosphere.
   * @private
   * @param {THREE.Group} root
   * @param {number} rows
   * @param {number} cols
   * @param {number} cs
   */
  _addAmbientLights(root, rows, cols, cs) {
    const step  = Math.max(3, Math.floor(Math.min(rows, cols) / 3));
    const color = 0xffeedd; // Warm afternoon light scatter

    for (let r = step; r < rows; r += step) {
      for (let c = step; c < cols; c += step) {
        const light = new THREE.PointLight(color, 0.6, cs * (step + 1));
        light.position.set(c * cs + cs / 2, WALL_HEIGHT * 0.8, r * cs + cs / 2);
        root.add(light);
      }
    }
  }

  // ───────────────────────────────────────────────────────────
  // Lifecycle / Disposal
  // ───────────────────────────────────────────────────────────

  /**
   * Remove all maze geometry and dispose GPU resources.
   * @private
   */
  _tearDown() {
    if (this._mazeRoot) {
      this._scene.remove(this._mazeRoot);
      this._mazeRoot = null;
    }
    this._geoPool.forEach((g) => g.dispose());
    this._geoPool.length = 0;
    this._matPool.forEach((m) => m.dispose());
    this._matPool.length = 0;
    disposeTextures();
    console.log('[MazeRenderer] Level torn down and GPU resources released.');
  }

  /**
   * Permanently detach from the EventBus and dispose all resources.
   * Call this when removing the renderer entirely (e.g., app shutdown).
   */
  dispose() {
    this._unsubGenerated();
    this._unsubDestroyed();
    this._tearDown();
  }

  // ───────────────────────────────────────────────────────────
  // Resource Tracking Helpers
  // ───────────────────────────────────────────────────────────

  /**
   * Register a geometry for deferred disposal and return it.
   * @private
   * @template {THREE.BufferGeometry} G
   * @param {G} geo
   * @returns {G}
   */
  _trackGeo(geo) {
    this._geoPool.push(geo);
    return geo;
  }

  /**
   * Register a material for deferred disposal and return it.
   * @private
   * @template {THREE.Material} M
   * @param {M} mat
   * @returns {M}
   */
  _trackMaterial(mat) {
    this._matPool.push(mat);
    return mat;
  }
}
