import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar/Avatar';
import { useHikes } from '@/hooks/useHikes';
import { colorForUser } from '@/lib/memberColor';
import { formatDistance } from '@/lib/units';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProfileStore } from '@/stores/useProfileStore';

export default function ProfileScreen(): React.JSX.Element {
  const userEmail = useAuthStore((s) => s.user?.email ?? null);
  const profile = useProfileStore((s) => s.profile);
  const unitSystem = profile?.unit_system ?? 'metric';
  const displayName = profile?.display_name ?? userEmail ?? 'Hiker';
  const { hikes } = useHikes();

  const totalHikes = hikes?.length ?? 0;
  const totalDistanceMeters =
    hikes?.reduce((sum, h) => sum + h.distance_meters, 0) ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-1 gap-6 px-6 pt-2">
        <View className="items-center gap-3">
          <Avatar
            seed={profile?.avatar_seed ?? null}
            displayName={displayName}
            fallbackColor={profile ? colorForUser(profile.id) : '#0f766e'}
            size={96}
          />
          <View className="items-center gap-0.5">
            <Text className="text-xl font-bold text-gray-900" numberOfLines={1}>
              {displayName}
            </Text>
            {userEmail && userEmail !== displayName ? (
              <Text className="text-sm text-gray-500" numberOfLines={1}>
                {userEmail}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="flex-row gap-3">
          <SummaryCard
            iconName="trail-sign-outline"
            label="Total hikes"
            value={String(totalHikes)}
          />
          <SummaryCard
            iconName="footsteps-outline"
            label="Total distance"
            value={formatDistance(totalDistanceMeters, unitSystem)}
          />
        </View>

        <Link href="/settings" asChild>
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 active:bg-gray-50"
          >
            <View className="flex-row items-center gap-3">
              <Ionicons name="settings-outline" size={22} color="#0f766e" />
              <Text className="text-base font-medium text-gray-900">
                Settings
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

function SummaryCard({
  iconName,
  label,
  value,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View className="flex-1 gap-2 rounded-2xl border border-gray-200 bg-white p-4">
      <Ionicons name={iconName} size={20} color="#0f766e" />
      <Text className="text-xl font-semibold text-gray-900">{value}</Text>
      <Text className="text-sm text-gray-600">{label}</Text>
    </View>
  );
}
