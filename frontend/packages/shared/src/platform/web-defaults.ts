/**
 * Web default platform surface.
 *
 * Hosts the browser implementations that used to live inline in shared
 * modules (localStorage token storage, the Vibration API haptics engine and
 * the WebAudio procedural sound engine). Everything here is moved code —
 * behavior is identical to the pre-surface implementation.
 *
 * Native hosts (iOS/Android) must NOT rely on this module; they inject their
 * own backends via `configurePlatform()` (see ./surface.ts).
 */
import type { FeedbackPreferences, HapticPattern, SoundType } from '../services/feedback/types';
import { DEFAULT_PREFERENCES } from '../services/feedback/types';
import type { HapticsBackend, OnNetworkChange, PlatformSurface } from './surface';

/* ─────────────────────────────────────────────────────────────────────────
 * Storage backends (localStorage-backed)
 * ───────────────────────────────────────────────────────────────────────── */

export const WEB_TOKEN_KEY = 'auth_token';

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export class WebTokenStorage {
  async get(): Promise<string | null> {
    return safeLocalStorage()?.getItem(WEB_TOKEN_KEY) ?? null;
  }

  async set(token: string | null): Promise<void> {
    const ls = safeLocalStorage();
    if (!ls) return;
    if (token === null) {
      ls.removeItem(WEB_TOKEN_KEY);
    } else {
      ls.setItem(WEB_TOKEN_KEY, token);
    }
  }
}

export class WebKVStorage {
  async getItem(k: string): Promise<string | null> {
    return safeLocalStorage()?.getItem(k) ?? null;
  }

  async setItem(k: string, v: string): Promise<void> {
    safeLocalStorage()?.setItem(k, v);
  }

  async removeItem(k: string): Promise<void> {
    safeLocalStorage()?.removeItem(k);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * HapticEngine — wraps the Vibration API with intensity scaling,
 * smart pattern normalization, and graceful fallback.
 *
 * Design decisions:
 * - Odd-indexed values in patterns are pauses; we preserve rhythm
 *   by scaling pauses less aggressively than vibration durations.
 * - Zero-duration vibrations are stripped to avoid API inconsistencies.
 * - Overlapping calls auto-cancel the previous vibration (browser-native).
 *
 * The engine doubles as the web `HapticsBackend`: the impact/success/
 * warning/error/selection methods are raw device-level primitives
 * (expo-haptics-style) mapped to representative patterns, while the richer
 * `trigger(pattern, prefs)` API is preserved for the feedback controller.
 * ───────────────────────────────────────────────────────────────────────── */
export class HapticEngine implements HapticsBackend {
  private supported: boolean;

  constructor() {
    this.supported =
      typeof navigator !== 'undefined' &&
      'vibrate' in navigator &&
      typeof navigator.vibrate === 'function';
  }

  isSupported(): boolean {
    return this.supported;
  }

  trigger(pattern: HapticPattern, prefs: FeedbackPreferences): void {
    if (!this.supported || !prefs.masterEnabled || !prefs.hapticsEnabled) return;
    if (prefs.hapticIntensity <= 0) return;

    const normalized = this.normalize(pattern, prefs.hapticIntensity);
    if (this.isEmpty(normalized)) return;

    this.fire(normalized);
  }

  /* ── HapticsBackend surface (raw device primitives, no pref gating) ── */

  impact(style: 'light' | 'medium' | 'heavy'): void {
    const pattern = style === 'light' ? 8 : style === 'medium' ? 15 : 25;
    this.fire(pattern);
  }

  success(): void {
    this.fire([15, 30, 15]);
  }

  warning(): void {
    this.fire([30, 20, 30]);
  }

  error(): void {
    this.fire([40, 40, 20]);
  }

  selection(): void {
    this.fire(6);
  }

  cancel(): void {
    if (this.supported) {
      this.fire(0);
    }
  }

  /* ── internals ── */

  private fire(pattern: HapticPattern): void {
    if (!this.supported) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Silently fail — some browsers throw in certain contexts
    }
  }

  private normalize(pattern: HapticPattern, intensity: number): HapticPattern {
    if (typeof pattern === 'number') {
      return Math.max(0, Math.round(pattern * intensity));
    }

    return pattern
      .map((val, idx) => {
        if (idx % 2 === 0) {
          // Vibration duration — scale with intensity
          return Math.max(0, Math.round(val * intensity));
        }
        // Pause duration — preserve rhythm (scale less aggressively)
        return Math.max(0, Math.round(val * (0.4 + 0.6 * intensity)));
      })
      .filter((val, idx, arr) => {
        // Strip trailing zeros and consecutive zero-pairs
        if (val === 0 && idx % 2 === 0 && idx === arr.length - 1) return false;
        return true;
      });
  }

  private isEmpty(pattern: HapticPattern): boolean {
    if (typeof pattern === 'number') return pattern <= 0;
    return pattern.length === 0 || pattern.every((v) => v === 0);
  }
}

export const hapticEngine = new HapticEngine();

/* ─────────────────────────────────────────────────────────────────────────
 * AudioEngine — Procedural sound synthesis using the Web Audio API.
 *
 * Design Philosophy: "Discreet & Realistic"
 * Mimics high-fidelity recordings of real casino felt, cards, and clay chips.
 * - Extremely short envelopes (10ms - 60ms) to avoid synthetic drift.
 * - Soft sine and triangle waves only (no harsh sawtooths or square waves).
 * - Lowpass filters to remove harsh highs and simulate soft materials.
 * - Low master volume to remain unobtrusive.
 *
 * The engine doubles as the web `AudioBackend`: `play(preset, opts)` and
 * `setEnabled(b)` implement the surface interface (using the engine's own
 * preference snapshot), while `playSound(sound, prefs, overrides)` keeps the
 * original rich API used by the feedback controller.
 * ───────────────────────────────────────────────────────────────────────── */

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
  private readonly MAX_VOICES = 16;
  private surfacePrefs: FeedbackPreferences = { ...DEFAULT_PREFERENCES };

