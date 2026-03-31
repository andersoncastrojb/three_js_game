/**
 * @file EventBus.js
 * @layer Core
 * @description Lightweight publish/subscribe event bus.
 * Decouples all layers: use-cases emit events, infrastructure listens and reacts.
 * No Three.js dependency allowed here.
 */

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void} unsubscribe function
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Subscribe once – auto-unsubscribes after first call.
   * @param {string} event
   * @param {Function} handler
   */
  once(event, handler) {
    const wrapper = (payload) => {
      handler(payload);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  /**
   * Emit an event with an optional payload.
   * @param {string} event
   * @param {*} payload
   */
  emit(event, payload) {
    this._listeners.get(event)?.forEach((fn) => fn(payload));
  }

  /** Remove all listeners for all events. */
  clear() {
    this._listeners.clear();
  }
}

/** Singleton instance shared across the application */
export const eventBus = new EventBus();
