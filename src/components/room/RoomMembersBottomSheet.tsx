import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { formatDistanceToNow } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';

import { endRoomAsHost, leaveRoom } from '@/hooks/useRoom';
import { initialsFromDisplayName } from '@/lib/displayName';
import { useRoomStore } from '@/stores/useRoomStore';
import type { MemberLivePosition, RoomMember } from '@/types/room';

const SNAP_POINTS: string[] = ['18%', '55%', '92%'];
const COPIED_INDICATOR_MS = 1500;

const COLOR = {
  text: '#111827',
  muted: '#6b7280',
  divider: '#e5e7eb',
  brand: '#0f766e',
  brandActive: '#0e6b63',
  danger: '#dc2626',
  dangerBorder: '#fecaca',
  white: '#ffffff',
};

type Row = {
  member: RoomMember;
  position: MemberLivePosition | null;
  isMe: boolean;
};

function statusLine(position: MemberLivePosition | null): string {
  if (!position) return 'Waiting for first position';
  if (position.isOnline) return 'Online · just now';
  return `Offline · ${formatDistanceToNow(position.timestamp, { addSuffix: true })}`;
}

export function RoomMembersBottomSheet(): React.JSX.Element | null {
  const room = useRoomStore((s) => s.room);
  const members = useRoomStore((s) => s.members);
  const livePositions = useRoomStore((s) => s.livePositions);
  const myUserId = useRoomStore((s) => s.myUserId);
  const isHost = useRoomStore((s) => s.isHost);

  const sheetRef = useRef<BottomSheet>(null);

  const rows: Row[] = useMemo(() => {
    return Object.values(members)
      .map((member) => ({
        member,
        position: livePositions[member.user_id] ?? null,
        isMe: member.user_id === myUserId,
      }))
      .sort((a, b) => {
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
      backgroundStyle={{ backgroundColor: COLOR.white }}
      handleIndicatorStyle={{
        backgroundColor: '#cbd5e1',
        width: 36,
        height: 6,
      }}
    >
      <BottomSheetView
        style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}
      >
        <RoomHeader code={room.code} />

        <View
          style={{
            height: 1,
            backgroundColor: COLOR.divider,
            marginVertical: 8,
          }}
        />

        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 1,
            color: COLOR.muted,
            marginVertical: 12,
          }}
        >
          MEMBERS · {rows.length}
        </Text>

        {rows.map((row) => (
          <MemberRow
            key={row.member.user_id}
            row={row}
            isHost={room.host_id === row.member.user_id}
          />
        ))}

        {rows.length === 1 ? (
          <Text
            style={{
              fontSize: 14,
              color: COLOR.muted,
              fontStyle: 'italic',
              marginVertical: 16,
              textAlign: 'center',
            }}
          >
            Waiting for hikers to join…
          </Text>
        ) : null}

        <View style={{ flex: 1 }} />

        <View
          style={{
            height: 1,
            backgroundColor: COLOR.divider,
            marginVertical: 8,
          }}
        />

        {isHost ? <EndRoomButton /> : <LeaveRoomButton />}
      </BottomSheetView>
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
    <View
      style={{ flexDirection: 'column', gap: 8, paddingVertical: 16 }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 1,
          color: COLOR.muted,
        }}
      >
        ROOM
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Copy room code ${code}`}
        onPress={() => void onCopy()}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Text
          style={{
            fontFamily: 'Menlo',
            fontSize: 24,
            fontWeight: '700',
            letterSpacing: 2,
            color: COLOR.brand,
          }}
        >
          {code}
        </Text>
        <Text style={{ fontSize: 12, color: COLOR.muted }}>
          {copied ? 'Code copied' : 'Tap to copy'}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share room code"
        onPress={() => void onShare()}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          height: 44,
          borderRadius: 10,
          backgroundColor: pressed ? COLOR.brandActive : COLOR.brand,
        })}
      >
        <Text
          style={{ color: COLOR.white, fontWeight: '600', fontSize: 15 }}
        >
          Share Code
        </Text>
      </Pressable>
    </View>
  );
}

function MemberRow({
  row,
  isHost: isHostRow,
}: {
  row: Row;
  isHost: boolean;
}): React.JSX.Element {
  const { member, position, isMe } = row;
  const isOnline = position?.isOnline ?? false;
  const status = statusLine(position);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
      }}
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
        <Text style={{ color: COLOR.white, fontWeight: '700', fontSize: 14 }}>
          {initialsFromDisplayName(member.display_name)}
        </Text>
      </View>

      <View style={{ flex: 1, flexDirection: 'column', gap: 2 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: '500',
              color: COLOR.text,
            }}
          >
            {member.display_name}
            {isMe ? ' (you)' : ''}
          </Text>
          {isHostRow ? <Text style={{ fontSize: 14 }}>⭐</Text> : null}
        </View>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ fontSize: 12, color: COLOR.muted }}
        >
          {status}
        </Text>
      </View>

      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: member.color,
        }}
      />
    </View>
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
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLOR.dangerBorder,
        marginVertical: 8,
        backgroundColor: pressed ? '#fef2f2' : COLOR.white,
        opacity: isWorking ? 0.6 : 1,
      })}
    >
      <Text style={{ color: COLOR.danger, fontWeight: '600', fontSize: 16 }}>
        Leave Room
      </Text>
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
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLOR.dangerBorder,
        marginVertical: 8,
        backgroundColor: pressed ? '#fef2f2' : COLOR.white,
        opacity: isWorking ? 0.6 : 1,
      })}
    >
      <Text style={{ color: COLOR.danger, fontWeight: '600', fontSize: 16 }}>
        End Room for Everyone
      </Text>
    </Pressable>
  );
}
