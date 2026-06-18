import { useState, useEffect } from 'react';

interface VisualEffect {
  glow?: string;
  shake?: number;
  pulse?: boolean;
  event?: string;
  seatIndex?: number;
}

/**
 * Listens for `feedback:visual` custom events dispatched by the
 * FeedbackController and returns the current active effect (or null).
 *
 * Effects auto-clear after `duration` ms.
 *
 *   const effect = useVisualFeedback();
 *   // effect = { glow: '#4edea3', shake: 4, pulse: true, event: 'allIn', seatIndex: 3 }
 */
export function useVisualFeedback(duration = 600) {
  const [effect, setEffect] = useState<VisualEffect | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as VisualEffect;
      setEffect(detail);
      const timer = setTimeout(() => setEffect(null), duration);
      return () => clearTimeout(timer);
    };

    window.addEventListener('feedback:visual', handler);
    return () => window.removeEventListener('feedback:visual', handler);
  }, [duration]);

  return effect;
}

/**
 * Returns CSS properties for the current visual effect.
 * Useful for applying glow/shake directly to an element.
 *
 * @deprecated Use useVisualFeedback and conditionally apply styles yourself.
 *             This function does not filter by seatIndex and will apply to all.
 */
export function useVisualFeedbackStyle(duration = 600): React.CSSProperties {
  const effect = useVisualFeedback(duration);

  if (!effect) return {};

  const style: React.CSSProperties = {};

  if (effect.glow) {
    style.boxShadow = `0 0 30px ${effect.glow}44, 0 0 60px ${effect.glow}22`;
  }

  if (effect.shake) {
    const offset = effect.shake;
    const x = (Math.random() - 0.5) * offset * 2;
    const y = (Math.random() - 0.5) * offset * 2;
    style.transform = `translate(${x}px, ${y}px)`;
  }

  return style;
}
