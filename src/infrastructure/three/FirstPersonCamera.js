/**
 * @file FirstPersonCamera.js
 * @layer Infrastructure / Three.js
 * @description Binds the Three.js camera to the Player domain entity.
 * Manages pointer-lock, relays mouse-delta to PlayerController,
 * and syncs camera position/rotation each frame from the Player snapshot.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  May import Three.js — this IS the infrastructure layer.    ║
 * ║  Listens to PlayerEvents; never calls use-cases directly    ║
 * ║  (except the approved relay: applyMouseLook).               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import * as THREE from 'three';
import { PlayerEvents } from '../../core/EventBus.js';

/** Camera eye height above the floor plane (world-units). */
const EYE_HEIGHT = 1.7;

export class FirstPersonCamera {
  /**
   * @param {THREE.PerspectiveCamera}                             camera
   * @param {import('../../use-cases/PlayerController.js').PlayerController} controller
   * @param {import('../../core/entities/Player.js').Player}     player
   * @param {EventBus}                                            bus
   * @param {HTMLCanvasElement}                                   canvas
   */
  constructor(camera, controller, player, bus, canvas) {
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      throw new TypeError('FirstPersonCamera: needs a PerspectiveCamera.');
    }

    /** @private @type {THREE.PerspectiveCamera} */
    this._camera = camera;

    /** @private @type {import('../../use-cases/PlayerController.js').PlayerController} */
    this._ctrl = controller;

    /** @private @type {import('../../core/entities/Player.js').Player} */
    this._player = player;

    /** @private @type {EventBus} */
    this._bus = bus;

    /** @private @type {HTMLCanvasElement} */
    this._canvas = canvas;

    /** @private Whether pointer-lock is active. */
    this._locked = false;

    // Set initial camera field-of-view
    this._camera.fov = 75;
    this._camera.updateProjectionMatrix();

    this._attachPointerLock();
    this._syncCamera();
  }

  // ───────────────────────────────────────────────────────────
  // GameLoop System Interface
  // ───────────────────────────────────────────────────────────

  /**
   * Called each frame by the render bootstrap.
   * Syncs Three.js camera transform to the Player domain entity.
   */
  update() {
    this._syncCamera();
  }

  // ───────────────────────────────────────────────────────────
  // Pointer Lock
  // ───────────────────────────────────────────────────────────

  /** @private */
  _attachPointerLock() {
    this._canvas.addEventListener('click', this._onCanvasClick);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup',   this._onMouseUp);
  }

  _onCanvasClick = () => {
    if (!this._locked) {
      this._canvas.requestPointerLock();
    }
  };

  _onPointerLockChange = () => {
    this._locked = document.pointerLockElement === this._canvas;
    console.info('[FirstPersonCamera] Pointer lock:', this._locked ? 'acquired' : 'released');
  };

  /**
   * Relay raw mouse delta to the PlayerController (use case).
   * @param {MouseEvent} e
   */
  _onMouseMove = (e) => {
    if (!this._locked) return;
    this._ctrl.applyMouseLook(e.movementX, e.movementY);
  };

  _onMouseDown = (e) => {
    if (!this._locked) return;
    if (e.button === 0) this._ctrl.setMouseFire(true);
  };

  _onMouseUp = (e) => {
    if (e.button === 0) this._ctrl.setMouseFire(false);
  };

  // ───────────────────────────────────────────────────────────
  // Camera Sync
  // ───────────────────────────────────────────────────────────

  /**
   * Mirror Player entity position + look angles → Three.js camera transform.
   * @private
   */
  _syncCamera() {
    const p = this._player;

    // Position: at player world position, raised to eye height
    this._camera.position.set(p.position.x, EYE_HEIGHT, p.position.z);

    // Rotation: Three.js Euler order YXZ is correct for FPS cameras
    this._camera.rotation.order = 'YXZ';
    this._camera.rotation.y = p.yaw;
    this._camera.rotation.x = p.pitch;
    this._camera.rotation.z = 0;
  }

  // ───────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────

  /** Remove all DOM event listeners and exit pointer lock. */
  dispose() {
    this._canvas.removeEventListener('click', this._onCanvasClick);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup',   this._onMouseUp);

    if (document.pointerLockElement === this._canvas) {
      document.exitPointerLock();
    }
  }
}
