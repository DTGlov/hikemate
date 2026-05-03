import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRoomStore } from '@/stores/useRoomStore';

export function ActiveRoomBanner(): React.JSX.Element | null {
  const room = useRoomStore((s) => s.room);
  const memberCount = useRoomStore((s) => Object.keys(s.members).length);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!room) {
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
  }, [room, pulse]);

  if (!room) return null;

  // Hide on the Home tab (where the room overlay shows the same info).
  const seg = segments as readonly string[];
  const onHomeTab =
    seg[0] === '(tabs)' && (seg[1] === undefined || seg[1] === 'index');
  if (onHomeTab) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingHorizontal: 12,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Return to active room"
        onPress={() => router.navigate('/(tabs)')}
        className="flex-row items-center gap-3 rounded-2xl bg-emerald-600 px-4 py-3 shadow-lg active:bg-emerald-700"
      >
        <Animated.View style={{ opacity: pulse }}>
          <Ionicons name="radio-button-on" size={22} color="#ffffff" />
        </Animated.View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-white">
            In room: {room.code}
          </Text>
          <Text className="text-xs text-emerald-100">
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#ffffff" />
      </Pressable>
    </View>
  );
}
