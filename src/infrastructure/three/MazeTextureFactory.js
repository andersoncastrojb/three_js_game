/**
 * @file MazeTextureFactory.js
 * @layer Infrastructure / Three.js
 * @description Generates procedural THREE.Texture objects for maze surfaces.
 * Keeps canvas / CanvasRenderingContext2D usage isolated from geometry code.
 *
 * All textures are generated once per renderer lifecycle and cached.
 * Dispose with `MazeTextureFactory.dispose()` when tearing down a level.
 */

import * as THREE from 'three';

/** @type {Map<string, THREE.Texture>} */
const _cache = new Map();

/**
 * Draw a stone-brick pattern onto a CanvasRenderingContext2D.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size   - Canvas side length in pixels.
 */
function _paintBrick(ctx, size) {
  // Base stone colour (Doom: dark rusty brown)
  ctx.fillStyle = '#2b1408';
  ctx.fillRect(0, 0, size, size);

  // Brick rows
  const brickH = size / 4;
  const brickW = size / 2;

  ctx.strokeStyle = '#1c0d05';
  ctx.lineWidth = 2;

  for (let row = 0; row < 4; row++) {
    const offsetX = (row % 2 === 0) ? 0 : brickW / 2;
    for (let col = -1; col < 3; col++) {
      const x = offsetX + col * brickW;
      const y = row * brickH;

      // Brick face with subtle gradient noise
      const shade = 10 + Math.floor(Math.random() * 20);
      ctx.fillStyle = `rgb(${shade + 50},${shade + 20},${shade + 10})`;
      ctx.fillRect(x + 2, y + 2, brickW - 4, brickH - 4);

      // Grout lines
      ctx.strokeRect(x, y, brickW, brickH);
    }
  }

  // Subtle highlight at top edge
  ctx.fillStyle = 'rgba(255,100,50,0.06)';
  ctx.fillRect(0, 0, size, 4);
}

/**
 * Draw a cracked-stone floor pattern onto a CanvasRenderingContext2D.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size
 */
function _paintFloor(ctx, size) {
  // Dark base (Doom style floor)
  ctx.fillStyle = '#140a05';
  ctx.fillRect(0, 0, size, size);

  // Subtle tile grid
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  const tileSize = size / 4;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * tileSize, 0);
    ctx.lineTo(i * tileSize, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * tileSize);
    ctx.lineTo(size, i * tileSize);
    ctx.stroke();
  }

  // Crack/vein noise lines (like dry blood/lava)
  ctx.strokeStyle = 'rgba(150,20,10,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }
}

/**
 * Create (or return cached) a wall texture.
 * @returns {THREE.Texture}
 */
export function getWallTexture() {
  if (_cache.has('wall')) return _cache.get('wall');

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  _paintBrick(ctx, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  _cache.set('wall', tex);
  return tex;
}

/**
 * Create (or return cached) a floor texture.
 * @returns {THREE.Texture}
 */
export function getFloorTexture() {
  if (_cache.has('floor')) return _cache.get('floor');

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  _paintFloor(ctx, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  _cache.set('floor', tex);
  return tex;
}

/** Release all cached textures (call when tearing down a level). */
export function disposeTextures() {
  _cache.forEach((tex) => tex.dispose());
  _cache.clear();
}
