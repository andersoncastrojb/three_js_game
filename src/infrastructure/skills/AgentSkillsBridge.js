/**
 * @file AgentSkillsBridge.js
 * @layer Infrastructure / Skills
 * @description Concrete adapter implementations for external AI skill platforms.
 * All configuration is loaded from environment variables (CLAUDE.md Rule 4).
 * All responses are validated before reaching the domain (CLAUDE.md Rule 2).
 * Errors are always caught and logged — never silently swallowed (CLAUDE.md Rule 2).
 *
 * Two adapters provided:
 *   1. HttpSkillAdapter  — REST POST to agentskills.io
 *   2. ShellSkillAdapter — CLI stub (swap child_process in Node/Electron)
 */

import { SkillAdapter } from './SkillAdapter.js';
import { SkillResultValidator, ValidationError } from './SkillResultValidator.js';

// ── Environment-driven config (Rule 4) ────────────────────────────────────────
const BASE_URL   = import.meta.env.VITE_AGENTSKILLS_BASE_URL ?? 'https://api.agentskills.io/v1';
const API_KEY    = import.meta.env.VITE_AI_PROVIDER_KEY      ?? '';
const SKILLS_SH  = import.meta.env.VITE_SKILLS_SH_PATH       ?? './skills/run-skill.sh';

// ──────────────────────────────────────────────────────────────────────────────
// 1. HTTP / REST adapter (agentskills.io)
// ──────────────────────────────────────────────────────────────────────────────
export class HttpSkillAdapter extends SkillAdapter {
  /**
   * @param {string} skillName
   * @param {string} [endpoint]       Full REST URL. Defaults to BASE_URL.
   * @param {RequestInit} [fetchOptions]
   */
  constructor(skillName, endpoint = BASE_URL, fetchOptions = {}) {
    super(skillName, endpoint);
    this.fetchOptions = fetchOptions;
  }

  /**
   * POST payload to the skill endpoint and return a validated SkillResult.
   * Explicit try/catch per CLAUDE.md Rule 2 — never breaks the render loop.
   *
   * @param {object} payload
   * @returns {Promise<import('./SkillAdapter.js').SkillResult>}
   */
  async invoke(payload) {
    try {
      if (!API_KEY) {
        throw new Error(
          'VITE_AI_PROVIDER_KEY is not set. Add it to your .env file (see .env.example).'
        );
      }

      const response = await fetch(this.endpoint, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          ...this.fetchOptions.headers,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000), // 10 s hard timeout
        ...this.fetchOptions,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const raw = await response.json();

      // ── Validate before injecting into domain state ────────────────────────
      const result = {
        success:   true,
        data:      raw,
        skillName: this.skillName,
        timestamp: Date.now(),
      };
      return SkillResultValidator.validate(result);

    } catch (err) {
      // ── Explicit error handling — not silent (Rule 2) ──────────────────────
      if (err instanceof ValidationError) {
        console.error(`[HttpSkillAdapter:${this.skillName}] Validation failed:`, err.message, err.received);
      } else {
        console.error(`[HttpSkillAdapter:${this.skillName}] Network/API error:`, err.message);
      }

      // Return a safe fallback result so the caller can handle gracefully
      return {
        success:   false,
        data:      null,
        error:     err.message,
        skillName: this.skillName,
        timestamp: Date.now(),
      };
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Shell / CLI adapter (skills.sh) — stub for browser, real in Node/Electron
// ──────────────────────────────────────────────────────────────────────────────
export class ShellSkillAdapter extends SkillAdapter {
  /**
   * @param {string} skillName
   * @param {string} [scriptPath]  Defaults to VITE_SKILLS_SH_PATH env var.
   */
  constructor(skillName, scriptPath = SKILLS_SH) {
    super(skillName, scriptPath);
  }

  /**
   * Simulate shell invocation. In Node/Electron, replace with child_process.spawn.
   * @param {object} payload
   * @returns {Promise<import('./SkillAdapter.js').SkillResult>}
   */
  async invoke(payload) {
    try {
      console.info(`[ShellSkillAdapter] Would execute: ${this.endpoint}`, payload);

      // ── STUB — replace body below with child_process.spawn in Electron ──
      await new Promise((r) => setTimeout(r, 300));

      const result = {
        success:   true,
        data:      {
          output: `[Mock] Shell skill "${this.skillName}" executed. Args: ${JSON.stringify(payload)}`,
        },
        skillName: this.skillName,
        timestamp: Date.now(),
      };

      return SkillResultValidator.validate(result);

    } catch (err) {
      console.error(`[ShellSkillAdapter:${this.skillName}] Error:`, err.message);
      return {
        success:   false,
        data:      null,
        error:     err.message,
        skillName: this.skillName,
        timestamp: Date.now(),
      };
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Factory helper
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Create the appropriate adapter based on endpoint format.
 * @param {string} skillName
 * @param {string} endpoint
 * @returns {SkillAdapter}
 */
export function createSkillAdapter(skillName, endpoint) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return new HttpSkillAdapter(skillName, endpoint);
  }
  return new ShellSkillAdapter(skillName, endpoint);
}
