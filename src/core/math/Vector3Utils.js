/**
 * @file Vector3Utils.js
 * @layer Core / Math
 * @description Pure math helpers operating on plain {x,y,z} objects.
 * Do NOT import Three.js here – these must be usable server-side or in tests.
 */

/** @typedef {{ x: number, y: number, z: number }} Vec3 */

export const Vector3Utils = {
  /** Create a zero vector */
  zero: () => ({ x: 0, y: 0, z: 0 }),

  /** Add two vectors */
  add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  },

  /** Subtract b from a */
  subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  },

  /** Scale a vector by scalar */
  scale(v, s) {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  },

  /** Euclidean length */
  length(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  },

  /** Normalized unit vector */
  normalize(v) {
    const l = Vector3Utils.length(v);
    if (l === 0) return Vector3Utils.zero();
    return Vector3Utils.scale(v, 1 / l);
  },

  /** Dot product */
  dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  },

  /** Linear interpolation between a and b */
  lerp(a, b, t) {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  },

  /** Euclidean distance between two points */
  distance(a, b) {
    return Vector3Utils.length(Vector3Utils.subtract(b, a));
  },

  /** Deep-clone a vector */
  clone(v) {
    return { x: v.x, y: v.y, z: v.z };
  },
};
