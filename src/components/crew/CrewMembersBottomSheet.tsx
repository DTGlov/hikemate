import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { formatDistanceToNow } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/avatar/Avatar';
import { endCrewAsHost, leaveCrew } from '@/hooks/useCrew';
import { formatDistance, formatDuration, formatPace } from '@/lib/units';
import { useCrewStore } from '@/stores/useCrewStore';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';
import { useProfileStore } from '@/stores/useProfileStore';
import type { MemberLivePosition, CrewMember } from '@/types/crew';
import type { HikeStats } from '@/types/hike';

const SNAP_POINTS: string[] = ['22%', '55%', '92%'];
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
  member: CrewMember;
  position: MemberLivePosition | null;
  stats: HikeStats | null;
  isMe: boolean;
};

function statusLine(position: MemberLivePosition | null): string {
  if (!position) return 'Waiting for first position';
  if (position.isOnline) return 'Online · just now';
  return `Offline · ${formatDistanceToNow(position.timestamp, { addSuffix: true })}`;
}

export function CrewMembersBottomSheet(): React.JSX.Element | null {
  const crew = useCrewStore((s) => s.crew);
  const members = useCrewStore((s) => s.members);
  const livePositions = useCrewStore((s) => s.livePositions);
  const liveStats = useCrewStore((s) => s.liveStats);
  const arrivals = useCrewStore((s) => s.arrivals);
  const myUserId = useCrewStore((s) => s.myUserId);
  const isHost = useCrewStore((s) => s.isHost);
  const unitSystem = useProfileStore((s) => s.profile?.unit_system ?? 'metric');

  // Self stats from the local hike-tracking store — don't wait for our
  // own broadcast to round-trip via the channel.
  const ownTrackingStatus = useHikeTrackingStore((s) => s.status);
  const ownStats = useHikeTrackingStore((s) => s.stats);
  const isSelfTracking =
    ownTrackingStatus === 'tracking' || ownTrackingStatus === 'paused';

  const sheetRef = useRef<BottomSheet>(null);

  const rows: Row[] = useMemo(() => {
    return Object.values(members)
      .map((member) => {
        const isMe = member.user_id === myUserId;
        const stats = isMe
          ? isSelfTracking
            ? ownStats
            : null
          : (liveStats[member.user_id] ?? null);
        return {
          member,
          position: livePositions[member.user_id] ?? null,
          stats,
          isMe,
        };
      })
      .sort((a, b) => {
        if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
        const aHost = crew?.host_id === a.member.user_id;
        const bHost = crew?.host_id === b.member.user_id;
        if (aHost !== bHost) return aHost ? -1 : 1;
        return a.member.display_name.localeCompare(b.member.display_name);
      });
  }, [
    members,
    livePositions,
    liveStats,
    myUserId,
    crew?.host_id,
    isSelfTracking,
    ownStats,
  ]);

  if (!crew) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      index={0}
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
        <CrewHeader code={crew.code} />

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
            isHost={crew.host_id === row.member.user_id}
            arrived={Boolean(arrivals[row.member.user_id])}
            unitSystem={unitSystem}
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

        {isHost ? <EndCrewButton /> : <LeaveCrewButton />}
      </BottomSheetView>
    </BottomSheet>
  );
}

function CrewHeader({ code }: { code: string }): React.JSX.Element {
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
        message: `Join my hike on HikeMate — code ${code}\nhikemate://crew/${code}`,
      });
    } catch (err) {
      console.warn('Share failed', err);
    }
  };

  return (
    <View style={{ flexDirection: 'column', gap: 8, paddingVertical: 16 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 1,
          color: COLOR.muted,
        }}
      >
        CREW
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Copy crew code ${code}`}
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
        accessibilityLabel="Share crew code"
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
        <Text style={{ color: COLOR.white, fontWeight: '600', fontSize: 15 }}>
          Share Code
        </Text>
      </Pressable>
    </View>
  );
}

function MemberRow({
  row,
  isHost: isHostRow,
  arrived,
  unitSystem,
}: {
  row: Row;
  isHost: boolean;
  arrived: boolean;
  unitSystem: 'metric' | 'imperial';
}): React.JSX.Element {
  const { member, position, stats, isMe } = row;
  const isOnline = position?.isOnline ?? false;
  const status = statusLine(position);
  const statsLine = stats
    ? `${formatDistance(stats.distanceMeters, unitSystem)} · ${formatDuration(stats.durationSeconds)} · ${formatPace(stats.currentPaceSecPerKm, unitSystem)}`
    : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
      }}
    >
      <View style={{ opacity: isOnline ? 1 : 0.55 }}>
        <Avatar
          seed={member.avatar_seed}
          displayName={member.display_name}
          fallbackColor={member.color}
          size={44}
          ringColor={member.color}
        />
      </View>

      <View style={{ flex: 1, flexDirection: 'column', gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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
          {arrived ? (
            <View
              accessibilityRole="text"
              accessibilityLabel="Arrived at meeting point"
            >
              <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ fontSize: 12, color: COLOR.muted }}
        >
          {status}
        </Text>
        {statsLine ? (
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              fontSize: 12,
              color: COLOR.brand,
              fontWeight: '500',
            }}
          >
            {statsLine}
          </Text>
        ) : null}
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

function LeaveCrewButton(): React.JSX.Element {
  const [isWorking, setIsWorking] = useState(false);
  const snapshotForSummary = useCrewStore((s) => s.snapshotForSummary);

  const onPress = (): void => {
    // Three options: Cancel / Leave / View Summary. The summary path
    // snapshots the live crew state into useCrewStore.lastEndedCrew
    // BEFORE leaveCrew wipes the live slots — the root layout watches
    // lastEndedCrew and pushes /crew-summary/[roomId] when it appears.
    Alert.alert('Leave crew?', 'You can rejoin anytime with the code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setIsWorking(true);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => undefined,
          );
          await leaveCrew();
          setIsWorking(false);
        },
      },
      {
        text: 'View Summary',
        onPress: async () => {
          setIsWorking(true);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => undefined,
          );
          snapshotForSummary();
          await leaveCrew();
          setIsWorking(false);
        },
      },
    ]);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Leave crew"
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
        Leave Crew
      </Text>
    </Pressable>
  );
}

function EndCrewButton(): React.JSX.Element {
  const [isWorking, setIsWorking] = useState(false);

  const onPress = (): void => {
    Alert.alert(
      'End this crew?',
      'All members will be disconnected. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Crew',
          style: 'destructive',
          onPress: async () => {
            setIsWorking(true);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
              () => undefined,
            );
            const { error } = await endCrewAsHost();
            setIsWorking(false);
            if (error) Alert.alert('Could not end crew', error);
          },
        },
      ],
    );
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="End crew for everyone"
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
        End Crew for Everyone
      </Text>
    </Pressable>
  );
}
