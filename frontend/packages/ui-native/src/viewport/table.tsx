import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';

/* ══════════════════════════════════════════════════════════════════════════
   Seat geometry — 1:1 port of apps/pwa/src/lib/seatPositions.ts (FROZEN %s)
   plus the TablePage.tsx center-column anchors. Consumed by A3 (table UI).
   ══════════════════════════════════════════════════════════════════════════ */

/** Absolute seat/pot anchor exactly as the PWA `Position` type. */
export interface Position {
  left: string;
  top: string;
  bottom?: string;
  transform: string;
}

/** Hard seat cap of a full StackBluff table. */
export const MAX_SEATS = 9;

/** PWA responsive breakpoint for the table layout (TablePage isMobile logic). */
export const MOBILE_BREAKPOINT = 768;

/**
 * Desktop (landscape / tablet ≥768px) seat anchors — exact PWA values.
 * Index 0 = seat below the pot (bottom center), clockwise to the left.
 */
export const TABLE_POSITIONS: Position[] = [
  { left: '50%', top: '82%', transform: 'translate(-50%, -50%)' },
  { left: '92%', top: '72%', transform: 'translate(-50%, -50%)' },
  { left: '92%', top: '50%', transform: 'translate(-50%, -50%)' },
  { left: '92%', top: '28%', transform: 'translate(-50%, -50%)' },
  { left: '72%', top: '15%', transform: 'translate(-50%, -50%)' },
  { left: '28%', top: '15%', transform: 'translate(-50%, -50%)' },
  { left: '8%', top: '28%', transform: 'translate(-50%, -50%)' },
  { left: '8%', top: '50%', transform: 'translate(-50%, -50%)' },
  { left: '8%', top: '72%', transform: 'translate(-50%, -50%)' },
];

/**
 * Mobile (<768px) seat anchors — exact PWA values.
 * Hero seat (index 0) anchors `bottom: 10px` instead of a top %.
 * Side seats use an expanded vertical range 10%..70%.
 */
export const MOBILE_TABLE_POSITIONS: Position[] = [
  { left: '50%', top: 'auto', bottom: '10px', transform: 'translate(-50%, -50%)' }, // 0: Hero
  { left: '91%', top: '70%', transform: 'translate(-50%, -50%)' },
  { left: '91%', top: '50%', transform: 'translate(-50%, -50%)' },
  { left: '91%', top: '30%', transform: 'translate(-50%, -50%)' },
  { left: '91%', top: '10%', transform: 'translate(-50%, -50%)' },
  { left: '9%', top: '10%', transform: 'translate(-50%, -50%)' },
  { left: '9%', top: '30%', transform: 'translate(-50%, -50%)' },
  { left: '9%', top: '50%', transform: 'translate(-50%, -50%)' },
  { left: '9%', top: '70%', transform: 'translate(-50%, -50%)' },
];

/**
 * Mobile seat anchors generator — parity with PWA `getMobilePositions`.
 * `isNarrow` (<362px) is currently unused by the PWA math but kept in the
 * signature so A3 can specialize later without a breaking change.
 */
export function getMobilePositions(_isNarrow = false): Position[] {
  const topPositions = [10, 30, 50, 70]; // % from top
  const heroBottom = '10px';

  const rightSide = topPositions.map((t) => ({
    left: '91%',
    top: `${t}%`,
    transform: 'translate(-50%, -50%)',
  }));
  const leftSide = topPositions.map((t) => ({
    left: '9%',
    top: `${t}%`,
    transform: 'translate(-50%, -50%)',
  }));

  return [
    { left: '50%', top: 'auto', bottom: heroBottom, transform: 'translate(-50%, -50%)' }, // 0: Hero
    rightSide[3],
    rightSide[2],
    rightSide[1],
    rightSide[0],
    leftSide[0],
    leftSide[1],
    leftSide[2],
    leftSide[3],
  ];
}

/** Pot anchor — desktop {50%, 10%} / mobile {50%, 14%} (seatPositions.ts). */
export const POT_POSITION = {
  desktop: { left: '50%', top: '10%', transform: 'translate(-50%, -50%)' },
  mobile: { left: '50%', top: '14%', transform: 'translate(-50%, -50%)' },
} as const;

/** Pot anchor selector matching {@link TABLE_POSITIONS} vs mobile variants. */
export function getPotPosition(isMobile: boolean): Position {
  return isMobile ? POT_POSITION.mobile : POT_POSITION.desktop;
}

