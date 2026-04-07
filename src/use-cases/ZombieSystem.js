/**
 * @file ZombieSystem.js
 * @layer Use Cases
 * @description Manages Zombie AI behavior, perception, and state transitions via LLM.
 */

import { Zombie } from '../core/entities/Zombie.js';
import { eventBus, ZombieEvents, LevelEvents } from '../core/EventBus.js';
import { Vector3Utils } from '../core/math/Vector3Utils.js';
import { AStar } from '../core/math/AStar.js';

/** @typedef {import('../core/entities/Zombie').Zombie} Zombie */
/** @typedef {import('../core/entities/GameEntity').GameEntity} GameEntity */

export class ZombieSystem {
  /**
   * @param {Object} deps
   * @param {Map<string, Zombie>} deps.zombieRegistry - Reference to active zombies.
   * @param {GameEntity}          deps.player         - Reference to the player entity.
   * @param {any}                 deps.modelFactory   - AI Model Factory (Infrastructure).
   * @param {any}                 deps.contextLoader  - AI Context Loader (Infrastructure).
   */
  constructor({ zombieRegistry, player, modelFactory, contextLoader }) {
    this.zombies = zombieRegistry;
    this.player = player;
    this.modelFactory = modelFactory;
    this.contextLoader = contextLoader;
    
    /** @type {number} Frames between AI updates to save tokens/performance */
    this.updateInterval = 60; 
    this._frameCount = 0;

    /** @type {number[][]} The maze grid for pathfinding */
    this._grid = null;
    this._cellSize = 4; // Should match maze cell size

    /** @type {Map<string, {col: number, row: number}[]>} Map of zombie ID to their current calculated path */
    this._paths = new Map();

    eventBus.on(LevelEvents.GENERATED, (payload) => {
      this._grid = payload.grid;
      this._paths.clear(); // Reset paths on new level
      this._resetRegistry();
      this._spawnInitialZombies(payload.zombieCount, payload.entrance);
    });
  }

  /** @private */
  _resetRegistry() {
    // Mark all existing zombies as inactive so the renderer removes them
    for (const zombie of this.zombies.values()) {
      zombie.active = false;
      eventBus.emit(ZombieEvents.DIED, { zombieId: zombie.id });
    }
    this.projectiles = new Set(); // Reset projectiles logic? No, CombatSystem handles that.
    this.zombies.clear();
  }

  /**
   * @private
   * @param {number} count 
   * @param {Object} entrance 
   */
  _spawnInitialZombies(count, entrance) {
    if (!this._grid) return;
    const rows = this._grid.length;
    const cols = this._grid[0].length;

    for (let i = 0; i < count; i++) {
      // Find a random cell that isn't the entrance
      let r, c;
      do {
        r = Math.floor(Math.random() * rows);
        c = Math.floor(Math.random() * cols);
      } while (r === entrance.row && c === entrance.col);

      const worldPos = this._gridToWorld(c, r);
      this.spawn(`zom-${Date.now()}-${i}`, worldPos.x, worldPos.z);
    }
  }

  /**
   * Spawn a new zombie in the registry.
   * @param {string} id 
   * @param {number} x 
   * @param {number} z 
   * @param {Object} [stats]
   */
  spawn(id, x, z, stats = { health: 100, speed: 2 }) {
    const zombie = new Zombie(id, stats);
    zombie.setPosition(x, 1.25, z); // 1.25 is half height for default box
    this.zombies.set(id, zombie);
    eventBus.emit(ZombieEvents.SPAWNED, zombie);
    return zombie;
  }

  /**
   * System tick called by GameLoop.
   * @param {number} deltaTime 
   */
  async update(deltaTime) {
    this._frameCount++;
    
    // Only update AI every N frames
    if (this._frameCount % this.updateInterval === 0) {
      const activeZombies = Array.from(this.zombies.values()).filter(z => z.active);
      
      // Process zombies sequentially to avoid overwhelming the API
      for (const zombie of activeZombies) {
        await this._processZombieAI(zombie);
      }
    }

    // Every frame movement logic based on current state
    this._updateMovement(deltaTime);
  }

