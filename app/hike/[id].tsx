import { Ionicons } from '@expo/vector-icons';
import Mapbox, {
  Camera,
  LineLayer,
  MapView,
  ShapeSource,
} from '@rnmapbox/maps';
import { format } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useHike } from '@/hooks/useHike';
import { supabase } from '@/lib/supabase';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
} from '@/lib/units';
import { useProfileStore } from '@/stores/useProfileStore';
import type { SavedHike } from '@/types/hike';

const MAP_PADDING = {
  paddingLeft: 40,
  paddingRight: 40,
  paddingTop: 80,
  paddingBottom: 320,
};

function bufferBounds(bbox: [number, number, number, number]): {
  ne: [number, number];
  sw: [number, number];
} {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  // Pad single-point or near-zero-area boxes so the camera doesn't error.
  const lngPad = Math.max((maxLng - minLng) * 0.1, 0.001);
  const latPad = Math.max((maxLat - minLat) * 0.1, 0.001);
  return {
    ne: [maxLng + lngPad, maxLat + latPad],
    sw: [minLng - lngPad, minLat - latPad],
  };
}

export default function HikeDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { hike, isLoading, error, refresh } = useHike(id ?? null);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerBackTitle: 'Back',
          headerShadowVisible: false,
        }}
      />
      {isLoading && !hike ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : error && !hike ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
          <Text className="text-center text-base text-gray-700">{error}</Text>
          <View className="w-full max-w-xs">
            <Button label="Retry" onPress={() => void refresh()} />
          </View>
        </View>
      ) : hike ? (
        <HikeDetail hike={hike} onDeleted={() => router.back()} />
      ) : null}
    </View>
  );
}

function HikeDetail({
  hike,
  onDeleted,
}: {
  hike: SavedHike;
  onDeleted: () => void;
}): React.JSX.Element {
  const unitSystem = useProfileStore((s) => s.profile?.unit_system ?? 'metric');
  const [name, setName] = useState(hike.name ?? '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineShape = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: hike.path.map((p) => [p.longitude, p.latitude]),
      },
    }),
    [hike.path],
  );

  const bounds = useMemo(
    () => bufferBounds(hike.bounding_box),
    [hike.bounding_box],
  );

  const startedAt = new Date(hike.started_at);
  const endedAt = new Date(hike.ended_at);
  const averagePace =
    hike.distance_meters > 0
      ? hike.duration_seconds / (hike.distance_meters / 1000)
      : null;

  const onSaveName = async (): Promise<void> => {
    setIsSavingName(true);
    setError(null);
    const trimmed = name.trim();
    const { error: updateError } = await supabase
      .from('hikes')
      .update({ name: trimmed.length > 0 ? trimmed : null })
      .eq('id', hike.id);
    setIsSavingName(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setIsEditingName(false);
  };

  const onDelete = (): void => {
    Alert.alert(
      'Delete hike?',
      'This permanently removes the hike. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            const { error: deleteError } = await supabase
              .from('hikes')
              .delete()
              .eq('id', hike.id);
            setIsDeleting(false);
            if (deleteError) {
              setError(deleteError.message);
              return;
            }
            onDeleted();
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1">
      <View className="h-2/5 w-full">
        <MapView
          style={{ flex: 1 }}
          styleURL={Mapbox.StyleURL.Outdoors}
          scaleBarEnabled={false}
          compassEnabled={false}
        >
          <Camera
            defaultSettings={{
              bounds,
              padding: MAP_PADDING,
            }}
            animationMode="none"
          />
          <ShapeSource id="detail-path-source" shape={lineShape}>
            <LineLayer
              id="detail-path-line"
              style={{
                lineColor: '#0f766e',
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        </MapView>
      </View>

      <SafeAreaView className="flex-1" edges={['bottom']}>
        <View className="flex-1 gap-4 px-6 pt-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              {isEditingName ? (
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onBlur={() => void onSaveName()}
                  onSubmitEditing={() => void onSaveName()}
                  autoFocus
                  placeholder="Untitled hike"
                  placeholderTextColor="#9ca3af"
                  className="h-12 rounded-xl border border-gray-300 px-3 text-xl font-bold text-gray-900"
                />
              ) : (
                <Pressable onPress={() => setIsEditingName(true)}>
                  <Text className="text-2xl font-bold text-gray-900">
                    {hike.name ?? `Hike on ${format(startedAt, 'PP')}`}
                  </Text>
                  <Text className="mt-1 text-sm text-gray-500">
                    Tap to rename
                  </Text>
                </Pressable>
              )}
            </View>
            {isSavingName ? (
              <ActivityIndicator size="small" color="#0f766e" />
            ) : null}
          </View>

          <View className="flex-row flex-wrap gap-3">
            <BigStat
              label="Distance"
              value={formatDistance(hike.distance_meters, unitSystem)}
            />
            <BigStat
              label="Duration"
              value={formatDuration(hike.duration_seconds)}
            />
            <BigStat
              label="Elevation Gain"
              value={formatElevation(hike.elevation_gain_meters, unitSystem)}
            />
            <BigStat
              label="Elevation Loss"
              value={formatElevation(hike.elevation_loss_meters, unitSystem)}
            />
            <BigStat
              label="Avg Pace"
              value={formatPace(averagePace, unitSystem)}
            />
            <BigStat label="Started" value={format(startedAt, 'p')} />
            <BigStat label="Ended" value={format(endedAt, 'p')} />
          </View>

          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}

          <View className="mt-auto pb-2">
            <Pressable
              accessibilityRole="button"
              onPress={onDelete}
              disabled={isDeleting}
              className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-red-200 active:bg-red-50"
            >
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
              <Text className="text-base font-semibold text-red-600">
                Delete hike
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function BigStat({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View className="min-w-[45%] flex-1 rounded-xl bg-gray-50 px-4 py-3">
      <Text className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </Text>
      <Text className="mt-1 text-lg font-semibold text-gray-900">{value}</Text>
    </View>
  );
}
