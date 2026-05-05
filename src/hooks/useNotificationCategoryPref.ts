import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

import { cancelCategory } from '@/lib/notifications';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCES_KEY,
  type NotificationCategory,
  type NotificationPreferences,
} from '@/lib/notificationCategories';

type UseNotificationPreferencesResult = {
  preferences: NotificationPreferences;
  isLoading: boolean;
  setPreference: (
    category: NotificationCategory,
    enabled: boolean,
  ) => Promise<void>;
};

function parsePreferences(raw: string | null): NotificationPreferences {
  if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      preHikeReminders:
        parsed.preHikeReminders ??
        DEFAULT_NOTIFICATION_PREFERENCES.preHikeReminders,
      pauseRecovery:
        parsed.pauseRecovery ?? DEFAULT_NOTIFICATION_PREFERENCES.pauseRecovery,
      geofenceArrivals:
        parsed.geofenceArrivals ??
        DEFAULT_NOTIFICATION_PREFERENCES.geofenceArrivals,
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

/**
 * Per-user notification category toggles persisted in SecureStore.
 *
 * Toggling a category off cancels every scheduled notification with that
 * category's identifier prefix — so the user sees an immediate effect
 * (no orphaned reminders sitting in the iOS notification center).
 */
export function useNotificationPreferences(): UseNotificationPreferencesResult {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void SecureStore.getItemAsync(NOTIFICATION_PREFERENCES_KEY).then((raw) => {
      if (cancelled) return;
      setPreferences(parsePreferences(raw));
      setIsLoading(false);
    });
    return (): void => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback(
    async (category: NotificationCategory, enabled: boolean): Promise<void> => {
      const next = { ...preferences, [category]: enabled };
      setPreferences(next);
      await SecureStore.setItemAsync(
        NOTIFICATION_PREFERENCES_KEY,
        JSON.stringify(next),
      );
      if (!enabled) {
        await cancelCategory(category);
      }
    },
    [preferences],
  );

  return { preferences, isLoading, setPreference };
}
