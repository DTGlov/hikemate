import { Ionicons } from '@expo/vector-icons';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { HikeListItem } from '@/components/hike/HikeListItem';
import { useHikes } from '@/hooks/useHikes';

export default function HikesScreen(): React.JSX.Element {
  const { hikes, isLoading, error, refresh } = useHikes();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="px-6 pb-3 pt-2">
        <Text className="text-3xl font-bold text-gray-900">Hikes</Text>
      </View>

      {error && hikes === null ? (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Ionicons name="cloud-offline-outline" size={56} color="#9ca3af" />
          <Text className="text-center text-base text-gray-700">
            Couldn&apos;t load your hikes.
          </Text>
          <Text className="text-center text-sm text-gray-500">{error}</Text>
          <View className="w-full max-w-xs">
            <Button label="Retry" onPress={() => void refresh()} />
          </View>
        </View>
      ) : (
        <FlatList
          data={hikes ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 32,
            gap: 12,
          }}
          renderItem={({ item }) => <HikeListItem hike={item} />}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => void refresh()}
              tintColor="#0f766e"
            />
          }
          ListEmptyComponent={isLoading ? <ListSkeleton /> : <EmptyHikes />}
        />
      )}
    </SafeAreaView>
  );
}

function ListSkeleton(): React.JSX.Element {
  return (
    <View className="gap-3 pt-2">
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
        >
          <View className="h-32 bg-gray-100" />
          <View className="gap-2 p-4">
            <View className="h-4 w-1/2 rounded bg-gray-200" />
            <View className="h-3 w-3/4 rounded bg-gray-100" />
          </View>
        </View>
      ))}
    </View>
  );
}

function EmptyHikes(): React.JSX.Element {
  return (
    <View className="items-center gap-4 px-6 pt-24">
      <View className="h-24 w-24 items-center justify-center rounded-full bg-teal-50">
        <Ionicons name="trail-sign-outline" size={48} color="#0f766e" />
      </View>
      <View className="items-center gap-1">
        <Text className="text-xl font-semibold text-gray-900">
          No hikes yet
        </Text>
        <Text className="text-center text-base text-gray-600">
          Your first hike will appear here once you finish tracking on the Home
          tab.
        </Text>
      </View>
    </View>
  );
}
