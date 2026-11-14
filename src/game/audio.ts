class SoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private distortionCurve: Float32Array<ArrayBuffer> | null = null;
  public muted = false;

  private ensureCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.compressor) {
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-14, this.ctx.currentTime);
      comp.knee.setValueAtTime(18, this.ctx.currentTime);
      comp.ratio.setValueAtTime(8, this.ctx.currentTime);
      comp.attack.setValueAtTime(0.002, this.ctx.currentTime);
      comp.release.setValueAtTime(0.18, this.ctx.currentTime);
      comp.connect(this.ctx.destination);
      this.compressor = comp;
    }
    if (this.ctx && !this.noiseBuffer) {
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    if (!this.distortionCurve) {
      const samples = 256;
      const curve = new Float32Array(new ArrayBuffer(samples * 4));
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((Math.PI + 18) * x) / (Math.PI + 18 * Math.abs(x));
      }
      this.distortionCurve = curve;
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureCtx();
  }

  private get output(): AudioNode | null {
    if (!this.ctx) return null;
    return this.compressor || this.ctx.destination;
  }

  public playJump() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(460, t + 0.14);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playPickup(kind: 'bone' | 'green_bone' | 'nitro' | 'medkit') {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const freqs =
      kind === 'green_bone'
        ? [587, 740, 880, 1175]
        : kind === 'bone'
        ? [523, 784]
        : kind === 'nitro'
        ? [440, 880, 1175]
        : [392, 523, 659];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'green_bone' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, t + idx * 0.05);
      gain.gain.setValueAtTime(kind === 'green_bone' ? 0.14 : 0.11, t + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + (kind === 'green_bone' ? 0.18 : 0.12));
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + (kind === 'green_bone' ? 0.19 : 0.13));
    });
  }

  public playHeadCrash(isFatal: boolean, intensity = 1, isHeadFirst = true) {
    const ctx = this.ensureCtx();
    const out = this.output;
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const power = Math.min(1.45, Math.max(0.65, intensity));

    // Layer 1: Sub-bass ground slam with wave-shaper punch
    const subOsc = ctx.createOscillator();
    const subShaper = ctx.createWaveShaper();
    const subGain = ctx.createGain();
    if (this.distortionCurve) subShaper.curve = this.distortionCurve;
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(isHeadFirst ? 185 : 140, t);
    subOsc.frequency.exponentialRampToValueAtTime(26, t + 0.32);
    subGain.gain.setValueAtTime(0.52 * power, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    subOsc.connect(subShaper).connect(subGain).connect(out);
    subOsc.start(t);
    subOsc.stop(t + 0.38);

    // Layer 2: Helmet crack & gravel crunch noise burst
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(isHeadFirst ? 1.4 : 0.9, t);
      filter.frequency.setValueAtTime(isHeadFirst ? 2400 : 1400, t);
      filter.frequency.exponentialRampToValueAtTime(220, t + 0.28);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.45 * power, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      noise.connect(filter).connect(noiseGain).connect(out);
      noise.start(t);
      noise.stop(t + 0.32);
    }

    // Layer 3: Metallic bicycle frame clatter
    const clatterFreqs = isHeadFirst ? [390, 675, 1140] : [310, 520];
    clatterFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const start = t + i * 0.018;
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, start + 0.14);
      gain.gain.setValueAtTime(0.09 * power, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      osc.connect(gain).connect(out);
      osc.start(start);
      osc.stop(start + 0.16);
    });

    // Layer 4: Expressive dog yelp / groan
    const yelp = ctx.createOscillator();
    const yelpGain = ctx.createGain();
    yelp.type = 'triangle';
    yelp.frequency.setValueAtTime(isFatal ? 720 : 620, t + 0.045);
    yelp.frequency.exponentialRampToValueAtTime(isFatal ? 150 : 330, t + (isFatal ? 0.62 : 0.28));
    yelpGain.gain.setValueAtTime(0.24 * Math.min(1.15, power), t + 0.045);
    yelpGain.gain.exponentialRampToValueAtTime(0.001, t + (isFatal ? 0.65 : 0.3));
    yelp.connect(yelpGain).connect(out);
    yelp.start(t + 0.045);
    yelp.stop(t + (isFatal ? 0.66 : 0.32));
  }

  public playBark() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 0.11].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(290, t + offset);
      osc.frequency.exponentialRampToValueAtTime(140, t + offset + 0.08);
      gain.gain.setValueAtTime(0.12, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.1);
    });
  }

  public playTaunt(tauntId: string) {
    const ctx = this.ensureCtx();
    const out = this.output;
    if (!ctx || !out) return;
    const t = ctx.currentTime;

    const pattern: Record<string, { freqs: number[]; type: OscillatorType; dur: number }> = {
      ahead: { freqs: [523, 659, 784], type: 'triangle', dur: 0.08 },
      bark_taunt: { freqs: [360, 220, 420, 240], type: 'square', dur: 0.07 },
      nitro_laugh: { freqs: [440, 587, 740, 988], type: 'sawtooth', dur: 0.06 },
      head_warn: { freqs: [660, 440, 660], type: 'triangle', dur: 0.09 },
      catch_me: { freqs: [587, 880, 587, 1046], type: 'sine', dur: 0.07 },
      nice_flip: { freqs: [523, 659, 784, 1046], type: 'sine', dur: 0.09 },
    };
    const cfg = pattern[tauntId] || pattern.ahead;
    cfg.freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = cfg.type;
      const start = t + idx * (cfg.dur + 0.02);
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + cfg.dur);
      osc.connect(gain).connect(out);
      osc.start(start);
      osc.stop(start + cfg.dur + 0.01);
    });
  }

  public playFlip() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    [587, 740, 880].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t + idx * 0.045);
      gain.gain.setValueAtTime(0.1, t + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.045 + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + idx * 0.045);
      osc.stop(t + idx * 0.045 + 0.13);
    });
  }

  public playThunder() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.55);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  public playGunshot(weaponId: '98k' | 'm47' | 'pistol') {
    const ctx = this.ensureCtx();
    const out = this.output;
    if (!ctx || !out) return;
    const t = ctx.currentTime;

    // Noise transient crack
    const dur = weaponId === '98k' ? 0.22 : weaponId === 'm47' ? 0.09 : 0.12;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * (weaponId === '98k' ? 0.35 : 0.25)));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = weaponId === '98k' ? 1400 : weaponId === 'm47' ? 1900 : 2200;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(weaponId === '98k' ? 0.38 : 0.22, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(filter).connect(nGain).connect(out);
    noise.start(t);

    // Punch oscillator
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = weaponId === '98k' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(weaponId === '98k' ? 240 : weaponId === 'm47' ? 180 : 320, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + dur);
    oGain.gain.setValueAtTime(weaponId === '98k' ? 0.28 : 0.16, t);
    oGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(oGain).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  public playHitConfirm(fatal: boolean) {
    const ctx = this.ensureCtx();
    const out = this.output;
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fatal ? 920 : 680, t);
    osc.frequency.exponentialRampToValueAtTime(fatal ? 1380 : 480, t + (fatal ? 0.16 : 0.08));
    gain.gain.setValueAtTime(fatal ? 0.22 : 0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (fatal ? 0.18 : 0.09));
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + (fatal ? 0.19 : 0.1));
  }

  public playSilentTrapCue(kind: 'hazard' | 'spring', urgency: number) {
    const ctx = this.ensureCtx();
    const out = this.output;
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (kind === 'spring') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);
    } else {
      osc.type = 'triangle';
      const base = 420 + urgency * 560;
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.06);
    }
    gain.gain.setValueAtTime(0.08 + urgency * 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playSilentSlopeCue(slopeRad: number) {
    const ctx = this.ensureCtx();
    const out = this.output;
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    if (slopeRad < -0.18) {
      // Uphill / launch ramp: rising tone
      osc.frequency.setValueAtTime(310, t);
      osc.frequency.exponentialRampToValueAtTime(540, t + 0.12);
    } else {
      // Steep drop: falling tone
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(190, t + 0.14);
    }
    gain.gain.setValueAtTime(0.075, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playFinish(win: boolean) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = win ? [523, 659, 784, 1046] : [392, 349, 311, 261];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t + i * 0.1);
      gain.gain.setValueAtTime(0.15, t + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.3);
    });
  }
}

export const soundEngine = new SoundEngine();
