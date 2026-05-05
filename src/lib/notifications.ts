import * as Notifications from 'expo-notifications';

import {
  NOTIFICATION_ID_PREFIX,
  type NotificationCategory,
} from '@/lib/notificationCategories';

export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined';

let handlerConfigured = false;

/**
 * Idempotent — call once at app start. Configures how foreground
 * notifications render (banner + sound + list, no badge). Subsequent
 * calls no-op.
 */
export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function mapStatus(
  status: Notifications.PermissionStatus,
): NotificationPermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'undetermined') return 'undetermined';
  return 'denied';
}

export async function getNotificationPermission(): Promise<NotificationPermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return mapStatus(status);
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  const { status } = await Notifications.requestPermissionsAsync();
  return mapStatus(status);
}

export interface ScheduleLocalNotificationOptions {
  identifier: string;
  title: string;
  body: string;
  triggerDate: Date;
  data?: Record<string, unknown>;
}

/**
 * Schedule (or replace, if `identifier` already exists) a local
 * notification at `triggerDate`. Returns the platform identifier — for our
 * call sites that's always the same string we passed in.
 */
export async function scheduleLocalNotification(
  options: ScheduleLocalNotificationOptions,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    identifier: options.identifier,
    content: {
      title: options.title,
      body: options.body,
      sound: 'default',
      data: options.data ?? {},
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: options.triggerDate,
    },
  });
}

export async function cancelLocalNotification(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (err) {
    // Cancelling a non-existent identifier is a no-op on iOS but throws
    // on some Android versions; swallow to keep callers idempotent.
    console.warn('[notifications] cancel failed:', err);
  }
}

export async function getScheduledNotifications(): Promise<
  Notifications.NotificationRequest[]
> {
  return Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Cancel every scheduled notification whose identifier begins with the
 * given category's prefix. Used when the user disables a category.
 */
export async function cancelCategory(
  category: NotificationCategory,
): Promise<void> {
  const prefix = NOTIFICATION_ID_PREFIX[category];
  const scheduled = await getScheduledNotifications();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(prefix))
      .map((n) => cancelLocalNotification(n.identifier)),
  );
}
