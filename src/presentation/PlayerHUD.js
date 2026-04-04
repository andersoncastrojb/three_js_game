/**
 * @file PlayerHUD.js
 * @layer Presentation
 * @description DOM overlay that shows the player's health bar, lives, ammo
 * counter, crosshair, reload indicator, and damage flash feedback.
 *
 * Subscribes to PlayerEvents on the EventBus. 
 * Never imports Three.js or use-case classes directly.
 *
 * ╔═════════════════════════════════════════════════════════╗
 * ║  Presentation only: DOM + EventBus subscriptions.      ║
 * ╚═════════════════════════════════════════════════════════╝
 */

import { eventBus, PlayerEvents, CombatEvents } from '../core/EventBus.js';
import { CombatSystemEvents } from '../use-cases/CombatSystem.js';

export class PlayerHUD {
  /** @type {HTMLElement} */
  #root;

  /** @type {Array<() => void>} EventBus unsubscribe callbacks */
  #unsubs = [];

  constructor() {
    this.#root = this.#buildDOM();
    document.body.appendChild(this.#root);
    this.#bindEvents();
  }

  // ─────────────────────────────────────────────────────────
  // DOM Construction
  // ─────────────────────────────────────────────────────────

  #buildDOM() {
    const el = document.createElement('div');
    el.id = 'player-hud';
    el.innerHTML = `
      <!-- Crosshair -->
      <div id="crosshair" aria-hidden="true">
        <div class="ch-h"></div>
        <div class="ch-v"></div>
      </div>

      <!-- Bottom HUD bar -->
      <div id="player-stats-bar">

        <!-- Health block -->
        <div class="stat-block" id="stat-health">
          <span class="stat-label">HP</span>
          <div class="health-bar-track">
            <div class="health-bar-fill" id="health-bar-fill"></div>
          </div>
          <span class="stat-value" id="hp-value">100</span>
        </div>

        <!-- Lives -->
        <div class="stat-block" id="stat-lives">
          <span class="stat-label">LIVES</span>
          <div class="lives-icons" id="lives-icons">
            <span class="life-icon">❤</span>
            <span class="life-icon">❤</span>
            <span class="life-icon">❤</span>
          </div>
        </div>

        <!-- Ammo -->
        <div class="stat-block" id="stat-ammo">
          <span class="stat-label">AMMO</span>
          <div class="ammo-display">
            <span class="ammo-current" id="ammo-current">30</span>
            <span class="ammo-sep">/</span>
            <span class="ammo-max" id="ammo-max">30</span>
          </div>
        </div>

      </div>

      <!-- Reload indicator -->
      <div id="reload-indicator" class="hidden">RELOADING…</div>

      <!-- Damage flash overlay -->
      <div id="damage-flash" aria-hidden="true"></div>

      <!-- Lock-to-play prompt -->
      <div id="lock-prompt">
        <div class="lock-inner">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="5" y="11" width="14" height="10" rx="2"/>
            <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
          </svg>
          <p>Click to Enter</p>
          <span>WASD · Mouse to aim · Click to fire · R to reload</span>
        </div>
      </div>
    `;
    return el;
  }

  // ─────────────────────────────────────────────────────────
  // Event Bindings
  // ─────────────────────────────────────────────────────────

  #bindEvents() {
    // Hide lock-prompt on pointer-lock
    document.addEventListener('pointerlockchange', () => {
      const locked = !!document.pointerLockElement;
      document.getElementById('lock-prompt').classList.toggle('hidden', locked);
    });

    // Player state changes
    this.#unsubs.push(
      eventBus.on(PlayerEvents.HEALTH_CHANGED, (s) => this.#updateHealth(s)),
      eventBus.on(PlayerEvents.AMMO_CHANGED,   (s) => this.#updateAmmo(s)),
      eventBus.on(PlayerEvents.SPAWNED,        (s) => this.#syncAll(s)),
      eventBus.on(PlayerEvents.DIED,           ()  => this.#flashDamage(true)),

      // Reload UI
      eventBus.on(CombatSystemEvents.RELOAD_START,  () => {
        document.getElementById('reload-indicator').classList.remove('hidden');
      }),
      eventBus.on(CombatSystemEvents.RELOAD_FINISH, (s) => {
        document.getElementById('reload-indicator').classList.add('hidden');
        this.#updateAmmo(s);
      }),

      // Damage flash on hit received
      eventBus.on(PlayerEvents.HEALTH_CHANGED, (s) => {
        if (s.health < (this._lastHealth ?? s.maxHealth)) {
          this.#flashDamage();
          this._lastHealth = s.health;
        } else {
          this._lastHealth = s.health;
        }
      }),
    );
  }

  // ─────────────────────────────────────────────────────────
  // Update Methods
  // ─────────────────────────────────────────────────────────

  /**
   * @param {import('../core/entities/Player.js').PlayerSnapshot} snap
   */
  #updateHealth(snap) {
    const pct = Math.max(0, (snap.health / snap.maxHealth) * 100);
    document.getElementById('health-bar-fill').style.width = `${pct}%`;
    document.getElementById('hp-value').textContent = Math.ceil(snap.health);

    // Colour shift: green → yellow → red
    const fill = document.getElementById('health-bar-fill');
    if (pct > 60)      fill.dataset.level = 'high';
    else if (pct > 30) fill.dataset.level = 'mid';
    else               fill.dataset.level = 'low';
  }

  /**
   * @param {import('../core/entities/Player.js').PlayerSnapshot} snap
   */
  #updateAmmo(snap) {
    document.getElementById('ammo-current').textContent = snap.ammo;
    document.getElementById('ammo-max').textContent     = snap.maxAmmo;

    const ammoEl = document.getElementById('ammo-current');
    ammoEl.classList.toggle('ammo-empty', snap.ammo === 0);
  }

  /**
   * @param {import('../core/entities/Player.js').PlayerSnapshot} snap
   */
  #updateLives(snap) {
    const container = document.getElementById('lives-icons');
    container.innerHTML = '';
    for (let i = 0; i < snap.lives; i++) {
      const span = document.createElement('span');
      span.className = 'life-icon';
      span.textContent = '❤';
      container.appendChild(span);
    }
  }

  /**
   * Full sync of all HUD panels from a player snapshot.
   * @param {import('../core/entities/Player.js').PlayerSnapshot} snap
   */
  #syncAll(snap) {
    this.#updateHealth(snap);
    this.#updateAmmo(snap);
    this.#updateLives(snap);
    this._lastHealth = snap.health;
  }

  /**
   * Briefly flash the red damage-received overlay.
   * @param {boolean} [isGameOver]
   */
  #flashDamage(isGameOver = false) {
    const el = document.getElementById('damage-flash');
    el.classList.add(isGameOver ? 'flash-death' : 'flash-hit');
    setTimeout(() => {
      el.classList.remove('flash-hit', 'flash-death');
    }, isGameOver ? 800 : 250);
  }

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────

  dispose() {
    this.#unsubs.forEach((fn) => fn());
    this.#root.remove();
  }
}
