import { useCallback, useRef } from 'react';
import { feedbackController } from '../services/feedback/controller';
import { useFeedbackStore } from '../stores/feedbackStore';
import type { FeedbackEvent } from '../services/feedback/types';
import { SEAT_PAN_MAP } from '../services/feedback/types';

interface TriggerOptions {
  pan?: number;
  volume?: number;
  pitch?: number;
  seatIndex?: number;
}

/**
 * React hook for triggering haptic + audio + visual feedback.
 *
 * Usage:
 *   const { trigger } = useFeedback();
 *   trigger('raise', { seatIndex: 3 });
 *
 * Automatically syncs with FeedbackStore preferences.
 * Resolves spatial pan from seat index if provided.
 */
export function useFeedback() {
  const prefs = useFeedbackStore();
  const lastTickRef = useRef(0);

  // Keep controller in sync with store
  feedbackController.setPreferences(prefs);

  const trigger = useCallback(
    (event: FeedbackEvent, options?: TriggerOptions) => {
      const pan = options?.seatIndex !== undefined
        ? SEAT_PAN_MAP[options.seatIndex] ?? 0
        : options?.pan;

      // Throttle high-frequency events (slider ticks, timer ticks)
      if (event === 'sliderTick' || event === 'timerTick') {
        const now = performance.now();
        if (now - lastTickRef.current < 50) return;
        lastTickRef.current = now;
      }

      feedbackController.trigger(event, {
        ...options,
        pan,
      });
    },
    [],
  );

  /** Resume audio context — call from a user gesture */
  const resume = useCallback(async () => {
    await feedbackController.resume();
  }, []);

  /** Initialize the feedback system — call once from a user gesture */
  const init = useCallback(async () => {
    await feedbackController.init();
  }, []);

  return {
    trigger,
    resume,
    init,
    isHapticSupported: feedbackController.isHapticSupported(),
    isAudioReady: feedbackController.isAudioReady(),
  };
}