  /**
   * @private
   * @param {Zombie} zombie 
   */
  async _processZombieAI(zombie) {
    try {
      const distance = Vector3Utils.distance(zombie.position, this.player.position);
      
      // 1. Build perception string
      const perception = `dist:${distance.toFixed(2)}, hp:${zombie.health}, state:${zombie.aiState}`;
      
      // 2. Load Context (Skills + Knowledge)
      // Note: In a real implementation, we might cache this context
      const fullContext = this.contextLoader.loadFullContext('zombie-behavior');
      
      // 3. Get Model Adapter via Factory
      const aiProvider = 'gemini'; // This would ideally come from config
      const adapter = this.modelFactory.create(aiProvider);
      
      // 4. Perform Inference
      // We pass the perception as the user input
      const result = await adapter.complete(fullContext, perception);
      
      // 5. Parse and apply state
      // Strip potential markdown backticks from LLM output
      const cleanJson = result.response.replace(/```json\n?|```\n?/gi, '').trim();
      const decision = JSON.parse(cleanJson);
      
      if (decision && decision.state) {
        const oldState = zombie.aiState;
        zombie.setAIState(decision.state);
        
        if (oldState !== zombie.aiState) {
          eventBus.emit(ZombieEvents.STATE_CHANGED, {
            zombieId: zombie.id,
            oldState,
            newState: zombie.aiState,
            thought: decision.thought
          });
          
          // Clear path when state changes to force recalculation
          this._paths.delete(zombie.id);
        }
      }
    } catch (error) {
      console.error(`[ZombieSystem] Error updating AI for zombie ${zombie.id}:`, error);
      // Fallback behavior if AI fails
      zombie.setAIState('idle');
    }
  }

  /**
   * Helper to convert world position to grid cell.
   * @private
   */
  _worldToGrid(pos) {
    return {
      col: Math.floor(pos.x / this._cellSize),
      row: Math.floor(pos.z / this._cellSize)
    };
  }

  /**
   * Helper to convert grid cell to world center position.
   * @private
   */
  _gridToWorld(col, row) {
    return {
      x: col * this._cellSize + (this._cellSize / 2),
      z: row * this._cellSize + (this._cellSize / 2)
    };
  }

