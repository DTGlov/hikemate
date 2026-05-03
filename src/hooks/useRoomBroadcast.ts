import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import { haversineMeters } from '@/lib/geo';
import { broadcastPosition } from '@/lib/realtimeChannels';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useRoomStore } from '@/stores/useRoomStore';

const BROADCAST_INTERVAL_MS = 5_000;
const DB_WRITE_INTERVAL_MS = 60_000;
const DB_WRITE_DISTANCE_M = 50;

/**
 * Pumps the current user's location into the room channel, throttled to
 * 5s, and persists last_known_* to Postgres at most every 60s OR when the
 * user has moved >50m since the last DB write — whichever fires first.
 *
 * The DB write isn't for the live UX (broadcast handles that); it's the
 * snapshot that late joiners see while waiting for the next broadcast.
 */
export function useRoomBroadcast(channel: RealtimeChannel | null): void {
  const room = useRoomStore((s) => s.room);
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const currentLocation = useLocationStore((s) => s.currentLocation);

  const lastBroadcastAtRef = useRef<number>(0);
  const lastDbWriteAtRef = useRef<number>(0);
  const lastDbWritePosRef = useRef<{ lat: number; lng: number } | null>(null);

  // Reset throttling refs whenever the room context changes so we don't
  // carry stale "last broadcast" timestamps between rooms.
  useEffect(() => {
    lastBroadcastAtRef.current = 0;
    lastDbWriteAtRef.current = 0;
    lastDbWritePosRef.current = null;
  }, [room?.id, myUserId]);

  useEffect(() => {
    if (!channel || !room || !myUserId || !currentLocation) return;

    const now = Date.now();

    // Broadcast (5s throttle).
    if (now - lastBroadcastAtRef.current >= BROADCAST_INTERVAL_MS) {
      lastBroadcastAtRef.current = now;
      broadcastPosition(channel, {
        user_id: myUserId,
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
        altitude: null,
        timestamp: now,
      });
    }

    // DB write (60s OR 50m moved).
    const lastWriteAt = lastDbWriteAtRef.current;
    const lastWritePos = lastDbWritePosRef.current;
    const distanceMoved = lastWritePos
      ? haversineMeters(
          { latitude: lastWritePos.lat, longitude: lastWritePos.lng },
          {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          },
        )
      : Infinity;
    const shouldWrite =
      lastWriteAt === 0 ||
      now - lastWriteAt >= DB_WRITE_INTERVAL_MS ||
      distanceMoved >= DB_WRITE_DISTANCE_M;

    if (shouldWrite) {
      lastDbWriteAtRef.current = now;
      lastDbWritePosRef.current = {
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
      };
      void supabase
        .from('room_members')
        .update({
          last_known_lat: currentLocation.latitude,
          last_known_lng: currentLocation.longitude,
          last_seen_at: new Date(now).toISOString(),
        })
        .eq('room_id', room.id)
        .eq('user_id', myUserId);
    }
  }, [channel, room, myUserId, currentLocation]);
}
