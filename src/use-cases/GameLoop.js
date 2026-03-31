/**
 * @file GameLoop.js
 * @layer Use Cases
 * @description Orchestrates per-frame domain logic updates.
 * The render loop in infrastructure/three calls tick() each frame,
 * passing the elapsed delta time. This class is purely logic – no Three.js.
 */

import { eventBus } from '../core/EventBus.js';

export const GameLoopEvents = {
  TICK: 'gameloop:tick',
  START: 'gameloop:start',
  STOP: 'gameloop:stop',
};

export class GameLoop {
  /** @type {Array<{ update: (delta: number) => void }>} */
  #systems = [];
  #running = false;
  #elapsedTime = 0;
  #tickCount = 0;

  /** Register a system that has an update(delta) method */
  addSystem(system) {
    if (typeof system.update !== 'function') {
      throw new Error('System must have an update(delta) method.');
    }
    this.#systems.push(system);
    return this;
  }

  removeSystem(system) {
    this.#systems = this.#systems.filter((s) => s !== system);
    return this;
  }

  /** Called once per frame by the render loop infrastructure. */
  tick(delta) {
    if (!this.#running) return;
    this.#elapsedTime += delta;
    this.#tickCount++;

    for (const system of this.#systems) {
      system.update(delta);
    }

    eventBus.emit(GameLoopEvents.TICK, {
      delta,
      elapsed: this.#elapsedTime,
      tick: this.#tickCount,
    });
  }

  start() {
    this.#running = true;
    eventBus.emit(GameLoopEvents.START, {});
  }

  stop() {
    this.#running = false;
    eventBus.emit(GameLoopEvents.STOP, {});
  }

  get isRunning() { return this.#running; }
  get elapsedTime() { return this.#elapsedTime; }
  get tickCount() { return this.#tickCount; }
}
