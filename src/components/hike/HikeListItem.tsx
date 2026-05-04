import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Image, Pressable, Text, View } from 'react-native';

import { getHikeThumbnailUrl } from '@/lib/mapbox';
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
      })}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
    >
      <View className="h-32 bg-gray-100">
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            accessibilityLabel="Map preview of hike route"
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Ionicons name="map-outline" size={28} color="#9ca3af" />
          </View>
        )}
      </View>
      <View className="gap-1 p-4">
        <Text
          className="text-base font-semibold text-gray-900"
          numberOfLines={1}
        >
          {hike.name ?? `Hike on ${format(startedAt, 'PP')}`}
        </Text>
        <View className="flex-row items-center gap-3">
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
    <View className="flex-row items-center gap-1">
      <Ionicons name={icon} size={14} color="#6b7280" />
      <Text className="text-sm text-gray-600">{text}</Text>
    </View>
  );
}
