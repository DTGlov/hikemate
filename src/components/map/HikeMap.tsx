import Mapbox, {
  Camera,
  MapView,
  UserLocation,
  type MapState,
} from '@rnmapbox/maps';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { RecenterButton } from '@/components/map/RecenterButton';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useLocationStore } from '@/stores/useLocationStore';

const DEFAULT_ZOOM = 15;

export function HikeMap(): React.JSX.Element {
  useUserLocation();

  const currentLocation = useLocationStore((s) => s.currentLocation);
  const lastKnownLocation = useLocationStore((s) => s.lastKnownLocation);
  const isFollowingUser = useLocationStore((s) => s.isFollowingUser);
  const setFollowingUser = useLocationStore((s) => s.setFollowingUser);
  const loadLastKnownLocation = useLocationStore(
    (s) => s.loadLastKnownLocation,
  );

  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    void loadLastKnownLocation();
  }, [loadLastKnownLocation]);

  // Once we have a real GPS fix and we're following, fly to it. The
  // followUserLocation prop on Camera also tracks updates, but flying on
  // the first fix gives a smoother transition from lastKnownLocation.
  useEffect(() => {
    if (!currentLocation || !isFollowingUser) return;
    cameraRef.current?.flyTo(
      [currentLocation.longitude, currentLocation.latitude],
      750,
    );
  }, [currentLocation, isFollowingUser]);

  const onCameraChanged = useCallback(
    (state: MapState): void => {
      // The user grabbed the map. Stop following so the camera doesn't
      // fight the gesture. RecenterButton will reappear.
      if (state.gestures.isGestureActive && isFollowingUser) {
        setFollowingUser(false);
      }
    },
    [isFollowingUser, setFollowingUser],
  );

  // Initial center: prefer last known location so the user doesn't see a
  // blank world map while we wait for the first GPS fix.
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
      </MapView>

      {isLocating ? (
        <View className="pointer-events-none absolute left-0 right-0 top-16 items-center">
          <View className="flex-row items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow">
            <ActivityIndicator size="small" color="#0f766e" />
            <Text className="text-sm font-medium text-gray-700">
              Locating you…
            </Text>
          </View>
        </View>
      ) : null}

      <RecenterButton cameraRef={cameraRef} />
    </View>
  );
}
