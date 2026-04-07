/**
 * @file main.js
 * @description Application bootstrap – wires all Clean Architecture layers together.
 *
 * Dependency direction (outer → inner, never reversed):
 *   Presentation → Use Cases → Core
 *   Infrastructure → Use Cases → Core
 *   Infrastructure never imports from Presentation, and vice versa.
 */

import './style.css';

// ── Config ───────────────────────────────────────────────────────────────────
import { Settings } from '@config/settings.js';

// ── Core ─────────────────────────────────────────────────────────────────────
import { eventBus, ZombieEvents, LevelEvents, PlayerEvents } from './core/EventBus.js';

// ── Use Cases ─────────────────────────────────────────────────────────────────
import { GameLoop }    from './use-cases/GameLoop.js';
import { AgentBehavior, AgentEvents } from './use-cases/AgentBehavior.js';
import { LevelManager }  from './use-cases/LevelManager.js';
import { CombatSystem }  from './use-cases/CombatSystem.js';
import { PlayerController } from './use-cases/PlayerController.js';
import { ZombieSystem }  from './use-cases/ZombieSystem.js';

// ── Infrastructure / Three.js ─────────────────────────────────────────────────
import { SceneManager }      from './infrastructure/three/SceneManager.js';
import { RenderLoop }        from './infrastructure/three/RenderLoop.js';
import { createLighting }    from './infrastructure/three/LightingSetup.js';
import { MazeRenderer }      from './infrastructure/three/MazeRenderer.js';
import { FirstPersonCamera } from './infrastructure/three/FirstPersonCamera.js';
import { CombatRenderer }    from './infrastructure/three/CombatRenderer.js';
import * as THREE from 'three';

// ── Infrastructure / AI ───────────────────────────────────────────────────────
import { AIModelFactory } from './infrastructure/ai/ModelFactory.js';
import { ContextLoader }  from './infrastructure/ai/ContextLoader.js';

// ── Infrastructure / Skills ───────────────────────────────────────────────────
import { createSkillAdapter } from './infrastructure/skills/AgentSkillsBridge.js';

// ── Presentation ──────────────────────────────────────────────────────────────
import { HUD }       from './presentation/HUD.js';
import { PlayerHUD } from './presentation/PlayerHUD.js';
import { InputHandler, InputEvents } from './presentation/InputHandler.js';

// ── Core Entities ─────────────────────────────────────────────────────────────
import { Player } from './core/entities/Player.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Initialise core use-cases
// ─────────────────────────────────────────────────────────────────────────────
const gameLoop      = new GameLoop();
const agentBehavior = new AgentBehavior();
const levelManager  = new LevelManager();

// ── Player ────────────────────────────────────────────────────────────────────
const player        = new Player('player-1');

// ─────────────────────────────────────────────────────────────────────────────
// 2. Initialise Three.js infrastructure
// ─────────────────────────────────────────────────────────────────────────────
const canvas = document.getElementById(Settings.CANVAS_ID);
const sceneManager = new SceneManager(canvas);

// Lighting
sceneManager.add(createLighting());

// ─────────────────────────────────────────────────────────────────────────────
// 2b. Maze renderer — subscribes to level:generated on the EventBus
// ─────────────────────────────────────────────────────────────────────────────
const mazeRenderer = new MazeRenderer(sceneManager.scene, eventBus, {
  cellSize:    4,
  wallHeight:  3,
  showCeiling: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// 2c. Player systems: CombatSystem → PlayerController → FirstPersonCamera
// ─────────────────────────────────────────────────────────────────────────────
const inputHandler   = new InputHandler();
const zombieRegistry = new Map();

const combatSystem   = new CombatSystem({ zombieRegistry });
const playerCtrl     = new PlayerController(player, inputHandler, combatSystem, eventBus);

const zombieSystem   = new ZombieSystem({ 
  zombieRegistry, 
  player, 
  modelFactory: AIModelFactory, 
  contextLoader: ContextLoader 
});

// Infrastructure Combat Renderer
const combatRenderer = new CombatRenderer(sceneManager.scene, sceneManager.camera);

// Spawn the player at the maze entrance (cell 0,0 → world centre of that cell)
const CELL_SIZE  = 4;
const SPAWN_X    = CELL_SIZE / 2;   // centre of entrance cell
const SPAWN_Z    = CELL_SIZE / 2;
player.setPosition(SPAWN_X, 0, SPAWN_Z);

// Hand the camera to the FirstPersonCamera infrastructure adapter
const fpsCamera = new FirstPersonCamera(
  sceneManager.camera,
  playerCtrl,
  player,
  eventBus,
  canvas
);

// Register systems as game-loop systems
gameLoop.addSystem(playerCtrl);
gameLoop.addSystem(fpsCamera);
gameLoop.addSystem(combatSystem);
gameLoop.addSystem(zombieSystem);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Zombie → Three.js visual binding (Infrastructure)
// ─────────────────────────────────────────────────────────────────────────────

const zombieMeshes = new Map();

// Create shared materials
const skinMat = new THREE.MeshStandardMaterial({ color: 0x5a7a40, roughness: 0.9 });
const shirtMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.9 });
const pantsMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.9 });
const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const torsoGeo = new THREE.BoxGeometry(0.8, 1.0, 0.4);
const armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
const legGeo = new THREE.BoxGeometry(0.35, 0.9, 0.35);

