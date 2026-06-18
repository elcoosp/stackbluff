import { useState, useLayoutEffect, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '@stackbluff/shared/stores/gameStore';
import {
  desktopPositions,
  getMobilePositions,
  getPositionIndex,
  type Position,
} from '@/lib/seatPositions';
import { AnimatedChip, getChipColor } from './AnimatedChip';

const pct = (s: string) => parseFloat(s);

function useViewportWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 500);
  useLayoutEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

interface BetAnimationLayerProps {
  isDesktop: boolean;
  heroSeat: number;
}

export const BetAnimationLayer = ({ isDesktop, heroSeat }: BetAnimationLayerProps) => {
  const lastAction = useGameStore((s) => s.lastAction);
  const seats = useGameStore((s) => s.seats);
  const vw = useViewportWidth();

  const isNarrow = !isDesktop && vw < 362;
  const positions = isDesktop ? desktopPositions : getMobilePositions(isNarrow);

  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [activeChips, setActiveChips] = useState<Array<{ id: string; from: any; to: any; color: any; delay: number; index: number }>>([]);
  const idCounter = useRef(0);
  const processedActionId = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!node) return;
    const updateSize = () => {
      setContainerSize({
        w: node.offsetWidth,
        h: node.offsetHeight,
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);

  useEffect(() => {
    if (!lastAction || containerSize.w === 0) return;
    if (lastAction.action === 'fold' || lastAction.action === 'check') return;

    // 1. Prevent duplicate animations for the same action
    const actionId = `${lastAction.player_id}-${lastAction.action}-${lastAction.amount}`;
    if (processedActionId.current === actionId) return;
    processedActionId.current = actionId;

    // 2. Find the seat of the player who acted
    const seatEntry = Object.entries(seats).find(([, s]: [string, any]) => s.user_id === lastAction.player_id);
    if (!seatEntry) return;

    const seatIndex = Number(seatEntry[0]);
    const posIdx = getPositionIndex(seatIndex, heroSeat);
    const seatPos = positions[posIdx];
    if (!seatPos) return;

    const toPixels = (pos: Position) => ({
      x: (pct(pos.left) / 100) * containerSize.w,
      y: (pct(pos.top) / 100) * containerSize.h,
    });

    const seatPx = toPixels(seatPos);

    // Pot is at top: 6% (mobile) or 3% (desktop), left: 50%
    const potPx = {
      x: containerSize.w / 2,
      y: containerSize.h * (isDesktop ? 0.03 : 0.06)
    };

    // 3. Determine chip amount and count
    const amount = lastAction.amount ?? 50;
    const color = getChipColor(amount);
    const chipCount = Math.min(5, Math.max(2, Math.floor(amount / 50)));

    const newChips = Array.from({ length: chipCount }, (_, i) => ({
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

    // 4. Clear chips after animation completes
    const timer = setTimeout(() => {
      setActiveChips((prev) => prev.filter((c) => !newChips.find((nc) => nc.id === c.id)));
    }, 800);

    return () => clearTimeout(timer);
  }, [lastAction, seats, heroSeat, positions, containerSize, isDesktop]);

  return (
    <div
      ref={setNode}
      className="absolute inset-0 z-[445] pointer-events-none overflow-visible"
    >
      <AnimatePresence>
        {activeChips.map((chip) => (
          <AnimatedChip
            key={chip.id}
            from={chip.from}
            to={chip.to}
            color={chip.color}
            delay={chip.delay}
            duration={0.6} // Faster for betting
            arcHeight={30} // Lower arc for betting
            zIndex={445}
            size={20} // Slightly smaller for bets
            index={chip.index}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
