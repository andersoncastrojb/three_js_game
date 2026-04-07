/**
 * @file SoundManager.js
 * @layer Infrastructure / Audio
 * @description Procedurally generates retro arcade sounds using the Web Audio API.
 * No external sound files needed. Listens to EventBus for triggers.
 */

import { eventBus, PlayerEvents, ZombieEvents, LevelEvents } from '../../core/EventBus.js';

export class SoundManager {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.initialized = false;
    this._noiseBuffer = null;
    
    // Browsers require a user gesture to start audio context
    const initAudio = () => {
      if (!this.initialized) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.initialized = true;
        document.removeEventListener('click', initAudio);
        document.removeEventListener('keydown', initAudio);
      }
    };
    
    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);

    this._setupListeners();
  }

  _setupListeners() {
    eventBus.on(PlayerEvents.FIRED, () => this.playShoot());
    eventBus.on(ZombieEvents.ATTACK, () => this.playPlayerHit());
    eventBus.on(ZombieEvents.GROAN, (payload) => this.playZombieGroan(payload.distance));
    
    eventBus.on(PlayerEvents.DIED, (s) => {
      if (s.lives <= 0) this.playGameOver();
    });
    
    eventBus.on(LevelEvents.CHANGED, () => this.playWin());
  }

  /**
   * Generates a burst of white noise used for gunshots and breath effects.
   * @private
   */
  _getNoiseBuffer() {
    if (!this.ctx) return null;
    if (this._noiseBuffer) return this._noiseBuffer;
    
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds max
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this._noiseBuffer = buffer;
    return buffer;
  }

  playShoot() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const noiseBuffer = this._getNoiseBuffer();

    // =================================================================
    // WEAPON OPTIONS: Change this number to test different guns!
    // 1 = Realistic Pistol (Crisp, sharp crack)
    // 2 = Heavy Shotgun (Deep bass thump, wide noise spread)
    // 3 = Sci-Fi Laser (Classic retro sweep)
    // =================================================================
    const weaponType = 3;

    if (weaponType === 1) {
      // ── OPTION 1: REALISTIC PISTOL ──
      // Transient "Click/Thump"
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(250, now);
      osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.05);
      oscGain.gain.setValueAtTime(1.5, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);

      // Gunpowder "Crack" (Filtered noise)
      if (noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 3000;
        noiseFilter.Q.value = 0.5;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(1.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noise.start(now);
        noise.stop(now + 0.2);
      }

    } else if (weaponType === 2) {
      // ── OPTION 2: HEAVY SHOTGUN ──
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.15);
      oscGain.gain.setValueAtTime(2.0, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);

      if (noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 1500;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(2.0, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4); // Long decay

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noise.start(now);
        noise.stop(now + 0.4);
      }

    } else if (weaponType === 3) {
      // ── OPTION 3: SCI-FI LASER BLASTER ──
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      
      // Fast downward pitch sweep
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);
      
      oscGain.gain.setValueAtTime(0.5, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      
      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.15);
    }
  }

  playZombieGroan(distance) {
    if (!this.ctx) return;
    
    // Scale volume based on distance
    const maxDist = 15;
    const distFactor = Math.max(0, 1 - (distance / maxDist));
    const masterVolume = 0.05 + (0.8 * distFactor); 
    if (masterVolume <= 0.05) return; // Too far to hear

    const now = this.ctx.currentTime;
    const duration = 1.0 + Math.random() * 1.5; // Random groan length 1s - 2.5s

    // Real Guttural Zombie Growl: We use White Noise representing breath/air,
    // and modulate its volume very fast using a low-frequency oscillator (LFO).
    // This creates a "rattling vocal cords" or "clicking" effect.

    const noiseBuffer = this._getNoiseBuffer();
    if (!noiseBuffer) return;

    // 1. The Breath (Air from lungs)
    const breathSource = this.ctx.createBufferSource();
    breathSource.buffer = noiseBuffer;
    breathSource.loop = true;

    // 2. Throat Resonance (Filters the noise to sound like a human mouth/chest)
    const throatFilter = this.ctx.createBiquadFilter();
    throatFilter.type = 'bandpass';
    throatFilter.frequency.setValueAtTime(300 + Math.random() * 200, now); // 300-500Hz
    throatFilter.Q.value = 1.5;

    // 3. The Rattle/Gargle (Vocal cords tearing)
    // A square wave at 10-25 Hz creates distinct harsh "clicks" in the breath
    const rattleLfo = this.ctx.createOscillator();
    rattleLfo.type = 'square';
    rattleLfo.frequency.setValueAtTime(10 + Math.random() * 15, now);

    // Amplitude Modulator (AM) Node
    const amGain = this.ctx.createGain();
    amGain.gain.value = 0; // Base gain is 0, LFO will push it up and down
    rattleLfo.connect(amGain.gain);

    // 4. Master Volume Envelope (Fade in and out like a breath)
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.01, now);
    masterGain.gain.exponentialRampToValueAtTime(masterVolume, now + duration * 0.2); // Swell up
    masterGain.gain.exponentialRampToValueAtTime(0.01, now + duration); // Fade out

    // Signal Chain: Noise -> Filter -> AM Gain -> Master Gain -> Speakers
    breathSource.connect(throatFilter);
    throatFilter.connect(amGain);
    amGain.connect(masterGain);
    masterGain.connect(this.ctx.destination);

    // Start everything
    breathSource.start(now);
    rattleLfo.start(now);
    
    // Stop everything
    breathSource.stop(now + duration);
    rattleLfo.stop(now + duration);
  }

  playPlayerHit() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Flesh crunch sound
    const noiseBuffer = this._getNoiseBuffer();
    if (noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800; // Muffled crunch

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(1.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.15);
    }
  }

  playGameOver() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 2.5); // Deep dive bomb
    
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 2.5);
  }

  playWin() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    
    // Triumphant arpeggio
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.setValueAtTime(554.37, now + 0.15); // C#5
    osc.frequency.setValueAtTime(659.25, now + 0.3); // E5
    osc.frequency.setValueAtTime(880, now + 0.45); // A5
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 1.2);
  }
}