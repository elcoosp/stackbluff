/**
 * BetAnimationLayer — Reanimated port of PWA
 * `components/game/BetAnimationLayer.tsx` (seat → pot chip toss).
 *
 * On every bet/raise/call/all-in lastAction (fold/check skipped, one
 * animation per action id) it flies 2–5 premium chips from the acting
 * seat's anchor to the pot (top 6% mobile / 3% desktop, left 50%) through
 * the ui-native AnimatedChip toss (Framer keyframes times [0, .15, .85, 1],
 * ease cubic-bezier(0.25,0.46,0.45,0.94), duration 0.6s, arc 30, size 20,
 * 0.05s chip stagger, ±8/±5px jitter) — all UI-thread.
 */

import type { Seat } from '@stackbluff/shared/src/stores/gameStore';
import {
  AnimatedChip,
  type ChipColors,
  getPositionIndex,
  getTablePositions,
  type Position,
} from '@stackbluff/ui-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View } from 'react-native';
import { getChipColor } from '../format';

const pct = (s: string) => Number.parseFloat(s);

interface ActiveChip {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: ChipColors;
  delay: number;
  index: number;
}

export interface BetAnimationLayerProps {
  isDesktop: boolean;
  heroSeat: number;
  lastAction: { player_id: string; action: string; amount: number | null } | null;
  seats: Record<number, Seat>;
}

/** Seat anchor → container px (ports the layer's safe `toPixels`). */
function toPixels(pos: Position, w: number, h: number): { x: number; y: number } {
  let y: number;
  if (pos.bottom) {
    y = h - Number.parseFloat(pos.bottom);
  } else {
    y = (pct(pos.top) / 100) * h;
  }
  return { x: (pct(pos.left) / 100) * w, y };
}

export function BetAnimationLayer({
  isDesktop,
  heroSeat,
  lastAction,
  seats,
}: BetAnimationLayerProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activeChips, setActiveChips] = useState<ActiveChip[]>([]);
  const idCounter = useRef(0);
  const processedActionId = useRef<string | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
        ? prev
        : { w: width, h: height },
    );
  }, []);

  const positions = useMemo(() => getTablePositions(!isDesktop), [isDesktop]);

  useEffect(() => {
    if (!lastAction || size.w === 0) return;

    const actionLower = lastAction.action?.toLowerCase();
    if (actionLower === 'fold' || actionLower === 'check') return;

    // 1. Prevent duplicate animations for the same action
    const actionId = `${lastAction.player_id}-${lastAction.action}-${lastAction.amount}`;
    if (processedActionId.current === actionId) return;
    processedActionId.current = actionId;

    // 2. Find the seat of the player who acted
    const seatEntry = Object.entries(seats).find(([, s]) => s.user_id === lastAction.player_id);
    if (!seatEntry) return;

    const seatIndex = Number(seatEntry[0]);
    const posIdx = getPositionIndex(seatIndex, heroSeat);
    const seatPos = positions[posIdx];
    if (!seatPos) return;

    const seatPx = toPixels(seatPos, size.w, size.h);

    // Pot is at top: 6% (mobile) or 3% (desktop), left: 50%
    const potPx = {
      x: size.w / 2,
      y: size.h * (isDesktop ? 0.03 : 0.06),
    };

    // 3. Determine chip amount and count
    const amount = lastAction.amount ?? 50;
    const color = getChipColor(amount);
    const chipCount = Math.min(5, Math.max(2, Math.floor(amount / 50)));

    const newChips: ActiveChip[] = Array.from({ length: chipCount }, (_, i) => ({
      id: `bet-${lastAction.player_id}-${idCounter.current++}-${i}`,
      from: {
        x: seatPx.x + (i === 0 ? 0 : Math.random() * 16 - 8),
        y: seatPx.y + (i === 0 ? 0 : Math.random() * 10 - 5),
      },
      to: {
        x: potPx.x + (i === 0 ? 0 : Math.random() * 16 - 8),
        y: potPx.y + (i === 0 ? 0 : Math.random() * 10 - 5),
      },
      color,
      delay: i * 0.05,
      index: i,
    }));

    setActiveChips((prev) => [...prev, ...newChips]);

    // 4. Clear chips after the toss completes (PWA 800ms)
    const timer = setTimeout(() => {
      setActiveChips((prev) => prev.filter((c) => !newChips.find((nc) => nc.id === c.id)));
    }, 800);

    return () => clearTimeout(timer);
  }, [lastAction, seats, heroSeat, positions, size, isDesktop]);

  return (
    <View
      onLayout={onLayout}
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 445 }}
    >
      {activeChips.map((chip) => (
        <AnimatedChip
          key={chip.id}
          from={chip.from}
          to={chip.to}
          colors={chip.color}
          delay={chip.delay}
          duration={0.6} // Faster for betting
          arcHeight={30} // Lower arc for betting
          zIndex={445}
          size={20} // Slightly smaller for bets
          index={chip.index}
        />
      ))}
    </View>
  );
}
