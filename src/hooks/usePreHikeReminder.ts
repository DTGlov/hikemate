import { useEffect } from 'react';

import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { useNotificationPreferences } from '@/hooks/useNotificationCategoryPref';
import {
  cancelLocalNotification,
  scheduleLocalNotification,
} from '@/lib/notifications';
import { preHikeIdentifier } from '@/lib/notificationCategories';
import { useCrewStore } from '@/stores/useCrewStore';

const REMINDER_LEAD_MS = 30 * 60 * 1000;

/**
 * Phase 8 — schedules a "starts in 30 minutes" local notification when
 * the user is in a crew with a `scheduled_start_at` set far enough in the
 * future. Cancels cleanly when the user leaves the crew, when the start
 * time changes/clears, or when the user disables the preference.
 *
 * Mounted at the root layout so the schedule survives screen navigation.
 *
 * The notification fires at `scheduled_start_at - 30min`. If that target
 * time has already passed (host scheduled the hike for soon, or app was
 * offline through the window), we skip — late reminders are noise.
 *
 * scheduleLocalNotification uses a deterministic identifier
 * (`prehike-{room.id}`), so swapping the start time replaces the schedule
 * idempotently without leaving an orphan.
 */
export function usePreHikeReminder(): void {
  const crew = useCrewStore((s) => s.crew);
  const { status: permissionStatus } = useNotificationPermission();
  const { preferences, isLoading: prefsLoading } = useNotificationPreferences();

  useEffect(() => {
    if (!crew) return;
    const roomId = crew.id;
    const identifier = preHikeIdentifier(roomId);

    const enabled =
      !prefsLoading &&
      preferences.preHikeReminders &&
      permissionStatus === 'granted' &&
      crew.scheduled_start_at !== null;

    if (!enabled) {
      void cancelLocalNotification(identifier);
      return;
    }

    const startMs = new Date(crew.scheduled_start_at as string).getTime();
    if (!Number.isFinite(startMs)) {
      void cancelLocalNotification(identifier);
      return;
    }
    const triggerMs = startMs - REMINDER_LEAD_MS;
    if (triggerMs <= Date.now()) {
      // Past the reminder window — nothing useful to schedule.
      void cancelLocalNotification(identifier);
      return;
    }

    const triggerDate = new Date(triggerMs);
    const crewLabel = crew.name?.trim() ? crew.name.trim() : crew.code;
    void scheduleLocalNotification({
      identifier,
      title: 'Hike starts soon',
      body: `Your crew hike '${crewLabel}' starts in 30 minutes.`,
      triggerDate,
      data: { roomId, kind: 'prehike' },
    }).catch((err) => {
      console.warn('[notifications] pre-hike schedule failed:', err);
    });
  }, [
    crew,
    crew?.id,
    crew?.name,
    crew?.code,
    crew?.scheduled_start_at,
    permissionStatus,
    preferences.preHikeReminders,
    prefsLoading,
  ]);
}
