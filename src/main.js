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
import { GameLoop }      from './use-cases/GameLoop.js';
import { AgentBehavior, AgentEvents } from './use-cases/AgentBehavior.js';

// ── Infrastructure / Three.js ─────────────────────────────────────────────────
import { SceneManager }    from './infrastructure/three/SceneManager.js';
import { RenderLoop }      from './infrastructure/three/RenderLoop.js';
import { createLighting }  from './infrastructure/three/LightingSetup.js';
import * as THREE          from 'three';

// ── Infrastructure / Skills ───────────────────────────────────────────────────
import { createSkillAdapter } from './infrastructure/skills/AgentSkillsBridge.js';

// ── Presentation ──────────────────────────────────────────────────────────────
import { HUD }          from './presentation/HUD.js';
import { InputHandler, InputEvents } from './presentation/InputHandler.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Initialise core use-cases
// ─────────────────────────────────────────────────────────────────────────────
const gameLoop      = new GameLoop();
const agentBehavior = new AgentBehavior();

// ─────────────────────────────────────────────────────────────────────────────
// 2. Initialise Three.js infrastructure
// ─────────────────────────────────────────────────────────────────────────────
const canvas       = document.getElementById(Settings.CANVAS_ID);
const sceneManager = new SceneManager(canvas);

// Lighting
sceneManager.add(createLighting());

// Grid floor
const gridHelper = new THREE.GridHelper(30, 30, 0x223355, 0x112233);
sceneManager.add(gridHelper);

// Central reference icosahedron (placeholder until real assets load)
const coreGeo  = new THREE.IcosahedronGeometry(1, 2);
const coreMat  = new THREE.MeshStandardMaterial({
  color: 0x00ddff,
  emissive: 0x003344,
  roughness: 0.3,
  metalness: 0.8,
});
const coreMesh = new THREE.Mesh(coreGeo, coreMat);
coreMesh.castShadow = true;
coreMesh.position.set(0, 1, 0);
sceneManager.add(coreMesh);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Agent → Three.js visual binding (Infrastructure listens to domain events)
// ─────────────────────────────────────────────────────────────────────────────
const agentMeshes = new Map();

eventBus.on(AgentEvents.SPAWNED, (agentData) => {
  const geo  = new THREE.SphereGeometry(0.35, 16, 16);
  const mat  = new THREE.MeshStandardMaterial({ color: 0xff6633, emissive: 0x331100, roughness: 0.5 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.position.set(agentData.position.x, agentData.position.y + 0.35, agentData.position.z);
  sceneManager.add(mesh);
  agentMeshes.set(agentData.id, mesh);
});

eventBus.on(AgentEvents.MOVED, (agentData) => {
  const mesh = agentMeshes.get(agentData.id);
  if (mesh) {
    mesh.position.set(agentData.position.x, agentData.position.y + 0.35, agentData.position.z);
  }
});

eventBus.on(AgentEvents.DISMISSED, (agentData) => {
  const mesh = agentMeshes.get(agentData.id);
  if (mesh) {
    sceneManager.remove(mesh);
    agentMeshes.delete(agentData.id);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Domain system: rotate core mesh each tick
// ─────────────────────────────────────────────────────────────────────────────
gameLoop.addSystem({
  update(delta) {
    coreMesh.rotation.y += delta * 0.4;
    coreMesh.rotation.x += delta * 0.15;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Start render loop
// ─────────────────────────────────────────────────────────────────────────────
const renderLoop = new RenderLoop(sceneManager, gameLoop);
renderLoop.start();

// ─────────────────────────────────────────────────────────────────────────────
// 6. Presentation layer
// ─────────────────────────────────────────────────────────────────────────────
new HUD();
new InputHandler();

// ─────────────────────────────────────────────────────────────────────────────
// 7. Demo: spawn an agent and invoke a stub skill on SPACE key
// ─────────────────────────────────────────────────────────────────────────────
const demoAgent    = agentBehavior.spawn('agent-demo', { x: 3, y: 0, z: 3 });
const skillAdapter = createSkillAdapter('DemoShellSkill', Settings.SKILLS_SH_PATH);

eventBus.on(InputEvents.KEY_DOWN, async ({ code }) => {
  if (code === 'Space') {
    // ── Explicit try/catch — the render loop must never break (CLAUDE.md Rule 2) ──
    try {
      console.log('[Demo] Invoking skill adapter…');
      const result = await skillAdapter.invoke({ agentId: demoAgent.id, action: 'ping' });
      agentBehavior.applySkillResult(demoAgent.id, result);
    } catch (error) {
      console.error('[AI Skill Error] Skill invocation failed:', error.message);
      // Fallback: mark agent with error state without crashing the scene
      agentBehavior.applySkillResult(demoAgent.id, {
        success: false, data: null, error: error.message,
        skillName: 'DemoShellSkill', timestamp: Date.now(),
      });
    }
  }
});

if (Settings.DEBUG) {
  console.log('🟢 Three.js Clean Architecture – DEBUG mode active.');
  window._debug = { gameLoop, agentBehavior, sceneManager, eventBus };
}
