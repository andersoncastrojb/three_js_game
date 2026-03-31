/**
 * @file SkillAdapter.js
 * @layer Infrastructure / Skills
 * @description Foundational interface (abstract base) for AI skill adapters.
 *
 * ARCHITECTURE CONTRACT
 * ─────────────────────
 * AI agents (from skills.sh or agentskills.io) are invoked through
 * concrete implementations of this adapter. Results are passed back into
 * the domain via AgentBehavior.applySkillResult(), which in turn fires
 * events consumed by the Three.js presentation layer.
 *
 * FLOW:
 *   [External AI / Shell Skill]
 *       │  HTTP / spawn / WebSocket
 *       ▼
 *   SkillAdapter.invoke(payload)
 *       │  returns Promise<SkillResult>
 *       ▼
 *   AgentBehavior.applySkillResult(agentId, result)
 *       │  emits "agent:skillResult" via EventBus
 *       ▼
 *   Three.js objects update visually
 */

export class SkillAdapter {
  /**
   * @param {string} skillName  Human-readable name for the skill
   * @param {string} endpoint   URL or executable path
   */
  constructor(skillName, endpoint) {
    if (new.target === SkillAdapter) {
      throw new Error('SkillAdapter is abstract – extend it.');
    }
    this.skillName = skillName;
    this.endpoint  = endpoint;
  }

  /**
   * Invoke the skill with the given payload.
   * Concrete subclasses must override this.
   *
   * @param {object} payload  Arbitrary parameters for the skill
   * @returns {Promise<SkillResult>}
   */
  // eslint-disable-next-line no-unused-vars
  async invoke(payload) {
    throw new Error(`${this.skillName}.invoke() not implemented.`);
  }

  /**
   * Validate that a raw response from the skill can be used.
   * Override in subclasses for stricter checks.
   * @param {*} raw
   * @returns {boolean}
   */
  validate(raw) {
    return raw !== null && raw !== undefined;
  }
}

/**
 * @typedef {object} SkillResult
 * @property {boolean} success
 * @property {*}       data     Skill-specific result payload
 * @property {string}  [error]  Error message if !success
 * @property {string}  skillName
 * @property {number}  timestamp
 */
