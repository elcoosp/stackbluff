/**
 * ChipAnimationLayer — Reanimated port of PWA
 * `components/game/ChipAnimationLayer.tsx` (pot → winner payout).
 *
 * Gated by the TableScene's `showdownMorphComplete` delay (400ms after the
 * showdown reveal). Each winner receives one premium chip per $100 won
 * (min 1, max 30) flying from the morphed pot anchor (left 50%, top 30% —
 * the PWA's hardcoded `top-[30%] left-1/2`) to the winner seat, grouped
 * into stacks of 6 ((stackIdx − 2)×10 x-offset, chip-in-stack × −2 y),
 * delay 0.5 + i·0.04s, duration 1.2s, arc 80, size 24 — ui-native
 * AnimatedChip, UI-thread.
 */

import type { ShowdownRevealData } from '@stackbluff/shared/src/stores/gameStore';
import {
  AnimatedChip,
  getPositionIndex,
  getTablePositions,
  type Position,
} from '@stackbluff/ui-native';
import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View } from 'react-native';
import { getChipColor } from '../format';

const pct = (s: string) => Number.parseFloat(s);

export interface ChipAnimationLayerProps {
  isDesktop: boolean;
  heroSeat: number;
  showdownReveal: ShowdownRevealData | null;
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

export function ChipAnimationLayer({
  isDesktop,
  heroSeat,
  showdownReveal,
}: ChipAnimationLayerProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
        ? prev
        : { w: width, h: height },
    );
  }, []);

  const positions = useMemo(() => getTablePositions(!isDesktop), [isDesktop]);

  const winnerChips = useMemo(() => {
    const chips: { id: string; seatIndex: number; amount: number }[] = [];
    if (!showdownReveal) return chips;
    for (const player of showdownReveal.players) {
      if (player.is_winner && player.win_amount > 0) {
        chips.push({
          id: `win-${player.user_id}-${player.seat}`,
          seatIndex: player.seat,
          amount: player.win_amount,
        });
      }
    }
    return chips;
  }, [showdownReveal]);

  // Hardcoded to match the exact CSS top-[30%] left-1/2 morphed pot position
  const potPx = { x: size.w / 2, y: size.h * 0.3 };

  return (
    <View
      onLayout={onLayout}
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 500 }}
    >
      {size.w > 0 &&
        size.h > 0 &&
        winnerChips.flatMap((winner) => {
          const posIdx = getPositionIndex(winner.seatIndex, heroSeat);
          const seatPos = positions[posIdx];
          if (!seatPos) return [];

          const seatPx = toPixels(seatPos, size.w, size.h);
          const color = getChipColor(winner.amount);

          // 1 chip per $100 won. Minimum 1, Maximum 30.
          const chipCount = Math.min(30, Math.max(1, Math.floor(winner.amount / 100)));

          return Array.from({ length: chipCount }, (_, i) => {
            // Group chips into stacks (e.g., 5 stacks of chips)
            const stackIdx = Math.floor(i / 6);
            const chipInStack = i % 6;
            const xOffset = (stackIdx - 2) * 10;
            const yOffset = chipInStack * -2;

            return (
              <AnimatedChip
                // biome-ignore lint/suspicious/noArrayIndexKey: stable payout list, order doesn't change
                key={`${winner.id}-chip-${i}`}
                from={{ x: potPx.x, y: potPx.y }}
                to={{ x: seatPx.x, y: seatPx.y }}
                colors={color}
                delay={0.5 + i * 0.04}
                duration={1.2}
                arcHeight={80}
                zIndex={500}
                size={24}
                xOffset={xOffset}
                yOffset={yOffset}
                index={i}
              />
            );
          });
        })}
    </View>
  );
}
