/**
 * @file RenderLoop.js
 * @layer Infrastructure / Three.js
 * @description Drives requestAnimationFrame and calls into:
 *   1. GameLoop.tick(delta) – pure domain logic
 *   2. SceneManager renderer – visual output
 * This bridges the use-case layer and the Three.js infrastructure.
 */

import * as THREE from 'three';

export class RenderLoop {
  #timer = new THREE.Timer();
  #animId = null;

  /**
   * @param {import('./SceneManager.js').SceneManager} sceneManager
   * @param {import('../../use-cases/GameLoop.js').GameLoop} gameLoop
   */
  constructor(sceneManager, gameLoop) {
    this.sceneManager = sceneManager;
    this.gameLoop = gameLoop;
  }

  start() {
    this.gameLoop.start();
    this.#loop();
  }

  stop() {
    if (this.#animId !== null) {
      cancelAnimationFrame(this.#animId);
      this.#animId = null;
    }
    this.gameLoop.stop();
  }

  #loop = () => {
    this.#animId = requestAnimationFrame(this.#loop);
    this.#timer.update();
    const delta = this.#timer.getDelta();

    // 1. Advance domain logic (use-case layer)
    this.gameLoop.tick(delta);

    // 2. Render the scene
    const { renderer, scene, camera } = this.sceneManager;
    renderer.render(scene, camera);
  };
}