/** Seat list selector matching the PWA isDesktop branch. */
export function getTablePositions(isMobile: boolean): Position[] {
  return isMobile ? MOBILE_TABLE_POSITIONS : TABLE_POSITIONS;
}

/** Clockwise seat rotation so the hero seat always renders at index 0. */
export function getPositionIndex(seatIndex: number, heroSeat: number): number {
  return (((seatIndex - heroSeat) % MAX_SEATS) + MAX_SEATS) % MAX_SEATS;
}

/**
 * Center-column anchors measured from TablePage.tsx / DealAnimationLayer.tsx:
 * - community cards: absolutely centered at top 42% (mobile) / 40% (desktop)
 * - deck (deal origin): x 50%, y 35% (mobile) / 38% (desktop)
 * - felt inset (rail → felt padding): 12px mobile / 40px desktop
 * - container max width: 500px mobile / 1000px desktop
 */
export const TABLE_ANCHORS = {
  communityCardsTop: { mobile: '42%', desktop: '40%' },
  deck: { mobile: { x: 0.5, y: 0.35 }, desktop: { x: 0.5, y: 0.38 } },
  feltInset: { mobile: 12, desktop: 40 },
  containerMaxWidth: { mobile: 500, desktop: 1000 },
} as const;

/* ── positionToStyle ── */

function lengthToRN(value: string): number | string {
  if (value.endsWith('px')) return Number.parseFloat(value);
  return value;
}

/**
 * Converts a PWA `Position` (`{left:'92%', top:'72%', transform:
 * 'translate(-50%, -50%)'}`) into a React Native absolute style.
 *
 * RN has no `translate(-50%, -50%)` string, so centering is emitted as
 * `transform: [{translateX: '-50%'}, {translateY: '-50%'}]` (percentage
 * translate, RN ≥0.76) — or, when the caller passes `measured` seat size,
 * as exact pixel offsets (works on every RN version).
 *
 * `top: 'auto'` (mobile hero seat) is dropped in favor of `bottom`.
 */
export function positionToStyle(
  position: Position,
  measured?: { width: number; height: number },
): ViewStyle {
  const match = /translate\(\s*([-\d.]+%)[,\s]+([-\d.]+%)\s*\)/.exec(position.transform);
  const txPct = match ? Number.parseFloat(match[1]) : 0;
  const tyPct = match ? Number.parseFloat(match[2]) : 0;

  const translate = measured
    ? [
        { translateX: (txPct / 100) * measured.width },
        { translateY: (tyPct / 100) * measured.height },
      ]
    : [{ translateX: `${txPct}%` }, { translateY: `${tyPct}%` }];

  const style: ViewStyle = {
    position: 'absolute',
    left: lengthToRN(position.left),
    transform: translate,
    ...(position.bottom != null
      ? { bottom: lengthToRN(position.bottom) }
      : position.top !== 'auto'
        ? { top: lengthToRN(position.top) }
        : {}),
  };

  return style;
}

/* ── TableViewport ── */

export interface TableViewportValue {
  /** Measured container width in px (0 before first layout). */
  width: number;
  /** Measured container height in px (0 before first layout). */
  height: number;
  /** `width < 768` — the PWA table breakpoint. */
  isMobile: boolean;
}

const TableViewportContext = createContext<TableViewportValue>({
  width: 0,
  height: 0,
  isMobile: true,
});

export interface TableViewportProviderProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps the table screen area (rail + felt + seats), measures itself via
 * `onLayout` and publishes `{width, height, isMobile}`. Mirrors the PWA
 * `useIsDesktop`/window-width behavior for the frozen table geometry.
 */
export function TableViewportProvider({ children, style }: TableViewportProviderProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => {
      if (Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5) {
        return prev;
      }
      return { width, height };
    });
  }, []);

  const value = useMemo<TableViewportValue>(
    () => ({ ...size, isMobile: size.width < MOBILE_BREAKPOINT }),
    [size],
  );

  return (
    <TableViewportContext.Provider value={value}>
      <View onLayout={handleLayout} style={[{ flex: 1 }, style]}>
        {children}
      </View>
    </TableViewportContext.Provider>
  );
}

/** Read the measured table viewport. Pair with {@link positionToStyle}. */
export function useTableViewport(): TableViewportValue {
  return useContext(TableViewportContext);
}
