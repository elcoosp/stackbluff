import { useEffect, useRef } from 'react';

/**
 * Custom hook that calls a callback at a specified interval.
 * Properly cleans up on unmount and handles delay changes.
 *
 * @param callback - Function to call on each interval
 * @param delay - Delay in milliseconds (null to disable)
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delay === null) {
      return;
    }

    const id = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => clearInterval(id);
  }, [delay]);
}
