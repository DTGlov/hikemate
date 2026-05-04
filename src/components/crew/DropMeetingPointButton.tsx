import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_OFFSET = 72;
const RECENTER_BUTTON_OFFSET = 64;

type Props = {
  hasExistingPin: boolean;
  onPress: () => void;
};

/**
 * Host-only floating button. Sits above the recenter button on the
 * map's right edge. Label flips based on whether a pin already exists.
 */
export function DropMeetingPointButton({
  hasExistingPin,
  onPress,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const handlePress = (): void => {
    void Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 16,
        bottom: insets.bottom + TAB_BAR_OFFSET + RECENTER_BUTTON_OFFSET,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          hasExistingPin ? 'Move meeting point' : 'Drop meeting point'
        }
        onPress={handlePress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          height: 44,
          borderRadius: 22,
          backgroundColor: pressed ? '#0e6b63' : '#0f766e',
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        })}
      >
        <Ionicons name="flag" size={18} color="#ffffff" />
        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
          {hasExistingPin ? 'Move Meeting Point' : 'Drop Meeting Point'}
        </Text>
      </Pressable>
    </View>
  );
}
