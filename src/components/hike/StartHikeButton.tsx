import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

import { useBottomSheetOffset } from '@/hooks/useBottomSheetOffset';

type Props = {
  onPress: () => void;
};

export function StartHikeButton({ onPress }: Props): React.JSX.Element {
  // Lifts the button above the crew bottom sheet's peek when in a crew.
  // Falls back to the historical insets+tab-bar baseline when solo.
  const bottomOffset = useBottomSheetOffset();

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
        bottom: bottomOffset,
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
