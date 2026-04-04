/**
 * @file ZombieSystem.js
 * @layer Use Cases
 * @description Manages AI states and movement for all zombies in the level.
 * Handles chasing the player, attacking, and checking line-of-sight/distance.
 *
 * Registered as a GameLoop system.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Core & Use-Case imports only. No Three.js.                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { eventBus, ZombieEvents } from '../core/EventBus.js';
import { Zombie } from '../core/entities/Zombie.js';
import { Vector3Utils } from '../core/math/Vector3Utils.js';

// Import Infrastructure for AI (Strictly following CLAUDE.md Pattern)
import { ContextLoader } from '../infrastructure/ai/ContextLoader.js';
import { AIModelFactory, AIProvider } from '../infrastructure/ai/ModelFactory.js';

const SIGHT_RANGE = 20;
const ATTACK_RANGE = 1.5;
const ATTACK_COOLDOWN = 1.0; // Seconds between attacks

export class ZombieSystem {
  /**
   * @param {import('../core/entities/Player.js').Player} player
   * @param {import('./CombatSystem.js').CombatSystem} combat
   */
  constructor(player, combat) {
    /** @type {import('../core/entities/Player.js').Player} */
    this._player = player;

    /** @type {import('./CombatSystem.js').CombatSystem} */
    this._combat = combat;

    /** @type {Map<string, Zombie>} */
    this._zombies = new Map();

    // Listen for Zombie death events to clean up
    this._unsubDied = eventBus.on(ZombieEvents.DIED, ({ id }) => {
      const z = this._zombies.get(id);
      if (z) z.state = 'dead';
    });
  }

  /**
   * Spawn a new zombie entity.
   * @param {string} id
   * @param {number} x
   * @param {number} z
   * @returns {Zombie}
   */
  spawn(id, x, z) {
    const zombie = new Zombie(id);
    zombie.setPosition(x, 0, z);
    this._zombies.set(id, zombie);
    
    // Register with combat system so it can take damage from bullets
    this._combat.registerZombie(id, zombie.maxHealth);
    
    eventBus.emit(ZombieEvents.SPAWNED, zombie.toSnapshot());
    return zombie;
  }

  /**
   * GameLoop tick interface. Updates AI logic for all zombies.
   * @param {number} delta
   */
  update(delta) {
    const playerPos = this._player.position;

    for (const [id, zombie] of this._zombies) {
      if (!zombie.isAlive) continue;

      const dist = Vector3Utils.distance(zombie.position, playerPos);

      // --- ASYNC LLM BRAIN (Decoupled, doesn't block 60FPS) ---
      zombie.lastThinkTime += delta;
      
      // Force an attack state if extremely close (reflex)
      if (dist <= ATTACK_RANGE && zombie.state !== 'attack') {
        zombie.state = 'attack';
      }

      if (zombie.lastThinkTime >= 3.0 && !zombie.isThinking) {
        zombie.lastThinkTime = 0;
        zombie.isThinking = true;

        // Token Optimization: Do not load full knowledge/lore for Zombies. 
        // We strictly load the minimal System Rules.
        const fullContext = ContextLoader.loadSkill('zombie-behavior');
        const adapter = AIModelFactory.create(AIProvider.GEMINI);
        const userInput = `My Health: ${zombie.health}. Player Distance: ${dist.toFixed(2)}`;

        // Fire and forget promise to not block the main render thread
        adapter.complete(fullContext, userInput).then(res => {
          zombie.isThinking = false;
          if (!zombie.isAlive) return;

          try {
            // Clean markdown blocks
            const clean = res.response.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(clean);
            if (data.state && ['idle', 'chase', 'attack', 'flee'].includes(data.state)) {
               // Only update if it makes sense to not override reflex reactions
               if (zombie.state !== 'attack' || dist > ATTACK_RANGE) {
                 zombie.state = data.state;
                 console.log(`[Zombie-AI] ${id} thought: "${data.thought}" -> Action: ${data.state}`);
               }
            }
          } catch (e) {
            console.error(`[Zombie-AI] Failed to parse JSON:`, res.response);
          }
        }).catch(err => {
          zombie.isThinking = false;
          console.error(`[Zombie-AI] LLM request failed`, err);
        });
      }

      // --- PHYSICAL STATE MACHINE ---
      switch (zombie.state) {
        case 'idle':
          // Wait quietly
          break;

        case 'chase':
          if (!this._player.isAlive) {
            zombie.state = 'idle';
          } else {
            // Move towards player
            const dir = Vector3Utils.normalize(Vector3Utils.subtract(playerPos, zombie.position));
            const step = zombie.speed * delta;
            
            zombie.setPosition(
              zombie.position.x + dir.x * step,
              zombie.position.y,
              zombie.position.z + dir.z * step
            );
            eventBus.emit(ZombieEvents.MOVED, zombie.toSnapshot());
          }
          break;

        case 'flee':
          // Move AWAY from player
          const escapeDir = Vector3Utils.normalize(Vector3Utils.subtract(zombie.position, playerPos));
          const runStep = (zombie.speed * 1.5) * delta;
          
          zombie.setPosition(
            zombie.position.x + escapeDir.x * runStep,
            zombie.position.y,
            zombie.position.z + escapeDir.z * runStep
          );
          eventBus.emit(ZombieEvents.MOVED, zombie.toSnapshot());
          break;

        case 'attack':
          if (!this._player.isAlive || dist > ATTACK_RANGE) {
            zombie.state = 'chase';
          } else {
            zombie.lastAttackTime += delta;
            if (zombie.lastAttackTime >= ATTACK_COOLDOWN) {
              zombie.lastAttackTime = 0;
              // Player takes damage natively! We emit an event instead of calling methods directly
              // to keep subsystems strictly isolated if possible, or we could call a method if passed.
              // In this case, we'll emit a domain COMBAT event to let PlayerController hurt the player.
              // Actually, PlayerController listens to Input but can also expose `applyDamage()` which main.js uses,
              // or EventBus broadcasts the damage intent. Let's fire a generic global event, or just mutate
              // player health here since we were injected the Player entity!
              
              const died = this._player.takeDamage(zombie.damage);
              eventBus.emit(ZombieEvents.ATTACKED, { zombieId: id, targetId: this._player.id, damage: zombie.damage });
              
              // We must manually trigger health changed here because Player doesn't emit its own events.
              // We rely on PlayerController's `_dispatchChangeEvents` catching this on the next tick!
            }
          }
          break;
      }
    }
  }

  dispose() {
    this._unsubDied();
  }
}
