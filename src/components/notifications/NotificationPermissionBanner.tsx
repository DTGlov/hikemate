import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { colors, fontFamily, fontSize, lineHeight, spacing } from '@/lib/theme';

type Props = {
  onOpenSettings: () => void;
};

/**
 * Phase 8 — persistent banner shown in Profile when notification
 * permission is denied. Tapping "Open Settings" deep-links into the
 * app's iOS Settings page so the user can flip permission back on.
 */
export function NotificationPermissionBanner({
  onOpenSettings,
}: Props): React.JSX.Element {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginHorizontal: spacing.lg,
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <Ionicons
        name="notifications-off-outline"
        size={20}
        color={colors.textSecondary}
      />
      <Text
        style={{
          flex: 1,
          fontFamily: fontFamily.regular,
          fontSize: fontSize.body,
          lineHeight: lineHeight.body,
          color: colors.textPrimary,
        }}
      >
        Notifications are off. Enable them in Settings to receive reminders.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open notification settings"
        onPress={onOpenSettings}
        style={({ pressed }) => ({
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 8,
          backgroundColor: pressed ? colors.brandActive : colors.brand,
        })}
      >
        <Text
          style={{
            fontFamily: fontFamily.medium,
            fontSize: fontSize.small,
            lineHeight: lineHeight.small,
            color: '#ffffff',
          }}
        >
          Open Settings
        </Text>
      </Pressable>
    </View>
  );
}
