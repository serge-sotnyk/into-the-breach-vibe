// Tiny WebAudio synth: every sound effect and the ambient score are generated at
// runtime, so the game ships without audio assets.

type Wave = OscillatorType;

export class Sound {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private sfxVol = 0.7;
  private musicVol = 0.35;
  private musicMode: 'off' | 'menu' | 'battle' = 'off';
  private musicTimer = 0;
  private step = 0;
  private last = new Map<string, number>();

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxVol;
    this.sfxBus.connect(comp);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicVol * 0.5;
    this.musicBus.connect(comp);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.musicMode !== 'off') this.startMusicLoop();
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVol = sfx;
    this.musicVol = music;
    if (this.sfxBus) this.sfxBus.gain.value = sfx;
    if (this.musicBus) this.musicBus.gain.value = music * 0.5;
  }

  private tone(freq: number, dur: number, type: Wave, vol: number, to?: number, delay = 0, attack = 0.005): void {
    const c = this.ctx;
    if (!c || !this.sfxBus) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass', to?: number, delay = 0, q = 1): void {
    const c = this.ctx;
    if (!c || !this.sfxBus || !this.noiseBuf) return;
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  play(name: string): void {
    if (!this.ctx || this.sfxVol <= 0) return;
    const now = performance.now();
    if (now - (this.last.get(name) ?? 0) < 45) return;
    this.last.set(name, now);
    switch (name) {
      case 'click':
        this.tone(880, 0.05, 'square', 0.06, 660);
        break;
      case 'hover':
        this.tone(1200, 0.025, 'sine', 0.03);
        break;
      case 'select':
        this.tone(520, 0.09, 'triangle', 0.16, 820);
        break;
      case 'denied':
        this.tone(170, 0.1, 'square', 0.08);
        this.tone(150, 0.12, 'square', 0.08, undefined, 0.11);
        break;
      case 'move':
        this.noise(0.22, 0.08, 500, 'bandpass', 900);
        this.tone(130, 0.18, 'sawtooth', 0.04, 170);
        break;
      case 'skitter':
        this.noise(0.14, 0.05, 3000, 'highpass');
        break;
      case 'push':
        this.noise(0.16, 0.12, 700, 'lowpass', 200);
        break;
      case 'whoosh':
        this.noise(0.4, 0.14, 300, 'bandpass', 2200, 0, 2);
        break;
      case 'punch':
        this.noise(0.12, 0.3, 900, 'lowpass', 200);
        this.tone(110, 0.16, 'sine', 0.45, 45);
        break;
      case 'shot':
        this.noise(0.18, 0.28, 2400, 'bandpass', 300, 0, 2);
        this.tone(240, 0.1, 'square', 0.12, 70);
        break;
      case 'spit':
        this.noise(0.22, 0.18, 1400, 'bandpass', 500, 0, 4);
        this.tone(300, 0.15, 'sawtooth', 0.06, 120);
        break;
      case 'artillery':
        this.tone(420, 0.42, 'sine', 0.09, 900);
        this.noise(0.12, 0.2, 600, 'lowpass');
        break;
      case 'boom':
        this.noise(0.55, 0.55, 600, 'lowpass', 90);
        this.tone(70, 0.45, 'sine', 0.55, 32);
        break;
      case 'hit':
        this.noise(0.1, 0.3, 1200, 'bandpass', 500);
        this.tone(170, 0.09, 'square', 0.12, 90);
        break;
      case 'bump':
        this.tone(120, 0.18, 'sine', 0.5, 55);
        this.noise(0.12, 0.22, 400, 'lowpass');
        break;
      case 'building':
        this.noise(0.8, 0.5, 900, 'lowpass', 150);
        this.tone(55, 0.6, 'sine', 0.45, 30);
        this.tone(880, 0.16, 'square', 0.05, undefined, 0.15);
        this.tone(660, 0.16, 'square', 0.05, undefined, 0.33);
        break;
      case 'die':
        this.tone(420, 0.28, 'sawtooth', 0.12, 70);
        this.noise(0.25, 0.18, 700, 'bandpass', 250, 0, 3);
        break;
      case 'mechdown':
        this.noise(0.9, 0.5, 700, 'lowpass', 80);
        this.tone(220, 0.8, 'sawtooth', 0.12, 35);
        break;
      case 'splash':
        this.noise(0.45, 0.3, 1800, 'bandpass', 350, 0, 1.5);
        break;
      case 'fall':
        this.tone(500, 0.6, 'sine', 0.12, 60);
        break;
      case 'fire':
        this.noise(0.35, 0.12, 2500, 'highpass');
        this.noise(0.25, 0.1, 500, 'lowpass', undefined, 0.05);
        break;
      case 'flame':
        this.noise(0.4, 0.22, 900, 'bandpass', 1800, 0, 0.7);
        break;
      case 'emerge':
        this.noise(0.6, 0.35, 220, 'lowpass', 90);
        this.tone(48, 0.5, 'sine', 0.3);
        break;
      case 'rumble':
        this.noise(0.3, 0.08, 160, 'lowpass');
        break;
      case 'shield':
        this.tone(600, 0.22, 'sine', 0.14, 1300);
        break;
      case 'resist':
        this.tone(980, 0.12, 'triangle', 0.14, 1400);
        this.tone(1400, 0.2, 'triangle', 0.1, undefined, 0.08);
        break;
      case 'freeze':
        this.tone(1900, 0.3, 'sine', 0.08, 2600);
        this.noise(0.25, 0.1, 5000, 'highpass');
        break;
      case 'zap':
        this.noise(0.18, 0.2, 3000, 'highpass');
        this.tone(1300, 0.14, 'sawtooth', 0.08, 180);
        break;
      case 'thunder':
        this.noise(0.9, 0.5, 2500, 'lowpass', 120);
        break;
      case 'laser':
        this.tone(1000, 0.32, 'sawtooth', 0.1, 380);
        this.tone(1500, 0.32, 'sine', 0.06, 600);
        break;
      case 'hook':
        this.tone(700, 0.2, 'square', 0.05, 250);
        break;
      case 'pulse':
        this.tone(160, 0.35, 'sine', 0.35, 60);
        this.noise(0.3, 0.15, 400, 'lowpass');
        break;
      case 'wind':
        this.noise(0.9, 0.25, 300, 'bandpass', 1600, 0, 1.2);
        break;
      case 'swap':
        this.tone(300, 0.2, 'sine', 0.12, 1200);
        this.tone(1200, 0.2, 'sine', 0.08, 300, 0.12);
        break;
      case 'heal':
        this.tone(520, 0.22, 'triangle', 0.12, 1040);
        this.tone(660, 0.22, 'triangle', 0.08, 1320, 0.06);
        break;
      case 'acid':
        this.noise(0.3, 0.12, 900, 'bandpass', 400, 0, 6);
        break;
      case 'sand':
        this.noise(0.4, 0.12, 1200, 'highpass');
        break;
      case 'smoke':
        this.noise(0.5, 0.1, 500, 'lowpass');
        break;
      case 'crumble':
        this.noise(0.45, 0.3, 500, 'lowpass', 120);
        break;
      case 'web':
        this.tone(900, 0.12, 'triangle', 0.06, 500);
        break;
      case 'pod':
        [660, 880, 1100].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.12, undefined, i * 0.08));
        break;
      case 'target':
        this.tone(1500, 0.035, 'sine', 0.04);
        break;
      case 'yourturn':
        this.tone(523, 0.18, 'triangle', 0.14);
        this.tone(784, 0.3, 'triangle', 0.14, undefined, 0.12);
        break;
      case 'enemyturn':
        this.tone(98, 0.7, 'sawtooth', 0.08, 92);
        this.tone(147, 0.7, 'sawtooth', 0.05, 139);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.14, undefined, i * 0.11));
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.07, undefined, i * 0.18));
        break;
      case 'buy':
        this.tone(880, 0.08, 'square', 0.06);
        this.tone(1320, 0.14, 'triangle', 0.1, undefined, 0.07);
        break;
      case 'save':
        this.tone(660, 0.1, 'triangle', 0.1);
        this.tone(990, 0.16, 'triangle', 0.1, undefined, 0.09);
        break;
      case 'levelup':
        [523, 784, 1047, 1568].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, undefined, i * 0.08));
        break;
    }
  }

  // ------------------------------------------------------------------ music

  music(mode: 'off' | 'menu' | 'battle'): void {
    if (mode === this.musicMode) return;
    this.musicMode = mode;
    if (this.ctx && mode !== 'off') this.startMusicLoop();
  }

  private startMusicLoop(): void {
    if (this.musicTimer) return;
    const tick = (): void => {
      if (this.musicMode === 'off' || !this.ctx || !this.musicBus) {
        this.musicTimer = 0;
        return;
      }
      this.playBar();
      this.musicTimer = window.setTimeout(tick, this.musicMode === 'battle' ? 2400 : 3200);
    };
    tick();
  }

  private pad(freq: number, dur: number, vol: number): void {
    const c = this.ctx!;
    const t0 = c.currentTime + 0.02;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, t0);
    f.frequency.linearRampToValueAtTime(1100, t0 + dur * 0.5);
    f.frequency.linearRampToValueAtTime(500, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    f.connect(g).connect(this.musicBus!);
    for (const det of [-6, 6]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(f);
      o.start(t0);
      o.stop(t0 + dur + 0.1);
    }
  }

  private pluck(freq: number, delay: number, vol: number): void {
    const c = this.ctx!;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    o.connect(g).connect(this.musicBus!);
    o.start(t0);
    o.stop(t0 + 0.7);
  }

  private playBar(): void {
    // A minor progression: Am - F - C - G (menu), Am - Dm - Em - Am (battle)
    const menu = [
      [110, 130.8, 164.8],
      [87.3, 110, 130.8],
      [130.8, 164.8, 196],
      [98, 123.5, 146.8],
    ];
    const battle = [
      [110, 130.8, 164.8],
      [146.8, 174.6, 220],
      [164.8, 196, 246.9],
      [110, 130.8, 164.8],
    ];
    const chords = this.musicMode === 'battle' ? battle : menu;
    const chord = chords[this.step % chords.length];
    const dur = this.musicMode === 'battle' ? 2.5 : 3.3;
    for (const f of chord) this.pad(f, dur, 0.05);
    this.pad(chord[0] / 2, dur, 0.06);
    if (this.musicMode === 'battle') {
      for (let i = 0; i < 4; i++) this.pluck(chord[i % 3] * 4, i * 0.6, 0.035);
    } else if (this.step % 2 === 0) {
      this.pluck(chord[2] * 4, 0.4, 0.03);
      this.pluck(chord[1] * 4, 1.4, 0.025);
    }
    this.step++;
  }
}
