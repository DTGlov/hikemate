import { Ionicons } from '@expo/vector-icons';
import { Pressable, Share, Text } from 'react-native';

type Props = {
  code: string;
};

export function CrewCodeShareButton({ code }: Props): React.JSX.Element {
  const onPress = async (): Promise<void> => {
    try {
      await Share.share({
        message: `Join my hike on HikeMate — code ${code}\nhikemate://crew/${code}`,
      });
    } catch (err) {
      console.warn('Share failed', err);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Share crew code"
      onPress={onPress}
      className="h-11 flex-row items-center gap-2 rounded-full bg-teal-700 px-5 active:bg-teal-800"
    >
      <Ionicons name="share-outline" size={18} color="#ffffff" />
      <Text className="text-sm font-semibold text-white">Share Code</Text>
    </Pressable>
  );
}
