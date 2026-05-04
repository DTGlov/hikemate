import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { appendPointsToInProgressHike } from '@/lib/hikePersistence';

export const HIKE_LOCATION_TASK = 'hike-location-task';

type LocationTaskBody = {
  locations: Location.LocationObject[];
};

// Defining the task at module load is intentional: the TaskManager runtime
// calls back into JS for background location events, and the task must be
// registered before any event arrives. Keep this body lean — no Zustand,
// no Supabase, no React. Persistence is the sole side effect.
TaskManager.defineTask(
  HIKE_LOCATION_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<LocationTaskBody>) => {
    if (error) {
      console.error('[BG location task] error:', error);
      return;
    }
    if (
      !data ||
      !Array.isArray(data.locations) ||
      data.locations.length === 0
    ) {
      return;
    }
    try {
      await appendPointsToInProgressHike(data.locations);
    } catch (err) {
      console.error('[BG location task] persist failed:', err);
    }
  },
);
