/**
 * @file AgentBehavior.js
 * @layer Use Cases
 * @description Encapsulates AI agent behavioral logic.
 * Operates on core domain entities and emits events on state changes.
 * Must not reference Three.js. Output is reflected in the 3D scene via events.
 */

import { GameEntity } from '../core/entities/GameEntity.js';
import { Vector3Utils } from '../core/math/Vector3Utils.js';
import { eventBus } from '../core/EventBus.js';

export const AgentEvents = {
  SPAWNED:   'agent:spawned',
  MOVED:     'agent:moved',
  ACTIVATED: 'agent:activated',
  DISMISSED: 'agent:dismissed',
  SKILL_RESULT: 'agent:skillResult',
};

export class AgentBehavior {
  /** @type {Map<string, GameEntity>} */
  #agents = new Map();

  /**
   * Spawn a new agent entity at a given position.
   * @param {string} id
   * @param {{ x: number, y: number, z: number }} position
   * @returns {GameEntity}
   */
  spawn(id, position = { x: 0, y: 0, z: 0 }) {
    const agent = new GameEntity(id, 'agent');
    agent.setPosition(position.x, position.y, position.z);
    agent.setState({ velocity: Vector3Utils.zero(), health: 100 });
    this.#agents.set(id, agent);
    eventBus.emit(AgentEvents.SPAWNED, agent.toJSON());
    return agent;
  }

  /**
   * Move an agent towards a target position by step amount.
   * @param {string} id
   * @param {{ x: number, y: number, z: number }} target
   * @param {number} step
   */
  moveTo(id, target, step = 0.05) {
    const agent = this.#agents.get(id);
    if (!agent) return;

    const dir = Vector3Utils.normalize(
      Vector3Utils.subtract(target, agent.position)
    );
    const dist = Vector3Utils.distance(agent.position, target);
    const move = Math.min(step, dist);
    const next = Vector3Utils.add(agent.position, Vector3Utils.scale(dir, move));
    agent.setPosition(next.x, next.y, next.z);

    eventBus.emit(AgentEvents.MOVED, agent.toJSON());
  }

  /**
   * Apply the result of an external skill invocation to an agent.
   * Infrastructure layer calls this after receiving a skill response.
   * @param {string} id
   * @param {object} skillResult
   */
  applySkillResult(id, skillResult) {
    const agent = this.#agents.get(id);
    if (!agent) return;
    agent.setState({ lastSkillResult: skillResult });
    eventBus.emit(AgentEvents.SKILL_RESULT, { agent: agent.toJSON(), skillResult });
  }

  /** @returns {GameEntity | undefined} */
  get(id) {
    return this.#agents.get(id);
  }

  /** @returns {GameEntity[]} */
  all() {
    return Array.from(this.#agents.values());
  }

  dismiss(id) {
    const agent = this.#agents.get(id);
    if (agent) {
      agent.active = false;
      eventBus.emit(AgentEvents.DISMISSED, agent.toJSON());
      this.#agents.delete(id);
    }
  }
}
