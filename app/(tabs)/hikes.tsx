import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { HikeListItem } from '@/components/hike/HikeListItem';
import { useHikes } from '@/hooks/useHikes';
import {
  colors,
  fontFamily,
  fontSize,
  lineHeight,
  radius,
  spacing,
} from '@/lib/theme';

export default function HikesScreen(): React.JSX.Element {
  const { hikes, isLoading, error, refresh } = useHikes();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View
        style={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
        }}
      >
        <Text
          style={{
            fontFamily: fontFamily.bold,
            fontSize: fontSize.heading2,
            lineHeight: lineHeight.heading2,
            color: colors.textPrimary,
          }}
        >
          Hikes
        </Text>
      </View>

      {error && hikes === null ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.xxl,
            gap: spacing.base,
          }}
        >
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={colors.textMuted}
          />
          <Text
            style={{
              fontFamily: fontFamily.medium,
              fontSize: fontSize.bodyLarge,
              lineHeight: lineHeight.bodyLarge,
              color: colors.textPrimary,
              textAlign: 'center',
            }}
          >
            Couldn&apos;t load your hikes.
          </Text>
          <Text
            style={{
              fontFamily: fontFamily.regular,
              fontSize: fontSize.body,
              lineHeight: lineHeight.body,
              color: colors.textSecondary,
              textAlign: 'center',
            }}
          >
            {error}
          </Text>
          <View style={{ width: '100%', maxWidth: 320 }}>
            <Button label="Retry" onPress={() => void refresh()} />
          </View>
        </View>
      ) : (
        <FlatList
          data={hikes ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.base,
            paddingBottom: spacing.xxl,
            gap: spacing.md,
          }}
          renderItem={({ item }) => (
            <HikeListItem
              hike={item}
              onPress={() => router.push(`/hike/${item.id}`)}
            />
          )}
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
    <View style={{ gap: spacing.md, paddingTop: spacing.sm }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            overflow: 'hidden',
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ height: 128, backgroundColor: colors.surfaceMuted }} />
          <View style={{ gap: spacing.sm, padding: spacing.base }}>
            <View
              style={{
                height: 14,
                width: '50%',
                borderRadius: 4,
                backgroundColor: colors.divider,
              }}
            />
            <View
              style={{
                height: 12,
                width: '75%',
                borderRadius: 4,
                backgroundColor: colors.surfaceMuted,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function EmptyHikes(): React.JSX.Element {
  return (
    <View style={{ minHeight: 480 }}>
      <EmptyState
        icon="map-outline"
        title="No hikes yet"
        body="Tap Start Hike on the Home tab to begin your first adventure."
      />
    </View>
  );
}
