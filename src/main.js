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
import { eventBus } from './core/EventBus.js';

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
import { ProjectileRaycaster } from './infrastructure/three/ProjectileRaycaster.js';
import * as THREE from 'three';

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
const combatSystem   = new CombatSystem(player, eventBus);
const playerCtrl     = new PlayerController(player, inputHandler, combatSystem, eventBus);
const zombieSystem   = new ZombieSystem(player, combatSystem);
const projRaycaster  = new ProjectileRaycaster(sceneManager.scene, eventBus);

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

// Register PlayerController + FPS camera + ZombieSystem as game-loop systems
gameLoop.addSystem(playerCtrl);
gameLoop.addSystem(fpsCamera);
gameLoop.addSystem(zombieSystem);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Zombie → Three.js visual binding (Infrastructure)
// ─────────────────────────────────────────────────────────────────────────────
import { ZombieEvents } from './core/EventBus.js';

const zombieMeshes = new Map();

eventBus.on(ZombieEvents.SPAWNED, (z) => {
  const geo = new THREE.BoxGeometry(1.2, 2.5, 1.2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x448833, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  // Store zombie id so the raycaster can find it
  mesh.userData.zombieId = z.id;
  mesh.position.set(z.position.x, 2.5 / 2, z.position.z);
  sceneManager.add(mesh);
  zombieMeshes.set(z.id, mesh);
});

eventBus.on(ZombieEvents.MOVED, (z) => {
  const mesh = zombieMeshes.get(z.id);
  if (mesh) {
    mesh.position.set(z.position.x, 2.5 / 2, z.position.z);
  }
});

eventBus.on(ZombieEvents.DAMAGED, (z) => {
  const mesh = zombieMeshes.get(z.id);
  if (mesh) {
    mesh.material.emissive.setHex(0x550000);
    setTimeout(() => { if (mesh) mesh.material.emissive.setHex(0x000000); }, 150);
  }
});

eventBus.on(ZombieEvents.DIED, (z) => {
  const mesh = zombieMeshes.get(z.id);
  if (mesh) {
    sceneManager.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    zombieMeshes.delete(z.id);
  }
});

// Note: Removed legacy Agent logic rendering block.

// ─────────────────────────────────────────────────────────────────────────────
// 4. Generate level
// ─────────────────────────────────────────────────────────────────────────────
levelManager.generateLevel();

// Spawn a few sample zombies around the maze
const cs = 4;
zombieSystem.spawn('zom-1', cs * 1.5, cs * 1.5);
zombieSystem.spawn('zom-2', cs * 3.5, cs * 2.5);
zombieSystem.spawn('zom-3', cs * 2.5, cs * 6.5);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Start render loop
// ─────────────────────────────────────────────────────────────────────────────
const renderLoop = new RenderLoop(sceneManager, gameLoop);
renderLoop.start();

// ─────────────────────────────────────────────────────────────────────────────
// 6. Presentation layer
// ─────────────────────────────────────────────────────────────────────────────
new HUD();
new PlayerHUD();   // Health / Ammo / Lives / Crosshair
// InputHandler already created in step 2c above

if (Settings.DEBUG) {
  console.log('🟢 Three.js Clean Architecture – DEBUG mode active.');
  window._debug = { gameLoop, levelManager, mazeRenderer, player, combatSystem, playerCtrl, zombieSystem, projRaycaster, sceneManager, eventBus };
}
