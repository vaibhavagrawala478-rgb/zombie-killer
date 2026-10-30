// Fully procedural audio (WebAudio). No asset files.
import { G } from './state.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.intensity = 0; // 0..1 drives the music
    this.heart = 0;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain();
    this.master.gain.value = G.settings.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);

    this.rev = ctx.createConvolver();
    this.rev.buffer = this.makeIR(2.0, 2.4);
    const rg = ctx.createGain(); rg.gain.value = 0.5;
    this.rev.connect(rg); rg.connect(this.master);

    this.musicBus = ctx.createGain(); this.musicBus.gain.value = G.settings.music;
    this.musicBus.connect(this.master);

    // white noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.startAmbient();
    this.startMusic();
  }

  applyVolume() {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : G.settings.volume;
    this.musicBus.gain.value = G.settings.music;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : G.settings.volume;
    return this.muted;
  }

  makeIR(sec, decay) {
    const ctx = this.ctx, len = ctx.sampleRate * sec;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // output node with optional pan + reverb send
  out(vol = 1, pan = 0, wet = 0.15, dest = null) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = vol;
    let node = g;
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); node = p; }
    node.connect(dest || this.master);
    if (wet > 0 && !dest) { const w = ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(this.rev); }
    return g;
  }

  noise({ dur = 0.1, type = 'lowpass', f0 = 2000, f1 = 500, q = 0.8, vol = 0.5, at = 0, pan = 0, wet = 0.15, attack = 0.002 }) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out(1, pan, wet));
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, vol = 0.3, at = 0, pan = 0, wet = 0.1, attack = 0.004, vib = 0, dest = null }) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (vib) {
      const l = ctx.createOscillator(); l.frequency.value = 6 + Math.random() * 3;
      const lg = ctx.createGain(); lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency);
      l.start(t); l.stop(t + dur + 0.05);
    }
    o.connect(g); g.connect(this.out(1, pan, wet, dest));
    o.start(t); o.stop(t + dur + 0.05);
  }

  spatial(x, z) {
    const p = G.player;
    const dx = x - p.pos.x, dz = z - p.pos.z;
    const dist = Math.hypot(dx, dz);
    const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const pan = dist > 0.01 ? (dx * rx + dz * rz) / dist : 0;
    return { gain: 1 / (1 + dist * 0.16), pan: pan * 0.85, dist };
  }

  // ---- weapons ----
  shot(id) {
    if (!this.ctx) return;
    switch (id) {
      case 'pistol':
        this.noise({ dur: 0.16, f0: 4200, f1: 600, vol: 0.55, wet: 0.3 });
        this.tone({ f0: 180, f1: 55, dur: 0.14, vol: 0.5 });
        break;
      case 'smg':
        this.noise({ dur: 0.09, type: 'bandpass', f0: 3500, f1: 900, q: 0.7, vol: 0.45, wet: 0.2 });
        this.tone({ f0: 160, f1: 60, dur: 0.08, vol: 0.4 });
        break;
      case 'shotgun':
        this.noise({ dur: 0.5, f0: 3000, f1: 150, vol: 0.9, wet: 0.5 });
        this.tone({ f0: 110, f1: 28, dur: 0.4, vol: 0.9 });
        this.noise({ dur: 0.25, type: 'highpass', f0: 1500, f1: 800, vol: 0.2, at: 0.0 });
        break;
      case 'ar':
        this.noise({ dur: 0.12, f0: 3800, f1: 500, vol: 0.55, wet: 0.35 });
        this.tone({ f0: 130, f1: 45, dur: 0.12, vol: 0.55 });
        break;
      case 'sniper':
        this.noise({ dur: 0.9, f0: 5000, f1: 120, vol: 1.0, wet: 0.9 });
        this.tone({ f0: 90, f1: 24, dur: 0.6, vol: 1.0 });
        this.tone({ type: 'triangle', f0: 1800, f1: 400, dur: 0.15, vol: 0.2 });
        break;
      case 'rocket':
        this.noise({ dur: 0.7, type: 'bandpass', f0: 400, f1: 2400, q: 0.6, vol: 0.7, wet: 0.5 });
        this.tone({ f0: 70, f1: 30, dur: 0.5, vol: 0.7 });
        break;
    }
  }
  reload(t) {
    if (!this.ctx) return;
    this.noise({ dur: 0.05, type: 'highpass', f0: 3000, f1: 2500, vol: 0.3, at: 0.05 });
    this.tone({ type: 'square', f0: 300, f1: 200, dur: 0.05, vol: 0.08, at: 0.05 });
    this.noise({ dur: 0.07, type: 'highpass', f0: 2200, f1: 1800, vol: 0.35, at: t * 0.55 });
    this.noise({ dur: 0.06, type: 'highpass', f0: 3500, f1: 3000, vol: 0.4, at: t * 0.9 });
    this.tone({ type: 'square', f0: 220, f1: 140, dur: 0.06, vol: 0.1, at: t * 0.9 });
  }
  dry() { if (this.ctx) this.noise({ dur: 0.04, type: 'highpass', f0: 3000, f1: 2500, vol: 0.3 }); }
  swap() {
    if (!this.ctx) return;
    this.noise({ dur: 0.06, type: 'bandpass', f0: 1500, f1: 900, vol: 0.25 });
    this.tone({ type: 'square', f0: 180, f1: 110, dur: 0.05, vol: 0.08, at: 0.05 });
  }

  // ---- zombies ----
  groan(x, z, big = 1) {
    if (!this.ctx) return;
    const s = this.spatial(x, z);
    if (s.gain < 0.05) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = (0.7 + Math.random() * 0.7) * (0.8 + big * 0.2);
    const base = (75 + Math.random() * 55) / Math.sqrt(big);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * 1.25, t);
    o.frequency.linearRampToValueAtTime(base * 0.8, t + dur);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(350 + Math.random() * 250, t);
    f.frequency.linearRampToValueAtTime(700 + Math.random() * 300, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(300, t + dur);
    const l = ctx.createOscillator(); l.frequency.value = 5 + Math.random() * 6;
    const lg = ctx.createGain(); lg.gain.value = base * 0.07; l.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * s.gain, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.out(1, s.pan, 0.35));
    o.start(t); l.start(t); o.stop(t + dur + 0.05); l.stop(t + dur + 0.05);
  }
  zombieHit(x, z, head) {
    if (!this.ctx) return;
    const s = this.spatial(x, z);
    this.noise({ dur: 0.08, f0: 1400, f1: 300, vol: 0.35 * Math.max(0.3, s.gain * 2), pan: s.pan });
    this.tone({ f0: head ? 260 : 120, f1: 50, dur: 0.09, vol: 0.3 * Math.max(0.3, s.gain * 2), pan: s.pan });
    if (head) this.tone({ type: 'triangle', f0: 1700, f1: 900, dur: 0.1, vol: 0.12, pan: s.pan });
  }
  zombieDie(x, z, big = 1) {
    if (!this.ctx) return;
    const s = this.spatial(x, z);
    const v = Math.max(0.25, s.gain * 2);
    this.noise({ dur: 0.3, f0: 900, f1: 120, vol: 0.4 * v, pan: s.pan, wet: 0.3 });
    this.tone({ type: 'sawtooth', f0: 150 / Math.sqrt(big), f1: 40, dur: 0.5, vol: 0.18 * v, pan: s.pan, vib: 8 });
  }
  scream(x, z) {
    if (!this.ctx) return;
    const s = this.spatial(x, z), v = Math.max(0.35, s.gain * 2.2);
    for (const [f0, f1] of [[620, 1500], [930, 2100]]) this.tone({ type: 'sawtooth', f0, f1, dur: 1.2, vol: 0.12 * v, pan: s.pan, wet: 0.5, vib: 40, attack: 0.15 });
    this.noise({ dur: 1.2, type: 'bandpass', f0: 1800, f1: 2600, q: 2, vol: 0.2 * v, pan: s.pan, wet: 0.5, attack: 0.15 });
  }
  spit(x, z) {
    if (!this.ctx) return;
    const s = this.spatial(x, z), v = Math.max(0.3, s.gain * 2);
    this.noise({ dur: 0.25, type: 'bandpass', f0: 500, f1: 2200, q: 1.5, vol: 0.3 * v, pan: s.pan });
    this.tone({ f0: 300, f1: 900, dur: 0.18, vol: 0.12 * v, pan: s.pan });
  }
  splat(x, z) {
    if (!this.ctx) return;
    const s = this.spatial(x, z), v = Math.max(0.3, s.gain * 2);
    this.noise({ dur: 0.3, f0: 1800, f1: 200, vol: 0.35 * v, pan: s.pan });
    this.tone({ f0: 160, f1: 60, dur: 0.2, vol: 0.2 * v, pan: s.pan });
  }
  ricochet(x, z) {
    if (!this.ctx) return;
    const s = this.spatial(x, z);
    this.tone({ type: 'triangle', f0: 2600 + Math.random() * 800, f1: 1400, dur: 0.18, vol: 0.18, pan: s.pan, wet: 0.4 });
    this.noise({ dur: 0.05, type: 'highpass', f0: 4000, f1: 3000, vol: 0.2, pan: s.pan });
  }
  hurt() {
    if (!this.ctx) return;
    this.tone({ f0: 100, f1: 38, dur: 0.25, vol: 0.7 });
    this.noise({ dur: 0.18, f0: 1200, f1: 200, vol: 0.4 });
  }
  claw(x, z) {
    if (!this.ctx) return;
    const s = this.spatial(x, z);
    this.noise({ dur: 0.12, type: 'bandpass', f0: 2500, f1: 800, vol: 0.2, pan: s.pan });
  }
  step() {
    if (!this.ctx) return;
    this.noise({ dur: 0.06, f0: 500 + Math.random() * 200, f1: 150, vol: 0.09, wet: 0.05 });
  }
  jump() { if (this.ctx) this.noise({ dur: 0.1, f0: 800, f1: 300, vol: 0.08 }); }

  // ---- explosions ----
  explosion(x, z) {
    if (!this.ctx) return;
    const s = this.spatial(x, z);
    const v = clamp(1.2 / (1 + s.dist * 0.05), 0.25, 1.2);
    this.noise({ dur: 1.6, f0: 1800, f1: 50, vol: 1.0 * v, pan: s.pan, wet: 0.9, q: 0.4 });
    this.tone({ f0: 80, f1: 18, dur: 1.0, vol: 1.0 * v, pan: s.pan });
    this.noise({ dur: 0.3, type: 'highpass', f0: 3000, f1: 1000, vol: 0.3 * v, pan: s.pan });
  }
  gas(x, z) {
    if (!this.ctx) return;
    const s = this.spatial(x, z);
    this.noise({ dur: 0.9, type: 'bandpass', f0: 600, f1: 200, q: 0.5, vol: 0.45 * Math.max(0.3, s.gain * 2), pan: s.pan, wet: 0.5 });
    this.tone({ f0: 70, f1: 30, dur: 0.6, vol: 0.5 * Math.max(0.3, s.gain * 2), pan: s.pan });
  }

  // ---- economy ----
  pickup(rank) {
    if (!this.ctx) return;
    const base = 660 * Math.pow(1.122, rank * 2);
    [1, 1.5, 2].forEach((m, i) => this.tone({ type: 'sine', f0: base * m, dur: 0.22, vol: 0.18, at: i * 0.055, wet: 0.35 }));
    this.tone({ type: 'triangle', f0: base * 3, dur: 0.3, vol: 0.05, at: 0.1, wet: 0.5 });
  }
  cash(big = false) {
    if (!this.ctx) return;
    this.noise({ dur: 0.05, type: 'highpass', f0: 4000, f1: 3000, vol: 0.25 });
    this.tone({ type: 'sine', f0: 2093, dur: 0.5, vol: 0.18, at: 0.05, wet: 0.3 });
    this.tone({ type: 'sine', f0: 2637, dur: 0.7, vol: 0.18, at: 0.12, wet: 0.3 });
    if (big) this.tone({ type: 'sine', f0: 3136, dur: 0.8, vol: 0.14, at: 0.2, wet: 0.4 });
  }
  buy() {
    if (!this.ctx) return;
    this.noise({ dur: 0.08, f0: 1200, f1: 200, vol: 0.4 });
    this.tone({ type: 'square', f0: 140, f1: 70, dur: 0.12, vol: 0.12 });
    this.tone({ type: 'sine', f0: 1568, dur: 0.3, vol: 0.12, at: 0.08, wet: 0.3 });
    this.tone({ type: 'sine', f0: 2093, dur: 0.4, vol: 0.12, at: 0.14, wet: 0.3 });
  }
  deny() {
    if (!this.ctx) return;
    this.tone({ type: 'square', f0: 160, f1: 120, dur: 0.18, vol: 0.12 });
    this.tone({ type: 'square', f0: 120, f1: 90, dur: 0.2, vol: 0.12, at: 0.12 });
  }
  uiClick() { if (this.ctx) this.tone({ type: 'sine', f0: 900, f1: 700, dur: 0.05, vol: 0.08 }); }

  // ---- announcements ----
  waveStart(boss) {
    if (!this.ctx) return;
    const f = boss ? 55 : 82;
    [1, 1.5, 2].forEach((m, i) => this.tone({ type: 'sawtooth', f0: f * m, f1: f * m * 0.97, dur: 2.2, vol: 0.18, at: i * 0.02, wet: 0.7, attack: 0.3 }));
    this.noise({ dur: 1.8, type: 'lowpass', f0: 200, f1: 900, vol: 0.2, wet: 0.6, attack: 0.5 });
  }
  waveClear() {
    if (!this.ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.8, vol: 0.14, at: i * 0.12, wet: 0.6 }));
  }
  heartbeat() {
    if (!this.ctx) return;
    this.tone({ f0: 70, f1: 40, dur: 0.14, vol: 0.5 });
    this.tone({ f0: 62, f1: 36, dur: 0.14, vol: 0.4, at: 0.16 });
  }

  // ---- ambience ----
  startAmbient() {
    const ctx = this.ctx;
    // wind
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const l1 = ctx.createOscillator(); l1.frequency.value = 0.07;
    const l1g = ctx.createGain(); l1g.gain.value = 0.035; l1.connect(l1g); l1g.connect(g.gain);
    const l2 = ctx.createOscillator(); l2.frequency.value = 0.11;
    const l2g = ctx.createGain(); l2g.gain.value = 180; l2.connect(l2g); l2g.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(); l1.start(); l2.start();
    // crickets
    this.cricket = setInterval(() => {
      if (!this.ctx || G.state === 'paused') return;
      const n = 3 + Math.floor(Math.random() * 4);
      const base = 4200 + Math.random() * 600;
      for (let i = 0; i < n; i++) this.tone({ type: 'sine', f0: base, dur: 0.05, vol: 0.012, at: i * 0.075, wet: 0.2, pan: (Math.random() - 0.5) * 1.2 });
    }, 2600);
  }

  // Tiny step sequencer; intensity (0..1) controls how much is playing.
  startMusic() {
    const ctx = this.ctx;
    this.step16 = 0;
    this.nextT = ctx.currentTime + 0.2;
    const bpm = 96, spb = 60 / bpm / 4;
    const bass = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
    this.musicTimer = setInterval(() => {
      if (!this.ctx) return;
      while (this.nextT < ctx.currentTime + 0.15) {
        this.seq(this.step16, this.nextT, bass);
        this.nextT += spb;
        this.step16 = (this.step16 + 1) % 64;
      }
    }, 30);
  }
  seq(i, t, bass) {
    const ctx = this.ctx, I = this.intensity;
    const dest = this.musicBus;
    const mk = (o, g, dur, vol) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
    };
    // pad drone per bar
    if (i % 16 === 0) {
      const note = bass[(i >> 4) % bass.length] * 2;
      [1, 1.498].forEach(m => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = note * m;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380 + I * 500;
        const g = ctx.createGain(); o.connect(f); f.connect(g); g.connect(dest);
        const dur = 2.4;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.045, t + 1.0);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.start(t); o.stop(t + dur + 0.05);
      });
    }
    // kick-like pulse
    if (I > 0.12 && (i % 8 === 0 || (I > 0.5 && i % 8 === 6))) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
      const g = ctx.createGain(); o.connect(g); g.connect(dest);
      mk(o, g, 0.22, 0.45 * (0.4 + I));
    }
    // bass line
    if (I > 0.2 && (i % 4 === 0 || (I > 0.6 && i % 4 === 3))) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = bass[(i >> 3) % bass.length];
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(260 + I * 700, t); f.frequency.exponentialRampToValueAtTime(110, t + 0.2);
      const g = ctx.createGain(); o.connect(f); f.connect(g); g.connect(dest);
      mk(o, g, 0.22, 0.12 * (0.5 + I));
    }
    // hats
    if (I > 0.4 && i % 2 === 1) {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = ctx.createGain(); src.connect(f); f.connect(g); g.connect(dest);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * I, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.start(t, Math.random()); src.stop(t + 0.07);
    }
    // eerie high stab
    if (I > 0.55 && i % 32 === 20) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 440 * 1.189;
      const g = ctx.createGain(); o.connect(g); g.connect(dest);
      mk(o, g, 1.2, 0.04);
    }
  }
}
