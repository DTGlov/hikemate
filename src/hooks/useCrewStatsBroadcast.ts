import { useEffect, useRef } from 'react';

import { broadcastCrewStats } from '@/lib/realtimeChannels';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCrewStore } from '@/stores/useCrewStore';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';
import type { HikeStatus } from '@/types/hike';

const STATS_BROADCAST_INTERVAL_MS = 10_000;

/**
 * Phase 6.5 — Hybrid Crew Stats.
 *
 * While the user is in a crew AND actively tracking a hike, broadcast
 * their current HikeStats every 10 seconds on the crew channel. When
 * tracking ends (status leaves 'tracking' for any reason — paused,
 * idle, saving), fire a one-shot { stopped: true } broadcast so peers
 * remove the entry from their `liveStats` map.
 *
 * Position broadcasts (5s) and stats broadcasts (10s) share the channel
 * but use different events; throttling is independent.
 *
 * Mounted once at the root layout — no behavior unless a crew exists
 * AND the user is actively tracking.
 */
export function useCrewStatsBroadcast(): void {
  const channel = useCrewStore((s) => s.channel);
  const crew = useCrewStore((s) => s.crew);
  const myUserId = useAuthStore((s) => s.user?.id ?? null);

  const status = useHikeTrackingStore((s) => s.status);
  const stats = useHikeTrackingStore((s) => s.stats);

  const lastBroadcastAtRef = useRef<number>(0);
  const prevStatusRef = useRef<HikeStatus>('idle');
  const stoppedSignalSentRef = useRef<boolean>(false);

  // Reset throttling when the crew or the user changes — different
  // crew/user pair, fresh broadcast cadence.
  useEffect(() => {
    lastBroadcastAtRef.current = 0;
    stoppedSignalSentRef.current = false;
  }, [crew?.id, myUserId]);

  useEffect(() => {
    const wasTracking = prevStatusRef.current === 'tracking';
    const isTracking = status === 'tracking';
    prevStatusRef.current = status;

    if (!channel || !crew || !myUserId) return;

    // tracking → not-tracking: one-shot stopped broadcast so other
    // members' UI removes our stats immediately. Only send once per
    // active stretch (until the next start).
    if (wasTracking && !isTracking && !stoppedSignalSentRef.current) {
      stoppedSignalSentRef.current = true;
      broadcastCrewStats(channel, {
        user_id: myUserId,
        stopped: true,
        timestamp: Date.now(),
      });
      return;
    }

    if (!isTracking) return;

    // We're actively tracking. Reset the stopped guard so the next
    // tracking → not-tracking transition can fire its signal.
    stoppedSignalSentRef.current = false;

    const now = Date.now();
    if (now - lastBroadcastAtRef.current < STATS_BROADCAST_INTERVAL_MS) {
      return;
    }
    lastBroadcastAtRef.current = now;
    broadcastCrewStats(channel, {
      user_id: myUserId,
      distance_meters: stats.distanceMeters,
      duration_seconds: stats.durationSeconds,
      current_pace_sec_per_km: stats.currentPaceSecPerKm,
      elevation_gain_meters: stats.elevationGainMeters,
      timestamp: now,
    });
  }, [channel, crew, myUserId, status, stats]);
}
