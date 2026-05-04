import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDistance, formatDuration } from '@/lib/units';
import { useCrewStore } from '@/stores/useCrewStore';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';
import { useOfflineStore } from '@/stores/useOfflineStore';
import { useProfileStore } from '@/stores/useProfileStore';

const BANNER_SLOT_HEIGHT = 56;

export function BackgroundTrackingBanner(): React.JSX.Element | null {
  const status = useHikeTrackingStore((s) => s.status);
  const stats = useHikeTrackingStore((s) => s.stats);
  const startedAt = useHikeTrackingStore((s) => s.startedAt);
  const pausedAt = useHikeTrackingStore((s) => s.pausedAt);
  const accumulatedPausedMs = useHikeTrackingStore(
    (s) => s.accumulatedPausedMs,
  );
  const unitSystem = useProfileStore((s) => s.profile?.unit_system ?? 'metric');
  const outboxCount = useOfflineStore((s) => s.outboxCount);
  const inCrew = useCrewStore((s) => s.crew !== null);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status !== 'tracking') {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return (): void => loop.stop();
  }, [status, pulse]);

  const isActive = status === 'tracking' || status === 'paused';
  if (!isActive) return null;

  // Hide on the Home tab (where the active overlay already shows everything)
  // to avoid two overlapping displays of the same data.
  const seg = segments as readonly string[];
  const onHomeTab =
    seg[0] === '(tabs)' && (seg[1] === undefined || seg[1] === 'index');
  if (onHomeTab) return null;

  const liveDuration = (() => {
    if (startedAt === null) return 0;
    const now = Date.now();
    const pausedNow = pausedAt !== null ? now - pausedAt : 0;
    return Math.max(
      0,
      (now - startedAt - accumulatedPausedMs - pausedNow) / 1000,
    );
  })();

  // Slot below any banner that's also visible on this screen. Outbox
  // is global; ActiveCrewBanner only appears on non-Home tabs (same
  // hide rule as us, but inverted) — but ActiveCrewBanner already
  // hides on Home, and we ALSO hide on Home, so there's never a
  // case where both appear simultaneously. We only need to leave room
  // for outbox.
  const slotOffset = outboxCount > 0 ? BANNER_SLOT_HEIGHT : 0;
  // (inCrew read kept so a future banner can stack here too.)
  void inCrew;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + slotOffset,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingHorizontal: 12,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Return to active hike"
        onPress={() => router.navigate('/(tabs)')}
        className="flex-row items-center gap-3 rounded-2xl bg-teal-700 px-4 py-3 shadow-lg active:bg-teal-800"
      >
        <Animated.View
          style={{
            opacity: status === 'tracking' ? pulse : 0.6,
          }}
        >
          <Ionicons
            name={status === 'tracking' ? 'radio-button-on' : 'pause-circle'}
            size={22}
            color="#ffffff"
          />
        </Animated.View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-white">
            {status === 'tracking' ? 'Tracking your hike' : 'Hike paused'}
          </Text>
          <Text className="text-xs text-teal-100">
            {formatDistance(stats.distanceMeters, unitSystem)} •{' '}
            {formatDuration(liveDuration)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#ffffff" />
      </Pressable>
    </View>
  );
}
