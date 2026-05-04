import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

const HORIZONTAL_PADDING = 20;
const ICON_GUTTER_GAP = 12;

type IoniconName = keyof typeof Ionicons.glyphMap;

type Props = {
  /** Optional leading icon. When present, sits 20px from the screen edge
   *  with a 12px gap to the label so labels stack vertically across rows. */
  icon?: IoniconName;
  iconColor?: string;
  label: string;
  /** Right-aligned secondary text (e.g. an email address or "v1.0.0"). */
  value?: string;
  /** Right-aligned control (Switch, etc.). Takes precedence over `value`. */
  control?: React.ReactNode;
  onPress?: () => void;
  /** Renders the label in red — use for sign-out / delete-style actions. */
  destructive?: boolean;
  /** Replaces the right-side content with a spinner while in flight. */
  loading?: boolean;
};

/**
 * Single-row primitive used across the Profile sections. Forces a uniform
 * horizontal padding (20pt), icon-to-label gap (12pt), and 56pt height so
 * every row aligns to the same column grid regardless of section.
 */
export function ProfileRow({
  icon,
  iconColor,
  label,
  value,
  control,
  onPress,
  destructive = false,
  loading = false,
}: Props): React.JSX.Element {
  const labelColor = destructive ? '#dc2626' : '#111827';
  const resolvedIconColor = iconColor ?? (destructive ? '#dc2626' : '#6b7280');

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        paddingHorizontal: HORIZONTAL_PADDING,
        gap: ICON_GUTTER_GAP,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
      }}
    >
      {icon ? (
        <Ionicons name={icon} size={20} color={resolvedIconColor} />
      ) : null}
      <Text
        style={{
          flex: 1,
          fontSize: 16,
          color: labelColor,
          fontWeight: destructive ? '500' : '400',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color={resolvedIconColor} />
      ) : control ? (
        control
      ) : value ? (
        <Text
          style={{ fontSize: 16, color: '#6b7280', flexShrink: 1 }}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? destructive
            ? '#fef2f2'
            : '#f9fafb'
          : '#ffffff',
      })}
    >
      {content}
    </Pressable>
  );
}
