import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Image, Pressable, Text, View } from 'react-native';

import { getHikeThumbnailUrl } from '@/lib/mapbox';
import {
  colors,
  fontFamily,
  fontSize,
  lineHeight,
  radius,
  spacing,
} from '@/lib/theme';
import { formatDistance, formatDuration } from '@/lib/units';
import { useProfileStore } from '@/stores/useProfileStore';
import type { SavedHike } from '@/types/hike';

type Props = {
  hike: SavedHike;
  onPress?: () => void;
};

export function HikeListItem({ hike, onPress }: Props): React.JSX.Element {
  const unitSystem = useProfileStore((s) => s.profile?.unit_system ?? 'metric');
  const thumbnailUrl = getHikeThumbnailUrl(hike.path, 320, 180);
  const startedAt = new Date(hike.started_at);

  const handlePress = (): void => {
    void Haptics.selectionAsync().catch(() => undefined);
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open hike ${hike.name ?? `on ${format(startedAt, 'PP')}`}`}
      onPress={handlePress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
        overflow: 'hidden',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      })}
    >
      <View style={{ height: 128, backgroundColor: colors.surfaceMuted }}>
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            accessibilityLabel="Map preview of hike route"
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Ionicons name="map-outline" size={28} color={colors.textMuted} />
          </View>
        )}
      </View>
      <View style={{ gap: spacing.xs, padding: spacing.base }}>
        <Text
          style={{
            fontFamily: fontFamily.medium,
            fontSize: fontSize.bodyLarge,
            lineHeight: lineHeight.bodyLarge,
            color: colors.textPrimary,
          }}
          numberOfLines={1}
        >
          {hike.name ?? `Hike on ${format(startedAt, 'PP')}`}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <Stat
            icon="footsteps-outline"
            text={formatDistance(hike.distance_meters, unitSystem)}
          />
          <Stat
            icon="time-outline"
            text={formatDuration(hike.duration_seconds)}
          />
          <Stat icon="calendar-outline" text={format(startedAt, 'PP')} />
        </View>
      </View>
    </Pressable>
  );
}

function Stat({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}): React.JSX.Element {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
      }}
    >
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text
        style={{
          fontFamily: fontFamily.regular,
          fontSize: fontSize.small,
          lineHeight: lineHeight.small,
          color: colors.textSecondary,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
