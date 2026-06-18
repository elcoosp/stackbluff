import { motion } from 'framer-motion';

// Keep the color scheme for compatibility, though the CSS handles the premium contrast
export const getChipColor = (_amount?: number) => {
  return {
    bg: '#1a1a1a',
    edge: '#333333',
    highlight: '#ffffff',
    text: '#cfcfcf'
  };
};

interface AnimatedChipProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: ReturnType<typeof getChipColor>;
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
      style={{
        width: size,
        height: size,
        zIndex,
        willChange: 'transform, opacity'
      }}
      initial={{
        x: from.x + xOffset - size / 2,
        y: from.y + yOffset - size / 2,
        scale: 0.8,
        opacity: 0,
      }}
      animate={{
        x: [from.x + xOffset - size / 2, midX - size / 2, to.x + xOffset - size / 2, to.x + xOffset - size / 2],
        y: [from.y + yOffset - size / 2, midY - size / 2, to.y + yOffset - size / 2, to.y + yOffset - size / 2],
        scale: [0.8, 1.1, 0.7, 0.7],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        delay,
        duration,
        ease: [0.25, 0.46, 0.45, 0.94],
        times: [0, 0.15, 0.85, 1],
      }}
    >
      {/*
        PREMIUM CHIP BODY LAYERS
        Layer 1: Machined steel rim (No zebra stripes)
        Layer 2: Recessed black center face
        Layer 3: Subtle inner detail ring
        Layer 4: Sharp top gloss reflection
      */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          position: 'relative',
          // Diagonal brushed metal gradient for a smooth, machined rim
          background: `linear-gradient(135deg, #4a4a4a 0%, #1a1a1a 40%, #2a2a2a 60%, #0a0a0a 100%)`,
          // Heavy drop shadow for physical weight, inset bevels for a 3D metal edge
          boxShadow: `
            0 15px 25px rgba(0,0,0,0.9),
            0 5px 10px rgba(0,0,0,0.6),
            inset 0 4px 6px rgba(255,255,255,0.25),
            inset 0 -6px 10px rgba(0,0,0,0.9)
          `,
        }}
      >
        {/* CENTER FACE: Recessed inlay */}
        <div
          style={{
            position: 'absolute',
            inset: '15%', // Defines the width of the metallic rim
            borderRadius: '50%',
            // Pitch black glossy center
            background: `radial-gradient(circle at 35% 30%, #222222, #000000 80%)`,
            // Stacked box shadows create a deep, multi-layered metallic decal ring
            boxShadow: `
              0 0 0 2px #0a0a0a,
              0 0 0 4px #cfcfcf,
              0 0 0 5px #333333,
              inset 0 5px 10px rgba(0,0,0,1)
            `,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* SUBTLE INNER DETAIL RING */}
          <div
            style={{
              width: '60%',
              height: '60%',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)',
            }}
          />
        </div>

        {/* SHARP TOP GLOSS: Enameled reflection */}
        <div
          style={{
            position: 'absolute',
            top: '8%',
            left: '15%',
            width: '70%',
            height: '35%',
            borderRadius: '50%',
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.35), transparent 80%)',
            filter: 'blur(2px)',
            transform: 'rotate(-15deg)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </motion.div>
  );
};
