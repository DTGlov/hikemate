import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { colors, fontFamily, fontSize, lineHeight, spacing } from '@/lib/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

/**
 * Standard empty-state layout used across the app: centered icon, title,
 * supporting body. Use this everywhere a screen would otherwise show a
 * blank list — every empty surface should explain what's missing AND
 * what action surfaces it.
 */
export function EmptyState({ icon, title, body }: Props): React.JSX.Element {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.xxl,
        gap: spacing.xxl,
      }}
    >
      <Ionicons name={icon} size={48} color={colors.textMuted} />
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Text
          style={{
            fontFamily: fontFamily.medium,
            fontSize: fontSize.heading3,
            lineHeight: lineHeight.heading3,
            color: colors.textPrimary,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: fontFamily.regular,
            fontSize: fontSize.body,
            lineHeight: lineHeight.body,
            color: colors.textSecondary,
            textAlign: 'center',
          }}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}
