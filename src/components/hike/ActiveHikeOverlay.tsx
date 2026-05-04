import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBottomSheetOffset } from '@/hooks/useBottomSheetOffset';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
} from '@/lib/units';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';
import { useProfileStore } from '@/stores/useProfileStore';

type Props = {
  onStop: () => void;
  isGpsStale: boolean;
  permissionLost: boolean;
  backgroundDisabled: boolean;
};

function liveDurationSeconds(
  startedAt: number | null,
  pausedAt: number | null,
  accumulatedPausedMs: number,
): number {
  if (startedAt === null) return 0;
  const now = Date.now();
  const pausedNow = pausedAt !== null ? now - pausedAt : 0;
  return Math.max(
    0,
    (now - startedAt - accumulatedPausedMs - pausedNow) / 1000,
  );
}

export function ActiveHikeOverlay({
  onStop,
  isGpsStale,
  permissionLost,
  backgroundDisabled,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  // Lifts the bottom Pause/Stop row above the crew sheet's peek when
  // in a crew; falls back to the historical baseline when solo.
  const bottomOffset = useBottomSheetOffset();
  const status = useHikeTrackingStore((s) => s.status);
  const stats = useHikeTrackingStore((s) => s.stats);
  const startedAt = useHikeTrackingStore((s) => s.startedAt);
  const pausedAt = useHikeTrackingStore((s) => s.pausedAt);
  const accumulatedPausedMs = useHikeTrackingStore(
    (s) => s.accumulatedPausedMs,
  );
  const pauseHike = useHikeTrackingStore((s) => s.pauseHike);
  const resumeHike = useHikeTrackingStore((s) => s.resumeHike);

  const unitSystem = useProfileStore((s) => s.profile?.unit_system ?? 'metric');

  // 1Hz ticker so duration updates smoothly between GPS fixes.
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    if (status !== 'tracking') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return (): void => clearInterval(id);
  }, [status]);

  const isPaused = status === 'paused';
  const liveDuration = liveDurationSeconds(
    startedAt,
    pausedAt,
    accumulatedPausedMs,
  );

  const onPauseResume = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => undefined,
    );
    if (isPaused) resumeHike();
    else pauseHike();
  };

  const onStopPress = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
      () => undefined,
    );
    onStop();
  };

  return (
    <>
      {/* Top stats panel */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: insets.top + 8,
          paddingHorizontal: 12,
        }}
      >
        <View className="rounded-2xl bg-white/95 p-4 shadow-lg">
          <Text className="text-center text-5xl font-bold text-gray-900">
            {formatDuration(liveDuration)}
          </Text>
          <Text className="mt-1 text-center text-sm text-gray-500">
            {isPaused ? 'PAUSED' : 'DURATION'}
          </Text>
          <View className="mt-3 flex-row justify-around">
            <Stat
              label="Distance"
              value={formatDistance(stats.distanceMeters, unitSystem)}
            />
            <Stat
              label="Elevation"
              value={formatElevation(stats.elevationGainMeters, unitSystem)}
            />
            <Stat
              label="Pace"
              value={formatPace(stats.currentPaceSecPerKm, unitSystem)}
            />
          </View>

          {(isGpsStale || permissionLost || backgroundDisabled) && (
            <View className="mt-3 flex-row items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
              <Ionicons name="warning-outline" size={16} color="#b45309" />
              <Text className="text-sm text-amber-900">
                {permissionLost
                  ? 'Location access lost — re-enable in Settings'
                  : backgroundDisabled
                    ? 'Background tracking off — locking your phone will pause this hike'
                    : 'Searching for GPS…'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom action buttons */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: bottomOffset,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 12,
          paddingHorizontal: 16,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPaused ? 'Resume hike' : 'Pause hike'}
          onPress={onPauseResume}
          className="h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg active:bg-gray-100"
        >
          <Ionicons
            name={isPaused ? 'play' : 'pause'}
            size={26}
            color="#0f766e"
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stop hike"
          onPress={onStopPress}
          className="h-14 flex-row items-center gap-2 rounded-full bg-red-600 px-7 shadow-lg active:bg-red-700"
        >
          <Ionicons name="stop" size={20} color="#ffffff" />
          <Text className="text-base font-semibold text-white">Stop</Text>
        </Pressable>
      </View>
    </>
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
    <View className="items-center">
      <Text className="text-base font-semibold text-gray-900">{value}</Text>
      <Text className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </Text>
    </View>
  );
}
