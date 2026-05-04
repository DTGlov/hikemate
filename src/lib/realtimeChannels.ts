import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type {
  CrewMember,
  CrewStatsBroadcast,
  HikeCrew,
  MeetingPoint,
  MemberPositionBroadcast,
} from '@/types/crew';
import { extractMeetingPoint } from '@/types/crew';

const POSITION_BROADCAST_EVENT = 'position';
const CREW_STATS_BROADCAST_EVENT = 'crew-stats';

export type CrewChannelCallbacks = {
  onMemberJoined: (member: CrewMember) => void;
  onMemberLeft: (userId: string) => void;
  onMemberUpdated: (member: CrewMember) => void;
  onCrewEnded: () => void;
  onMeetingPointChanged: (point: MeetingPoint | null) => void;
  onArrival: (userId: string, arrivedAt: string) => void;
  onPositionBroadcast: (broadcast: MemberPositionBroadcast) => void;
  onCrewStatsBroadcast: (broadcast: CrewStatsBroadcast) => void;
  onPresenceSync: (onlineUserIds: string[]) => void;
};

/**
 * One channel per crew handles four concerns:
 *   1. postgres_changes on room_members (INSERT/UPDATE/DELETE) — join/leave
 *      events and last_known_* sync for late joiners
 *   2. postgres_changes on hike_rooms (UPDATE) — host ending the crew
 *   3. broadcast 'position' — high-frequency live position pings (5s)
 *   4. presence — online/offline tracking, keyed by user_id
 *
 * Returns the channel so callers can broadcast on it and unsubscribe on
 * cleanup. The channel is auto-subscribed; presence.track() runs once
 * SUBSCRIBED status arrives.
 */
export function subscribeToCrew(
  crewId: string,
  myUserId: string,
  callbacks: CrewChannelCallbacks,
): RealtimeChannel {
  const channelName = `crew:${crewId}`;
  console.log('[RT] creating channel', { channelName, myUserId });
  const channel = supabase.channel(channelName, {
    config: { presence: { key: myUserId } },
  });

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'room_members',
        filter: `room_id=eq.${crewId}`,
      },
      (payload) => {
        callbacks.onMemberJoined(payload.new as CrewMember);
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'room_members',
        filter: `room_id=eq.${crewId}`,
      },
      (payload) => {
        callbacks.onMemberUpdated(payload.new as CrewMember);
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'room_members',
        filter: `room_id=eq.${crewId}`,
      },
      (payload) => {
        const old = payload.old as Partial<CrewMember>;
        if (old.user_id) callbacks.onMemberLeft(old.user_id);
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'hike_rooms',
        filter: `id=eq.${crewId}`,
      },
      (payload) => {
        const next = payload.new as HikeCrew;
        if (next.ended_at) callbacks.onCrewEnded();
        callbacks.onMeetingPointChanged(extractMeetingPoint(next));
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'meeting_point_arrivals',
        filter: `room_id=eq.${crewId}`,
      },
      (payload) => {
        const row = payload.new as { user_id: string; arrived_at: string };
        callbacks.onArrival(row.user_id, row.arrived_at);
      },
    )
    .on('broadcast', { event: POSITION_BROADCAST_EVENT }, (payload) => {
      const broadcast = payload.payload as MemberPositionBroadcast;
      console.log('[RT-HANDLERS] broadcast handler invoked', {
        eventType: 'position',
        payload: broadcast,
        isSelf: broadcast.user_id === myUserId,
      });
      // Don't echo our own broadcasts back through this path — the local
      // state already reflects current location via useLocationStore.
      if (broadcast.user_id === myUserId) return;
      callbacks.onPositionBroadcast(broadcast);
    })
    .on('broadcast', { event: CREW_STATS_BROADCAST_EVENT }, (payload) => {
      const broadcast = payload.payload as CrewStatsBroadcast;
      // Skip self — local hike-tracking store is already the source of
      // truth for our own stats.
      if (broadcast.user_id === myUserId) return;
      callbacks.onCrewStatsBroadcast(broadcast);
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const onlineUserIds = Object.keys(state);
      console.log('[RT] presence sync', { channelName, onlineUserIds });
      callbacks.onPresenceSync(onlineUserIds);
    });

  console.log('[RT-HANDLERS] handlers attached, about to subscribe', {
    channelName,
  });
  console.log('[RT] subscribing to channel', { channelName });
  channel.subscribe((status, err) => {
    console.log('[RT] channel status', {
      channelName,
      status,
      channelState: channel.state,
      error: err?.message,
    });
    if (status === 'SUBSCRIBED') {
      void channel
        .track({ user_id: myUserId, joined_at: Date.now() })
        .then((trackResult) => {
          console.log('[RT] presence tracked', { channelName, trackResult });
        })
        .catch((trackErr) => {
          console.warn('[RT] presence track failed', {
            channelName,
            error: trackErr?.message ?? trackErr,
          });
        });
    }
  });
  console.log('[RT-HANDLERS] subscribe() called, returning channel', {
    channelName,
  });

  return channel;
}

export function broadcastPosition(
  channel: RealtimeChannel,
  position: MemberPositionBroadcast,
): void {
  void channel.send({
    type: 'broadcast',
    event: POSITION_BROADCAST_EVENT,
    payload: position,
  });
}

export function broadcastCrewStats(
  channel: RealtimeChannel,
  stats: CrewStatsBroadcast,
): void {
  void channel.send({
    type: 'broadcast',
    event: CREW_STATS_BROADCAST_EVENT,
    payload: stats,
  });
}

export async function teardownChannel(
  channel: RealtimeChannel | null,
): Promise<void> {
  if (!channel) return;
  try {
    await channel.untrack();
  } catch {
    // Best-effort — already untracked or channel already closed.
  }
  await supabase.removeChannel(channel);
}
