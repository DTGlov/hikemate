import { Ionicons } from '@expo/vector-icons';
import Mapbox, {
  Camera,
  LineLayer,
  MapView,
  ShapeSource,
} from '@rnmapbox/maps';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar/Avatar';
import { Button } from '@/components/Button';
import {
  type SummaryMember,
  useCrewEndSummary,
} from '@/hooks/useCrewEndSummary';
import { boundingBox } from '@/lib/geo';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  type UnitSystem,
} from '@/lib/units';
import { useCrewStore } from '@/stores/useCrewStore';
import { useProfileStore } from '@/stores/useProfileStore';

const MAP_PADDING = 60;

function bufferedBounds(bbox: [number, number, number, number]): {
  ne: [number, number];
  sw: [number, number];
} {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lngPad = Math.max((maxLng - minLng) * 0.1, 0.001);
  const latPad = Math.max((maxLat - minLat) * 0.1, 0.001);
  return {
    ne: [maxLng + lngPad, maxLat + latPad],
    sw: [minLng - lngPad, minLat - latPad],
  };
}

export default function CrewSummaryScreen(): React.JSX.Element {
  // roomId is in the route purely to give this screen a stable URL — the
  // store snapshot is the source of truth.
  useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const clearLastEndedCrew = useCrewStore((s) => s.clearLastEndedCrew);
  const unitSystem = useProfileStore((s) => s.profile?.unit_system ?? 'metric');
  const { crew, members, myHike, isLoading, error } = useCrewEndSummary();

  const onLeave = useCallback((): void => {
    clearLastEndedCrew();
    router.replace('/(tabs)');
  }, [clearLastEndedCrew, router]);

  const polyline = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (!myHike) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: myHike.path.map((p) => [p.longitude, p.latitude]),
      },
    };
  }, [myHike]);

  const cameraRef = useRef<Camera>(null);
  const bounds = useMemo(() => {
    if (!myHike) return null;
    const isValidBbox =
      Array.isArray(myHike.bounding_box) &&
      myHike.bounding_box.length === 4 &&
      myHike.bounding_box.every((n) => Number.isFinite(n));
    const bbox = isValidBbox
      ? (myHike.bounding_box as [number, number, number, number])
      : boundingBox(myHike.path);
    return bufferedBounds(bbox);
  }, [myHike]);

  const onDidFinishLoadingStyle = useCallback((): void => {
    if (bounds) {
      cameraRef.current?.fitBounds(bounds.ne, bounds.sw, MAP_PADDING, 0);
    }
  }, [bounds]);

  const leaderboard = useMemo(() => computeLeaderboard(members), [members]);

  if (!crew) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Stack.Screen options={{ headerShown: true, title: 'Crew summary' }} />
        <Ionicons name="hourglass-outline" size={36} color="#9ca3af" />
        <Text className="text-center text-base text-gray-700">
          No crew summary available.
        </Text>
        <View className="w-48">
          <Button label="Done" onPress={onLeave} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          title: crew.name ?? 'Crew summary',
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close summary"
              onPress={onLeave}
              hitSlop={10}
              style={{ paddingHorizontal: 4 }}
            >
              <Ionicons name="close" size={26} color="#0f766e" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="h-72 w-full bg-gray-100">
          {polyline ? (
            <MapView
              style={{ flex: 1 }}
              styleURL={Mapbox.StyleURL.Outdoors}
              onDidFinishLoadingStyle={onDidFinishLoadingStyle}
              scaleBarEnabled={false}
              compassEnabled={false}
            >
              <Camera ref={cameraRef} animationMode="none" />
              <ShapeSource id="summary-path-source" shape={polyline}>
                <LineLayer
                  id="summary-path-line"
                  style={{
                    lineColor: '#0f766e',
                    lineWidth: 4,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </ShapeSource>
            </MapView>
          ) : (
            <View className="flex-1 items-center justify-center gap-2 px-6">
              {isLoading ? (
                <ActivityIndicator size="small" color="#0f766e" />
              ) : (
                <>
                  <Ionicons name="map-outline" size={36} color="#9ca3af" />
                  <Text className="text-center text-sm text-gray-600">
                    No saved hike to display on the map.
                  </Text>
                </>
              )}
            </View>
          )}
        </View>

        <View className="gap-5 px-6 pt-5">
          <View>
            <Text className="text-xs uppercase tracking-wide text-gray-500">
              Highlights
            </Text>
            <View className="mt-2 gap-2">
              {leaderboard.empty ? (
                <Text className="text-sm text-gray-600">
                  Nobody tracked a hike during this crew session.
                </Text>
              ) : (
                <>
                  {leaderboard.fastestPace ? (
                    <HighlightCard
                      iconName="speedometer-outline"
                      label="Fastest pace"
                      member={leaderboard.fastestPace.member}
                      value={formatPace(
                        leaderboard.fastestPace.value,
                        unitSystem,
                      )}
                    />
                  ) : null}
                  {leaderboard.longestDistance ? (
                    <HighlightCard
                      iconName="trail-sign-outline"
                      label="Longest distance"
                      member={leaderboard.longestDistance.member}
                      value={formatDistance(
                        leaderboard.longestDistance.value,
                        unitSystem,
                      )}
                    />
                  ) : null}
                  {leaderboard.highestGain ? (
                    <HighlightCard
                      iconName="trending-up-outline"
                      label="Most elevation gained"
                      member={leaderboard.highestGain.member}
                      value={formatElevation(
                        leaderboard.highestGain.value,
                        unitSystem,
                      )}
                    />
                  ) : null}
                </>
              )}
            </View>
          </View>

          <View>
            <Text className="text-xs uppercase tracking-wide text-gray-500">
              Crew ({members.length})
            </Text>
            <View className="mt-2 gap-2">
              {members.map((m) => (
                <MemberRow key={m.user_id} member={m} unitSystem={unitSystem} />
              ))}
            </View>
          </View>

          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}

          <Button label="Done" onPress={onLeave} />
        </View>
      </ScrollView>
    </View>
  );
}

