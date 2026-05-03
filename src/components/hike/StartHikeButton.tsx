import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_OFFSET = 72;

type Props = {
  onPress: () => void;
};

export function StartHikeButton({ onPress }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const handlePress = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
    onPress();
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + TAB_BAR_OFFSET,
        alignItems: 'center',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start a new hike"
        onPress={handlePress}
        className="h-14 flex-row items-center gap-2 rounded-full bg-teal-700 px-7 shadow-lg active:bg-teal-800"
      >
        <Ionicons name="play" size={22} color="#ffffff" />
        <Text className="text-base font-semibold text-white">Start Hike</Text>
      </Pressable>
    </View>
  );
}
