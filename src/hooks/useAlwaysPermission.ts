import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

export type AlwaysPermissionStatus =
  | 'undetermined'
  | 'foreground-only'
  | 'always'
  | 'denied';

const DECLINED_EXPLAINER_KEY = 'hikemate.declinedAlwaysExplainer';

type UseAlwaysPermissionResult = {
  status: AlwaysPermissionStatus;
  hasDeclinedExplainer: boolean;
  /** Re-read both foreground & background permission state from the OS. */
  refresh: () => Promise<AlwaysPermissionStatus>;
  /** Run the actual system prompts (foreground first, then background). */
  request: () => Promise<AlwaysPermissionStatus>;
  /** Persist that the user dismissed the explainer with "Maybe Later". */
  recordDeclinedExplainer: () => Promise<void>;
  /** Clear the declined-explainer flag (e.g. on logout). */
  resetDeclinedExplainer: () => Promise<void>;
  openSettings: () => Promise<void>;
};

async function readStatus(): Promise<AlwaysPermissionStatus> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    if (fg.status === Location.PermissionStatus.UNDETERMINED) {
      return 'undetermined';
    }
    return fg.canAskAgain ? 'undetermined' : 'denied';
  }
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status === Location.PermissionStatus.GRANTED) return 'always';
  return 'foreground-only';
}

export function useAlwaysPermission(): UseAlwaysPermissionResult {
  const [status, setStatus] = useState<AlwaysPermissionStatus>('undetermined');
  const [hasDeclinedExplainer, setHasDeclinedExplainer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void readStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    void SecureStore.getItemAsync(DECLINED_EXPLAINER_KEY).then((v) => {
      if (!cancelled) setHasDeclinedExplainer(v === '1');
    });
    return (): void => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async (): Promise<AlwaysPermissionStatus> => {
    const next = await readStatus();
    setStatus(next);
    return next;
  }, []);

  const request = useCallback(async (): Promise<AlwaysPermissionStatus> => {
    // Foreground first — required by iOS before Always can be asked at all.
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      const next: AlwaysPermissionStatus = fg.canAskAgain
        ? 'undetermined'
        : 'denied';
      setStatus(next);
      return next;
    }

    // Then Always. iOS only shows this dialog ONCE per install.
    const bg = await Location.requestBackgroundPermissionsAsync();

    // On Android 13+ the foreground service notification needs runtime
    // POST_NOTIFICATIONS — ask now so the service starts cleanly later.
    if (Platform.OS === 'android') {
      try {
        await Notifications.requestPermissionsAsync();
      } catch (err) {
        console.warn('Failed to request notification permission', err);
      }
    }

    const next: AlwaysPermissionStatus =
      bg.status === Location.PermissionStatus.GRANTED
        ? 'always'
        : 'foreground-only';
    setStatus(next);
    return next;
  }, []);

  const recordDeclinedExplainer = useCallback(async (): Promise<void> => {
    await SecureStore.setItemAsync(DECLINED_EXPLAINER_KEY, '1');
    setHasDeclinedExplainer(true);
  }, []);

  const resetDeclinedExplainer = useCallback(async (): Promise<void> => {
    await SecureStore.deleteItemAsync(DECLINED_EXPLAINER_KEY);
    setHasDeclinedExplainer(false);
  }, []);

  const openSettings = useCallback(async (): Promise<void> => {
    await Linking.openSettings();
  }, []);

  return {
    status,
    hasDeclinedExplainer,
    refresh,
    request,
    recordDeclinedExplainer,
    resetDeclinedExplainer,
    openSettings,
  };
}
