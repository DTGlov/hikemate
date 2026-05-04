import { Ionicons } from '@expo/vector-icons';
import Mapbox, { Camera, MapView, type MapState } from '@rnmapbox/maps';
import { useCallback, useRef, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { downloadRegion } from '@/lib/offlineRegions';
import { useLocationStore } from '@/stores/useLocationStore';
import { useOfflineStore } from '@/stores/useOfflineStore';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const DOWNLOAD_RECT_INSET = 0.08; // 8% inset on each side; the framed area
//   is what gets downloaded.

/**
 * Full-screen Mapbox MapView for picking an offline region. The
 * download area is the camera viewport's center 84% (the framed rectangle
 * is purely visual; we use the camera bounds at confirm time).
 */
export function DownloadRegionSheet({
  visible,
  onClose,
}: Props): React.JSX.Element {
  const lastKnown = useLocationStore((s) => s.lastKnownLocation);
  const setRegions = useOfflineStore((s) => s.setRegions);
  const existingRegions = useOfflineStore((s) => s.regions);

  const [name, setName] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const lastBoundsRef = useRef<{
    ne: [number, number];
    sw: [number, number];
  } | null>(null);

  const handleClose = (): void => {
    setName('');
    setError(null);
    setIsDownloading(false);
    setProgress(0);
    onClose();
  };

  const onCameraChanged = useCallback((state: MapState): void => {
    const [neLng, neLat] = state.properties.bounds.ne;
    const [swLng, swLat] = state.properties.bounds.sw;
    // Inset by DOWNLOAD_RECT_INSET on each side so the actual download
    // matches the framed rectangle, not the full visible viewport.
    const lngSpan = neLng - swLng;
    const latSpan = neLat - swLat;
    lastBoundsRef.current = {
      ne: [
        neLng - lngSpan * DOWNLOAD_RECT_INSET,
        neLat - latSpan * DOWNLOAD_RECT_INSET,
      ],
      sw: [
        swLng + lngSpan * DOWNLOAD_RECT_INSET,
        swLat + latSpan * DOWNLOAD_RECT_INSET,
      ],
    };
  }, []);

  const handleDownload = async (): Promise<void> => {
    const bounds = lastBoundsRef.current;
    if (!bounds) {
      setError('Pan the map first to choose an area.');
      return;
    }
    const trimmed = name.trim();
    const finalName =
      trimmed.length > 0 ? trimmed : `Region ${existingRegions.length + 1}`;
    if (existingRegions.some((r) => r.name === finalName)) {
      setError(`A region named "${finalName}" already exists.`);
      return;
    }

    setIsDownloading(true);
    setProgress(0);
    setError(null);

    try {
      const region = await downloadRegion({
        name: finalName,
        boundsNE: bounds.ne,
        boundsSW: bounds.sw,
        styleURL: Mapbox.StyleURL.Outdoors,
        onProgress: (p) => setProgress(p.percentage),
      });
      setRegions([...existingRegions, region]);
      Alert.alert(
        'Region downloaded',
        `"${finalName}" is now available offline.`,
      );
      handleClose();
    } catch (err) {
      console.warn('[downloadRegion] failed:', err);
      setError(err instanceof Error ? err.message : 'Download failed');
      setIsDownloading(false);
    }
  };

  const initialCenter: [number, number] | undefined = lastKnown
    ? [lastKnown.longitude, lastKnown.latitude]
    : undefined;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={handleClose}
            disabled={isDownloading}
          >
            <Text
              style={{
                color: isDownloading ? '#9ca3af' : '#0f766e',
                fontSize: 15,
                fontWeight: '600',
              }}
            >
              Cancel
            </Text>
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
            Download Region
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={{ flex: 1 }}>
          <MapView
            style={{ flex: 1 }}
            styleURL={Mapbox.StyleURL.Outdoors}
            onCameraChanged={onCameraChanged}
            scaleBarEnabled={false}
            compassEnabled={false}
          >
            <Camera
              defaultSettings={{
                centerCoordinate: initialCenter,
                zoomLevel: 11,
              }}
            />
          </MapView>

          {/* Visual rect — corresponds to the area we'll actually
              download (DOWNLOAD_RECT_INSET on each side). */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '8%',
              left: '8%',
              right: '8%',
              bottom: '8%',
              borderWidth: 2,
              borderColor: '#0f766e',
              borderRadius: 12,
              backgroundColor: 'rgba(15, 118, 110, 0.07)',
            }}
          />

          {isDownloading ? (
            <View
              style={{
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: 16,
                backgroundColor: '#ffffff',
                borderRadius: 12,
                padding: 16,
                shadowColor: '#000',
                shadowOpacity: 0.15,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              <Text style={{ fontWeight: '600', color: '#111827' }}>
                Downloading… {progress.toFixed(0)}%
              </Text>
              <View
                style={{
                  marginTop: 8,
                  height: 6,
                  backgroundColor: '#e5e7eb',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${Math.max(0, Math.min(100, progress))}%`,
                    height: '100%',
                    backgroundColor: '#0f766e',
                  }}
                />
              </View>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: '#6b7280',
                }}
              >
                Don’t close the app while a region is downloading.
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            gap: 10,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Region name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={`Region ${existingRegions.length + 1}`}
              placeholderTextColor="#9ca3af"
              editable={!isDownloading}
              maxLength={40}
              style={{
                height: 44,
                borderWidth: 1,
                borderColor: '#d1d5db',
                borderRadius: 10,
                paddingHorizontal: 12,
                fontSize: 15,
                color: '#111827',
              }}
            />
          </View>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>
            <Ionicons name="information-circle-outline" size={12} /> Pan and
            zoom to frame the area inside the teal rectangle. May use ~10–80 MB
            depending on terrain detail.
          </Text>
          {error ? (
            <Text style={{ color: '#dc2626', fontSize: 13 }}>{error}</Text>
          ) : null}
          <Button
            label="Download"
            onPress={() => void handleDownload()}
            isLoading={isDownloading}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
