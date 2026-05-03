import * as Location from 'expo-location';
import { useCallback, useEffect } from 'react';
import { Linking } from 'react-native';

import {
  useLocationStore,
  type LocationPermissionStatus,
} from '@/stores/useLocationStore';

type UseLocationPermissionResult = {
  status: LocationPermissionStatus;
  request: () => Promise<LocationPermissionStatus>;
  openSettings: () => Promise<void>;
};

function mapPermission(
  response: Pick<Location.LocationPermissionResponse, 'status' | 'canAskAgain'>,
): LocationPermissionStatus {
  if (response.status === Location.PermissionStatus.GRANTED) return 'granted';
  if (response.status === Location.PermissionStatus.UNDETERMINED) {
    return 'undetermined';
  }
  return response.canAskAgain ? 'denied' : 'denied-permanent';
}

export function useLocationPermission(): UseLocationPermissionResult {
  const status = useLocationStore((s) => s.permissionStatus);
  const setPermissionStatus = useLocationStore((s) => s.setPermissionStatus);

  useEffect(() => {
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then((response) => {
        if (cancelled) return;
        setPermissionStatus(mapPermission(response));
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Failed to read location permission', err);
      });
    return (): void => {
      cancelled = true;
    };
  }, [setPermissionStatus]);

  const request = useCallback(async (): Promise<LocationPermissionStatus> => {
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      const next = mapPermission(response);
      setPermissionStatus(next);
      return next;
    } catch (err) {
      console.warn('Failed to request location permission', err);
      return status;
    }
  }, [setPermissionStatus, status]);

  const openSettings = useCallback(async (): Promise<void> => {
    await Linking.openSettings();
  }, []);

  return { status, request, openSettings };
}
