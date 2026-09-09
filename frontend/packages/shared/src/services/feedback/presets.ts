import type { FeedbackConfig, FeedbackEvent } from './types';

/**
 * Preset configurations mapping each game event to its
 * haptic pattern, sound, and optional visual effect.
 *
 * Haptic patterns: [vibrate_ms, pause_ms, vibrate_ms, ...]
 * Designed for rhythm and texture — not just "buzz longer = more important."
 */
export const FEEDBACK_PRESETS: Record<FeedbackEvent, FeedbackConfig> = {
  /* ── Card events ── */
  cardDeal: {
    haptic: [8],
    sound: 'cardFlip',
    volume: 0.5,
    pitch: 1,
  },
  cardFlip: {
    haptic: [12],
    sound: 'cardFlip',
    volume: 0.7,
    pitch: 1.1,
  },
  dealCommunity: {
    haptic: [10, 40, 10, 40, 10],
    sound: 'cardFlip',
    volume: 0.6,
    pitch: 0.95,
  },

  /* ── Chip / betting ── */
  chipClink: {
    haptic: [15],
    sound: 'chipClink',
    volume: 0.4,
  },
  bet: {
    haptic: [20, 30, 15],
    sound: 'risingTone',
    volume: 0.65,
  },
  raise: {
    haptic: [25, 20, 25, 20, 15],
    sound: 'risingTone',
    volume: 0.75,
    pitch: 1.15,
  },
  check: {
    haptic: [8],
    sound: 'softTap',
    volume: 0.35,
  },
  call: {
    haptic: [18, 25, 12],
    sound: 'chipClink',
    volume: 0.55,
  },
  fold: {
    haptic: [10],
    sound: 'fallingTone',
    volume: 0.4,
  },
  allIn: {
    haptic: [40, 30, 40, 30, 60, 40, 80],
    sound: 'dramaticHit',
    volume: 1.0,
    visual: { glow: '#4edea3', shake: 4, pulse: true },
  },

  /* ── Outcomes ── */
  win: {
    haptic: [30, 30, 30, 30, 60, 40, 100],
    sound: 'fanfare',
    volume: 0.85,
    visual: { glow: '#4edea3', pulse: true },
  },
  lose: {
    haptic: [40, 40, 20],
    sound: 'defeat',
    volume: 0.5,
  },
  potCollect: {
    haptic: [15, 20, 15, 20, 15, 20, 20],
    sound: 'chipStack',
    volume: 0.7,
  },
  showdown: {
    haptic: [20, 40, 30],
    sound: 'cardFlip',
    volume: 0.8,
    pitch: 0.85,
  },

  /* ── UI ── */
  buttonClick: {
    haptic: [6],
    sound: 'click',
    volume: 0.3,
  },
  sliderTick: {
    haptic: [3],
    sound: 'tick',
    volume: 0.12,
  },
  sliderConfirm: {
    haptic: [15, 10, 15],
    sound: 'chipClink',
    volume: 0.5,
  },
  error: {
    haptic: [30, 20, 30],
    sound: 'errorBuzz',
    volume: 0.5,
    visual: { shake: 3 },
  },
  notification: {
    haptic: [20, 40, 20],
    sound: 'chime',
    volume: 0.5,
  },

  /* ── Timer ── */
  timerTick: {
    haptic: null, // No vibration for regular ticks — too annoying
    sound: 'tick',
    volume: 0.15,
  },
  timerUrgent: {
    haptic: [5],
    sound: 'urgentTick',
    volume: 0.35,
  },
  timerFinal: {
    haptic: [10, 10, 10, 10, 15],
    sound: 'urgentTick',
    volume: 0.6,
    visual: { glow: '#ef4444', shake: 2 },
  },

  /* ── Round lifecycle ── */
  roundStart: {
    haptic: [15, 30, 20],
    sound: 'whoosh',
    volume: 0.5,
  },
  roundEnd: {
    haptic: [20],
    sound: 'settle',
    volume: 0.4,
  },
  playerJoin: {
    haptic: [8],
    sound: 'chime',
    volume: 0.25,
    pitch: 1.2,
  },
  playerLeave: {
    haptic: [8],
    sound: 'settle',
    volume: 0.2,
    pitch: 0.8,
  },
};
