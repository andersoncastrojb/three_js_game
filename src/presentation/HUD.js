/**
 * @file HUD.js
 * @layer Presentation
 * @description DOM overlay HUD. Subscribes to EventBus events and reflects
 * domain state changes in the UI. No Three.js dependency.
 */

import { eventBus, PlayerEvents } from '../core/EventBus.js';
import { AgentEvents } from '../use-cases/AgentBehavior.js';
import { GameLoopEvents } from '../use-cases/GameLoop.js';

export class HUD {
  /** @type {HTMLElement} */
  #root;

  constructor() {
    this.#root = this.#createRoot();
    document.body.appendChild(this.#root);
    this.#bindEvents();
  }

  #createRoot() {
    const el = document.createElement('div');
    el.id = 'hud';
    el.innerHTML = `
      <div class="hud-panel" id="hud-status">
        <span class="hud-label">STATUS</span>
        <span class="hud-value" id="hud-status-value">Initializing…</span>
      </div>
      <div class="hud-panel" id="hud-tick">
        <span class="hud-label">TICK</span>
        <span class="hud-value" id="hud-tick-value">0</span>
      </div>
      <div class="hud-panel" id="hud-agents">
        <span class="hud-label">AGENTS</span>
        <span class="hud-value" id="hud-agents-value">0</span>
      </div>
      <div class="hud-panel hud-skill" id="hud-skill" style="display:none;">
        <span class="hud-label">SKILL RESULT</span>
        <span class="hud-value" id="hud-skill-value">—</span>
      </div>
    `;
    return el;
  }

  #bindEvents() {
    eventBus.on(GameLoopEvents.START, () => {
      document.getElementById('hud-status-value').textContent = 'Running';
    });

    eventBus.on(GameLoopEvents.TICK, ({ tick }) => {
      document.getElementById('hud-tick-value').textContent = tick;
    });

    eventBus.on(AgentEvents.SPAWNED, () => {
      const el = document.getElementById('hud-agents-value');
      el.textContent = parseInt(el.textContent) + 1;
    });

    eventBus.on(AgentEvents.DISMISSED, () => {
      const el = document.getElementById('hud-agents-value');
      el.textContent = Math.max(0, parseInt(el.textContent) - 1);
    });

    eventBus.on(PlayerEvents.SCAN_CHANGED, ({ isScanning }) => {
      this.#root.style.display = isScanning ? 'none' : 'flex';
    });

    eventBus.on(AgentEvents.SKILL_RESULT, ({ skillResult }) => {
      const panel = document.getElementById('hud-skill');
      const val = document.getElementById('hud-skill-value');
      panel.style.display = 'flex';
      val.textContent = skillResult.success
        ? `✓ ${skillResult.skillName}`
        : `✗ ${skillResult.error}`;
      setTimeout(() => { panel.style.display = 'none'; }, 4000);
    });
  }

  dispose() {
    this.#root.remove();
  }
}
