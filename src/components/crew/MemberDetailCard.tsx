import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { Pressable, Text, View } from 'react-native';

import { haversineMeters } from '@/lib/geo';
import { initialsFromDisplayName } from '@/lib/displayName';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
} from '@/lib/units';
import { useCrewStore } from '@/stores/useCrewStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useProfileStore } from '@/stores/useProfileStore';
import type { MemberLivePosition, CrewMember } from '@/types/crew';

type Props = {
  member: CrewMember;
  position: MemberLivePosition;
  onClose: () => void;
};

export function MemberDetailCard({
  member,
  position,
  onClose,
}: Props): React.JSX.Element {
  const myLocation = useLocationStore((s) => s.currentLocation);
  const unitSystem = useProfileStore((s) => s.profile?.unit_system ?? 'metric');
  const stats = useCrewStore((s) => s.liveStats[member.user_id] ?? null);

  const distanceText = myLocation
    ? formatDistance(
        haversineMeters(
          { latitude: myLocation.latitude, longitude: myLocation.longitude },
          { latitude: position.lat, longitude: position.lng },
        ),
        unitSystem,
      )
    : '—';

  const lastSeenText = position.isOnline
    ? 'Online now'
    : `Last update ${formatDistanceToNow(position.timestamp, { addSuffix: true })}`;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 100,
        left: 12,
        right: 12,
      }}
    >
      <View className="rounded-2xl bg-white p-4 shadow-lg">
        <View className="flex-row items-center gap-3">
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: member.color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {initialsFromDisplayName(member.display_name)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">
              {member.display_name}
            </Text>
            <Text className="text-xs text-gray-500">
              {distanceText} away • {lastSeenText}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close member details"
            onPress={onClose}
            className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
          >
            <Ionicons name="close" size={18} color="#374151" />
          </Pressable>
        </View>

        {stats ? (
          <View className="mt-4 flex-row flex-wrap gap-3 border-t border-gray-100 pt-3">
            <Stat
              label="Distance"
              value={formatDistance(stats.distanceMeters, unitSystem)}
            />
            <Stat
              label="Duration"
              value={formatDuration(stats.durationSeconds)}
            />
            <Stat
              label="Pace"
              value={formatPace(stats.currentPaceSecPerKm, unitSystem)}
            />
            <Stat
              label="Elevation"
              value={formatElevation(stats.elevationGainMeters, unitSystem)}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View className="min-w-[45%] flex-1 rounded-xl bg-gray-50 px-3 py-2">
      <Text className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </Text>
      <Text className="mt-0.5 text-sm font-semibold text-gray-900">
        {value}
      </Text>
    </View>
  );
}
