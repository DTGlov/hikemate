import { Ionicons } from '@expo/vector-icons';
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetFooter,
  BottomSheetView,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';

import { endRoomAsHost, leaveRoom } from '@/hooks/useRoom';
import { haversineMeters } from '@/lib/geo';
import { initialsFromDisplayName } from '@/lib/displayName';
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

const SNAP_POINTS: string[] = ['18%', '55%', '92%'];
const COPIED_INDICATOR_MS = 1500;

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
        // Me first, then host, then alphabetical.
        if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
        const aHost = room?.host_id === a.member.user_id;
        const bHost = room?.host_id === b.member.user_id;
        if (aHost !== bHost) return aHost ? -1 : 1;
        return a.member.display_name.localeCompare(b.member.display_name);
      });
  }, [members, livePositions, myUserId, room?.host_id]);

  const onlyMember = rows.length === 1 && rows[0]?.isMe;

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View className="border-t border-gray-100 bg-white px-4 py-3">
          {isHost ? <EndRoomButton /> : <LeaveRoomButton />}
        </View>
      </BottomSheetFooter>
    ),
    [isHost],
  );

  if (!room) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      index={1}
      enablePanDownToClose={false}
      backgroundStyle={{ backgroundColor: '#ffffff' }}
      handleIndicatorStyle={{
        backgroundColor: '#cbd5e1',
        width: 36,
        height: 6,
      }}
      footerComponent={renderFooter}
    >
      <BottomSheetView style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        <RoomHeader code={room.code} />
        <View className="my-4 h-px bg-gray-100" />
        <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Members · {rows.length}
        </Text>
      </BottomSheetView>

      <BottomSheetFlatList
        data={rows}
        keyExtractor={(row) => row.member.user_id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 96, // space for sticky footer
        }}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-100" />}
        renderItem={({ item }) => (
          <MemberRow
            row={item}
            isHostRow={room.host_id === item.member.user_id}
            myLocation={myLocation}
            unitSystem={unitSystem}
          />
        )}
        ListFooterComponent={
          onlyMember ? (
            <Text className="mt-4 text-center text-sm italic text-gray-500">
              Waiting for hikers to join…
            </Text>
          ) : null
        }
      />
    </BottomSheet>
  );
}

function RoomHeader({ code }: { code: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), COPIED_INDICATOR_MS);
    return (): void => clearTimeout(id);
  }, [copied]);

  const onCopy = async (): Promise<void> => {
    await Clipboard.setStringAsync(code);
    void Haptics.selectionAsync().catch(() => undefined);
    setCopied(true);
  };

  const onShare = async (): Promise<void> => {
    void Haptics.selectionAsync().catch(() => undefined);
    try {
      await Share.share({
        message: `Join my hike on HikeMate — code ${code}\nhikemate://room/${code}`,
      });
    } catch (err) {
      console.warn('Share failed', err);
    }
  };

  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Room
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Copy room code ${code}`}
        onPress={() => void onCopy()}
        className="self-start active:opacity-70"
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            letterSpacing: 4,
            fontFamily: 'Menlo',
            color: '#0f766e',
          }}
        >
          {code}
        </Text>
        <Text className="mt-0.5 text-xs text-gray-500">
          {copied ? 'Code copied' : 'Tap to copy'}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share room code"
        onPress={() => void onShare()}
        className="mt-1 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-teal-700 active:bg-teal-800"
      >
        <Ionicons name="share-outline" size={18} color="#ffffff" />
        <Text className="text-base font-semibold text-white">Share Code</Text>
      </Pressable>
    </View>
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

  const statusText = (() => {
    if (!position) return 'Hasn’t shared a position yet';
    if (isOnline) return 'Online · just now';
    return `Offline · ${formatDistanceToNow(position.timestamp, { addSuffix: true })}`;
  })();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${member.display_name}${isMe ? ', you' : ''}${isHostRow ? ', host' : ''}, ${statusText}`}
      android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
      style={{ minHeight: 44 }}
      className="flex-row items-center gap-3 py-3 active:bg-gray-50"
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: member.color,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isOnline ? 1 : 0.55,
        }}
      >
        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>
          {initialsFromDisplayName(member.display_name)}
        </Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="flex-shrink text-base font-semibold text-gray-900"
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
          {statusText}
        </Text>
      </View>
      {distanceText ? (
        <Text className="text-sm font-medium text-gray-600">
          {distanceText}
        </Text>
      ) : null}
      <View
        accessibilityElementsHidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: member.color,
        }}
      />
    </Pressable>
  );
}

function LeaveRoomButton(): React.JSX.Element {
  const [isWorking, setIsWorking] = useState(false);

  const onPress = (): void => {
    Alert.alert('Leave room?', 'You can rejoin anytime with the code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setIsWorking(true);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => undefined,
          );
          await leaveRoom();
          setIsWorking(false);
        },
      },
    ]);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Leave room"
      disabled={isWorking}
      onPress={onPress}
      className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-red-200 bg-white active:bg-red-50"
    >
      <Ionicons name="exit-outline" size={18} color="#dc2626" />
      <Text className="text-base font-semibold text-red-600">Leave Room</Text>
    </Pressable>
  );
}

function EndRoomButton(): React.JSX.Element {
  const [isWorking, setIsWorking] = useState(false);

  const onPress = (): void => {
    Alert.alert(
      'End this room?',
      'All members will be disconnected. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Room',
          style: 'destructive',
          onPress: async () => {
            setIsWorking(true);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
              () => undefined,
            );
            const { error } = await endRoomAsHost();
            setIsWorking(false);
            if (error) Alert.alert('Could not end room', error);
          },
        },
      ],
    );
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="End room for everyone"
      disabled={isWorking}
      onPress={onPress}
      className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-red-200 bg-white active:bg-red-50"
    >
      <Ionicons name="stop-circle-outline" size={18} color="#dc2626" />
      <Text className="text-base font-semibold text-red-600">
        End Room for Everyone
      </Text>
    </Pressable>
  );
}
