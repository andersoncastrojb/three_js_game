/**
 * @file SceneManager.js
 * @layer Infrastructure / Three.js
 * @description Sets up the Three.js scene, camera, renderer, and lights.
 * This is the ONLY entry point for Three.js within the infrastructure layer.
 */

import * as THREE from 'three';

export class SceneManager {
  /** @type {THREE.Scene} */
  scene;
  /** @type {THREE.PerspectiveCamera} */
  camera;
  /** @type {THREE.WebGLRenderer} */
  renderer;

  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0d1a);
    this.scene.fog = new THREE.FogExp2(0x0d0d1a, 0.035);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 6, 14);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Resize observer
    const ro = new ResizeObserver(() => this._onResize());
    ro.observe(canvas);
    this._ro = ro;
  }

  _onResize() {
    const { clientWidth: w, clientHeight: h } = this.renderer.domElement;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** @param {THREE.Object3D} object */
  add(object) {
    this.scene.add(object);
    return this;
  }

  /** @param {THREE.Object3D} object */
  remove(object) {
    this.scene.remove(object);
    return this;
  }

  dispose() {
    this._ro.disconnect();
    this.renderer.dispose();
  }
}
