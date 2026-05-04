import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_OFFSET = 72;

type Props = {
  onCreate: () => void;
  onJoin: () => void;
};

/**
 * Two small floating buttons on the map for entering a group hike. Sit
 * just above the Start Hike button so the primary action stays primary.
 */
export function CrewEntryFabs({ onCreate, onJoin }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + TAB_BAR_OFFSET + 72,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a group hike crew"
        onPress={onCreate}
        className="h-11 flex-row items-center gap-1.5 rounded-full bg-white px-4 shadow-md active:bg-gray-100"
      >
        <Ionicons name="add-circle-outline" size={18} color="#0f766e" />
        <Text className="text-sm font-semibold text-gray-900">Create Crew</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Join a group hike crew"
        onPress={onJoin}
        className="h-11 flex-row items-center gap-1.5 rounded-full bg-white px-4 shadow-md active:bg-gray-100"
      >
        <Ionicons name="enter-outline" size={18} color="#0f766e" />
        <Text className="text-sm font-semibold text-gray-900">Join Crew</Text>
      </Pressable>
    </View>
  );
}
