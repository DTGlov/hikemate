import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { HIKE_LOCATION_TASK } from '@/lib/backgroundLocationTask';
import {
  clearInProgressHike,
  getInProgressHike,
  setInProgressHike,
  type InProgressHike,
} from '@/lib/hikePersistence';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';

const POLL_INTERVAL_MS = 3000;

const WATCH_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 5,
  timeInterval: 2000,
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.Fitness,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'HikeMate is tracking your hike',
    notificationBody: 'Tap to return to your hike',
    notificationColor: '#0f766e',
  },
};

async function startBackgroundTracking(): Promise<void> {
  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(HIKE_LOCATION_TASK);
  if (isRegistered) return;
  try {
    await Location.startLocationUpdatesAsync(HIKE_LOCATION_TASK, WATCH_OPTIONS);
  } catch (err) {
    console.warn('[hikeLifecycle] startLocationUpdatesAsync failed:', err);
  }
}

async function stopBackgroundTracking(): Promise<void> {
  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(HIKE_LOCATION_TASK);
  if (!isRegistered) return;
  try {
    await Location.stopLocationUpdatesAsync(HIKE_LOCATION_TASK);
  } catch (err) {
    console.warn('[hikeLifecycle] stopLocationUpdatesAsync failed:', err);
  }
}

/**
 * Single source of truth for hike tracking lifecycle. Mounted once at the
 * root layout so its effects survive screen navigation.
 *
 *  - Hydrates the Zustand store from persistence on cold start.
 *  - Starts/stops Location.startLocationUpdatesAsync as the store status
 *    flips between tracking / paused / idle.
 *  - Polls the persistence file every 3s to absorb points captured by the
 *    background TaskManager task while the foreground was idle/closed.
 *  - On AppState 'active': forces a sync and re-checks if background
 *    permission was revoked behind our back.
 *  - Mirrors the in-progress hike file as the store mutates (start, pause,
 *    resume) so background and foreground writers agree on the truth.
 */
export function useHikeLifecycle(): void {
  const status = useHikeTrackingStore((s) => s.status);
  const startedAt = useHikeTrackingStore((s) => s.startedAt);
  const pausedAt = useHikeTrackingStore((s) => s.pausedAt);
  const accumulatedPausedMs = useHikeTrackingStore(
    (s) => s.accumulatedPausedMs,
  );
  const points = useHikeTrackingStore((s) => s.points);
  const restoreFromPersistence = useHikeTrackingStore(
    (s) => s.restoreFromPersistence,
  );
  const mergePersistedPoints = useHikeTrackingStore(
    (s) => s.mergePersistedPoints,
  );

  const hydratedRef = useRef(false);

  // 1. Cold-start hydration. Only runs once per mount.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void (async () => {
      const persisted = await getInProgressHike();
      if (!persisted) return;
      restoreFromPersistence(persisted);

      // If the OS reaped the task, and the hike isn't paused, re-arm it.
      const isPaused = persisted.pausedAt !== null;
      if (!isPaused) {
        await startBackgroundTracking();
      }
    })();
  }, [restoreFromPersistence]);

  // 2. Persist the in-progress hike whenever store identity changes that
  //    we want the background task to see (start, pause, resume). We don't
  //    persist on every addPoint here because the foreground store already
  //    has them — the background task is the only writer that adds points
  //    from outside.
  useEffect(() => {
    if (status === 'idle' || status === 'saving' || startedAt === null) return;
    const persisted: InProgressHike = {
      startedAt,
      pausedAt,
      accumulatedPausedMs,
      points,
    };
    void setInProgressHike(persisted);
  }, [status, startedAt, pausedAt, accumulatedPausedMs, points]);

  // 3. Drive the OS subscription from store status. start/stop are
  //    idempotent against TaskManager so flapping is safe.
  useEffect(() => {
    if (status === 'tracking') {
      void startBackgroundTracking();
    } else if (status === 'paused' || status === 'idle') {
      void stopBackgroundTracking();
    }
  }, [status]);

  // 4. Stop + clear persistence when status returns to idle (after a save
  //    or discard). 'saving' stays — only flip to idle when the caller
  //    confirms persistence + Supabase are both done.
  useEffect(() => {
    if (status !== 'idle') return;
    void stopBackgroundTracking();
    void clearInProgressHike();
  }, [status]);

  // 5. Foreground polling: read the persistence file every 3s while a
  //    hike is live and merge any new points. Cheap (small JSON), and the
  //    only safe path for the background-task → foreground-store handoff.
  useEffect(() => {
    if (status !== 'tracking' && status !== 'paused') return;
    let cancelled = false;
    const tick = async (): Promise<void> => {
      const persisted = await getInProgressHike();
      if (cancelled || !persisted) return;
      mergePersistedPoints(persisted.points);
    };
    void tick();
    const id = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return (): void => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status, mergePersistedPoints]);

  // 6. AppState 'active' force-sync: if the user had the app backgrounded
  //    and the OS was waking it just for events, an immediate read on
  //    return catches up the UI without waiting for the next 3s tick.
  useEffect(() => {
    const onChange = async (next: AppStateStatus): Promise<void> => {
      if (next !== 'active') return;
      const persisted = await getInProgressHike();
      if (!persisted) return;
      mergePersistedPoints(persisted.points);
    };
    const sub = AppState.addEventListener('change', (next) => {
      void onChange(next);
    });
    return (): void => sub.remove();
  }, [mergePersistedPoints]);

  // GPS-stale tracking lives in useBackgroundHikeTracker since the value
  // is consumed by the active-hike overlay; lifecycle stays headless.
}
