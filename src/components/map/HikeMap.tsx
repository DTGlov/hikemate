import Mapbox, {
  Camera,
  MapView,
  UserLocation,
  type MapState,
} from '@rnmapbox/maps';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ActiveHikeOverlay } from '@/components/hike/ActiveHikeOverlay';
import { AlwaysPermissionExplainer } from '@/components/hike/AlwaysPermissionExplainer';
import { HikePathLayer } from '@/components/hike/HikePathLayer';
import { StartHikeButton } from '@/components/hike/StartHikeButton';
import { StopHikeConfirmModal } from '@/components/hike/StopHikeConfirmModal';
import { RecenterButton } from '@/components/map/RecenterButton';
import { useAlwaysPermission } from '@/hooks/useAlwaysPermission';
import { useBackgroundHikeTracker } from '@/hooks/useBackgroundHikeTracker';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';
import { useLocationStore } from '@/stores/useLocationStore';

const DEFAULT_ZOOM = 15;

export function HikeMap(): React.JSX.Element {
  useUserLocation();
  const { isGpsStale, permissionLost } = useBackgroundHikeTracker();
  const {
    status: alwaysStatus,
    hasDeclinedExplainer,
    refresh: refreshPermission,
    request: requestAlwaysPermission,
    recordDeclinedExplainer,
  } = useAlwaysPermission();

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
  const [explainerVisible, setExplainerVisible] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    void loadLastKnownLocation();
  }, [loadLastKnownLocation]);

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

  const beginHike = useCallback((): void => {
    setFollowingUser(true);
    startHike();
  }, [setFollowingUser, startHike]);

  // Start flow:
  //   - already 'always' / 'foreground-only' → start now
  //   - undetermined and the user hasn't declined the explainer yet →
  //     show the explainer; choices route through onAllow / onLater
  //   - undetermined but explainer was already declined OR denied →
  //     try a silent system request; if granted, start; if denied,
  //     start anyway (foreground-only) so the user can still hike,
  //     and useBackgroundHikeTracker will surface the limitation
  const onStartHike = useCallback(async (): Promise<void> => {
    setIsWorking(true);
    try {
      const fresh = await refreshPermission();
      if (fresh === 'always' || fresh === 'foreground-only') {
        beginHike();
        return;
      }
      if (fresh === 'undetermined' && !hasDeclinedExplainer) {
        setExplainerVisible(true);
        return;
      }
      // 'denied' or already-declined-and-still-undetermined: try whatever
      // the system will give us. If denied permanently, request() returns
      // 'denied' and we don't start.
      const after = await requestAlwaysPermission();
      if (after === 'always' || after === 'foreground-only') beginHike();
    } finally {
      setIsWorking(false);
    }
  }, [
    beginHike,
    hasDeclinedExplainer,
    refreshPermission,
    requestAlwaysPermission,
  ]);

  const onAllowAlways = useCallback(async (): Promise<void> => {
    setIsWorking(true);
    try {
      const after = await requestAlwaysPermission();
      setExplainerVisible(false);
      if (after === 'always' || after === 'foreground-only') beginHike();
    } finally {
      setIsWorking(false);
    }
  }, [beginHike, requestAlwaysPermission]);

  const onLater = useCallback(async (): Promise<void> => {
    setIsWorking(true);
    try {
      await recordDeclinedExplainer();
      // Still need at least foreground permission to do anything.
      const after = await requestAlwaysPermission();
      setExplainerVisible(false);
      if (after === 'foreground-only' || after === 'always') beginHike();
    } finally {
      setIsWorking(false);
    }
  }, [beginHike, recordDeclinedExplainer, requestAlwaysPermission]);

  const initialCenter: [number, number] | undefined = lastKnownLocation
    ? [lastKnownLocation.longitude, lastKnownLocation.latitude]
    : undefined;

  const isLocating = isFollowingUser && currentLocation === null;
  const showForegroundOnlyBanner =
    isHikeActive && alwaysStatus === 'foreground-only';

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
          backgroundDisabled={showForegroundOnlyBanner && !permissionLost}
        />
      ) : (
        <>
          <RecenterButton cameraRef={cameraRef} />
          <StartHikeButton onPress={() => void onStartHike()} />
        </>
      )}

      <AlwaysPermissionExplainer
        visible={explainerVisible}
        isWorking={isWorking}
        onAllow={() => void onAllowAlways()}
        onLater={() => void onLater()}
      />

      <StopHikeConfirmModal
        visible={stopModalVisible}
        onClose={() => setStopModalVisible(false)}
      />
    </View>
  );
}
