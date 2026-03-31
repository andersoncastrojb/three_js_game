/**
 * @file LightingSetup.js
 * @layer Infrastructure / Three.js
 * @description Encapsulates all Three.js lighting configuration.
 * Returns a group of lights ready to be added to the scene.
 */

import * as THREE from 'three';

export function createLighting() {
  const group = new THREE.Group();
  group.name = 'Lighting';

  // Ambient – soft base illumination
  const ambient = new THREE.AmbientLight(0x1a1a3e, 0.8);
  group.add(ambient);

  // Directional – sun-like source with shadows
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(10, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 100;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.bias = -0.001;
  group.add(sun);

  // Hemisphere – sky/ground gradient fill
  const hemi = new THREE.HemisphereLight(0x6688cc, 0x422b00, 0.6);
  group.add(hemi);

  // Accent point light – subtle glow
  const accent = new THREE.PointLight(0x00ddff, 1.5, 30);
  accent.position.set(-4, 4, -4);
  group.add(accent);

  return group;
}
