import { Ionicons } from '@expo/vector-icons';
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { formatDistanceToNow } from 'date-fns';
import { useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

import { RoomCodeShareButton } from '@/components/room/RoomCodeShareButton';
import { RoomHostControls } from '@/components/room/RoomHostControls';
import { leaveRoom } from '@/hooks/useRoom';
import { haversineMeters } from '@/lib/geo';
import { initialsFromName } from '@/lib/memberColor';
import { formatDistance } from '@/lib/units';
import { useLocationStore } from '@/stores/useLocationStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoomStore } from '@/stores/useRoomStore';
import type { MemberLivePosition, RoomMember } from '@/types/room';

type Row = {
  member: RoomMember;
  position: MemberLivePosition | null;
  isMe: boolean;
};

const SNAP_POINTS: string[] = ['12%', '50%', '90%'];

export function RoomMembersBottomSheet(): React.JSX.Element | null {
  const room = useRoomStore((s) => s.room);
  const members = useRoomStore((s) => s.members);
  const livePositions = useRoomStore((s) => s.livePositions);
  const myUserId = useRoomStore((s) => s.myUserId);
  const isHost = useRoomStore((s) => s.isHost);
  const myLocation = useLocationStore((s) => s.currentLocation);
  const unitSystem = useProfileStore((s) => s.profile?.unit_system ?? 'metric');

  const sheetRef = useRef<BottomSheet>(null);

  const rows: Row[] = useMemo(() => {
    return Object.values(members)
      .map((member) => ({
        member,
        position: livePositions[member.user_id] ?? null,
        isMe: member.user_id === myUserId,
      }))
      .sort((a, b) => {
        // Me first, then host, then alpha by name.
        if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
        const aHost = room?.host_id === a.member.user_id;
        const bHost = room?.host_id === b.member.user_id;
        if (aHost !== bHost) return aHost ? -1 : 1;
        return a.member.display_name.localeCompare(b.member.display_name);
      });
  }, [members, livePositions, myUserId, room?.host_id]);

  if (!room) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      index={1}
      enablePanDownToClose={false}
      backgroundStyle={{ backgroundColor: '#ffffff' }}
      handleIndicatorStyle={{ backgroundColor: '#cbd5e1' }}
    >
      <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wide text-gray-500">
              Room
            </Text>
            <Text className="text-2xl font-bold tracking-[3px] text-teal-700">
              {room.code}
            </Text>
          </View>
          <RoomCodeShareButton code={room.code} />
        </View>
        <View className="mt-3 flex-row gap-2">
          {isHost ? <RoomHostControls /> : null}
          <LeaveRoomButton />
        </View>
      </BottomSheetView>

      <BottomSheetFlatList
        data={rows}
        keyExtractor={(row) => row.member.user_id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-100" />}
        renderItem={({ item }) => (
          <MemberRow
            row={item}
            isHostRow={room.host_id === item.member.user_id}
            myLocation={myLocation}
            unitSystem={unitSystem}
          />
        )}
      />
    </BottomSheet>
  );
}

function MemberRow({
  row,
  isHostRow,
  myLocation,
  unitSystem,
}: {
  row: Row;
  isHostRow: boolean;
  myLocation: { latitude: number; longitude: number } | null;
  unitSystem: 'metric' | 'imperial';
}): React.JSX.Element {
  const { member, position, isMe } = row;
  const isOnline = position?.isOnline ?? false;

  const distanceText = (() => {
    if (isMe || !position || !myLocation) return null;
    const meters = haversineMeters(
      { latitude: myLocation.latitude, longitude: myLocation.longitude },
      { latitude: position.lat, longitude: position.lng },
    );
    return formatDistance(meters, unitSystem);
  })();

  const lastSeenText = (() => {
    if (!position) return 'Hasn’t shared a position yet';
    if (isOnline) return 'Online';
    return `Last seen ${formatDistanceToNow(position.timestamp, { addSuffix: true })}`;
  })();

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${member.display_name}${isHostRow ? ', host' : ''}, ${lastSeenText}`}
      className="flex-row items-center gap-3 py-3"
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: member.color,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isOnline ? 1 : 0.6,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>
          {initialsFromName(member.display_name)}
        </Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            className="text-base font-semibold text-gray-900"
            numberOfLines={1}
          >
            {member.display_name}
            {isMe ? ' (you)' : ''}
          </Text>
          {isHostRow ? (
            <Ionicons name="star" size={14} color="#0f766e" />
          ) : null}
        </View>
        <Text className="text-xs text-gray-500" numberOfLines={1}>
          {lastSeenText}
        </Text>
      </View>
      {distanceText ? (
        <Text className="text-sm font-medium text-gray-600">
          {distanceText}
        </Text>
      ) : null}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: isOnline ? '#22c55e' : '#9ca3af',
        }}
      />
    </View>
  );
}

function LeaveRoomButton(): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Leave room"
      onPress={() => void leaveRoom()}
      className="h-11 flex-row items-center gap-2 rounded-full border border-gray-200 bg-white px-5 active:bg-gray-50"
    >
      <Ionicons name="exit-outline" size={18} color="#374151" />
      <Text className="text-sm font-semibold text-gray-700">Leave</Text>
    </Pressable>
  );
}
