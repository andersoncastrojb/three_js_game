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

  // Ambient – soft base illumination (bright afternoon)
  const ambient = new THREE.AmbientLight(0xffeedd, 1.2);
  group.add(ambient);

  // Directional – sun-like source with shadows (Golden hour, lower angle)
  const sun = new THREE.DirectionalLight(0xffd5a0, 2.8);
  sun.position.set(15, 10, 25); // Lower in the sky for long afternoon shadows
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

  // Hemisphere – sky/ground gradient fill (afternoon sky vs dusty ground)
  const hemi = new THREE.HemisphereLight(0x66aaff, 0xcc8855, 0.9);
  group.add(hemi);

  // Accent point light – subtle glow (blood red)
  const accent = new THREE.PointLight(0xff3300, 2.0, 30);
  accent.position.set(-4, 4, -4);
  group.add(accent);

  return group;
}
