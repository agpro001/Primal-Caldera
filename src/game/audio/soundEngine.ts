/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BeastSpecies, WeatherType } from '../../types/game.ts';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private isMuted: boolean = false;
  private initialized: boolean = false;

  private initContext() {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this.sfxGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
    this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.initialized = true;
    this.startAmbientDrone();
  }

  public setVolumes(master: number, sfx: number, music: number) {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const t = this.ctx.currentTime;
    this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : Math.max(0, Math.min(1, master)), t + 0.05);
    this.sfxGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, sfx)), t + 0.05);
    this.musicGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, music * 0.45)), t + 0.05);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.masterGain) {
      const t = this.ctx.currentTime;
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.85, t + 0.05);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private startAmbientDrone() {
    if (!this.ctx || !this.musicGain || this.ambientOsc) return;

    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A1 volcanic drone

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start();
      this.ambientOsc = osc;
      this.ambientGain = gain;
    } catch {
      // Audio autoplay policy handled smoothly
    }
  }

  public triggerUserInteraction() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playFootstep() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90 + Math.random() * 25, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.08);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playSpearSwing(heavy: boolean) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    const startFreq = heavy ? 160 : 280;
    const endFreq = heavy ? 420 : 680;
    const dur = heavy ? 0.28 : 0.16;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur * 0.6);
    osc.frequency.exponentialRampToValueAtTime(100, t + dur);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(heavy ? 350 : 600, t);
    filter.Q.setValueAtTime(3, t);

    gain.gain.setValueAtTime(heavy ? 0.35 : 0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  public playHit(isWeakPoint: boolean, isCrit: boolean) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Meaty thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.18);
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);

    // If weak point, play sharp high crack
    if (isWeakPoint || isCrit) {
      const ping = this.ctx.createOscillator();
      const pingGain = this.ctx.createGain();
      ping.type = 'sawtooth';
      ping.frequency.setValueAtTime(isCrit ? 920 : 640, t);
      ping.frequency.exponentialRampToValueAtTime(isCrit ? 1400 : 960, t + 0.12);
      pingGain.gain.setValueAtTime(0.3, t);
      pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      ping.connect(pingGain);
      pingGain.connect(this.sfxGain);
      ping.start(t);
      ping.stop(t + 0.26);
    }
  }

  public playDodge() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.25);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.27);
  }

  public playHurt() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  public playBeastRoar(species: BeastSpecies, enraged: boolean = false) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    let baseFreq = 85;
    let dur = 0.8;

    if (species === 'raptor') {
      baseFreq = 260;
      dur = 0.55;
      osc1.type = 'sawtooth';
      osc2.type = 'square';
    } else if (species === 'brontoshell') {
      baseFreq = 50;
      dur = 1.0;
      osc1.type = 'sawtooth';
      osc2.type = 'sine';
    } else if (species === 'thunderhorn') {
      baseFreq = 75;
      dur = 1.1;
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
    } else if (species === 'caldera_titan') {
      baseFreq = 45;
      dur = 1.4;
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
    }

    if (enraged) {
      baseFreq *= 1.25;
      dur *= 1.2;
    }

    osc1.frequency.setValueAtTime(baseFreq * 0.7, t);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + dur * 0.3);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + dur);

    osc2.frequency.setValueAtTime(baseFreq * 0.9, t);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, t + dur * 0.35);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, t + dur);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(enraged ? 1200 : 700, t);

    gain.gain.setValueAtTime(enraged ? 0.55 : 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur + 0.05);
    osc2.stop(t + dur + 0.05);
  }

  public playTelegraph() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.45);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.52);
  }

  public playTrapSnap() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playHeal() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const notes = [261.6, 329.6, 392.0, 523.3]; // C chord chime
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const noteTime = t + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.15, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(noteTime);
      osc.stop(noteTime + 0.36);
    });
  }

  public playFocusToggle(active: boolean) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = active ? 220 : 660;
    const endFreq = active ? 660 : 220;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.22);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playCarve() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.16);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playVictory() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    // Epic prehistoric horn brass fanfares: D3, F#3, A3, D4
    const chords = [146.8, 185.0, 220.0, 293.7];
    chords.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const noteTime = t + idx * 0.14;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.35, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 1.2);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(noteTime);
      osc.stop(noteTime + 1.3);
    });
  }

  public playDefeat() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 1.2);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 1.35);
  }

  public playWeatherShift(weather: WeatherType) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    if (weather === 'heavy_rain') {
      // Wind gust & rain hiss
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 1.2);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, t);
    } else if (weather === 'dense_fog') {
      // Hollow geothermal draft
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 1.5);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(160, t);
    } else if (weather === 'ash_storm') {
      // Deep caldera rumble
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(65, t);
      osc.frequency.linearRampToValueAtTime(95, t + 0.8);
      osc.frequency.exponentialRampToValueAtTime(45, t + 1.8);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, t);
    } else {
      // Clear sky chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.35); // E5
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(400, t);
    }

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 1.7);
  }
}

export const sound = new SoundEngine();
