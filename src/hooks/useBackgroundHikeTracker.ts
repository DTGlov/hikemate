import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAlwaysPermission } from '@/hooks/useAlwaysPermission';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';

const GPS_STALE_THRESHOLD_MS = 30_000;
const STALE_TICK_MS = 5_000;

type UseBackgroundHikeTrackerResult = {
  isGpsStale: boolean;
  permissionLost: boolean;
};

/**
 * Surfacing-only hook for the active-hike overlay. The actual lifecycle
 * (subscription, persistence, AppState) lives in useHikeLifecycle at the
 * root layout. This hook just derives:
 *
 *  - isGpsStale: have we gone >30s without a fresh point during tracking?
 *  - permissionLost: was background permission revoked while a hike is live?
 *
 * permissionLost auto-pauses the hike so a revoked permission doesn't
 * silently stop recording with the user thinking everything's fine.
 */
export function useBackgroundHikeTracker(): UseBackgroundHikeTrackerResult {
  const status = useHikeTrackingStore((s) => s.status);
  const lastPointTs = useHikeTrackingStore(
    (s) => s.points[s.points.length - 1]?.timestamp ?? null,
  );
  const pauseHike = useHikeTrackingStore((s) => s.pauseHike);

  const { status: permissionStatus, refresh } = useAlwaysPermission();

  const [isGpsStale, setIsGpsStale] = useState(false);
  const [permissionLost, setPermissionLost] = useState(false);

  useEffect(() => {
    if (status !== 'tracking') {
      setIsGpsStale(false);
      return;
    }
    const evaluate = (): void => {
      if (lastPointTs === null) {
        setIsGpsStale(false);
        return;
      }
      setIsGpsStale(Date.now() - lastPointTs > GPS_STALE_THRESHOLD_MS);
    };
    evaluate();
    const id = setInterval(evaluate, STALE_TICK_MS);
    return (): void => clearInterval(id);
  }, [status, lastPointTs]);

  useEffect(() => {
    const isActive = status === 'tracking' || status === 'paused';
    if (!isActive) {
      setPermissionLost(false);
      return;
    }
    const lost =
      permissionStatus !== 'always' && permissionStatus !== 'foreground-only';
    setPermissionLost(lost);
    if (lost && status === 'tracking') pauseHike();
  }, [status, permissionStatus, pauseHike]);

  // Re-check permission whenever the user returns to the app — they may
  // have flipped Settings without us getting a system event.
  useEffect(() => {
    const isActive = status === 'tracking' || status === 'paused';
    if (!isActive) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void refresh();
    });
    return (): void => sub.remove();
  }, [status, refresh]);

  return { isGpsStale, permissionLost };
}
