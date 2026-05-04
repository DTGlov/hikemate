import { Ionicons } from '@expo/vector-icons';
import type { Camera } from '@rnmapbox/maps';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { useBottomSheetOffset } from '@/hooks/useBottomSheetOffset';
import { useLocationStore } from '@/stores/useLocationStore';

type Props = {
  cameraRef: React.RefObject<Camera | null>;
};

export function RecenterButton({ cameraRef }: Props): React.JSX.Element | null {
  const isFollowingUser = useLocationStore((s) => s.isFollowingUser);
  const currentLocation = useLocationStore((s) => s.currentLocation);
  const setFollowingUser = useLocationStore((s) => s.setFollowingUser);
  // Clears the tab bar when solo and the crew sheet's peek when in crew.
  const bottomOffset = useBottomSheetOffset();

  if (isFollowingUser) return null;

  const onPress = (): void => {
    void Haptics.selectionAsync().catch(() => undefined);
    setFollowingUser(true);
    if (currentLocation) {
      cameraRef.current?.flyTo(
        [currentLocation.longitude, currentLocation.latitude],
        500,
      );
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 16,
        bottom: bottomOffset,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Recenter map on your location"
        onPress={onPress}
        className="h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md active:bg-gray-100"
      >
        <Ionicons name="locate" size={22} color="#0f766e" />
      </Pressable>
    </View>
  );
}