  /* ── Lifecycle ── */

  async init(): Promise<void> {
    if (this.ready) return;
    try {
      this.ctx = new AudioContext();

      // Keep master volume relatively low to be discrete
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;

      // Gentle compression to glue the sounds together
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 20;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.005;
      this.compressor.release.value = 0.1;

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // Pre-generate a 0.5s white-noise buffer
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
      this.masterGain.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.05); // Scale overall max to 0.5
    }
  }

  /* ── Public play method (rich API used by the feedback controller) ── */

  playSound(
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
    } catch (e) {
      console.warn('[AudioEngine] Play failed:', e);
    }

    // Free voice after 200ms (all realistic sounds are very short)
    setTimeout(() => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }, 200);
  }

  /* ── AudioBackend surface (simple API for platform consumers) ── */

  play(preset: string, opts?: { volume?: number }): void {
    this.playSound(preset as SoundType, this.surfacePrefs, { volume: opts?.volume ?? 1 });
  }

  setEnabled(b: boolean): void {
    this.surfacePrefs = { ...this.surfacePrefs, masterEnabled: b, audioEnabled: b };
  }

  /* ── Sound synthesis helpers ── */

  public static panner(ctx: AudioContext, value: number): StereoPannerNode {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, value));
    return p;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   REALISTIC & DISCREET SOUND DEFINITIONS
   ═══════════════════════════════════════════════════════════════════ */

