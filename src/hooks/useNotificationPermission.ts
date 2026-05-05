import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, type AppStateStatus } from 'react-native';

import {
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermissionStatus,
} from '@/lib/notifications';

type UseNotificationPermissionResult = {
  status: NotificationPermissionStatus;
  /** Re-read current permission status from the OS. */
  refresh: () => Promise<NotificationPermissionStatus>;
  /** Trigger the iOS system prompt; first call asks, subsequent calls no-op. */
  request: () => Promise<NotificationPermissionStatus>;
  /** Open this app's iOS Settings page so the user can flip permission. */
  openSettings: () => Promise<void>;
};

/**
 * Tracks the OS-level notification permission. Re-polls on app foreground
 * so a user returning from iOS Settings (where they may have just enabled
 * notifications) sees the UI update without a restart.
 */
export function useNotificationPermission(): UseNotificationPermissionResult {
  const [status, setStatus] = useState<NotificationPermissionStatus>('undetermined');

  useEffect(() => {
    let cancelled = false;
    void getNotificationPermission().then((next) => {
      if (!cancelled) setStatus(next);
    });
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      void getNotificationPermission().then((s) => {
        if (!cancelled) setStatus(s);
      });
    });
    return (): void => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const refresh = useCallback(async (): Promise<NotificationPermissionStatus> => {
    const next = await getNotificationPermission();
    setStatus(next);
    return next;
  }, []);

  const request = useCallback(async (): Promise<NotificationPermissionStatus> => {
    const next = await requestNotificationPermission();
    setStatus(next);
    return next;
  }, []);

  const openSettings = useCallback(async (): Promise<void> => {
    await Linking.openSettings();
  }, []);

  return { status, refresh, request, openSettings };
}
