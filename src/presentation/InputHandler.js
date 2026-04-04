/**
 * @file InputHandler.js
 * @layer Presentation
 * @description Captures keyboard and mouse input and emits domain events.
 * Pure DOM logic – no Three.js dependency.
 */

import { eventBus } from '../core/EventBus.js';

export const InputEvents = {
  KEY_DOWN: 'input:keydown',
  KEY_UP:   'input:keyup',
  MOUSE_MOVE: 'input:mousemove',
  CLICK:    'input:click',
};

export class InputHandler {
  #keys = new Set();

  constructor() {
    this.#attach();
  }

  #attach() {
    window.addEventListener('keydown', this.#onKeyDown);
    window.addEventListener('keyup',   this.#onKeyUp);
    window.addEventListener('mousemove', this.#onMouseMove);
    window.addEventListener('click',   this.#onClick);
  }

  #onKeyDown = (e) => {
    if (this.#keys.has(e.code)) return; // prevent repeat
    this.#keys.add(e.code);
    eventBus.emit(InputEvents.KEY_DOWN, { code: e.code, key: e.key });
  };

  #onKeyUp = (e) => {
    this.#keys.delete(e.code);
    eventBus.emit(InputEvents.KEY_UP, { code: e.code, key: e.key });
  };

  #onMouseMove = (e) => {
    eventBus.emit(InputEvents.MOUSE_MOVE, {
      x: e.clientX,
      y: e.clientY,
      normalizedX: (e.clientX / window.innerWidth)  * 2 - 1,
      normalizedY: -(e.clientY / window.innerHeight) * 2 + 1,
    });
  };

  #onClick = (e) => {
    eventBus.emit(InputEvents.CLICK, { x: e.clientX, y: e.clientY });
  };

  /** Check if a key is currently held. */
  isPressed = (code) => {
    return this.#keys.has(code);
  };

  dispose() {
    window.removeEventListener('keydown', this.#onKeyDown);
    window.removeEventListener('keyup',   this.#onKeyUp);
    window.removeEventListener('mousemove', this.#onMouseMove);
    window.removeEventListener('click',   this.#onClick);
    this.#keys.clear();
  }
}
