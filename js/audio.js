/**
 * DevPulse AI - Web Audio Synthesizer
 * Provides sleek, futuristic micro-interaction feedback sounds
 */

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  setEnabled(val) {
    this.enabled = !!val;
  }

  playTone(freq, type, duration, gainStart = 0.05, gainEnd = 0.001) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainStart, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(gainEnd, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio might be blocked by browser policy until interaction
    }
  }

  playSent() {
    if (!this.enabled) return;
    this.playTone(520, 'sine', 0.08, 0.06);
    setTimeout(() => {
      this.playTone(784, 'sine', 0.12, 0.05);
    }, 50);
  }

  playReceived() {
    if (!this.enabled) return;
    this.playTone(440, 'sine', 0.08, 0.04);
    setTimeout(() => {
      this.playTone(659.25, 'sine', 0.08, 0.04);
    }, 60);
    setTimeout(() => {
      this.playTone(880, 'sine', 0.15, 0.05);
    }, 120);
  }

  playClick() {
    if (!this.enabled) return;
    this.playTone(800, 'triangle', 0.03, 0.02);
  }

  playClear() {
    if (!this.enabled) return;
    this.playTone(600, 'sine', 0.08, 0.04);
    setTimeout(() => {
      this.playTone(400, 'sine', 0.12, 0.03);
    }, 70);
  }

  playError() {
    if (!this.enabled) return;
    this.playTone(220, 'sawtooth', 0.15, 0.05);
    setTimeout(() => {
      this.playTone(180, 'sawtooth', 0.2, 0.05);
    }, 120);
  }
}

const soundFx = new SoundEffects();
