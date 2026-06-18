import { type ReactNode, useEffect } from 'react';
import { feedbackController } from '../../services/feedback/controller';
import { useFeedbackStore } from '../../stores/feedbackStore';

/**
 * App-level provider. Syncs preference store → controller and
 * initializes audio on the first user gesture (browser policy).
 *
 * Place inside QueryClientProvider, outside RouterProvider:
 *
 *   <FeedbackProvider>
 *     <RouterProvider router={router} />
 *   </FeedbackProvider>
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const prefs = useFeedbackStore();

  // Sync preferences to the controller on every change
  useEffect(() => {
    feedbackController.setPreferences(prefs);
  }, [prefs]);

  // Auto-initialize audio engine on first user gesture
  useEffect(() => {
    let initDone = false;

    const onGesture = () => {
      if (initDone) return;
      initDone = true;
      feedbackController.init();
      document.removeEventListener('click', onGesture);
      document.removeEventListener('touchstart', onGesture);
      document.removeEventListener('keydown', onGesture);
    };

    document.addEventListener('click', onGesture);
    document.addEventListener('touchstart', onGesture);
    document.addEventListener('keydown', onGesture);

    return () => {
      document.removeEventListener('click', onGesture);
      document.removeEventListener('touchstart', onGesture);
      document.removeEventListener('keydown', onGesture);
    };
  }, []);

  return <>{children}</>;
}
