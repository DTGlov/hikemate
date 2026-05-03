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
import { CreateRoomSheet } from '@/components/room/CreateRoomSheet';
import { JoinRoomSheet } from '@/components/room/JoinRoomSheet';
import { MemberDetailCard } from '@/components/room/MemberDetailCard';
import { RoomEntryFabs } from '@/components/room/RoomEntryFabs';
import { RoomMemberDot } from '@/components/room/RoomMemberDot';
import { RoomMemberPathLayer } from '@/components/room/RoomMemberPathLayer';
import { RoomMembersBottomSheet } from '@/components/room/RoomMembersBottomSheet';
import { useHikeTracker } from '@/hooks/useHikeTracker';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useRoomStore } from '@/stores/useRoomStore';

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

  const room = useRoomStore((s) => s.room);
  const members = useRoomStore((s) => s.members);
  const livePositions = useRoomStore((s) => s.livePositions);
  const myUserId = useRoomStore((s) => s.myUserId);
  const inRoom = room !== null;

  const cameraRef = useRef<Camera>(null);
  const [stopModalVisible, setStopModalVisible] = useState(false);
  const [createRoomVisible, setCreateRoomVisible] = useState(false);
  const [joinRoomVisible, setJoinRoomVisible] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

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

  const onStartHike = useCallback(async (): Promise<void> => {
    const next = await requestLocationPermission();
    if (next !== 'granted') return;
    setFollowingUser(true);
    startHike();
  }, [requestLocationPermission, setFollowingUser, startHike]);

  const initialCenter: [number, number] | undefined = lastKnownLocation
    ? [lastKnownLocation.longitude, lastKnownLocation.latitude]
    : undefined;

  const isLocating = isFollowingUser && currentLocation === null;
  const selectedMember = selectedMemberId ? members[selectedMemberId] : null;
  const selectedPosition = selectedMemberId
    ? livePositions[selectedMemberId]
    : null;

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

        {/* Room overlays — paths under dots so dots stay on top. */}
        {inRoom
          ? Object.values(livePositions)
              .filter((p) => p.user_id !== myUserId)
              .map((position) => {
                const member = members[position.user_id];
                if (!member) return null;
                return (
                  <RoomMemberPathLayer
                    key={`path-${position.user_id}`}
                    position={position}
                    color={member.color}
                  />
                );
              })
          : null}
        {inRoom
          ? Object.values(livePositions)
              .filter((p) => p.user_id !== myUserId)
              .map((position) => {
                const member = members[position.user_id];
                if (!member) return null;
                return (
                  <RoomMemberDot
                    key={`dot-${position.user_id}`}
                    member={member}
                    position={position}
                    onSelected={() => setSelectedMemberId(position.user_id)}
                  />
                );
              })
          : null}
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
          {!inRoom ? (
            <>
              <StartHikeButton onPress={() => void onStartHike()} />
              <RoomEntryFabs
                onCreate={() => setCreateRoomVisible(true)}
                onJoin={() => setJoinRoomVisible(true)}
              />
            </>
          ) : null}
        </>
      )}

      {selectedMember && selectedPosition ? (
        <MemberDetailCard
          member={selectedMember}
          position={selectedPosition}
          onClose={() => setSelectedMemberId(null)}
        />
      ) : null}

      {inRoom ? <RoomMembersBottomSheet /> : null}

      <StopHikeConfirmModal
        visible={stopModalVisible}
        onClose={() => setStopModalVisible(false)}
      />
      <CreateRoomSheet
        visible={createRoomVisible}
        onClose={() => setCreateRoomVisible(false)}
      />
      <JoinRoomSheet
        visible={joinRoomVisible}
        onClose={() => setJoinRoomVisible(false)}
      />
    </View>
  );
}
