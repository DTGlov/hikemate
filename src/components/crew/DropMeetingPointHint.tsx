import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  onCancel: () => void;
};

/**
 * Top banner shown while the host is in drop-pin mode. Explains the
 * gesture and provides a Cancel affordance to exit without dropping.
 */
export function DropMeetingPointHint({ onCancel }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 12,
        right: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: '#0f766e',
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 16,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <Ionicons name="flag" size={18} color="#ffffff" />
        <Text
          style={{
            flex: 1,
            color: '#ffffff',
            fontSize: 14,
            fontWeight: '500',
          }}
        >
          Tap on the map to drop the meeting point.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel drop meeting point"
          onPress={onCancel}
          style={({ pressed }) => ({
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: pressed
              ? 'rgba(255, 255, 255, 0.2)'
              : 'transparent',
          })}
        >
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
