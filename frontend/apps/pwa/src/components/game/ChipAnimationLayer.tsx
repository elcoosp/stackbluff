import { useLayoutEffect, useState } from 'react';
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

interface ChipAnimationLayerProps {
  isDesktop: boolean;
  heroSeat: number;
  potRef: React.RefObject<HTMLDivElement>;
  showdownReveal: any;
}

export const ChipAnimationLayer = ({
  isDesktop,
  heroSeat,
  potRef,
  showdownReveal,
}: ChipAnimationLayerProps) => {
  const vw = useViewportWidth();

  const isNarrow = !isDesktop && vw < 362;
  const positions = isDesktop ? desktopPositions : getMobilePositions(isNarrow);

  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

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

  if (!showdownReveal)
    return (
      <div
        ref={setNode}
        className="absolute inset-0 z-[500] pointer-events-none overflow-visible"
      />
    );

  const winnerChips: Array<{ id: string; seatIndex: number; amount: number }> = [];

  for (const player of showdownReveal.players) {
    if (player.is_winner && player.win_amount > 0) {
      winnerChips.push({
        id: `win-${player.user_id}-${player.seat}`,
        seatIndex: player.seat,
        amount: player.win_amount,
      });
    }
  }

  if (containerSize.w === 0 || containerSize.h === 0) {
    return (
      <div
        ref={setNode}
        className="absolute inset-0 z-[500] pointer-events-none overflow-visible"
      />
    );
  }

  // Hardcoded to match the exact CSS top-[30%] left-1/2 morphed pot position
  const potPx = {
    x: containerSize.w / 2,
    y: containerSize.h * 0.3,
  };

  // Updated toPixels to handle bottom property safely
  const toPixels = (pos: Position) => {
    let y;
    if (pos.bottom) {
      y = containerSize.h - parseFloat(pos.bottom);
    } else {
      y = (pct(pos.top) / 100) * containerSize.h;
    }
    return {
      x: (pct(pos.left) / 100) * containerSize.w,
      y: y,
    };
  };

  return (
    <div ref={setNode} className="absolute inset-0 z-[500] pointer-events-none overflow-visible">
      {winnerChips.flatMap((winner) => {
        const posIdx = getPositionIndex(winner.seatIndex, heroSeat);
        const seatPos = positions[posIdx];
        if (!seatPos) return [];

        const seatPx = toPixels(seatPos);
        const color = getChipColor(winner.amount);

        // Calculate chips: 1 chip per $100 won. Minimum 1, Maximum 30.
        const chipCount = Math.min(30, Math.max(1, Math.floor(winner.amount / 100)));

        return Array.from({ length: chipCount }, (_, i) => {
          // Group chips into stacks (e.g., 5 stacks of chips)
          const stackIdx = Math.floor(i / 6);
          const chipInStack = i % 6;
          const xOffset = (stackIdx - 2) * 10;
          const yOffset = chipInStack * -2;

          return (
            <AnimatedChip
              key={`${winner.id}-chip-${i}`}
              from={{ x: potPx.x, y: potPx.y }}
              to={{ x: seatPx.x, y: seatPx.y }}
              color={color}
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
    </div>
  );
};