  /**
   * Helper to calculate 2D distance on XZ plane.
   * @private
   */
  _distance2D(p1, p2) {
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Move zombies based on their current AI state.
   * @private
   * @param {number} deltaTime 
   */
  _updateMovement(deltaTime) {
    const now = Date.now();
    if (!this._grid) return; // Cannot pathfind without a grid

    const playerGridPos = this._worldToGrid(this.player.position);
    const STOP_DISTANCE = 0.8; // Closer stop distance

    for (const zombie of this.zombies.values()) {
      if (!zombie.active) continue;

      // Use 2D distance for all movement/attack logic to ignore height differences
      const distance2D = this._distance2D(zombie.position, this.player.position);

      // Groan logic (Ambient sounds when close)
      if (distance2D < 15 && now - (zombie.lastGroanTime || 0) > 3000) {
        if (Math.random() < 0.02) { // Small chance per frame to groan
           zombie.lastGroanTime = now;
           eventBus.emit(ZombieEvents.GROAN, { zombieId: zombie.id, distance: distance2D });
        }
      }

      // Proximity override: If zombie is very close, force attack state
      if (distance2D < zombie.attackRange && zombie.aiState !== 'flee') {
        if (zombie.aiState !== 'attack') {
          zombie.setAIState('attack');
          eventBus.emit(ZombieEvents.STATE_CHANGED, {
            zombieId: zombie.id,
            oldState: 'n/a',
            newState: 'attack',
            thought: 'Too close to ignore!'
          });
        }
      }

      // Chase logic: move if in chase, OR if attacking but slightly out of range
      if (zombie.aiState === 'chase' || (zombie.aiState === 'attack' && distance2D > zombie.attackRange * 0.8)) {
        
        // Prevent walking completely through the player
        if (distance2D > STOP_DISTANCE) {
          // --- PATHFINDING ---
          let currentPath = this._paths.get(zombie.id);
          const zombieGridPos = this._worldToGrid(zombie.position);

          // Calculate path if missing, or if we reached the end of it
          if (!currentPath || currentPath.length === 0) {
             currentPath = AStar.findPath(this._grid, zombieGridPos, playerGridPos);
             this._paths.set(zombie.id, currentPath);
          }

          let direction = { x: 0, y: 0, z: 0 };

          if (currentPath && currentPath.length > 0) {
            const nextCell = currentPath[0];
            const targetWorldPos = this._gridToWorld(nextCell.col, nextCell.row);
            targetWorldPos.y = zombie.position.y;

            const distToNode = this._distance2D(zombie.position, targetWorldPos);
            
            if (distToNode < 0.2) {
               currentPath.shift();
            } else {
               direction = Vector3Utils.normalize(
                 Vector3Utils.subtract(targetWorldPos, zombie.position)
               );
               const moveStep = Vector3Utils.scale(direction, zombie.speed * deltaTime);
               const newPos = Vector3Utils.add(zombie.position, moveStep);
               zombie.setPosition(newPos.x, newPos.y, newPos.z);
            }
          } else {
            // Fallback (same cell or pathfinding failed)
            if (distance2D < this._cellSize) {
               direction = Vector3Utils.normalize(
                 Vector3Utils.subtract(this.player.position, zombie.position)
               );
               const moveStep = Vector3Utils.scale(direction, zombie.speed * deltaTime);
               const newPos = Vector3Utils.add(zombie.position, moveStep);
               zombie.setPosition(newPos.x, newPos.y, newPos.z);
            }
          }

          // Update rotation to face movement direction
          if (direction.x !== 0 || direction.z !== 0) {
             zombie.rotation.y = Math.atan2(direction.x, direction.z) + Math.PI;
          }
          
          eventBus.emit(ZombieEvents.MOVED, {
             zombieId: zombie.id,
             position: zombie.position,
             rotation: zombie.rotation
          });
        }
      }

      // Attack logic
      if (zombie.aiState === 'attack' && distance2D <= zombie.attackRange) {
        // Face player while attacking
        const dirToPlayer = Vector3Utils.subtract(this.player.position, zombie.position);
        zombie.rotation.y = Math.atan2(dirToPlayer.x, dirToPlayer.z) + Math.PI;
        
        eventBus.emit(ZombieEvents.MOVED, {
           zombieId: zombie.id,
           position: zombie.position,
           rotation: zombie.rotation
        });

        if (now - zombie.lastAttackTime >= zombie.attackCooldown) {
          zombie.lastAttackTime = now;
          eventBus.emit(ZombieEvents.ATTACK, { 
            zombieId: zombie.id, 
            damage: zombie.damage 
          });
        }
      }
      
      // Flee logic
      if (zombie.aiState === 'flee') {
        const direction = Vector3Utils.normalize(
          Vector3Utils.subtract(zombie.position, this.player.position)
        );
        const moveStep = Vector3Utils.scale(direction, zombie.speed * deltaTime);
        const newPos = Vector3Utils.add(zombie.position, moveStep);
        zombie.setPosition(newPos.x, newPos.y, newPos.z);
        
        if (direction.x !== 0 || direction.z !== 0) {
           zombie.rotation.y = Math.atan2(direction.x, direction.z) + Math.PI;
        }

        eventBus.emit(ZombieEvents.MOVED, { 
          zombieId: zombie.id, 
          position: zombie.position,
          rotation: zombie.rotation
        });
      }
    }
  }
}
