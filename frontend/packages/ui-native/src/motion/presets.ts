import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';
import { motion } from '../tokens';

/**
 * Framer Motion → Reanimated motion presets, frozen from
 * docs/mobile-plan/contracts/theme-tokens.md §Motion and PWA component CSS.
 *
 * Every config object here is ready to be spread into `withTiming` /
 * `withSpring`: e.g. `withTiming(1, motionPresets.dealFlip)` or
 * `withSpring(0.97, motionPresets.pressSpring)`.
 */
export const motionPresets = {
  /** Showdown winner glow pulse — halo opacity 0.5 ↔ 0.7 over 3s easeInOut loop */
  cardWinGlow: {
    loopMs: motion.winGlowLoopMs,
    glowLow: 0.5,
    glowHigh: 0.7,
    easing: Easing.inOut(Easing.ease),
  },
  /** Showdown loser — scale 0.98, 0.5s cubic-bezier(0.22,1,0.36,1) */
  cardLose: {
    durationMs: motion.loseDurationMs,
    easing: Easing.bezier(
      motion.loseEasing[0],
      motion.loseEasing[1],
      motion.loseEasing[2],
      motion.loseEasing[3],
    ),
    scale: motion.loseScale,
  },
  /** Deal / card flip — 0.5s cubic-bezier(0.22,1,0.36,1) */
  dealFlip: {
    durationMs: 500,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  },
  /** Chip toss arc — spring stiffness 260 damping 20 */
  chipToss: {
    spring: motion.chipTossSpring,
  },
  /** Gentle float loop (badges / hub) — 4s easeInOut */
  float: {
    loopMs: motion.floatLoopMs,
    easing: Easing.inOut(Easing.ease),
  },
  /** pulse-emerald glow — 2s ease-in-out infinite */
  pulseEmerald: {
    loopMs: motion.pulseEmeraldLoopMs,
    ringColor: 'rgba(78,222,163,0.4)',
    glowColor: 'rgba(78,222,163,0.15)',
    easing: Easing.inOut(Easing.ease),
  },
  /** Press feedback — spring stiffness 300 damping 20, scale to 0.97 */
  pressSpring: motion.pressSpring,
  pressScale: motion.pressScale,
  /** Shine sweep — 3s linear loop */
  sweep: {
    loopMs: motion.sweepLoopMs,
    easing: Easing.linear,
  },
} as const;

export type MotionPresets = typeof motionPresets;

/** Reusable typing for consumers: a Reanimated timing config. */
export type TimingConfig = WithTimingConfig;
/** Reusable typing for consumers: a Reanimated spring config. */
export type SpringConfig = WithSpringConfig;