// Scan markers for zombies
const zMarkerGeo = new THREE.SphereGeometry(0.5, 8, 8);
const zMarkerMat = new THREE.MeshBasicMaterial({ 
  color: 0xff0000, 
  depthTest: false, 
  transparent: true, 
  opacity: 0.8 
});

eventBus.on(ZombieEvents.SPAWNED, (z) => {
  const group = new THREE.Group();
  
  const zSkin = skinMat.clone();
  const zShirt = shirtMat.clone();
  const zPants = pantsMat.clone();
  
  // Humanoid parts
  const head = new THREE.Mesh(headGeo, zSkin); head.position.y = 2.2; group.add(head);
  const torso = new THREE.Mesh(torsoGeo, zShirt); torso.position.y = 1.4; group.add(torso);
  const leftArm = new THREE.Mesh(armGeo, zSkin); leftArm.position.set(-0.55, 1.6, -0.3); leftArm.rotation.x = -Math.PI / 2; group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, zSkin); rightArm.position.set(0.55, 1.6, -0.3); rightArm.rotation.x = -Math.PI / 2; group.add(rightArm);
  const leftLeg = new THREE.Mesh(legGeo, zPants); leftLeg.position.set(-0.22, 0.45, 0); group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, zPants); rightLeg.position.set(0.22, 0.45, 0); group.add(rightLeg);

  // ADD SCAN MARKER (Hovering Red Dot)
  const marker = new THREE.Mesh(zMarkerGeo, zMarkerMat);
  marker.position.y = 4.5; // Hover above zombie
  marker.name = 'scanMarker';
  marker.visible = false; // Hidden by default
  marker.renderOrder = 999;
  group.add(marker);

  group.userData.zombieId = z.id;
  group.position.set(z.position.x, 0, z.position.z);
  sceneManager.add(group);
  zombieMeshes.set(z.id, group);
});

// Toggle markers on scan
eventBus.on(PlayerEvents.SCAN_CHANGED, (p) => {
  for (const group of zombieMeshes.values()) {
    const marker = group.getObjectByName('scanMarker');
    if (marker) marker.visible = p.isScanning;
  }
});

eventBus.on(ZombieEvents.MOVED, (z) => {
  const group = zombieMeshes.get(z.zombieId);
  if (group) {
    group.position.set(z.position.x, 0, z.position.z);
    if (z.rotation) {
      group.rotation.y = z.rotation.y;
    }
  }
});

eventBus.on(ZombieEvents.DAMAGED, (z) => {
  const group = zombieMeshes.get(z.zombieId);
  if (group) {
    // Flash all children
    group.children.forEach(child => {
       if (child.material && child.material.emissive) {
          child.material.emissive.setHex(0x550000);
       }
    });
    setTimeout(() => {
       if (group) {
         group.children.forEach(child => {
            if (child.material && child.material.emissive) {
               child.material.emissive.setHex(0x000000);
            }
         });
       }
    }, 150);
  }
});

eventBus.on(ZombieEvents.DIED, (z) => {
  const group = zombieMeshes.get(z.zombieId);
  if (group) {
    sceneManager.remove(group);
    group.children.forEach(child => {
      // Dispose the CLONED materials for this specific zombie
      if (child.material) child.material.dispose();
    });
    zombieMeshes.delete(z.zombieId);
  }
});

// Note: Removed legacy Agent logic rendering block.

// ─────────────────────────────────────────────────────────────────────────────
// 4. Generate level
// ─────────────────────────────────────────────────────────────────────────────
levelManager.generateLevel();

// ─────────────────────────────────────────────────────────────────────────────
// 5. Start render loop and manage pause state
// ─────────────────────────────────────────────────────────────────────────────
const renderLoop = new RenderLoop(sceneManager, gameLoop);
renderLoop.start();

// Pause game logic when pointer lock is lost
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    if (!gameLoop.isRunning) gameLoop.start();
  } else {
    if (gameLoop.isRunning) {
      playerCtrl.cancelScan(); // Force cancel scan on pause
      gameLoop.stop();
    }
  }
});

// Restart level handling
eventBus.on('game:restartLevel', () => {
  levelManager.restartCurrentLevel();
});

// Next level handling
eventBus.on('game:nextLevel', () => {
  levelManager.nextLevel();
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Presentation & Audio layer
// ─────────────────────────────────────────────────────────────────────────────
import { SoundManager } from './infrastructure/audio/SoundManager.js';

new HUD();
new PlayerHUD();   // Health / Ammo / Lives / Crosshair
new SoundManager(); // Audio system
// InputHandler already created in step 2c above

if (Settings.DEBUG) {
  console.log('🟢 Three.js Clean Architecture – DEBUG mode active.');
  window._debug = { gameLoop, levelManager, mazeRenderer, player, combatSystem, playerCtrl, zombieSystem, combatRenderer, sceneManager, eventBus };
}
