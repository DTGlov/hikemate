import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { triggerOutboxSync } from '@/hooks/useHikeOutboxSync';
import { useOfflineStore } from '@/stores/useOfflineStore';

const SLOT_HEIGHT = 56;

/**
 * Highest-slot root banner. Visible whenever there are queued hikes
 * waiting to sync. Tap → Alert with manual "Retry now".
 */
export function OutboxBanner(): React.JSX.Element | null {
  const count = useOfflineStore((s) => s.outboxCount);
  const isOnline = useOfflineStore((s) => s.isOnline);
  const insets = useSafeAreaInsets();

  if (count <= 0) return null;

  const onPress = (): void => {
    Alert.alert(
      'Pending sync',
      `${count} ${count === 1 ? 'hike' : 'hikes'} waiting to upload.${
        isOnline ? '' : '\n\nYou are currently offline.'
      }`,
      [
        { text: 'OK', style: 'cancel' },
        {
          text: 'Retry now',
          onPress: () => void triggerOutboxSync(),
        },
      ],
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 60,
        paddingHorizontal: 12,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${count} hikes pending sync, tap for options`}
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: pressed ? '#fde68a' : '#fef3c7',
          borderWidth: 1,
          borderColor: '#fde68a',
        })}
      >
        <Ionicons name="cloud-upload-outline" size={18} color="#92400e" />
        <Text
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: '500',
            color: '#78350f',
          }}
        >
          {count} {count === 1 ? 'hike' : 'hikes'} pending sync
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#0f766e' }}>
          Details
        </Text>
      </Pressable>
    </View>
  );
}

export const OUTBOX_BANNER_SLOT_HEIGHT = SLOT_HEIGHT;
