import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { DownloadRegionSheet } from '@/components/settings/DownloadRegionSheet';
import { deleteRegion, loadRegions } from '@/lib/offlineRegions';
import {
  OFFLINE_FREE_DOWNLOAD_LIMIT,
  useOfflineStore,
  type OfflineRegionMeta,
} from '@/stores/useOfflineStore';

/**
 * Settings → Offline Maps. Lists downloaded Mapbox packs, lets the user
 * delete them to reclaim free slots, and opens DownloadRegionSheet for
 * a new download. Soft paywall when the free limit is hit.
 */
export function OfflineMapsSection(): React.JSX.Element {
  const regions = useOfflineStore((s) => s.regions);
  const setRegions = useOfflineStore((s) => s.setRegions);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Load on mount.
  useEffect(() => {
    void loadRegions()
      .then(setRegions)
      .catch((err) => {
        console.warn('[offlineMaps] loadRegions failed:', err);
      });
  }, [setRegions]);

  const slotsUsed = regions.length;
  const atLimit = slotsUsed >= OFFLINE_FREE_DOWNLOAD_LIMIT;

  const onDownloadPress = (): void => {
    if (atLimit) {
      Alert.alert(
        'Free downloads used',
        `You've used all ${OFFLINE_FREE_DOWNLOAD_LIMIT} free offline downloads. Pro unlocks unlimited regions (coming soon). Delete a region below to free up a slot.`,
      );
      return;
    }
    setSheetVisible(true);
  };

  const onDelete = (region: OfflineRegionMeta): void => {
    Alert.alert(
      `Delete "${region.name}"?`,
      'This frees up a download slot. The map area will no longer be available offline.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(region.name);
            try {
              await deleteRegion(region.name);
              setRegions(regions.filter((r) => r.name !== region.name));
            } catch (err) {
              console.warn('[offlineMaps] delete failed:', err);
              Alert.alert(
                'Could not delete region',
                err instanceof Error ? err.message : 'Unknown error',
              );
            } finally {
              setIsDeleting(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 13, color: '#6b7280' }}>
        {atLimit
          ? `${slotsUsed} of ${OFFLINE_FREE_DOWNLOAD_LIMIT} free downloads used (Pro coming soon)`
          : `${slotsUsed} of ${OFFLINE_FREE_DOWNLOAD_LIMIT} free downloads used`}
      </Text>

      {regions.length === 0 ? (
        <View
          style={{
            paddingVertical: 24,
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Ionicons name="download-outline" size={32} color="#9ca3af" />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827' }}>
              No offline regions yet
            </Text>
            <Text
              style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}
            >
              Download a region to use HikeMate without internet.
            </Text>
          </View>
        </View>
      ) : (
        regions.map((region) => (
          <View
            key={region.name}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: '#f3f4f6',
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#ccfbf1',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="map" size={20} color="#0f766e" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}
              >
                {region.name}
              </Text>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>
                Downloaded {format(new Date(region.downloadedAt), 'PP')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete region ${region.name}`}
              onPress={() => onDelete(region)}
              disabled={isDeleting === region.name}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: pressed ? '#fee2e2' : 'transparent',
                opacity: isDeleting === region.name ? 0.5 : 1,
              })}
            >
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
            </Pressable>
          </View>
        ))
      )}

      <Button
        label={
          atLimit
            ? 'Download new region (limit reached)'
            : 'Download new region'
        }
        variant={atLimit ? 'secondary' : 'primary'}
        onPress={onDownloadPress}
      />

      <DownloadRegionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}
