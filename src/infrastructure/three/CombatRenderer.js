/**
 * @file CombatRenderer.js
 * @layer Infrastructure / Three.js
 * @description Renders combat-related visuals: blood particles, gun models, and projectiles.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { eventBus, CombatEvents, ZombieEvents, PlayerEvents } from '../../core/EventBus.js';

export class CombatRenderer {
  /**
   * @param {THREE.Scene} scene 
   * @param {THREE.Camera} camera - Needed for gun attachment if we want it in view.
   */
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    
    /** @type {Map<string, THREE.Mesh>} */
    this.projectiles = new Map();
    
    /** @type {THREE.Group} */
    this.bloodParticles = new THREE.Group();
    this.scene.add(this.bloodParticles);
    
    this._loadGunModel();
    this._createPlayerMarker();
    this._setupListeners();
  }

  _setupListeners() {
    eventBus.on(CombatEvents.PROJECTILE_SPAWNED, (payload) => this._onProjectileSpawned(payload));
    eventBus.on(CombatEvents.PROJECTILE_MOVED, (payload) => this._onProjectileMoved(payload));
    eventBus.on(CombatEvents.PROJECTILE_DESTROYED, (payload) => this._onProjectileDestroyed(payload));
    eventBus.on(ZombieEvents.DAMAGED, (payload) => this._onZombieDamaged(payload));
    
    eventBus.on(PlayerEvents.MOVED, (payload) => this._onPlayerMoved(payload));
    eventBus.on(PlayerEvents.SCAN_CHANGED, (payload) => this._onPlayerScanChanged(payload));
  }

  /** @private */
  _createPlayerMarker() {
    this.playerMarker = new THREE.Group();
    // Remove depthTest: false to render naturally, preventing weird overlaps
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 }); 

    // Head (Cone)
    const headGeo = new THREE.ConeGeometry(0.8, 1.6, 16);
    headGeo.rotateX(-Math.PI / 2); // Point towards -Z
    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(0, 0, -0.8);

    // Shaft (Cylinder)
    const shaftGeo = new THREE.CylinderGeometry(0.3, 0.3, 2.0, 16);
    shaftGeo.rotateX(-Math.PI / 2); // Align along Z
    const shaft = new THREE.Mesh(shaftGeo, mat);
    shaft.position.set(0, 0, 1.0);

    this.playerMarker.add(head);
    this.playerMarker.add(shaft);
    
    this.playerMarker.visible = false; // Only visible during scan
    this.scene.add(this.playerMarker);
  }

  /**
   * @private
   * @param {import('../../core/entities/Player.js').PlayerSnapshot} payload 
   */
  _onPlayerMoved(payload) {
    if (this.playerMarker) {
      // Find the exact center of the current cell so the arrow never overlaps walls
      const cellSize = 4;
      const col = Math.floor(payload.position.x / cellSize);
      const row = Math.floor(payload.position.z / cellSize);
      const centerX = col * cellSize + (cellSize / 2);
      const centerZ = row * cellSize + (cellSize / 2);

      // Position marker safely above the maze walls (height is 3)
      this.playerMarker.position.set(centerX, 4.0, centerZ);
      // Group rotation just needs yaw directly
      this.playerMarker.rotation.y = payload.yaw;
    }
  }

  /**
   * @private
   * @param {import('../../core/entities/Player.js').PlayerSnapshot} payload 
   */
  _onPlayerScanChanged(payload) {
    if (this.playerMarker) {
      this.playerMarker.visible = payload.isScanning;
    }
  }

  /**
   * @private
   */
  _loadGunModel() {
    const loader = new GLTFLoader();
    // Path is speculative, should be adjusted based on actual asset location
    const modelPath = '/assets/models/gun.glb'; 
    
    loader.load(
      modelPath,
      (gltf) => {
        this.gunModel = gltf.scene;
        this.gunModel.scale.set(0.5, 0.5, 0.5);
        
        // Attach to camera for first-person view
        // Positioning it at the bottom right of the screen
        this.gunModel.position.set(0.5, -0.4, -0.8);
        this.gunModel.rotation.y = Math.PI;
        
        this.camera.add(this.gunModel);
        console.log('[CombatRenderer] Gun model loaded');
      },
      undefined,
      (error) => {
        console.warn('[CombatRenderer] Could not load gun model, using placeholder', error);
        this._createPlaceholderGun();
      }
    );
  }

  /** @private */
  _createPlaceholderGun() {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.4);
    const mat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    this.gunModel = new THREE.Mesh(geo, mat);
    this.gunModel.position.set(0.3, -0.3, -0.5);
    this.camera.add(this.gunModel);
  }

  /**
   * @private
   * @param {Object} payload 
   */
  _onProjectileSpawned({ projectileId, position, direction }) {
    const geo = new THREE.SphereGeometry(0.05, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const mesh = new THREE.Mesh(geo, mat);
    
    mesh.position.set(position.x, position.y, position.z);
    this.scene.add(mesh);
    this.projectiles.set(projectileId, mesh);
  }

  /**
   * @private
   * @param {Object} payload 
   */
  _onProjectileMoved({ projectileId, position }) {
    const mesh = this.projectiles.get(projectileId);
    if (mesh) {
      mesh.position.set(position.x, position.y, position.z);
    }
  }

  /**
   * @private
   * @param {Object} payload 
   */
  _onProjectileDestroyed({ projectileId }) {
    const mesh = this.projectiles.get(projectileId);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.projectiles.delete(projectileId);
    }
  }

  /**
   * @private
   * @param {Object} payload 
   */
  _onZombieDamaged({ position }) {
    this._spawnBloodSplatter(position);
  }

  /**
   * @private
   * @param {{x: number, y: number, z: number}} pos 
   */
  _spawnBloodSplatter(pos) {
    const count = 20;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      
      velocities.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 2
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xaa0000, size: 0.1 });
    const points = new THREE.Points(geo, mat);
    
    this.bloodParticles.add(points);

    // Simple animation for particles
    const startTime = Date.now();
    const duration = 500;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        this.bloodParticles.remove(points);
        geo.dispose();
        mat.dispose();
        return;
      }

      const posAttr = geo.attributes.position;
      for (let i = 0; i < count; i++) {
        posAttr.array[i * 3] += velocities[i].x * 0.05;
        posAttr.array[i * 3 + 1] += velocities[i].y * 0.05;
        posAttr.array[i * 3 + 2] += velocities[i].z * 0.05;
      }
      posAttr.needsUpdate = true;
      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Cleanup projectiles that are no longer active.
   * This should be called from the render loop or similar.
   */
  update() {
    // Logic to cleanup old projectile meshes could go here
    // or we could listen for a projectile:destroyed event.
  }
}
