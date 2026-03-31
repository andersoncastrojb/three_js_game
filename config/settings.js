/**
 * @file settings.js
 * @layer Config
 * @description Global configuration constants.
 * Import from any layer – this file has no external dependencies.
 */

export const Settings = Object.freeze({
  // Scene
  CANVAS_ID: 'app-canvas',
  FOG_DENSITY: 0.035,
  BACKGROUND_COLOR: 0x0d0d1a,

  // Camera
  CAMERA_FOV: 60,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 1000,
  CAMERA_POSITION: { x: 0, y: 6, z: 14 },

  // Physics / movement
  AGENT_DEFAULT_SPEED: 0.05,
  TICK_RATE_CAP: 60, // max domain ticks per second (informational)

  // Skills
  SKILL_TIMEOUT_MS: 10_000,
  AGENTSKILLS_BASE_URL: 'https://api.agentskills.io/v1',
  SKILLS_SH_PATH: './skills/run-skill.sh',

  // Debug
  DEBUG: import.meta.env.DEV,
});