type LeaderboardEntry = { member: SummaryMember; value: number };
type Leaderboard = {
  fastestPace: LeaderboardEntry | null;
  longestDistance: LeaderboardEntry | null;
  highestGain: LeaderboardEntry | null;
  empty: boolean;
};

function computeLeaderboard(members: SummaryMember[]): Leaderboard {
  let fastestPace: LeaderboardEntry | null = null;
  let longestDistance: LeaderboardEntry | null = null;
  let highestGain: LeaderboardEntry | null = null;
  let anyTracked = false;
  for (const m of members) {
    if (!m.stats) continue;
    anyTracked = true;
    const pace = m.stats.currentPaceSecPerKm;
    if (pace !== null && pace > 0) {
      if (!fastestPace || pace < fastestPace.value) {
        fastestPace = { member: m, value: pace };
      }
    }
    if (
      m.stats.distanceMeters > 0 &&
      (!longestDistance || m.stats.distanceMeters > longestDistance.value)
    ) {
      longestDistance = { member: m, value: m.stats.distanceMeters };
    }
    if (
      m.stats.elevationGainMeters > 0 &&
      (!highestGain || m.stats.elevationGainMeters > highestGain.value)
    ) {
      highestGain = { member: m, value: m.stats.elevationGainMeters };
    }
  }
  return { fastestPace, longestDistance, highestGain, empty: !anyTracked };
}

function HighlightCard({
  iconName,
  label,
  value,
  member,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  member: SummaryMember;
}): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-teal-50">
        <Ionicons name={iconName} size={18} color="#0f766e" />
      </View>
      <View className="flex-1">
        <Text className="text-xs uppercase tracking-wide text-gray-500">
          {label}
        </Text>
        <Text className="text-base font-semibold text-gray-900">{value}</Text>
        <Text className="text-xs text-gray-500" numberOfLines={1}>
          {member.display_name}
          {member.isMe ? ' (you)' : ''}
        </Text>
      </View>
      <Avatar
        seed={member.avatar_seed}
        displayName={member.display_name}
        fallbackColor={member.color}
        size={36}
        ringColor={member.color}
      />
    </View>
  );
}

function MemberRow({
  member,
  unitSystem,
}: {
  member: SummaryMember;
  unitSystem: UnitSystem;
}): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
      <Avatar
        seed={member.avatar_seed}
        displayName={member.display_name}
        fallbackColor={member.color}
        size={44}
        ringColor={member.color}
      />
      <View className="flex-1">
        <Text
          className="text-base font-semibold text-gray-900"
          numberOfLines={1}
        >
          {member.display_name}
          {member.isMe ? ' (you)' : ''}
        </Text>
        {member.stats ? (
          <View className="mt-0.5 flex-row flex-wrap gap-x-3">
            <Text className="text-xs text-gray-700">
              {formatDistance(member.stats.distanceMeters, unitSystem)}
            </Text>
            <Text className="text-xs text-gray-700">
              {formatDuration(member.stats.durationSeconds)}
            </Text>
            <Text className="text-xs text-gray-700">
              {formatElevation(member.stats.elevationGainMeters, unitSystem)}
            </Text>
            <Text className="text-xs text-gray-700">
              {formatPace(member.stats.currentPaceSecPerKm, unitSystem)}
            </Text>
          </View>
        ) : (
          <Text className="text-xs text-gray-500">Did not track this hike</Text>
        )}
      </View>
    </View>
  );
}
