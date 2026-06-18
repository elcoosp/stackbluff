import { motion } from 'framer-motion';

// Force all chips to use the premium Black / Silver design
export const getChipColor = (_amount?: number) => {
  return {
    bg: '#1f1f1f',
    border: '#46464b',
    highlight: '#c6c6cf',
    text: '#c6c6cf'
  };
};

interface AnimatedChipProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: ReturnType<typeof getChipColor>;
  delay: number;
  duration: number;
  arcHeight: number;
  zIndex?: number;
  size?: number;
  xOffset?: number;
  yOffset?: number;
  index?: number;
}

export const AnimatedChip = ({
  from,
  to,
  color,
  delay,
  duration,
  arcHeight,
  zIndex = 500,
  size = 24,
  xOffset = 0,
  yOffset = 0,
  index = 0
}: AnimatedChipProps) => {
  const midX = (from.x + to.x) / 2 + (index % 2 === 0 ? 20 : -20);
  const midY = Math.min(from.y, to.y) - arcHeight - (index * 3);

  return (
    <motion.div
      className="absolute top-0 left-0 pointer-events-none"
      style={{ width: size, height: size, zIndex }}
      initial={{
        x: from.x + xOffset - size / 2,
        y: from.y + yOffset - size / 2,
        scale: 0.8,
        opacity: 1,
      }}
      animate={{
        // 4 keyframes: Start -> Peak -> Seat -> Rest at Seat
        x: [from.x + xOffset - size / 2, midX - size / 2, to.x + xOffset - size / 2, to.x + xOffset - size / 2],
        y: [from.y + yOffset - size / 2, midY - size / 2, to.y + yOffset - size / 2, to.y + yOffset - size / 2],
        scale: [0.8, 1.2, 0.6, 0.6],
        opacity: [1, 1, 1, 0], // Stay fully visible until the very end
      }}
      transition={{
        delay,
        duration,
        ease: 'easeInOut',
        times: [0, 0.5, 0.9, 1], // Fade out only occurs in the final 10% (on arrival)
      }}
    >
      {/* Refined Premium Chip Design */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${color.highlight}aa, ${color.bg} 60%)`,
          border: `2px solid ${color.border}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.9), inset 0 1px 3px rgba(255,255,255,0.4), inset 0 -1px 3px rgba(0,0,0,0.4)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Inner dashed ring for texture */}
        <div
          style={{
            position: 'absolute',
            inset: 3,
            borderRadius: '50%',
            border: `1px dashed ${color.highlight}55`,
          }}
        />
        {/* Center face */}
        <div
          style={{
            width: size * 0.6,
            height: size * 0.6,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${color.bg}, ${color.border})`,
            border: '1px solid rgba(0,0,0,0.3)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)',
            color: color.text,
            fontSize: size * 0.4,
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          $         </div>
      </div>
    </motion.div>
  );
};
