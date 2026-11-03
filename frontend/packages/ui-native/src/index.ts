/**
 * @stackbluff/ui-native — StackBluff native design system.
 *
 * Export surface per docs/mobile-plan/contracts/design-system-api.md.
 * All components are Reanimated/RN primitives driven by tokens.ts (frozen
 * PWA values). Consumed by the table UI (A3) and all screens (A5).
 */

// Typography (existing primitive)
export { AppText, type AppTextProps, type AppTextVariant } from './components/AppText';
// Atoms
export {
  Badge,
  type BadgeProps,
  PlayerSpotBadge,
  type PlayerSpotBadgeProps,
  type RankTier,
  RankTierBadge,
  type RankTierBadgeProps,
  RazorDivider,
  type RazorDividerProps,
  type SpotBadge,
} from './components/atoms';
// Chips
export {
  AnimatedChip,
  type AnimatedChipProps,
  type ChipColors,
  ChipStack,
  type ChipStackProps,
  type ChipUnit,
  DEFAULT_CHIP_COLORS,
  decomposeIntoChips,
} from './components/chips';
// Containers & interactions
export { GlassHub, type GlassHubProps } from './components/GlassHub';
export { InsetRing, type InsetRingProps, parseColor, type RgbaColor } from './components/InsetRing';
// Card primitives
export {
  CardBack,
  type CardBackProps,
  NativeCard,
  type NativeCardProps,
} from './components/NativeCard';
export { NativeTableFelt, type NativeTableFeltProps } from './components/NativeTableFelt';
// Table layers
export { NativeTableRail, type NativeTableRailProps } from './components/NativeTableRail';
// Player identity
export { PlayerAvatar, type PlayerAvatarProps } from './components/PlayerAvatar';
export { PressableScale, type PressableScaleProps } from './components/PressableScale';

// Slider
export { RaiseSlider, type RaiseSliderProps } from './components/RaiseSlider';
export { Surface, type SurfaceProps } from './components/Surface';
// Timer
export { TimerBar, type TimerBarProps } from './components/TimerBar';
// Utilities
export { cn } from './lib/cn';
// Motion presets (Framer → Reanimated, frozen values)
export {
  type MotionPresets,
  motionPresets,
  type SpringConfig,
  type TimingConfig,
} from './motion/presets';
// Theme tokens (colors, rail, felt, card, motion, fonts, chip/table layers…)
export * from './tokens';
// Viewport primitives
export {
  type ContainerSize,
  MeasureContainer,
  type MeasureContainerProps,
  useContainerSize,
  useContainerWidth,
} from './viewport/MeasureContainer';
export {
  getMobilePositions,
  getPositionIndex,
  getPotPosition,
  getTablePositions,
  MAX_SEATS,
  MOBILE_BREAKPOINT,
  MOBILE_TABLE_POSITIONS,
  POT_POSITION,
  type Position,
  positionToStyle,
  TABLE_ANCHORS,
  TABLE_POSITIONS,
  TableViewportProvider,
  type TableViewportProviderProps,
  type TableViewportValue,
  useTableViewport,
} from './viewport/table';
