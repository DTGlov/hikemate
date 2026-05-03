import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Link } from 'expo-router';
import { Image, Text, View } from 'react-native';

import { getHikeThumbnailUrl } from '@/lib/mapbox';
import { formatDistance, formatDuration } from '@/lib/units';
import { useProfileStore } from '@/stores/useProfileStore';
import type { SavedHike } from '@/types/hike';

type Props = {
  hike: SavedHike;
};

export function HikeListItem({ hike }: Props): React.JSX.Element {
  const unitSystem = useProfileStore((s) => s.profile?.unit_system ?? 'metric');
  const thumbnailUrl = getHikeThumbnailUrl(hike.path, 320, 180);
  const startedAt = new Date(hike.started_at);

  return (
    <Link href={`/hike/${hike.id}`} asChild>
      <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
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
      </View>
    </Link>
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
