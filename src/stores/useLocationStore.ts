import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type LiveLocation = Coordinate & {
  timestamp: number;
};

export type LocationPermissionStatus =
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'denied-permanent';

const LAST_KNOWN_KEY = 'hikemate.lastKnownLocation';
const PERSIST_INTERVAL_MS = 30_000;

// Module-level so persist throttling doesn't churn store state / re-renders.
let lastPersistedAt = 0;

type LocationState = {
  currentLocation: LiveLocation | null;
  lastKnownLocation: Coordinate | null;
  permissionStatus: LocationPermissionStatus;
  isFollowingUser: boolean;
  setCurrentLocation: (location: LiveLocation) => void;
  setPermissionStatus: (status: LocationPermissionStatus) => void;
  setFollowingUser: (following: boolean) => void;
  loadLastKnownLocation: () => Promise<void>;
};

export const useLocationStore = create<LocationState>((set, get) => ({
  currentLocation: null,
  lastKnownLocation: null,
  permissionStatus: 'undetermined',
  isFollowingUser: true,

  setCurrentLocation: (location: LiveLocation): void => {
    const lastKnown: Coordinate = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
    set({ currentLocation: location, lastKnownLocation: lastKnown });

    const now = Date.now();
    if (now - lastPersistedAt < PERSIST_INTERVAL_MS) return;
    lastPersistedAt = now;
    void SecureStore.setItemAsync(
      LAST_KNOWN_KEY,
      JSON.stringify(lastKnown),
    ).catch((err) => {
      console.warn('Failed to persist last known location', err);
    });
  },

  setPermissionStatus: (status: LocationPermissionStatus): void => {
    set({ permissionStatus: status });
  },

  setFollowingUser: (following: boolean): void => {
    set({ isFollowingUser: following });
  },

  loadLastKnownLocation: async (): Promise<void> => {
    if (get().lastKnownLocation) return;
    try {
      const raw = await SecureStore.getItemAsync(LAST_KNOWN_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Coordinate;
      if (
        typeof parsed.latitude === 'number' &&
        typeof parsed.longitude === 'number'
      ) {
        set({ lastKnownLocation: parsed });
      }
    } catch (err) {
      console.warn('Failed to load last known location', err);
    }
  },
}));
