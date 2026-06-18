import type { SoundType, FeedbackPreferences } from './types';

/**
 * AudioEngine — procedural sound synthesis using the Web Audio API.
 *
 * All sounds are generated at runtime from oscillators and noise buffers.
 * No audio files required → zero latency, tiny bundle, infinite variation.
 *
 * Signal chain per voice:
 *   Source(s) → Filter(s) → Gain (envelope) → StereoPanner → masterGain → compressor → destination
 *
 * Key features:
 * - Lazy init (respects browser autoplay policy — needs user gesture)
 * - Pre-generated noise buffer reused across all noise-based sounds
 * - DynamicsCompressor prevents clipping when multiple sounds overlap
 * - Spatial panning per sound for positional audio
 * - Concurrent voice limiting (max 12 simultaneous)
 * - Pitch multiplier for variety (e.g., each card deal sounds slightly different)
 */

type SoundMethod = (
  ctx: AudioContext,
  now: number,
  vol: number,
  pan: number,
  pitch: number,
  masterGain: GainNode,
  noiseBuffer: AudioBuffer,
) => void;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ready = false;
  private activeVoices = 0;
  private readonly MAX_VOICES = 12;

  /* ── Lifecycle ── */

  async init(): Promise<void> {
    if (this.ready) return;
    try {
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.6;

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.15;

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // Pre-generate a 0.5s white-noise buffer (reused by all noise-based sounds)
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, sr * 0.5, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;

      this.ready = true;
    } catch (e) {
      console.warn('[AudioEngine] Init failed:', e);
    }
  }

  async resume(): Promise<void> {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  isReady(): boolean {
    return this.ready && this.ctx?.state === 'running';
  }

  setVolume(v: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
  }

  /* ── Public play method ── */

  play(
    sound: SoundType,
    prefs: FeedbackPreferences,
    overrides?: { volume?: number; pan?: number; pitch?: number },
  ): void {
    if (!prefs.masterEnabled || !prefs.audioEnabled || !this.ready || !this.ctx) return;
    if (this.activeVoices >= this.MAX_VOICES) return;

    const vol = (overrides?.volume ?? 1) * prefs.audioVolume;
    if (vol <= 0) return;

    const pan = prefs.spatialAudio ? (overrides?.pan ?? 0) : 0;
    const pitch = overrides?.pitch ?? 1;

    const method = SOUND_MAP[sound];
    if (!method) return;

    const now = this.ctx.currentTime;
    this.activeVoices++;

    try {
      method(this.ctx, now, vol, pan, pitch, this.masterGain!, this.noiseBuffer!);
    } catch {
      // Graceful — never crash the game over an audio glitch
    }

    // Voice will be freed after ~500ms max (all our sounds are short)
    setTimeout(() => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }, 600);
  }

  /* ── Sound synthesis helpers ── */

  /** Create a gain node with an attack/decay envelope */
  private static env(
    ctx: AudioContext,
    now: number,
    peak: number,
    attack: number,
    decay: number,
  ): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    return g;
  }

  /** Create a stereo panner */
  private static panner(ctx: AudioContext, value: number): StereoPannerNode {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, value));
    return p;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   SOUND DEFINITIONS
   Each function builds an ad-hoc audio graph, plays it, and lets
   the browser GC the nodes when they finish (Web Audio best practice).
   ═══════════════════════════════════════════════════════════════════ */

