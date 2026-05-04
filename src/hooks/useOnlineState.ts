import { useEffect } from 'react';

import { fetchOnlineState, subscribeToOnlineState } from '@/lib/netinfo';
import { useOfflineStore } from '@/stores/useOfflineStore';

const OFFLINE_DEBOUNCE_MS = 2000;

/**
 * Single source of truth for online/offline state. Mounted once at the
 * root layout. Pushes the current value into useOfflineStore so any
 * component can read it via a Zustand selector.
 *
 * The offline transition is debounced 2s to avoid banner flap on brief
 * blips (cell handover, momentary WiFi drop). The online transition
 * fires immediately — if connectivity returns, the user wants to know
 * straight away.
 */
export function useOnlineState(): void {
  const setOnline = useOfflineStore((s) => s.setOnline);

  useEffect(() => {
    let cancelled = false;
    let pendingOfflineTimer: ReturnType<typeof setTimeout> | null = null;

    const apply = (online: boolean): void => {
      if (cancelled) return;
      if (online) {
        if (pendingOfflineTimer !== null) {
          clearTimeout(pendingOfflineTimer);
          pendingOfflineTimer = null;
        }
        setOnline(true);
      } else {
        if (pendingOfflineTimer !== null) return;
        pendingOfflineTimer = setTimeout(() => {
          pendingOfflineTimer = null;
          if (!cancelled) setOnline(false);
        }, OFFLINE_DEBOUNCE_MS);
      }
    };

    void fetchOnlineState().then(apply);
    const unsubscribe = subscribeToOnlineState(apply);

    return (): void => {
      cancelled = true;
      if (pendingOfflineTimer !== null) clearTimeout(pendingOfflineTimer);
      unsubscribe();
    };
  }, [setOnline]);
}
