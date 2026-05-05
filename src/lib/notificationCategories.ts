// Phase 8 — Notification category preferences and identifier conventions.
//
// Identifiers are deterministic so cancel + reschedule are idempotent. The
// prefix lets us cancel an entire category at once when the user toggles
// a preference off.

export type NotificationCategory =
  | 'preHikeReminders'
  | 'pauseRecovery'
  | 'geofenceArrivals';

export interface NotificationPreferences {
  preHikeReminders: boolean;
  pauseRecovery: boolean;
  geofenceArrivals: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  preHikeReminders: true,
  pauseRecovery: true,
  geofenceArrivals: true,
};

export const NOTIFICATION_PREFERENCES_KEY = 'hikemate.notificationPreferences';

export const NOTIFICATION_ID_PREFIX: Record<NotificationCategory, string> = {
  preHikeReminders: 'prehike-',
  pauseRecovery: 'pause-recovery-',
  geofenceArrivals: 'geofence-',
};

export function preHikeIdentifier(roomId: string): string {
  return `${NOTIFICATION_ID_PREFIX.preHikeReminders}${roomId}`;
}

export function pauseRecoveryIdentifier(hikeId: string): string {
  return `${NOTIFICATION_ID_PREFIX.pauseRecovery}${hikeId}`;
}
