import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { supabase } from '@/lib/supabase';

export const MEETING_POINT_GEOFENCE_TASK = 'meeting-point-geofence-task';

type GeofenceTaskBody = {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
};

// Defining the task at module load is intentional: the OS may cold-launch
// the JS bundle to deliver a geofence event, and the task must be
// registered before that event arrives. Keep this body lean — local
// notification + arrival insert. Foreground reconciliation in useCrew
// catches any failures here.
TaskManager.defineTask(
  MEETING_POINT_GEOFENCE_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<GeofenceTaskBody>) => {
    if (error) {
      console.error('[GEO task] error:', error);
      return;
    }
    if (!data) return;

    const { eventType, region } = data;

    // We register with notifyOnEnter only, but iOS occasionally delivers
    // Exit events anyway. Ignore everything but Enter.
    if (eventType !== Location.GeofencingEventType.Enter) return;

    const crewId = region.identifier;
    if (!crewId) {
      console.warn('[GEO task] region missing identifier; skipping');
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "You've arrived!",
          body: "You've reached the meeting point.",
          sound: 'default',
        },
        trigger: null,
      });
    } catch (err) {
      console.warn('[GEO task] notification failed:', err);
      // Non-fatal: still try to record the arrival below.
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[GEO task] no auth user; arrival not recorded');
        return;
      }
      // Composite PK on (room_id, user_id) means a duplicate firing is
      // a no-op — Postgres will reject the second insert with 23505.
      const { error: insertError } = await supabase
        .from('meeting_point_arrivals')
        .insert({ room_id: crewId, user_id: user.id });
      if (insertError && insertError.code !== '23505') {
        console.warn('[GEO task] arrival insert failed:', insertError.message);
      }
    } catch (err) {
      console.warn('[GEO task] arrival insert threw:', err);
    }
  },
);
