import { Text, View } from 'react-native';

import {
  colors,
  fontFamily,
  fontSize,
  lineHeight,
  radius,
  spacing,
} from '@/lib/theme';

type Props = {
  label: string;
  value: string;
  suffix?: string;
};

export function StatPill({ label, value, suffix }: Props): React.JSX.Element {
  return (
    <View
      style={{
        flex: 1,
        height: 80,
        borderRadius: radius.md,
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'space-between',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: spacing.xs,
        }}
      >
        <Text
          style={{
            fontFamily: fontFamily.medium,
            fontSize: fontSize.heading3,
            lineHeight: lineHeight.heading3,
            color: colors.textPrimary,
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
        {suffix ? (
          <Text
            style={{
              fontFamily: fontFamily.regular,
              fontSize: fontSize.body,
              lineHeight: lineHeight.body,
              color: colors.textSecondary,
            }}
            numberOfLines={1}
          >
            {suffix}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: fontFamily.medium,
          fontSize: fontSize.caption,
          lineHeight: lineHeight.caption,
          color: colors.textSecondary,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
