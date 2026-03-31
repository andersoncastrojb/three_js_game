/**
 * @file SkillResultValidator.js
 * @layer Infrastructure / Skills
 * @description Manual validation for AI skill responses before they are
 * injected into game state. Follows CLAUDE.md Rule 2: strict input validation.
 *
 * In a larger project replace manual checks with a schema library (e.g. Zod).
 */

/**
 * Expected shape for a SkillResult returned by any SkillAdapter.
 * @typedef {object} SkillResult
 * @property {boolean} success
 * @property {*}       data
 * @property {string}  [error]
 * @property {string}  skillName
 * @property {number}  timestamp
 */

export class ValidationError extends Error {
  /**
   * @param {string} message
   * @param {*}      received - The raw value that failed validation
   */
  constructor(message, received) {
    super(message);
    this.name = 'ValidationError';
    this.received = received;
  }
}

export const SkillResultValidator = {
  /**
   * Validates the top-level shape of a SkillResult.
   * @param {*} raw
   * @returns {SkillResult}
   * @throws {ValidationError}
   */
  validate(raw) {
    if (raw === null || typeof raw !== 'object') {
      throw new ValidationError('SkillResult must be a non-null object.', raw);
    }
    if (typeof raw.success !== 'boolean') {
      throw new ValidationError('SkillResult.success must be boolean.', raw);
    }
    if (typeof raw.skillName !== 'string' || !raw.skillName) {
      throw new ValidationError('SkillResult.skillName must be a non-empty string.', raw);
    }
    if (typeof raw.timestamp !== 'number') {
      throw new ValidationError('SkillResult.timestamp must be a number.', raw);
    }
    return /** @type {SkillResult} */ (raw);
  },

  /**
   * Validates an agent action payload produced by an AI model.
   * @param {*} raw
   * @returns {{ action: string, targetPosition: {x:number,y:number,z:number}, speed: number }}
   * @throws {ValidationError}
   */
  validateAgentAction(raw) {
    const VALID_ACTIONS = ['move', 'idle', 'attack', 'retreat'];

    if (raw === null || typeof raw !== 'object') {
      throw new ValidationError('Agent action must be an object.', raw);
    }
    if (!VALID_ACTIONS.includes(raw.action)) {
      throw new ValidationError(
        `action must be one of: ${VALID_ACTIONS.join(', ')}.`,
        raw.action
      );
    }
    if (!SkillResultValidator._isVec3(raw.targetPosition)) {
      throw new ValidationError('targetPosition must be {x,y,z} with numbers.', raw.targetPosition);
    }
    if (typeof raw.speed !== 'number' || raw.speed <= 0 || raw.speed > 1) {
      throw new ValidationError('speed must be a number between 0.01 and 1.0.', raw.speed);
    }
    return raw;
  },

  /**
   * @param {*} v
   * @returns {boolean}
   * @private
   */
  _isVec3(v) {
    return (
      v !== null &&
      typeof v === 'object' &&
      typeof v.x === 'number' &&
      typeof v.y === 'number' &&
      typeof v.z === 'number'
    );
  },
};