const SOUND_MAP: Record<SoundType, SoundMethod> = {

  /* ── Card Flip ──
     Filtered noise burst with a high→low bandpass sweep.
     Mimics the crisp "snap" of a card being turned. */
  cardFlip(ctx, now, vol, pan, pitch, masterGain, noiseBuffer) {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(3200 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(600 * pitch, now + 0.07);

    const gain = AudioEngine.env(ctx, now, vol * 0.45, 0.001, 0.07);
    const panner = AudioEngine.panner(ctx, pan);

    noise.connect(bp).connect(gain).connect(panner).connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.1);
  },

  /* ── Chip Clink ──
     Two sine oscillators at "ceramic" frequencies with fast decay,
     plus a tiny noise burst for texture. Sounds like chips clicking. */
  chipClink(ctx, now, vol, pan, pitch, masterGain) {
    const freqs = [3200 * pitch, 4800 * pitch];

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;

      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * (i === 0 ? 0.25 : 0.18), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04 + i * 0.01);

      const panner = AudioEngine.panner(ctx, pan);
      osc.connect(g).connect(panner).connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.08);
    });
  },

  /* ── Chip Stack ──
     Multiple chipClink sounds in rapid succession with slight
     pitch variation — sounds like chips being gathered/stacked. */
  chipStack(ctx, now, vol, pan, pitch, masterGain, noiseBuffer) {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const t = now + i * 0.04;
      const p = pitch * (0.95 + Math.random() * 0.1);
      SOUND_MAP.chipClink(ctx, t, vol * (1 - i * 0.12), pan, p, masterGain, noiseBuffer);
    }
  },

  /* ── Soft Tap ──
     Very short sine at 800Hz. Used for "check" — minimal, polite. */
  softTap(ctx, now, vol, pan, pitch, masterGain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800 * pitch;

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.2, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  },

  /* ── Rising Tone ──
     Sine sweep upward + chip clink. For raise / bet — "going up!" */
  risingTone(ctx, now, vol, pan, pitch, masterGain, noiseBuffer) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(900 * pitch, now + 0.15);

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.18, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.2);

    // Add chip clink at the start
    SOUND_MAP.chipClink(ctx, now, vol * 0.6, pan, pitch, masterGain, noiseBuffer);
  },

  /* ── Falling Tone ──
     Descending sweep. For fold — a subtle "letting go" feeling. */
  fallingTone(ctx, now, vol, pan, pitch, masterGain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(180 * pitch, now + 0.15);

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  },

  /* ── Dramatic Hit ──
     Low thud + noise burst + rising sweep. For all-in — maximum impact. */
  dramaticHit(ctx, now, vol, pan, pitch, masterGain, noiseBuffer) {
    // Low sub hit
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 80 * pitch;
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(vol * 0.4, now);
    subG.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    sub.connect(subG);

    // Noise impact
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseBp = ctx.createBiquadFilter();
    noiseBp.type = 'lowpass';
    noiseBp.frequency.value = 2000;
    const noiseG = ctx.createGain();
    noiseG.gain.setValueAtTime(vol * 0.3, now);
    noiseG.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    // Rising sweep
    const sweep = ctx.createOscillator();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(200 * pitch, now);
    sweep.frequency.exponentialRampToValueAtTime(800 * pitch, now + 0.2);
    const sweepG = ctx.createGain();
    sweepG.gain.setValueAtTime(vol * 0.08, now + 0.02);
    sweepG.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    const panner = AudioEngine.panner(ctx, pan);
    subG.connect(panner);
    noiseG.connect(panner);
    sweepG.connect(panner);
    panner.connect(masterGain);

    sub.start(now); sub.stop(now + 0.3);
    noise.connect(noiseBp).connect(noiseG);
    noise.start(now); noise.stop(now + 0.15);
    sweep.start(now); sweep.stop(now + 0.3);
  },

  /* ── Fanfare ──
     Major-chord arpeggio (C5 → E5 → G5 → C6) with overlapping
     decay tails. For winning a hand — celebratory but brief. */
  fanfare(ctx, now, vol, pan, pitch, masterGain) {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const t = now + i * 0.08;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * pitch;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * 0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

      const panner = AudioEngine.panner(ctx, pan);
      osc.connect(g).connect(panner).connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  },

  /* ── Defeat ──
     Minor-second descent (A4 → Ab4). Quiet, somber. */
  defeat(ctx, now, vol, pan, pitch, masterGain) {
    [440, 415.3].forEach((freq, i) => {
      const t = now + i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * pitch;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * 0.1, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

      const panner = AudioEngine.panner(ctx, pan);
      osc.connect(g).connect(panner).connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  },

  /* ── Click ──
     Ultra-short pop. For generic button presses. */
  click(ctx, now, vol, pan, pitch, masterGain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1500 * pitch;

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.2, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.02);
  },

  /* ── Tick ──
     Minimal click for timer. Nearly subliminal. */
  tick(ctx, now, vol, pan, pitch, masterGain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1000 * pitch;

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.08, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.015);
  },

  /* ── Urgent Tick ──
     Louder, lower, double-tap. Timer is running out! */
  urgentTick(ctx, now, vol, pan, pitch, masterGain) {
    [0, 0.05].forEach(offset => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 800 * pitch;

      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * 0.15, now + offset);
      g.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.02);

      const panner = AudioEngine.panner(ctx, pan);
      osc.connect(g).connect(panner).connect(masterGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.03);
    });
  },

  /* ── Error Buzz ──
     Square-wave bursts. "Bzzt — invalid action." */
  errorBuzz(ctx, now, vol, pan, pitch, masterGain) {
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.05;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 200 * pitch;

      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * 0.1, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);

      const panner = AudioEngine.panner(ctx, pan);
      osc.connect(g).connect(panner).connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.04);
    }
  },

  /* ── Chime ──
     Two-tone ascending perfect fifth. For notifications. */
  chime(ctx, now, vol, pan, pitch, masterGain) {
    [880, 1318.5].forEach((freq, i) => {
      const t = now + i * 0.08;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * pitch;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * 0.18, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

      const panner = AudioEngine.panner(ctx, pan);
      osc.connect(g).connect(panner).connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  },

  /* ── Whoosh ──
     Filtered noise sweep. For round start / new deal. */
  whoosh(ctx, now, vol, pan, pitch, masterGain, noiseBuffer) {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(200 * pitch, now);
    hp.frequency.exponentialRampToValueAtTime(4000 * pitch, now + 0.12);
    hp.frequency.exponentialRampToValueAtTime(200 * pitch, now + 0.2);

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.15, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    const panner = AudioEngine.panner(ctx, pan);
    noise.connect(hp).connect(g).connect(panner).connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.25);
  },

  /* ── Settle ──
     Low sine fade-out. For round end — "the dust settles." */
  settle(ctx, now, vol, pan, pitch, masterGain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 200 * pitch;

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  },
};

export const audioEngine = new AudioEngine();
