/**
 * Shared table-UI helpers — 1:1 ports of the PWA formatting/geometry
 * helpers used by the game components (ActionBar, PotBadge, PlayerSpot,
 * CommunityCards, animation layers).
 */
import { type ChipColors, DEFAULT_CHIP_COLORS } from '@stackbluff/ui-native';

/** ActionBar formatCurrency — `$1.2k` shorthand above 1000. */
export function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    const k = (amount / 1000).toFixed(1);
    return `$${k}k`;
  }
  return `$${amount}`;
}

/** PlayerSpot stack formatter — drops the `.0` on round thousands. */
export function formatStack(stack: number): string {
  return stack >= 1000 ? `$${(stack / 1000).toFixed(stack % 1000 === 0 ? 0 : 1)}k` : `$${stack}`;
}

/** PotBadge amount formatter — trims the trailing `.0`. */
export function formatAmount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : n.toString();
}

/** PWA AnimatedChip#getChipColor — the default premium metal palette. */
export function getChipColor(_amount?: number): ChipColors {
  return DEFAULT_CHIP_COLORS;
}

/** CommunityCards responsive card ladder — exact PWA breakpoints/classes. */
export interface CommunityCardMetrics {
  cardWidth: number;
  gap: number;
  /** PWA: window < 980 → 'lg' else 'xl' (unused by native cards; kept for parity). */
  sizeProp: 'lg' | 'xl';
}

export function getCommunityCardMetrics(width: number): CommunityCardMetrics {
  if (width < 365) return { cardWidth: 56, gap: 8, sizeProp: 'lg' }; // w-14, gap-2
  if (width < 400) return { cardWidth: 56, gap: 8, sizeProp: 'lg' };
  if (width < 480) return { cardWidth: 64, gap: 10, sizeProp: 'lg' }; // w-16, gap-2.5
  if (width < 640) return { cardWidth: 64, gap: 12, sizeProp: 'lg' }; // gap-3
  if (width < 846) return { cardWidth: 80, gap: 12, sizeProp: 'lg' }; // w-20
  if (width < 980) return { cardWidth: 96, gap: 16, sizeProp: 'lg' }; // w-24, gap-4
  return { cardWidth: 112, gap: 20, sizeProp: 'xl' }; // w-28, gap-5
}

/** HistoryDialog parseCard — `As`/`Kh` wire strings → rank/suit glyphs. */
export function parseCard(cardStr: string): { rank: string; suit: string } {
  const rankMap: Record<string, string> = {
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    J: 'J',
    Q: 'Q',
    K: 'K',
    A: 'A',
  };
  const suitMap: Record<string, string> = {
    s: '♠',
    h: '♥',
    d: '♦',
    c: '♣',
  };
  const rank = cardStr.slice(0, -1);
  const suit = cardStr.slice(-1);
  return { rank: rankMap[rank] || rank, suit: suitMap[suit] || suit };
}

/** Seat hub width used by the deal layer targets (DealAnimationLayer.tsx). */
export function dealHubWidth(isHero: boolean, isDesktop: boolean): number {
  return isHero ? (isDesktop ? 160 : 128) : isDesktop ? 120 : 100;
}

/** TableState → Money formatter used by stats dialogs. */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
