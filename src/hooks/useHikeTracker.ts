import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';
import { useLocationStore } from '@/stores/useLocationStore';

const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 5,
  timeInterval: 2000,
};

const GPS_STALE_THRESHOLD_MS = 30_000;

type UseHikeTrackerResult = {
  isGpsStale: boolean;
  permissionLost: boolean;
};

/**
 * While a hike is tracking or paused, subscribe to high-accuracy location
 * updates and feed them into the hike store. Foreground-only — Phase 4.5
 * will swap in expo-task-manager for background tracking.
 *
 * Note: kept subscribed even when paused so the GPS chip stays warm and
 * resume is instant. addPoint itself ignores updates while paused.
 */
export function useHikeTracker(): UseHikeTrackerResult {
  const status = useHikeTrackingStore((s) => s.status);
  const addPoint = useHikeTrackingStore((s) => s.addPoint);
  const pauseHike = useHikeTrackingStore((s) => s.pauseHike);
  const permissionStatus = useLocationStore((s) => s.permissionStatus);

  const [isGpsStale, setIsGpsStale] = useState(false);
  const [permissionLost, setPermissionLost] = useState(false);
  const lastFixAtRef = useRef<number>(Date.now());

  // Auto-pause and surface a banner if permission is revoked mid-hike.
  useEffect(() => {
    const isActive = status === 'tracking' || status === 'paused';
    if (!isActive) return;
    if (permissionStatus !== 'granted') {
      setPermissionLost(true);
      if (status === 'tracking') pauseHike();
    } else {
      setPermissionLost(false);
    }
  }, [permissionStatus, status, pauseHike]);

  useEffect(() => {
    const isActive = status === 'tracking' || status === 'paused';
    if (!isActive || permissionStatus !== 'granted') {
      setIsGpsStale(false);
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    lastFixAtRef.current = Date.now();

    Location.watchPositionAsync(WATCH_OPTIONS, (location) => {
      lastFixAtRef.current = Date.now();
      setIsGpsStale(false);
      addPoint({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude:
          typeof location.coords.altitude === 'number'
            ? location.coords.altitude
            : null,
        timestamp: location.timestamp,
      });
    })
      .then((sub) => {
        if (cancelled) {
          sub.remove();
          return;
        }
        subscription = sub;
      })
      .catch((err) => {
        console.warn('Failed to start hike tracking subscription', err);
      });

    const staleInterval = setInterval(() => {
      if (Date.now() - lastFixAtRef.current > GPS_STALE_THRESHOLD_MS) {
        setIsGpsStale(true);
      }
    }, 5000);

    return (): void => {
      cancelled = true;
      subscription?.remove();
      subscription = null;
      clearInterval(staleInterval);
      setIsGpsStale(false);
    };
  }, [status, permissionStatus, addPoint]);

  return { isGpsStale, permissionLost };
}
