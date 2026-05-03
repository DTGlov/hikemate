import Mapbox, {
  Camera,
  MapView,
  UserLocation,
  type MapState,
} from '@rnmapbox/maps';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ActiveHikeOverlay } from '@/components/hike/ActiveHikeOverlay';
import { HikePathLayer } from '@/components/hike/HikePathLayer';
import { StartHikeButton } from '@/components/hike/StartHikeButton';
import { StopHikeConfirmModal } from '@/components/hike/StopHikeConfirmModal';
import { RecenterButton } from '@/components/map/RecenterButton';
import { useHikeTracker } from '@/hooks/useHikeTracker';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';
import { useLocationStore } from '@/stores/useLocationStore';

const DEFAULT_ZOOM = 15;

export function HikeMap(): React.JSX.Element {
  useUserLocation();
  const { isGpsStale, permissionLost } = useHikeTracker();
  const { request: requestLocationPermission } = useLocationPermission();

  const currentLocation = useLocationStore((s) => s.currentLocation);
  const lastKnownLocation = useLocationStore((s) => s.lastKnownLocation);
  const isFollowingUser = useLocationStore((s) => s.isFollowingUser);
  const setFollowingUser = useLocationStore((s) => s.setFollowingUser);
  const loadLastKnownLocation = useLocationStore(
    (s) => s.loadLastKnownLocation,
  );

  const hikeStatus = useHikeTrackingStore((s) => s.status);
  const trackingPoints = useHikeTrackingStore((s) => s.points);
  const startHike = useHikeTrackingStore((s) => s.startHike);
  const isHikeActive = hikeStatus === 'tracking' || hikeStatus === 'paused';

  const cameraRef = useRef<Camera>(null);
  const [stopModalVisible, setStopModalVisible] = useState(false);

  useEffect(() => {
    void loadLastKnownLocation();
  }, [loadLastKnownLocation]);

  // Smooth fly-to on first GPS fix when following.
  useEffect(() => {
    if (!currentLocation || !isFollowingUser) return;
    cameraRef.current?.flyTo(
      [currentLocation.longitude, currentLocation.latitude],
      750,
    );
  }, [currentLocation, isFollowingUser]);

  const onCameraChanged = useCallback(
    (state: MapState): void => {
      if (state.gestures.isGestureActive && isFollowingUser) {
        setFollowingUser(false);
      }
    },
    [isFollowingUser, setFollowingUser],
  );

  const onStartHike = useCallback(async (): Promise<void> => {
    // Re-check permission in case user toggled in Settings between map mount
    // and pressing Start.
    const next = await requestLocationPermission();
    if (next !== 'granted') return;
    setFollowingUser(true);
    startHike();
  }, [requestLocationPermission, setFollowingUser, startHike]);

  const initialCenter: [number, number] | undefined = lastKnownLocation
    ? [lastKnownLocation.longitude, lastKnownLocation.latitude]
    : undefined;

  const isLocating = isFollowingUser && currentLocation === null;

  return (
    <View className="flex-1">
      <MapView
        style={{ flex: 1 }}
        styleURL={Mapbox.StyleURL.Outdoors}
        onCameraChanged={onCameraChanged}
        scaleBarEnabled={false}
        compassEnabled
      >
        <Camera
          ref={cameraRef}
          followUserLocation={isFollowingUser}
          followZoomLevel={DEFAULT_ZOOM}
          defaultSettings={
            initialCenter
              ? { centerCoordinate: initialCenter, zoomLevel: DEFAULT_ZOOM }
              : { zoomLevel: DEFAULT_ZOOM }
          }
        />
        <UserLocation visible androidRenderMode="gps" />
        {isHikeActive ? <HikePathLayer points={trackingPoints} /> : null}
      </MapView>

      {isLocating && !isHikeActive ? (
        <View className="pointer-events-none absolute left-0 right-0 top-16 items-center">
          <View className="flex-row items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow">
            <ActivityIndicator size="small" color="#0f766e" />
            <Text className="text-sm font-medium text-gray-700">
              Locating you…
            </Text>
          </View>
        </View>
      ) : null}

      {isHikeActive ? (
        <ActiveHikeOverlay
          onStop={() => setStopModalVisible(true)}
          isGpsStale={isGpsStale}
          permissionLost={permissionLost}
        />
      ) : (
        <>
          <RecenterButton cameraRef={cameraRef} />
          <StartHikeButton onPress={() => void onStartHike()} />
        </>
      )}

      <StopHikeConfirmModal
        visible={stopModalVisible}
        onClose={() => setStopModalVisible(false)}
      />
    </View>
  );
}
