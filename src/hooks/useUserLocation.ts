import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback } from 'react';

import { useLocationStore } from '@/stores/useLocationStore';

const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  distanceInterval: 5,
  timeInterval: 2000,
};

export function useUserLocation(): void {
  const permissionStatus = useLocationStore((s) => s.permissionStatus);
  const setCurrentLocation = useLocationStore((s) => s.setCurrentLocation);

  useFocusEffect(
    useCallback(() => {
      if (permissionStatus !== 'granted') return;

      let subscription: Location.LocationSubscription | null = null;
      let cancelled = false;

      Location.watchPositionAsync(WATCH_OPTIONS, (location) => {
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
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
          console.warn('Failed to start location watch', err);
        });

      return (): void => {
        cancelled = true;
        subscription?.remove();
        subscription = null;
      };
    }, [permissionStatus, setCurrentLocation]),
  );
}
