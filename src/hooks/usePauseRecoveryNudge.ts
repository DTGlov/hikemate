import { useEffect } from 'react';

import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { useNotificationPreferences } from '@/hooks/useNotificationCategoryPref';
import {
  cancelLocalNotification,
  scheduleLocalNotification,
} from '@/lib/notifications';
import { pauseRecoveryIdentifier } from '@/lib/notificationCategories';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';

const NUDGE_DELAY_MS = 5 * 60 * 1000;
// The active hike has no opaque ID (until it's finalized in the DB) so we
// key the schedule on `startedAt`, which is unique per hike and stable
// across pause/resume cycles within the same hike.
const ACTIVE_HIKE_KEY = 'active';

/**
 * Phase 8 — fire a "still hiking?" nudge when an active hike has been
 * paused for 5 minutes. Cancels the schedule the moment the user
 * resumes, stops, or starts saving — the nudge only triggers if the
 * pause genuinely outlasts the threshold.
 *
 * Mounted at the root layout. Uses a deterministic identifier so a fast
 * pause→resume→pause cycle doesn't stack notifications.
 */
export function usePauseRecoveryNudge(): void {
  const status = useHikeTrackingStore((s) => s.status);
  const startedAt = useHikeTrackingStore((s) => s.startedAt);
  const { status: permissionStatus } = useNotificationPermission();
  const { preferences, isLoading: prefsLoading } = useNotificationPreferences();

  useEffect(() => {
    const hikeId = startedAt !== null ? String(startedAt) : ACTIVE_HIKE_KEY;
    const identifier = pauseRecoveryIdentifier(hikeId);

    const enabled =
      !prefsLoading &&
      preferences.pauseRecovery &&
      permissionStatus === 'granted' &&
      status === 'paused';

    if (!enabled) {
      void cancelLocalNotification(identifier);
      return;
    }

    const triggerDate = new Date(Date.now() + NUDGE_DELAY_MS);
    void scheduleLocalNotification({
      identifier,
      title: 'Still hiking?',
      body: 'Your hike has been paused for 5 minutes. Tap to resume or stop.',
      triggerDate,
      data: { hikeId, action: 'pause-recovery' },
    }).catch((err) => {
      console.warn('[notifications] pause-recovery schedule failed:', err);
    });
  }, [
    status,
    startedAt,
    permissionStatus,
    preferences.pauseRecovery,
    prefsLoading,
  ]);
}
