import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VisualEffect {
  glow?: string;
  shake?: number;
  pulse?: boolean;
  event?: string;
  seatIndex?: number;
}

/**
 * Full-screen overlay that renders visual feedback effects:
 * edge glow and deterministic screen shake for dramatic game events.
 *
 * Place once at the top level of your game view:
 *
 *   <div className="relative">
 *     <VisualFeedbackOverlay />
 *     <TableFelt />
 *     ...
 *   </div>
 */
export function VisualFeedbackOverlay() {
  const [effect, setEffect] = useState<VisualEffect | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as VisualEffect;
      setEffect(detail);
      const timer = setTimeout(() => setEffect(null), 500);
      return () => clearTimeout(timer);
    };

    window.addEventListener('feedback:visual', handler);
    return () => window.removeEventListener('feedback:visual', handler);
  }, []);

  const shakeAnimate = effect?.shake
    ? {
      x: [0, -effect.shake, effect.shake, -effect.shake / 2, effect.shake / 2, 0],
      y: [0, effect.shake / 2, -effect.shake / 2, effect.shake / 4, -effect.shake / 4, 0],
    }
    : {};

  return (
    <AnimatePresence>
      {effect && (
        <motion.div
          key="visual-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, ...shakeAnimate }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.2,
            repeat: effect.shake ? 2 : 0,
            repeatType: 'mirror',
          }}
          className="absolute inset-0 z-[200] pointer-events-none"
          style={{
            boxShadow: effect.glow
              ? `inset 0 0 80px ${effect.glow}33, inset 0 0 160px ${effect.glow}15`
              : undefined,
          }}
        />
      )}
    </AnimatePresence>
  );
}
