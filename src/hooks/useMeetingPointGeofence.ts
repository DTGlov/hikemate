import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useRef } from 'react';

import { useAlwaysPermission } from '@/hooks/useAlwaysPermission';
import { MEETING_POINT_GEOFENCE_TASK } from '@/lib/meetingPointTask';
import { useCrewStore } from '@/stores/useCrewStore';

const GEOFENCE_RADIUS_M = 100;

/**
 * Phase 7 — keep a single geofence registered around the active crew's
 * meeting point. Mounted once at the root layout.
 *
 * Strategy:
 *   - Register when (crew && meetingPoint && always-permission).
 *   - On any change to those inputs, fully unregister and re-register
 *     with the new region. There's no "update region" primitive on
 *     iOS so stop+start is the canonical reset.
 *   - The geofence task itself (meetingPointTask.ts) is the writer of
 *     `meeting_point_arrivals`; this hook is purely lifecycle.
 *
 * Notification permission is requested lazily on first appearance of
 * a meeting point. If denied, the geofence still registers (we get
 * the DB record) but the user won't see the local notification.
 */
export function useMeetingPointGeofence(): void {
  const crew = useCrewStore((s) => s.crew);
  const meetingPoint = useCrewStore((s) => s.meetingPoint);
  const { status: alwaysStatus } = useAlwaysPermission();

  const requestedNotifPermissionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const sync = async (): Promise<void> => {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        MEETING_POINT_GEOFENCE_TASK,
      );
      const shouldMonitor =
        !!crew && !!meetingPoint && alwaysStatus === 'always';

      if (cancelled) return;

      if (!shouldMonitor) {
        if (isRegistered) {
          try {
            await Location.stopGeofencingAsync(MEETING_POINT_GEOFENCE_TASK);
            console.log('[GEO] stopped (no-monitor)');
          } catch (err) {
            console.warn('[GEO] stopGeofencingAsync failed:', err);
          }
        }
        return;
      }

      // Pre-emptively request notification permission so the in-task
      // scheduleNotificationAsync isn't silently muted on first crossing.
      // Lazy + once per app session.
      if (!requestedNotifPermissionRef.current) {
        requestedNotifPermissionRef.current = true;
        try {
          await Notifications.requestPermissionsAsync();
        } catch (err) {
          console.warn('[GEO] notification permission request failed:', err);
        }
      }

      // Always reset to ensure the registered region matches the current
      // meetingPoint coordinates. Cheap on the OS side; safer than guessing
      // whether the in-flight region matches.
      if (isRegistered) {
        try {
          await Location.stopGeofencingAsync(MEETING_POINT_GEOFENCE_TASK);
        } catch (err) {
          console.warn('[GEO] pre-restart stop failed:', err);
        }
      }
      if (cancelled) return;

      try {
        await Location.startGeofencingAsync(MEETING_POINT_GEOFENCE_TASK, [
          {
            identifier: crew.id,
            latitude: meetingPoint.lat,
            longitude: meetingPoint.lng,
            radius: GEOFENCE_RADIUS_M,
            notifyOnEnter: true,
            notifyOnExit: false,
          },
        ]);
        console.log('[GEO] started', {
          crewId: crew.id,
          lat: meetingPoint.lat,
          lng: meetingPoint.lng,
        });
      } catch (err) {
        console.warn('[GEO] startGeofencingAsync failed:', err);
      }
    };

    void sync();

    return (): void => {
      cancelled = true;
    };
  }, [
    crew?.id,
    crew,
    meetingPoint?.lat,
    meetingPoint?.lng,
    meetingPoint,
    alwaysStatus,
  ]);
}
