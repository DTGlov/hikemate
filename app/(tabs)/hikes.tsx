import { Text, View } from 'react-native';

export default function HikesScreen(): React.JSX.Element {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg font-semibold text-teal-700">
        Hike history goes here
      </Text>
    </View>
  );
}
