import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useLocationPermission } from '@/hooks/useLocationPermission';

type StateContent = {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  cta: string;
};

const COPY: Record<
  'undetermined' | 'denied' | 'denied-permanent',
  StateContent
> = {
  undetermined: {
    iconName: 'map-outline',
    title: 'Find your way',
    body: 'HikeMate uses your location to show your position on the map and track your hikes.',
    cta: 'Enable Location',
  },
  denied: {
    iconName: 'location-outline',
    title: 'Location is needed',
    body: 'HikeMate can only show the map and track your hikes with your location. Want to allow access?',
    cta: 'Allow Location',
  },
  'denied-permanent': {
    iconName: 'settings-outline',
    title: 'Location is disabled',
    body: 'You’ll need to enable location access in Settings before HikeMate can show the map.',
    cta: 'Open Settings',
  },
};

export function LocationPermissionGate(): React.JSX.Element {
  const { status, request, openSettings } = useLocationPermission();
  const [isWorking, setIsWorking] = useState(false);

  const variant: 'undetermined' | 'denied' | 'denied-permanent' =
    status === 'granted' ? 'undetermined' : status;
  const copy = COPY[variant];

  const onPress = async (): Promise<void> => {
    setIsWorking(true);
    try {
      if (status === 'denied-permanent') {
        await openSettings();
      } else {
        await request();
      }
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center gap-6 px-8">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-teal-50">
          <Ionicons name={copy.iconName} size={56} color="#0f766e" />
        </View>
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-bold text-gray-900">
            {copy.title}
          </Text>
          <Text className="text-center text-base leading-6 text-gray-600">
            {copy.body}
          </Text>
        </View>
        <View className="w-full max-w-xs">
          <Button label={copy.cta} onPress={onPress} isLoading={isWorking} />
        </View>
      </View>
    </SafeAreaView>
  );
}
