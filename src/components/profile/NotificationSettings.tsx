import { Switch, Text, View } from 'react-native';

import { NotificationPermissionBanner } from '@/components/notifications/NotificationPermissionBanner';
import { ProfileRow } from '@/components/profile/ProfileRow';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { useNotificationPreferences } from '@/hooks/useNotificationCategoryPref';
import { colors, fontFamily, fontSize, lineHeight, spacing } from '@/lib/theme';
import type { NotificationCategory } from '@/lib/notificationCategories';

const SECTION_PADDING_X = spacing.lg;

/**
 * Phase 8 — three toggles for the categories of local notification this
 * app schedules. Toggles are disabled (not just visually muted — actual
 * disabled prop) when OS permission is not granted, paired with a banner
 * + Open Settings button.
 */
export function NotificationSettings(): React.JSX.Element {
  const { status, openSettings } = useNotificationPermission();
  const { preferences, isLoading, setPreference } = useNotificationPreferences();
  const isGranted = status === 'granted';
  const isDenied = status === 'denied';

  const renderSwitch = (category: NotificationCategory): React.JSX.Element => (
    <Switch
      value={isGranted && preferences[category]}
      disabled={!isGranted || isLoading}
      onValueChange={(next) => void setPreference(category, next)}
      trackColor={{ true: colors.brand, false: '#d1d5db' }}
      accessibilityLabel={category}
      accessibilityRole="switch"
    />
  );

  return (
    <View>
      {isDenied ? (
        <View style={{ paddingTop: spacing.md, paddingBottom: spacing.md }}>
          <NotificationPermissionBanner
            onOpenSettings={() => void openSettings()}
          />
        </View>
      ) : null}

      {!isGranted && !isDenied ? (
        <View
          style={{
            paddingHorizontal: SECTION_PADDING_X,
            paddingTop: spacing.sm,
            paddingBottom: spacing.md,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamily.regular,
              fontSize: fontSize.small,
              lineHeight: lineHeight.small,
              color: colors.textSecondary,
            }}
          >
            Join a crew to enable notifications.
          </Text>
        </View>
      ) : null}

      <ProfileRow
        icon="alarm-outline"
        label="Pre-hike reminders"
        control={renderSwitch('preHikeReminders')}
      />
      <ProfileRow
        icon="pause-circle-outline"
        label="Pause recovery nudges"
        control={renderSwitch('pauseRecovery')}
      />
      <ProfileRow
        icon="location-outline"
        label="Geofence arrivals"
        control={renderSwitch('geofenceArrivals')}
      />
    </View>
  );
}
