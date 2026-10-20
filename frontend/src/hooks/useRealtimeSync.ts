import { useEffect, useRef, useCallback } from 'react';

export interface UseRealtimeSyncOptions {
  /**
   * Async callback to fetch / sync fresh data
   */
  onSync: () => Promise<void> | void;

  /**
   * Periodic polling interval in milliseconds.
   * If null or <= 0, periodic timer is disabled.
   */
  interval?: number | null;

  /**
   * Whether auto sync is enabled (default true)
   */
  enabled?: boolean;

  /**
   * Revalidate immediately when browser window / tab gains focus or visibility (default true)
   */
  revalidateOnFocus?: boolean;

  /**
   * Minimum throttle time between focus revalidations in ms (default 4000ms)
   */
  focusThrottleMs?: number;
}

export function useRealtimeSync({
  onSync,
  interval = null,
  enabled = true,
  revalidateOnFocus = true,
  focusThrottleMs = 4000,
}: UseRealtimeSyncOptions) {
  const syncRef = useRef(onSync);
  syncRef.current = onSync;

  const isSyncingRef = useRef(false);
  const lastSyncTimeRef = useRef(0);

  const executeSync = useCallback(
    async (isFocusEvent = false) => {
      if (!enabled) return;

      const now = Date.now();
      if (isFocusEvent && now - lastSyncTimeRef.current < focusThrottleMs) {
        return;
      }

      if (isSyncingRef.current) return;

      try {
        isSyncingRef.current = true;
        lastSyncTimeRef.current = now;
        await syncRef.current();
      } catch (e) {
        // Silently catch background errors to avoid disrupting user experience
      } finally {
        isSyncingRef.current = false;
      }
    },
    [enabled, focusThrottleMs]
  );

  // Visibility and window focus listener
  useEffect(() => {
    if (!enabled || !revalidateOnFocus) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        executeSync(true);
      }
    };

    const handleWindowFocus = () => {
      executeSync(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [enabled, revalidateOnFocus, executeSync]);

  // Periodic polling timer (only runs when tab is active/visible)
  useEffect(() => {
    if (!enabled || !interval || interval <= 0) return;

    const timerId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        executeSync(false);
      }
    }, interval);

    return () => clearInterval(timerId);
  }, [enabled, interval, executeSync]);
}
