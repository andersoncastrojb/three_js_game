/**
 * @file Weapon.js
 * @layer Core / Domain
 * @description Represents a weapon entity with combat statistics.
 */

export class Weapon {
  /**
   * @param {Object} params
   * @param {string} params.id        - Unique identifier.
   * @param {string} params.name      - Display name of the weapon.
   * @param {number} params.damage    - Damage dealt per hit.
   * @param {number} params.fireRate  - Rounds per minute or delay between shots.
   * @param {number} params.ammo      - Current ammo count.
   * @param {number} params.maxAmmo   - Maximum ammo capacity.
   * @param {number} params.range     - Effective range of the weapon.
   */
  constructor({ id, name, damage, fireRate, ammo, maxAmmo, range }) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.name = name;
    /** @type {number} */
    this.damage = damage;
    /** @type {number} */
    this.fireRate = fireRate;
    /** @type {number} */
    this.ammo = ammo;
    /** @type {number} */
    this.maxAmmo = maxAmmo;
    /** @type {number} */
    this.range = range;
  }

  /**
   * Check if the weapon has ammo and can fire.
   * @returns {boolean}
   */
  canFire() {
    return this.ammo > 0;
  }

  /**
   * Consume ammo if available.
   * @returns {boolean} True if ammo was consumed, false otherwise.
   */
  consumeAmmo() {
    if (this.canFire()) {
      this.ammo--;
      return true;
    }
    return false;
  }

  /**
   * Reload the weapon.
   * @param {number} amount - Amount of ammo to add.
   */
  reload(amount) {
    this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
  }
}
