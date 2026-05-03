import { View } from 'react-native';

import { HikeMap } from '@/components/map/HikeMap';
import { LocationPermissionGate } from '@/components/map/LocationPermissionGate';
import { useLocationStore } from '@/stores/useLocationStore';

export default function HomeScreen(): React.JSX.Element {
  const permissionStatus = useLocationStore((s) => s.permissionStatus);

  if (permissionStatus !== 'granted') {
    return <LocationPermissionGate />;
  }

  return (
    <View className="flex-1">
      <HikeMap />
    </View>
  );
}
