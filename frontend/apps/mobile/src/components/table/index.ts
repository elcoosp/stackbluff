/**
 * components/table — StackBluff mobile table UI barrel (Task 3-a).
 *
 * Scene + primitives + dialogs + animation layers, mirroring the PWA
 * `components/game/index.ts` surface with the native additions
 * (TableScene, LiveTimerBar, the countdown/pre-action hooks and the
 * wsCompat shared-event bus).
 */

/* Primitives */
export { ActionBar, type ActionBarProps } from './ActionBar';
export {
  HandStrength,
  MobileAnalyticsStrip,
  TacticalOracle,
} from './AnalyticsPanel';
export { AnimatedNumber, type AnimatedNumberProps } from './AnimatedNumber';
/* Animation layers */
export { BetAnimationLayer, type BetAnimationLayerProps } from './animations/BetAnimationLayer';
export { ChipAnimationLayer, type ChipAnimationLayerProps } from './animations/ChipAnimationLayer';
export { DealAnimationLayer, type DealAnimationLayerProps } from './animations/DealAnimationLayer';
export { CommunityCards, type CommunityCardsProps } from './CommunityCards';
/* Theme + helpers */
export { type ClubTheme, useClubFeltTint, useClubThemeStore } from './clubTheme';
export { BuyInDialog, type BuyInDialogProps } from './dialogs/BuyInDialog';
/* Dialogs */
export { DialogButton, DialogDivider, DialogShell, DialogTitle } from './dialogs/DialogShell';
export { GameDialog, type GameDialogProps } from './dialogs/GameDialog';
export { HistoryDialog, type HistoryDialogProps } from './dialogs/HistoryDialog';
export { KickVoteDialog, type KickVoteDialogProps } from './dialogs/KickVoteDialog';
export { LeaveTableDialog, type LeaveTableDialogProps } from './dialogs/LeaveTableDialog';
export { PlayerStatsDialog, type PlayerStatsDialogProps } from './dialogs/PlayerStatsDialog';
export {
  dealHubWidth,
  formatAmount,
  formatCurrency,
  formatMoney,
  formatPercent,
  formatStack,
  getChipColor,
  getCommunityCardMetrics,
  parseCard,
} from './format';
export { LiveTimerBar, type LiveTimerBarProps } from './LiveTimerBar';
export { PlayerSpot, type PlayerSpotProps } from './PlayerSpot';
export { type LastAction, PotBadge, type PotBadgeProps } from './PotBadge';
export { SeatGrid, type SeatGridProps } from './SeatGrid';
export { SitOutButton, type SitOutButtonProps } from './SitOutButton';
export { TablePreviewThumbnail, type TablePreviewThumbnailProps } from './TablePreviewThumbnail';
/* Scene */
export { TableScene, type TableSceneProps, type TableSceneSocket } from './TableScene';
/* Hooks */
export { useGameFeedback } from './useGameFeedback';
export { type PreAction, usePreAction } from './usePreAction';
export { type TimerLevel, type TurnCountdown, useTurnCountdown } from './useTurnTimer';

/* Shared-event bus (RN stand-in for the PWA window CustomEvent transport) */
export { emitSharedEvent, installWsCompat, onSharedEvent } from './wsCompat';