const SOUND_MAP: Record<SoundType, SoundMethod> = {
  /* ── Card Flip ──
     A very short, soft high-frequency noise burst.
     Sounds like a card sliding and snapping on felt. */
  cardFlip(ctx, now, vol, pan, pitch, masterGain, noiseBuffer) {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Highpass to remove low rumbles, lowpass to remove harsh hiss
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000 * pitch;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6000 * pitch;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol * 0.15, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04); // 40ms

    const panner = AudioEngine.panner(ctx, pan);
    noise.connect(hp).connect(lp).connect(g).connect(panner).connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.05);
  },

  /* ── Chip Clink ──
     Two very soft, short sine waves at high frequencies.
     Sounds like clay chips softly touching. */
  chipClink(ctx, now, vol, pan, pitch, masterGain) {
    const freqs = [1800 * pitch, 2400 * pitch];

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(vol * (i === 0 ? 0.12 : 0.08), now + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03); // 30ms

      const panner = AudioEngine.panner(ctx, pan);
      osc.connect(g).connect(panner).connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.04);
    });
  },

  /* ── Chip Stack ──
     A few quick, soft chip clinks with slight pitch variation. */
  chipStack(ctx, now, vol, pan, pitch, masterGain, noiseBuffer) {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const t = now + i * 0.025; // 25ms apart
      const p = pitch * (0.95 + Math.random() * 0.1);
      SOUND_MAP.chipClink(ctx, t, vol * 0.8, pan, p, masterGain, noiseBuffer);
    }
  },

  /* ── Soft Tap (Check) ──
     A single, muted, soft sine wave. Very polite. */
  softTap(ctx, now, vol, pan, pitch, masterGain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 400 * pitch;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol * 0.1, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04); // 40ms

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  },

  /* ── Rising Tone (Bet / Raise) ──
     A very subtle, short sine sweep + a chip clink.
     No harsh synth sounds, just a soft "ding" of chips. */
  risingTone(ctx, now, vol, pan, pitch, masterGain, noiseBuffer) {
    // Subtle sweep
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(700 * pitch, now + 0.08);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol * 0.08, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1); // 100ms

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.12);

    // Primary sound is the chip clink
    SOUND_MAP.chipClink(ctx, now, vol * 0.8, pan, pitch, masterGain, noiseBuffer);
  },

  /* ── Falling Tone (Fold) ──
     A soft, muted low sine wave. "Sliding cards back". */
  fallingTone(ctx, now, vol, pan, pitch, masterGain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(150 * pitch, now + 0.1);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500 * pitch;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol * 0.1, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12); // 120ms

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(filter).connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  },

  /* ── Dramatic Hit (All-In) ──
     A soft low thud + chip clink.
     We avoid harsh metallic sweeps to keep it realistic. */
  dramaticHit(ctx, now, vol, pan, pitch, masterGain, noiseBuffer) {
    // Soft low thud
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(100 * pitch, now);
    sub.frequency.exponentialRampToValueAtTime(50 * pitch, now + 0.1);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.0001, now);
    subG.gain.exponentialRampToValueAtTime(vol * 0.2, now + 0.005);
    subG.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    const panner = AudioEngine.panner(ctx, pan);
    sub.connect(subG).connect(panner).connect(masterGain);
    sub.start(now);
    sub.stop(now + 0.2);

    // Heavy chip stack
    SOUND_MAP.chipStack(ctx, now, vol * 0.9, pan, pitch * 0.9, masterGain, noiseBuffer);
  },

  /* ── Fanfare (Win) ──
     A soft, warm, 2-note major chord (C5 → E5).
     Very short and polite, like a high-end slot machine. */
  fanfare(ctx, now, vol, pan, pitch, masterGain) {
    const notes = [523.25, 659.25]; // C5, E5
    notes.forEach((freq, i) => {
      const t = now + i * 0.06;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * pitch;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * 0.15, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); // 200ms

      const panner = AudioEngine.panner(ctx, pan);
      osc.connect(g).connect(panner).connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  },

  /* ── Defeat (Lose) ──
     A soft, muted low click. Barely noticeable. */
  defeat(ctx, now, vol, pan, pitch, masterGain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 200 * pitch;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol * 0.08, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08); // 80ms

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  },

  /* ── Click (UI Button) ──
     Ultra-short, soft pop. */
  click(ctx, now, vol, pan, pitch, masterGain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800 * pitch;

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.01); // 10ms

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.02);
  },

  /* ── Tick (Timer) ──
     Minimal high-frequency click. Nearly subliminal. */
  tick(ctx, now, vol, pan, pitch, masterGain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1200 * pitch;

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.06, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.008); // 8ms

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.01);
  },

  /* ── Urgent Tick (Timer Warning) ──
     A slightly louder, lower double-tap. */
  urgentTick(ctx, now, vol, pan, pitch, masterGain) {
    [0, 0.04].forEach((offset) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 900 * pitch;

      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * 0.1, now + offset);
      g.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.015); // 15ms

      const panner = AudioEngine.panner(ctx, pan);
      osc.connect(g).connect(panner).connect(masterGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.02);
    });
  },

  /* ── Error Buzz ──
     A soft, muted low buzz. */
  errorBuzz(ctx, now, vol, pan, pitch, masterGain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 150 * pitch;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300 * pitch;

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.1, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08); // 80ms

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(filter).connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  },

  /* ── Chime (Notification) ──
     A soft, warm 2-note bell. */
  chime(ctx, now, vol, pan, pitch, masterGain) {
    [880, 1108.73].forEach((freq, i) => {
      // A5, C#6
      const t = now + i * 0.08;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * pitch;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * 0.12, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); // 150ms

      const panner = AudioEngine.panner(ctx, pan);
      osc.connect(g).connect(panner).connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  },

  /* ── Whoosh (Round Start) ──
     A very soft, short filtered noise sweep. */
  whoosh(ctx, now, vol, pan, pitch, masterGain, noiseBuffer) {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.5; // Wide band
    bp.frequency.setValueAtTime(400 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(1200 * pitch, now + 0.1);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol * 0.08, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12); // 120ms

    const panner = AudioEngine.panner(ctx, pan);
    noise.connect(bp).connect(g).connect(panner).connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.15);
  },

  /* ── Settle (Round End) ──
     A soft low sine fade. */
  settle(ctx, now, vol, pan, pitch, masterGain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(150 * pitch, now + 0.15);

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.1, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15); // 150ms

    const panner = AudioEngine.panner(ctx, pan);
    osc.connect(g).connect(panner).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  },
};

export const audioEngine = new AudioEngine();

/* ─────────────────────────────────────────────────────────────────────────
 * Network status (window online/offline events)
 * ───────────────────────────────────────────────────────────────────────── */

export const webOnNetworkChange: OnNetworkChange = (cb) => {
  if (typeof window === 'undefined') return () => {};
  const onOnline = () => cb(true);
  const onOffline = () => cb(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
};

/* ─────────────────────────────────────────────────────────────────────────
 * The web default surface
 * ───────────────────────────────────────────────────────────────────────── */

let webDefaultSurface: PlatformSurface | null = null;

export function getWebDefaultSurface(): PlatformSurface {
  if (!webDefaultSurface) {
    webDefaultSurface = {
      tokenStorage: new WebTokenStorage(),
      kvStorage: new WebKVStorage(),
      haptics: hapticEngine,
      audio: audioEngine,
      api: { baseUrl: '' },
      platformId: 'web',
      onNetworkChange: webOnNetworkChange,
    };
  }
  return webDefaultSurface;
}
