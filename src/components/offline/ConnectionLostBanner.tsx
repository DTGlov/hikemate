import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Static banner shown only on the home tab when in a crew and offline.
 * No pulse, no tap action — purely informational. Auto-clears when the
 * caller stops rendering it (online again or out of crew).
 */
export function ConnectionLostBanner(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 56, // sits below any potential outbox banner
        left: 12,
        right: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: '#fef9c3',
          borderWidth: 1,
          borderColor: '#fde68a',
        }}
      >
        <Ionicons name="cloud-offline-outline" size={18} color="#854d0e" />
        <Text
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: '500',
            color: '#713f12',
          }}
        >
          Connection lost — others’ positions may be stale
        </Text>
      </View>
    </View>
  );
}
