import { Ionicons } from '@expo/vector-icons';
import Mapbox, {
  Camera,
  MapView,
  UserLocation,
  type MapState,
} from '@rnmapbox/maps';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';

import { ActiveHikeOverlay } from '@/components/hike/ActiveHikeOverlay';
import { AlwaysPermissionExplainer } from '@/components/hike/AlwaysPermissionExplainer';
import { HikePathLayer } from '@/components/hike/HikePathLayer';
import { StartHikeButton } from '@/components/hike/StartHikeButton';
import { StopHikeConfirmModal } from '@/components/hike/StopHikeConfirmModal';
import { RecenterButton } from '@/components/map/RecenterButton';
import { CreateCrewSheet } from '@/components/crew/CreateCrewSheet';
import { CrewEntryFabs } from '@/components/crew/CrewEntryFabs';
import { CrewMemberDot } from '@/components/crew/CrewMemberDot';
import { CrewMemberPathLayer } from '@/components/crew/CrewMemberPathLayer';
import { CrewMembersBottomSheet } from '@/components/crew/CrewMembersBottomSheet';
import { DropMeetingPointButton } from '@/components/crew/DropMeetingPointButton';
import { DropMeetingPointHint } from '@/components/crew/DropMeetingPointHint';
import { JoinCrewSheet } from '@/components/crew/JoinCrewSheet';
import { ConnectionLostBanner } from '@/components/offline/ConnectionLostBanner';
import { MeetingPointGeofenceLayer } from '@/components/crew/MeetingPointGeofenceLayer';
import { MeetingPointPin } from '@/components/crew/MeetingPointPin';
import { MemberDetailCard } from '@/components/crew/MemberDetailCard';
import { useAlwaysPermission } from '@/hooks/useAlwaysPermission';
import { useBackgroundHikeTracker } from '@/hooks/useBackgroundHikeTracker';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useCrewStore } from '@/stores/useCrewStore';
import { useOfflineStore } from '@/stores/useOfflineStore';
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

  const crew = useCrewStore((s) => s.crew);
  const members = useCrewStore((s) => s.members);
  const livePositions = useCrewStore((s) => s.livePositions);
  const meetingPoint = useCrewStore((s) => s.meetingPoint);
  const arrivals = useCrewStore((s) => s.arrivals);
  const myUserId = useCrewStore((s) => s.myUserId);
  const isHost = useCrewStore((s) => s.isHost);
  const setMeetingPointRemote = useCrewStore((s) => s.setMeetingPointRemote);
  const inCrew = crew !== null;
  const isOnline = useOfflineStore((s) => s.isOnline);

  const cameraRef = useRef<Camera>(null);
  const [stopModalVisible, setStopModalVisible] = useState(false);
  const [explainerVisible, setExplainerVisible] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [createCrewVisible, setCreateCrewVisible] = useState(false);
  const [joinCrewVisible, setJoinCrewVisible] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [dropPinMode, setDropPinMode] = useState(false);

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

  // Map tap handler: only acts when in drop-pin mode (host-only).
  // GeoJSON Point coordinates are [lng, lat].
  const onMapPress = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point>): void => {
      if (!dropPinMode || !crew || !isHost) return;
      const [lng, lat] = feature.geometry.coordinates;
      Alert.alert(
        meetingPoint ? 'Move meeting point here?' : 'Drop meeting point here?',
        'Crew members will see the new location and a 100m geofence around it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              const { error } = await setMeetingPointRemote(lat, lng);
              setDropPinMode(false);
              if (error) {
                Alert.alert('Could not set meeting point', error);
              }
            },
          },
        ],
      );
    },
    [crew, dropPinMode, isHost, meetingPoint, setMeetingPointRemote],
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
        onPress={onMapPress}
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

        {/* Phase 7 — meeting point geofence + pin. Geofence first so the
            pin renders on top. Visible to every crew member. */}
        {inCrew && meetingPoint ? (
          <>
            <MeetingPointGeofenceLayer point={meetingPoint} />
            <MeetingPointPin
              point={meetingPoint}
              onSelected={() => {
                const totalMembers = Object.keys(members).length;
                const arrivedCount = Object.keys(arrivals).length;
                Alert.alert(
                  meetingPoint.label,
                  `${arrivedCount} of ${totalMembers} arrived`,
                );
              }}
            />
          </>
        ) : null}

        {/* Crew overlays — paths under dots so dots stay on top. */}
        {inCrew
          ? Object.values(livePositions)
              .filter((p) => p.user_id !== myUserId)
              .map((position) => {
                const member = members[position.user_id];
                if (!member) return null;
                return (
                  <CrewMemberPathLayer
                    key={`path-${position.user_id}`}
                    position={position}
                    color={member.color}
                  />
                );
              })
          : null}
        {inCrew
          ? Object.values(livePositions)
              .filter((p) => p.user_id !== myUserId)
              .map((position) => {
                const member = members[position.user_id];
                if (!member) return null;
                return (
                  <CrewMemberDot
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
          backgroundDisabled={showForegroundOnlyBanner && !permissionLost}
        />
      ) : (
        <>
          <RecenterButton cameraRef={cameraRef} />
          {!inCrew ? (
            <>
              <StartHikeButton onPress={() => void onStartHike()} />
              <CrewEntryFabs
                onCreate={() => setCreateCrewVisible(true)}
                onJoin={() => setJoinCrewVisible(true)}
              />
            </>
          ) : null}
          {/* Phase 7 — host-only meeting point control. Hidden during
              drop-pin mode (the hint banner takes its place) and during
              active hikes (the overlay's own controls take over). */}
          {inCrew && isHost && !dropPinMode ? (
            <DropMeetingPointButton
              hasExistingPin={meetingPoint !== null}
              onPress={() => setDropPinMode(true)}
            />
          ) : null}
        </>
      )}

      {/* Drop-pin top banner — host-only, only while in drop mode. */}
      {dropPinMode ? (
        <DropMeetingPointHint onCancel={() => setDropPinMode(false)} />
      ) : null}

      {/* Non-host members with a meeting point but without Always
          permission — surface a dismissable banner so they know
          notifications won't fire. Host already knows. */}
      {inCrew &&
      !isHost &&
      meetingPoint !== null &&
      alwaysStatus !== 'always' ? (
        <AlwaysPermissionBanner />
      ) : null}

      {/* Phase 7.5 — connection lost. Only on the home tab and only
          when in a crew (members' dots are stale without realtime). */}
      {inCrew && !isOnline ? <ConnectionLostBanner /> : null}

      <AlwaysPermissionExplainer
        visible={explainerVisible}
        isWorking={isWorking}
        onAllow={() => void onAllowAlways()}
        onLater={() => void onLater()}
      />
      {selectedMember && selectedPosition ? (
        <MemberDetailCard
          member={selectedMember}
          position={selectedPosition}
          onClose={() => setSelectedMemberId(null)}
        />
      ) : null}

      {inCrew ? <CrewMembersBottomSheet /> : null}

      <StopHikeConfirmModal
        visible={stopModalVisible}
        onClose={() => setStopModalVisible(false)}
      />
      <CreateCrewSheet
        visible={createCrewVisible}
        onClose={() => setCreateCrewVisible(false)}
      />
      <JoinCrewSheet
        visible={joinCrewVisible}
        onClose={() => setJoinCrewVisible(false)}
      />
    </View>
  );
}

/**
 * Surfaced when a meeting point exists but the user is on foreground-only
 * permission, so the geofence can't register and arrival notifications
 * won't fire. Tappable → opens system Settings.
 */
function AlwaysPermissionBanner(): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open settings to enable Always location"
      onPress={() => void Linking.openSettings()}
      style={{
        position: 'absolute',
        top: 64,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#fef3c7',
        borderWidth: 1,
        borderColor: '#fde68a',
      }}
    >
      <Ionicons name="warning-outline" size={18} color="#b45309" />
      <Text style={{ flex: 1, fontSize: 13, color: '#78350f' }}>
        Always location needed for arrival notifications.
      </Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#0f766e' }}>
        Open Settings
      </Text>
    </Pressable>
  );
}
